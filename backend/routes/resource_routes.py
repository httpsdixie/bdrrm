"""
Resource Tracking — COA Property Management
Barangay Linao BDRRMC

Fields per COA compliance:
  - Property Number (property_code)  — barangay-assigned, unique
  - Description (name)
  - Acquisition Date
  - Estimated Life (years)
  - Responsibility Center             — always "Linao BDRRMC", never user-editable
  - Acquisition Cost
  - Accumulated Depreciation
  - Net Book Value                    — always computed server-side: cost − acc_dep

Status values: available | maintenance | damaged | borrowed
"""

from typing import Optional
from datetime import datetime, timezone
import random, string

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, root_validator, validator

from ..auth.dependencies import get_current_user
from ..database import supabase

router = APIRouter(prefix="/resources", tags=["Resources"])

# Hardcoded — this system belongs to Linao BDRRMC, they own every asset.
RESPONSIBILITY_CENTER = "Linao BDRRMC"


# ── helpers ──────────────────────────────────────────────────────────────────

def _gen_code() -> str:
    year = datetime.now(timezone.utc).year
    suffix = ''.join(random.choices(string.digits, k=4))
    return f"BRG-{year}-{suffix}"


def _unique_code() -> str:
    for _ in range(30):
        code = _gen_code()
        if not supabase.table("resources").select("id").eq("property_code", code).execute().data:
            return code
    raise HTTPException(500, "Could not generate a unique property code.")


def _compute_nbv(acquisition_cost: float, accumulated_depreciation: float) -> float:
    """Net Book Value = Acquisition Cost − Accumulated Depreciation (floor 0)."""
    return round(max(0.0, acquisition_cost - accumulated_depreciation), 2)


def _normalize(item: dict) -> dict:
    """Always enforce responsibility_center and recompute NBV."""
    if not item:
        return item
    item["responsibility_center"] = RESPONSIBILITY_CENTER
    cost   = float(item.get("acquisition_cost") or 0)
    acc    = float(item.get("accumulated_depreciation") or 0)
    item["net_book_value"] = _compute_nbv(cost, acc)
    return item


def _log(
    *,
    resource_id: Optional[str],
    resource_name: str,
    event_type: str,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    description: str,
    performed_by: Optional[str] = None,
    performed_by_name: Optional[str] = None,
):
    """Write to resource_logs — non-fatal."""
    try:
        supabase.table("resource_logs").insert({
            "resource_id":       resource_id,
            "resource_name":     resource_name,
            "event_type":        event_type,
            "old_status":        old_status,
            "new_status":        new_status,
            "description":       description,
            "performed_by":      performed_by,
            "performed_by_name": performed_by_name,
            "created_at":        datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception:
        pass


# ── schemas ───────────────────────────────────────────────────────────────────

class ResourceCreate(BaseModel):
    property_code:            Optional[str]   = None   # auto-generated if blank
    name:                     str             = Field(..., min_length=1)
    acquisition_date:         Optional[str]   = None   # YYYY-MM-DD
    estimated_life:           Optional[float] = Field(default=5.0, ge=0)
    acquisition_cost:         float           = Field(default=0.0, ge=0)
    accumulated_depreciation: float           = Field(default=0.0, ge=0)

    @validator("accumulated_depreciation")
    def acc_dep_le_cost(cls, v, values):
        cost = values.get("acquisition_cost", 0) or 0
        if v > cost:
            raise ValueError("Accumulated depreciation cannot exceed acquisition cost.")
        return v


class ResourceUpdate(BaseModel):
    property_code:            Optional[str]   = None
    name:                     Optional[str]   = None
    acquisition_date:         Optional[str]   = None
    estimated_life:           Optional[float] = Field(default=None, ge=0)
    acquisition_cost:         Optional[float] = Field(default=None, ge=0)
    accumulated_depreciation: Optional[float] = Field(default=None, ge=0)


class StatusUpdate(BaseModel):
    status: str    # available | maintenance | damaged | borrowed
    notes:  Optional[str] = None   # who borrowed, damage description, etc.

    @validator("status")
    def valid_status(cls, v):
        allowed = {"available", "maintenance", "damaged", "borrowed"}
        if v not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(sorted(allowed))}")
        return v

    @root_validator(skip_on_failure=True)
    def notes_required_for_sensitive_statuses(cls, values):
        status = values.get("status")
        notes = (values.get("notes") or "").strip()
        if status in {"borrowed", "damaged"} and not notes:
            raise ValueError("Notes are required when setting status to 'borrowed' or 'damaged'.")
        return values


# ── routes ────────────────────────────────────────────────────────────────────

@router.get("/generate/code")
def generate_code(current_user: dict = Depends(get_current_user)):
    """Return a new unique property code."""
    return {"property_code": _unique_code()}


@router.get("/")
def list_resources(current_user: dict = Depends(get_current_user)):
    result = supabase.table("resources").select("*").order("name").execute()
    return [_normalize(r) for r in (result.data or [])]


@router.get("/logs")
def list_logs(
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    # Only return events written by this module (added, updated, status_changed, archived).
    # Rows with event_types like 'dispatched', 'restocked', 'returned', 'maintenance' are
    # legacy/other-module entries that don't belong in the Resources activity log.
    result = (
        supabase.table("resource_logs")
        .select("*")
        .in_("event_type", ["added", "updated", "status_changed", "archived"])
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


@router.get("/{resource_id}")
def get_resource(resource_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("resources").select("*").eq("id", resource_id).single().execute()
    if not result.data:
        raise HTTPException(404, "Resource not found")
    return _normalize(result.data)


@router.post("/", status_code=201)
def create_resource(body: ResourceCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(403, "Insufficient permissions")

    code = (body.property_code or "").strip() or _unique_code()

    if supabase.table("resources").select("id").eq("property_code", code).execute().data:
        raise HTTPException(409, f"Property code '{code}' is already in use.")

    nbv = _compute_nbv(body.acquisition_cost, body.accumulated_depreciation)

    payload = {
        "property_code":            code,
        "name":                     body.name.strip(),
        "type":                     "other",               # required NOT NULL; COA mode doesn't categorize by type
        "acquisition_date":         body.acquisition_date or None,
        "estimated_life":           body.estimated_life,
        "responsibility_center":    RESPONSIBILITY_CENTER,  # always hardcoded
        "acquisition_cost":         body.acquisition_cost,
        "accumulated_depreciation": body.accumulated_depreciation,
        "net_book_value":           nbv,
        "status":                   "available",
    }

    try:
        result = supabase.table("resources").insert(payload).execute()
    except Exception as e:
        raise HTTPException(500, f"Database insert failed: {e}")
    if not result.data:
        raise HTTPException(500, "Insert returned no data.")
    created = _normalize(result.data[0])

    _log(
        resource_id=created["id"],
        resource_name=created["name"],
        event_type="added",
        new_status="available",
        description=f"New asset added. Property Code: {code}. Acquisition Cost: ₱{body.acquisition_cost:,.2f}.",
        performed_by=current_user.get("sub"),
        performed_by_name=current_user.get("full_name"),
    )
    return created


@router.patch("/{resource_id}")
def update_resource(
    resource_id: str,
    body: ResourceUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update COA accounting fields or description. Does NOT change status — use /status for that."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(403, "Insufficient permissions")

    res = supabase.table("resources").select("*").eq("id", resource_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Resource not found")

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")

    # Always recompute NBV after any cost/depreciation change
    cost = float(updates.get("acquisition_cost", res.data.get("acquisition_cost") or 0))
    acc  = float(updates.get("accumulated_depreciation", res.data.get("accumulated_depreciation") or 0))
    updates["net_book_value"] = _compute_nbv(cost, acc)

    # Responsibility center is never updated from the outside
    updates.pop("responsibility_center", None)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = supabase.table("resources").update(updates).eq("id", resource_id).execute()
    if not result.data:
        raise HTTPException(404, "Resource not found")

    updated = _normalize(result.data[0])
    _log(
        resource_id=resource_id,
        resource_name=updated["name"],
        event_type="updated",
        description=f"Asset details updated. Fields changed: {', '.join(updates.keys())}.",
        performed_by=current_user.get("sub"),
        performed_by_name=current_user.get("full_name"),
    )
    return updated


@router.patch("/{resource_id}/status")
def update_status(
    resource_id: str,
    body: StatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update the status of a resource (available / maintenance / damaged / borrowed)."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(403, "Insufficient permissions")

    res = supabase.table("resources").select("id,name,status").eq("id", resource_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Resource not found")

    old_status = res.data.get("status")
    result = supabase.table("resources").update({
        "status":       body.status,
        "status_notes": body.notes or None,
        "updated_at":   datetime.now(timezone.utc).isoformat(),
    }).eq("id", resource_id).execute()

    if not result.data:
        raise HTTPException(404, "Resource not found")

    updated = _normalize(result.data[0])
    _log(
        resource_id=resource_id,
        resource_name=updated["name"],
        event_type="status_changed",
        old_status=old_status,
        new_status=body.status,
        description=f"Status changed from '{old_status}' to '{body.status}'.{(' Notes: ' + body.notes) if body.notes else ''}",
        performed_by=current_user.get("sub"),
        performed_by_name=current_user.get("full_name"),
    )
    return updated


@router.delete("/{resource_id}", status_code=204)
def delete_resource(resource_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a resource. Admin only."""
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")

    res = supabase.table("resources").select("name").eq("id", resource_id).single().execute()
    name = (res.data or {}).get("name", "Unknown")

    supabase.table("resources").delete().eq("id", resource_id).execute()
    _log(
        resource_id=None,
        resource_name=name,
        event_type="archived",
        description="Asset removed from inventory by admin.",
        performed_by=current_user.get("sub"),
        performed_by_name=current_user.get("full_name"),
    )
