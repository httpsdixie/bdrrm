from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from ..database import supabase
from ..auth.dependencies import get_current_user
from datetime import datetime, timezone
import random, string

router = APIRouter(prefix="/assets", tags=["Asset Units"])


# ===== Helpers =====

def _generate_property_code() -> str:
    """Generate a property code in format BRG-YYYY-XXXX."""
    year = datetime.now(timezone.utc).year
    suffix = ''.join(random.choices(string.digits, k=4))
    return f"BRG-{year}-{suffix}"


def _unique_property_code() -> str:
    """Keep generating until we find one not yet in the DB."""
    for _ in range(20):
        code = _generate_property_code()
        existing = (
            supabase.table("asset_units")
            .select("id")
            .eq("property_code", code)
            .execute()
        )
        if not existing.data:
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate a unique property code, please try again.",
    )


# ===== Schemas =====

class AssetUnitCreate(BaseModel):
    resource_id: str
    property_code: Optional[str] = None   # auto-generated if omitted
    serial_number: Optional[str] = None
    condition: Optional[str] = "good"     # new, good, fair, poor, condemned
    status: Optional[str] = "available"   # available, deployed, maintenance, retired
    acquisition_date: Optional[str] = None
    acquisition_source: Optional[str] = None
    notes: Optional[str] = None


class AssetUnitUpdate(BaseModel):
    property_code: Optional[str] = None
    serial_number: Optional[str] = None
    condition: Optional[str] = None
    status: Optional[str] = None
    acquisition_date: Optional[str] = None
    acquisition_source: Optional[str] = None
    notes: Optional[str] = None
    last_deployed_incident_id: Optional[str] = None
    last_deployed_at: Optional[str] = None
    last_maintained_at: Optional[str] = None
    retired_at: Optional[str] = None


# ===== Routes =====

@router.get("/")
def get_all_assets(
    resource_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List all asset units, optionally filtered by resource, status, or search term."""
    query = (
        supabase.table("asset_units")
        .select("*, resources(name, type, category)")
        .order("property_code")
    )
    if resource_id:
        query = query.eq("resource_id", resource_id)
    if status_filter:
        query = query.eq("status", status_filter)

    result = query.execute()
    data = result.data or []

    if search:
        s = search.lower()
        data = [
            a for a in data
            if s in (a.get("property_code") or "").lower()
            or s in (a.get("serial_number") or "").lower()
            or s in (a.get("acquisition_source") or "").lower()
            or s in ((a.get("resources") or {}).get("name") or "").lower()
        ]
    return data


@router.get("/summary")
def get_asset_summary(current_user: dict = Depends(get_current_user)):
    """Count assets by status for dashboard stats."""
    result = supabase.table("asset_units").select("status").execute()
    data = result.data or []
    summary = {"total": len(data), "available": 0, "deployed": 0, "maintenance": 0, "retired": 0}
    for a in data:
        s = a.get("status", "available")
        if s in summary:
            summary[s] += 1
    return summary


@router.get("/{asset_id}")
def get_asset(asset_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single asset unit by ID."""
    result = (
        supabase.table("asset_units")
        .select("*, resources(name, type, category)")
        .eq("id", asset_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Asset unit not found")
    return result.data


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_asset(body: AssetUnitCreate, current_user: dict = Depends(get_current_user)):
    """Register a new serialized asset unit."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    prop_code = (body.property_code or "").strip() or _unique_property_code()

    # Check property code uniqueness
    existing = (
        supabase.table("asset_units")
        .select("id")
        .eq("property_code", prop_code)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Property code '{prop_code}' is already in use.",
        )

    payload = {
        "resource_id": body.resource_id,
        "property_code": prop_code,
        "serial_number": body.serial_number or None,
        "condition": body.condition or "good",
        "status": body.status or "available",
        "acquisition_date": body.acquisition_date or None,
        "acquisition_source": body.acquisition_source or None,
        "notes": body.notes or None,
        "created_by": current_user["sub"],
    }

    result = supabase.table("asset_units").insert(payload).execute()
    return result.data[0]


@router.patch("/{asset_id}")
def update_asset(
    asset_id: str,
    body: AssetUnitUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an asset unit's details or status."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # If retiring, stamp retired_at automatically
    if updates.get("status") == "retired" and not updates.get("retired_at"):
        updates["retired_at"] = datetime.now(timezone.utc).isoformat()

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("asset_units")
        .update(updates)
        .eq("id", asset_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Asset unit not found")
    return result.data[0]


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an asset unit record. Admin only."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    supabase.table("asset_units").delete().eq("id", asset_id).execute()


@router.get("/generate/code")
def generate_code(current_user: dict = Depends(get_current_user)):
    """Return a new unique auto-generated property code."""
    return {"property_code": _unique_property_code()}
