from enum import Enum
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator

from ..auth.dependencies import get_current_user
from ..database import supabase
from datetime import datetime, timezone
import json
import random
import string

router = APIRouter(prefix="/resources", tags=["Resources"])


# ===== Domain Enums =====

class ResourceType(str, Enum):
    rescue_boat = "rescue_boat"
    medical_kit = "medical_kit"
    food_pack = "food_pack"
    tent = "tent"
    vehicle = "vehicle"
    ambulance = "ambulance"
    fire_truck = "fire_truck"
    fuel = "fuel"
    other = "other"


class ResourceStatus(str, Enum):
    available = "available"
    deployed = "deployed"
    maintenance = "maintenance"
    damaged = "damaged"
    unavailable = "unavailable"
    retired = "retired"
    archived = "archived"


class ResourceCategory(str, Enum):
    disaster = "disaster"
    fire = "fire"
    medical = "medical"
    emergency = "emergency"
    police = "police"
    other = "other"


# ===== Helpers =====

def _generate_property_code() -> str:
    year = datetime.now(timezone.utc).year
    suffix = ''.join(random.choices(string.digits, k=4))
    return f"BRG-{year}-{suffix}"


def _unique_property_code() -> str:
    """Try up to 30 times to find a code not yet in the DB."""
    for _ in range(30):
        code = _generate_property_code()
        existing = supabase.table("resources").select("id").eq("property_code", code).execute()
        if not existing.data:
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique property code.")


def _write_log(
    *,
    resource_id: Optional[str],
    resource_name: str,
    resource_type: str,
    event_type: str,
    qty_change: int = 0,
    qty_before: Optional[int] = None,
    qty_after: Optional[int] = None,
    new_status: Optional[str] = None,
    reference_id: Optional[str] = None,
    description: str,
    performed_by: Optional[str] = None,
    performed_by_name: Optional[str] = None,
):
    """Insert a resource activity log entry. Non-fatal on failure."""
    try:
        supabase.table("resource_logs").insert({
            "resource_id":       resource_id,
            "resource_name":     resource_name,
            "resource_type":     resource_type,
            "event_type":        event_type,
            "qty_change":        qty_change,
            "qty_before":        qty_before,
            "qty_after":         qty_after,
            "new_status":        new_status,
            "reference_id":      reference_id,
            "description":       description,
            "performed_by":      performed_by,
            "performed_by_name": performed_by_name,
            "created_at":        datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception:
        pass  # Log failure should never break the main operation


# ===== Schemas =====

class ResourceCreate(BaseModel):
    # Make name/type/quantity optional so COA-only submissions are allowed from the simplified form
    name: Optional[str] = None
    type: Optional[ResourceType] = None
    quantity: Optional[int] = Field(default=0)
    location: Optional[str] = None
    category: Optional[ResourceCategory] = None
    applicable_hazards: List[str] = Field(default_factory=list)
    ownership_tier: str = Field(default="barangay")
    property_code: Optional[str] = None   # auto-generated if omitted
    serial_number: Optional[str] = None   # manufacturer serial (optional)
    # COA Accounting & Asset Management Fields
    acquisition_date: Optional[str] = None
    estimated_life: Optional[float] = Field(default=5.0)
    responsibility_center: Optional[str] = Field(default="BDRRMC Operations")
    acquisition_cost: Optional[float] = Field(default=0.0)
    accumulated_depreciation: Optional[float] = Field(default=0.0)
    net_book_value: Optional[float] = Field(default=0.0)

    @validator("quantity")
    def validate_quantity(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("Quantity must be 0 or greater")
        return value


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ResourceType] = None
    quantity: Optional[int] = None
    available_quantity: Optional[int] = None
    location: Optional[str] = None
    status: Optional[ResourceStatus] = None
    category: Optional[ResourceCategory] = None
    applicable_hazards: Optional[List[str]] = None
    ownership_tier: Optional[str] = None
    property_code: Optional[str] = None
    serial_number: Optional[str] = None
    maintenance_notes: Optional[str] = None   # description for damage/maintenance status
    # COA Accounting & Asset Management Fields
    acquisition_date: Optional[str] = None
    estimated_life: Optional[float] = None
    responsibility_center: Optional[str] = None
    acquisition_cost: Optional[float] = None
    accumulated_depreciation: Optional[float] = None
    net_book_value: Optional[float] = None

    @validator("quantity", "available_quantity", "estimated_life", "acquisition_cost", "accumulated_depreciation", "net_book_value")
    def non_negative_values(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("Numeric fields cannot be negative")
        return value


class DispatchCreate(BaseModel):
    resource_id: str
    incident_id: Optional[str] = None
    quantity_dispatched: int
    borrower_name: Optional[str] = None     # who is borrowing the equipment
    borrower_contact: Optional[str] = None  # their contact number
    destination: Optional[str] = None       # where the equipment is being deployed
    purpose: Optional[str] = None           # reason / purpose
    due_date: Optional[str] = None          # expected return date YYYY-MM-DD
    notes: Optional[str] = None

    @validator("quantity_dispatched")
    def validate_dispatch_quantity(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Dispatched quantity must be greater than 0")
        return value


def _generate_ticket_id() -> str:
    year = datetime.now(timezone.utc).year
    suffix = ''.join(random.choices(string.digits, k=4))
    return f"DSP-{year}-{suffix}"


def _unique_ticket_id() -> str:
    for _ in range(30):
        tid = _generate_ticket_id()
        existing = supabase.table("resource_dispatch").select("id").eq("ticket_id", tid).execute()
        if not existing.data:
            return tid
    return _generate_ticket_id()  # fallback, collision unlikely


class ReturnDispatch(BaseModel):
    notes: Optional[str] = None


def _get_resource_by_id(resource_id: str) -> Optional[dict]:
    result = (
        supabase.table("resources")
        .select("*")
        .eq("id", resource_id)
        .single()
        .execute()
    )
    return result.data


def _normalize_applicable_hazards(hazards: Optional[List[str] | str]) -> List[str]:
    if hazards is None:
        return []
    if isinstance(hazards, str):
        try:
            hazards = json.loads(hazards)
        except Exception:
            hazards = [h.strip() for h in hazards.split(",") if h.strip()]
    if isinstance(hazards, list):
        return [str(h).strip() for h in hazards if str(h).strip()]
    return [str(hazards).strip()]


def _resolve_default_category(category: Optional[str], hazards: List[str]) -> str:
    if category:
        return category
    if hazards:
        first = hazards[0]
        if first == "general_emergency":
            return ResourceCategory.emergency.value
        return first
    return ResourceCategory.emergency.value


def _normalize_resource(item: dict) -> dict:
    if not item or not isinstance(item, dict):
        return item

    hazards = _normalize_applicable_hazards(item.get("applicable_hazards"))
    category = item.get("category") or _resolve_default_category(None, hazards)
    item["applicable_hazards"] = hazards or [category]
    item["category"] = category

    # Calculate COA Depreciation and Net Book Value
    cost = float(item.get("acquisition_cost") or 0.0)
    life = float(item.get("estimated_life") or 5.0)
    acq_date_str = item.get("acquisition_date")

    if cost > 0 and life > 0 and acq_date_str:
        try:
            acq_dt = datetime.fromisoformat(acq_date_str.replace("Z", "+00:00"))
            now_dt = datetime.now(timezone.utc)
            years = max(0.0, (now_dt - acq_dt).days / 365.25)
            annual_dep = cost / life
            acc_dep = min(cost, annual_dep * years)
            nbv = max(0.0, cost - acc_dep)
            item["accumulated_depreciation"] = round(acc_dep, 2)
            item["net_book_value"] = round(nbv, 2)
        except Exception:
            pass
    elif cost > 0 and item.get("accumulated_depreciation") is not None:
        acc = float(item.get("accumulated_depreciation") or 0.0)
        item["net_book_value"] = max(0.0, round(cost - acc, 2))

    return item


# ===== Resource Routes =====

@router.get("/generate/code")
def generate_resource_code(current_user: dict = Depends(get_current_user)):
    """Return a new unique auto-generated property code."""
    return {"property_code": _unique_property_code()}


@router.get("/")
def get_all_resources(current_user: dict = Depends(get_current_user)):
    """Get all resources ordered by name."""
    result = (
        supabase.table("resources")
        .select("*")
        .order("name")
        .execute()
    )
    items = result.data or []
    return [_normalize_resource(item) for item in items]


@router.get("/logs")
def get_resource_logs(
    current_user: dict = Depends(get_current_user),
    event_type: Optional[str] = None,   # filter by event type
    resource_type: Optional[str] = None, # filter by resource type
    date_from: Optional[str] = None,    # ISO date string YYYY-MM-DD
    date_to: Optional[str] = None,      # ISO date string YYYY-MM-DD
    limit: int = 200,
):
    """Get resource activity logs with optional filters."""
    query = (
        supabase.table("resource_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if event_type:
        query = query.eq("event_type", event_type)
    if resource_type:
        query = query.eq("resource_type", resource_type)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        # Add 1 day to make date_to inclusive
        from datetime import date, timedelta
        try:
            dt = date.fromisoformat(date_to)
            query = query.lte("created_at", (dt + timedelta(days=1)).isoformat())
        except ValueError:
            query = query.lte("created_at", date_to)
    result = query.execute()
    return result.data or []


@router.get("/{resource_id}")
def get_resource(resource_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single resource by ID."""
    result = (
        supabase.table("resources")
        .select("*")
        .eq("id", resource_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return _normalize_resource(result.data)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_resource(body: ResourceCreate, current_user: dict = Depends(get_current_user)):
    """Add a new resource. Auto-assigns a property code if not provided."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    prop_code = (body.property_code or "").strip() or _unique_property_code()

    # Check uniqueness
    existing = supabase.table("resources").select("id").eq("property_code", prop_code).execute()
    if existing.data:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Property code '{prop_code}' is already in use.")

    hazards = _normalize_applicable_hazards(body.applicable_hazards)
    primary_cat = _resolve_default_category(body.category.value if body.category else None, hazards)

    # Provide sensible defaults for optional fields so COA-only submissions work
    name_val = (body.name or f"COA Asset {prop_code}").strip()
    type_val = body.type.value if body.type else ResourceType.other.value
    quantity_val = int(body.quantity or 0)

    payload = {
        "name": name_val,
        "type": type_val,
        "quantity": quantity_val,
        "available_quantity": quantity_val,
        "location": body.location,
        "status": (ResourceStatus.available.value if quantity_val > 0 else ResourceStatus.unavailable.value),
        "ownership_tier": body.ownership_tier,
        "property_code": prop_code,
        "serial_number": body.serial_number or None,
        "category": primary_cat,
        "applicable_hazards": hazards or [primary_cat],
        "acquisition_date": body.acquisition_date or None,
        "estimated_life": body.estimated_life,
        "responsibility_center": body.responsibility_center,
        "acquisition_cost": body.acquisition_cost,
        "accumulated_depreciation": body.accumulated_depreciation,
        "net_book_value": body.net_book_value,
    }

    try:
        result = supabase.table("resources").insert(payload).execute()
    except Exception:
        # Fallback if DB doesn't have newer COA columns yet
        fallback_payload = payload.copy()
        for coa_k in [
            "acquisition_date", "estimated_life", "responsibility_center",
            "acquisition_cost", "accumulated_depreciation", "net_book_value",
            "applicable_hazards",
        ]:
            fallback_payload.pop(coa_k, None)
        result = supabase.table("resources").insert(fallback_payload).execute()

    created = _normalize_resource(result.data[0])
    _write_log(
        resource_id=created["id"],
        resource_name=created["name"],
        resource_type=created["type"],
        event_type="added",
        qty_change=created["quantity"],
        qty_before=0,
        qty_after=created["quantity"],
        new_status=ResourceStatus.available.value,
        description=f"New resource added to inventory. Qty: {created['quantity']}. Location: {created.get('location') or 'N/A'}.",
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
    """Update resource details."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    resource = _get_resource_by_id(resource_id)
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if "applicable_hazards" in updates and updates["applicable_hazards"]:
        updates["applicable_hazards"] = _normalize_applicable_hazards(updates["applicable_hazards"])
        updates["category"] = updates["applicable_hazards"][0]

    OUT_OF_SERVICE = {ResourceStatus.maintenance.value, ResourceStatus.damaged.value, ResourceStatus.unavailable.value}
    if "status" in updates:
        new_status = updates["status"].value if isinstance(updates["status"], ResourceStatus) else updates["status"]
        updates["status"] = new_status
        if new_status in OUT_OF_SERVICE:
            updates["available_quantity"] = 0
        elif new_status == ResourceStatus.available.value and "available_quantity" not in updates:
            updates["available_quantity"] = resource.get("quantity", 0)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = (
            supabase.table("resources")
            .update(updates)
            .eq("id", resource_id)
            .execute()
        )
    except Exception:
        updates.pop("applicable_hazards", None)
        result = (
            supabase.table("resources")
            .update(updates)
            .eq("id", resource_id)
            .execute()
        )

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    updated = _normalize_resource(result.data[0])

    # Log status changes (maintenance, damaged, unavailable, available)
    if "status" in updates:
        new_st = updates["status"]
        status_labels = {
            ResourceStatus.available.value:   "Available",
            ResourceStatus.deployed.value:    "Deployed",
            ResourceStatus.maintenance.value: "Under Maintenance",
            ResourceStatus.damaged.value:     "Damaged",
            ResourceStatus.unavailable.value: "Unavailable",
            ResourceStatus.retired.value:     "Retired",
            ResourceStatus.archived.value:    "Archived",
        }
        maint_notes = body.maintenance_notes or ""
        _write_log(
            resource_id=resource_id,
            resource_name=updated["name"],
            resource_type=updated["type"],
            event_type="status_changed",
            qty_before=resource.get("available_quantity", 0),
            qty_after=updated.get("available_quantity"),
            new_status=new_st,
            description=f"Status changed to '{status_labels.get(new_st, new_st)}'.{(' Notes: ' + maint_notes) if maint_notes else ''}",
            performed_by=current_user.get("sub"),
            performed_by_name=current_user.get("full_name"),
        )

    return updated


class RestockRequest(BaseModel):
    add_quantity: int = Field(gt=0)
    notes: Optional[str] = None


class RetireRequest(BaseModel):
    disposal_reason: str      # e.g. End of Life, Beyond Economical Repair, Damaged in Disaster, Auctioned/Decommissioned
    voucher_number: Optional[str] = None # COA Audit Disposal Voucher No.
    disposal_date: Optional[str] = None  # YYYY-MM-DD
    notes: Optional[str] = None

    @validator("disposal_reason")
    def disposal_reason_not_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Disposal reason is required")
        return value.strip()


@router.post("/{resource_id}/retire")
def retire_resource(
    resource_id: str,
    body: RetireRequest,
    current_user: dict = Depends(get_current_user),
):
    """Decommission / Retire an asset at the end of its life or severe damage (COA Asset Disposal Workflow)."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    res = supabase.table("resources").select("*").eq("id", resource_id).single().execute()
    resource = res.data
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    disposal_date = body.disposal_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    voucher = body.voucher_number or f"COA-DISP-{datetime.now().year}-{random.randint(1000, 9999)}"

    # Update resource status to retired and remove from active available quantity
    result = (
        supabase.table("resources")
        .update({
            "status": ResourceStatus.retired.value,
            "available_quantity": 0,
            "maintenance_notes": f"RETIRED / DISPOSED: {body.disposal_reason}. Voucher: {voucher}. Notes: {body.notes or ''}".strip(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", resource_id)
        .execute()
    )

    _write_log(
        resource_id=resource_id,
        resource_name=resource["name"],
        resource_type=resource["type"],
        event_type="archived",
        qty_before=resource.get("available_quantity", 0),
        qty_after=0,
        new_status="retired",
        description=(
            f"Asset Decommissioned & Retired under COA Audit Disposal Protocol. "
            f"Reason: {body.disposal_reason}. Voucher #: {voucher}. Date: {disposal_date}. "
            f"Net Book Value at Retirement: ₱{resource.get('net_book_value', 0):,.2f}."
        ),
        performed_by=current_user.get("sub"),
        performed_by_name=current_user.get("full_name"),
    )

    return result.data[0] if result.data else {"message": "Resource retired successfully"}


@router.post("/{resource_id}/restock")
def restock_resource(
    resource_id: str,
    body: RestockRequest,
    current_user: dict = Depends(get_current_user),
):
    """Restock an existing resource by increasing total and available quantities."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    if body.add_quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Restock quantity must be greater than 0")

    res = supabase.table("resources").select("*").eq("id", resource_id).single().execute()
    resource = res.data
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    new_total = (resource.get("quantity") or 0) + body.add_quantity
    new_avail = (resource.get("available_quantity") or 0) + body.add_quantity
    new_status = ResourceStatus.available.value if new_avail > 0 else resource.get("status", ResourceStatus.available.value)

    result = (
        supabase.table("resources")
        .update({
            "quantity": new_total,
            "available_quantity": new_avail,
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", resource_id)
        .execute()
    )
    _write_log(
        resource_id=resource_id,
        resource_name=resource["name"],
        resource_type=resource["type"],
        event_type="restocked",
        qty_change=body.add_quantity,
        qty_before=resource.get("available_quantity", 0),
        qty_after=new_avail,
        new_status=new_status,
        description=f"Restocked +{body.add_quantity} unit(s). Total now: {new_total}. {body.notes or ''}".strip(),
        performed_by=current_user.get("sub"),
        performed_by_name=current_user.get("full_name"),
    )
    return result.data[0]


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(resource_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a resource and its dispatch log references. Admin only."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    # Fetch resource name before deleting for the log
    res = supabase.table("resources").select("name,type,quantity").eq("id", resource_id).single().execute()
    resource = res.data or {}
    # Remove dispatch log entries for this resource first to avoid FK violation
    supabase.table("resource_dispatch").delete().eq("resource_id", resource_id).execute()
    supabase.table("resources").delete().eq("id", resource_id).execute()
    _write_log(
        resource_id=None,
        resource_name=resource.get("name", "Unknown"),
        resource_type=resource.get("type", "other"),
        event_type="archived",
        qty_before=resource.get("quantity", 0),
        qty_after=0,
        new_status="archived",
        description=f"Resource archived and removed from inventory by admin.",
        performed_by=current_user.get("sub"),
        performed_by_name=current_user.get("full_name"),
    )


# ===== Dispatch Routes =====

@router.get("/dispatch/log")
def get_dispatch_log(current_user: dict = Depends(get_current_user)):
    """Get all dispatch records with resource and incident info."""
    result = (
        supabase.table("resource_dispatch")
        .select(
            "id, ticket_id, quantity_dispatched, "
            "borrower_name, borrower_contact, purpose, due_date, notes, "
            "dispatched_at, dispatched_at_precise, returned_at, "
            "resources(name, type, property_code), "
            "incidents(title), "
            "users(full_name)"
        )
        .order("dispatched_at", desc=True)
        .execute()
    )
    return result.data


@router.post("/dispatch", status_code=status.HTTP_201_CREATED)
def dispatch_resource(body: DispatchCreate, current_user: dict = Depends(get_current_user)):
    """Dispatch / lend a resource. Creates a borrowing ticket."""
    resource = _get_resource_by_id(body.resource_id)
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    if resource.get("status") in {
        ResourceStatus.maintenance.value,
        ResourceStatus.damaged.value,
        ResourceStatus.unavailable.value,
        ResourceStatus.retired.value,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Resource '{resource.get('name')}' is not available for dispatch"
        )

    if resource.get("available_quantity", 0) < body.quantity_dispatched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only {resource.get('available_quantity', 0)} units available"
        )

    new_available = resource.get("available_quantity", 0) - body.quantity_dispatched
    new_status = ResourceStatus.available.value if new_available > 0 else ResourceStatus.deployed.value

    supabase.table("resources").update({
        "available_quantity": new_available,
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", body.resource_id).execute()

    now = datetime.now(timezone.utc)
    dispatch = supabase.table("resource_dispatch").insert({
        "resource_id":          body.resource_id,
        "incident_id":          body.incident_id,
        "quantity_dispatched":  body.quantity_dispatched,
        "dispatched_by":        current_user["sub"],
        "borrower_name":        body.borrower_name or None,
        "borrower_contact":     body.borrower_contact or None,
        "destination":          body.destination or None,
        "purpose":              body.purpose or None,
        "due_date":             body.due_date or None,
        "notes":                body.notes or None,
        "ticket_id":            _unique_ticket_id(),
        "dispatched_at_precise": now.isoformat(),
        "dispatched_at":        now.isoformat(),
    }).execute()

    ticket = dispatch.data[0]
    _write_log(
        resource_id=body.resource_id,
        resource_name=resource.get("name", "Unknown"),
        resource_type=resource.get("type", "other"),
        event_type="dispatched",
        qty_change=-body.quantity_dispatched,
        qty_before=resource.get("available_quantity", 0),
        qty_after=new_available,
        new_status=new_status,
        reference_id=ticket["id"],
        description=(
            f"Dispatched {body.quantity_dispatched} unit(s) to {body.destination or 'N/A'}. "
            f"Borrower: {body.borrower_name or 'N/A'}. "
            f"Purpose: {body.purpose or 'N/A'}. "
            f"Ticket: {ticket.get('ticket_id', '')}."
        ),
        performed_by=current_user.get("sub"),
        performed_by_name=current_user.get("full_name"),
    )
    return ticket


@router.patch("/dispatch/{dispatch_id}/return")
def return_resource(
    dispatch_id: str,
    body: ReturnDispatch,
    current_user: dict = Depends(get_current_user),
):
    """Mark a dispatched resource as returned and restore its availability."""
    # Get the dispatch record
    res = (
        supabase.table("resource_dispatch")
        .select("*")
        .eq("id", dispatch_id)
        .single()
        .execute()
    )
    dispatch = res.data
    if not dispatch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispatch record not found")

    if dispatch.get("returned_at"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already returned")

    # Restore resource availability
    resource = _get_resource_by_id(dispatch["resource_id"])
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource record for dispatch not found")

    current_available = resource.get("available_quantity", 0)
    total_quantity = resource.get("quantity", 0)
    new_available = min(total_quantity, current_available + dispatch["quantity_dispatched"])
    new_status = ResourceStatus.available.value if new_available > 0 else resource.get("status", ResourceStatus.deployed.value)

    supabase.table("resources").update({
        "available_quantity": new_available,
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", dispatch["resource_id"]).execute()

    # Mark dispatch as returned
    updated = supabase.table("resource_dispatch").update({
        "returned_at": datetime.now(timezone.utc).isoformat(),
        "notes": body.notes or dispatch.get("notes"),
    }).eq("id", dispatch_id).execute()

    _write_log(
        resource_id=dispatch["resource_id"],
        resource_name=resource.get("name", "Unknown"),
        resource_type=resource.get("type", "other"),
        event_type="returned",
        qty_change=dispatch["quantity_dispatched"],
        qty_before=current_available,
        qty_after=new_available,
        new_status=new_status,
        reference_id=dispatch_id,
        description=(
            f"Returned {dispatch['quantity_dispatched']} unit(s) to inventory. "
            f"Ticket: {dispatch.get('ticket_id', '')}. "
            f"{body.notes or ''}".strip()
        ),
        performed_by=current_user.get("sub"),
        performed_by_name=current_user.get("full_name"),
    )
    return updated.data[0]
