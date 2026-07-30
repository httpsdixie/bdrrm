from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from database import supabase
from auth.dependencies import get_current_user
from datetime import datetime, timezone
import random, string

router = APIRouter(prefix="/resources", tags=["Resources"])


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
    name: str
    type: str           # rescue_boat, medical_kit, food_pack, tent, vehicle, other
    quantity: int
    location: Optional[str] = None
    category: Optional[str] = None
    applicable_hazards: Optional[list[str]] = []
    ownership_tier: Optional[str] = "barangay"
    property_code: Optional[str] = None   # auto-generated if omitted
    serial_number: Optional[str] = None   # manufacturer serial (optional)


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    quantity: Optional[int] = None
    available_quantity: Optional[int] = None
    location: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    applicable_hazards: Optional[list[str]] = None
    ownership_tier: Optional[str] = None
    property_code: Optional[str] = None
    serial_number: Optional[str] = None
    maintenance_notes: Optional[str] = None   # description for damage/maintenance status


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


def _normalize_resource(item: dict) -> dict:
    if not item or not isinstance(item, dict):
        return item
    hazards = item.get("applicable_hazards")
    if hazards is None or (isinstance(hazards, list) and len(hazards) == 0):
        cat = item.get("category")
        if cat:
            item["applicable_hazards"] = [cat]
        else:
            item["applicable_hazards"] = ["general_emergency"]
    elif isinstance(hazards, str):
        try:
            import json
            item["applicable_hazards"] = json.loads(hazards)
        except Exception:
            item["applicable_hazards"] = [h.strip() for h in hazards.split(",") if h.strip()]
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
        raise HTTPException(status_code=409, detail=f"Property code '{prop_code}' is already in use.")

    primary_cat = body.category or (body.applicable_hazards[0] if body.applicable_hazards else "general_emergency")

    payload = {
        "name": body.name,
        "type": body.type,
        "quantity": body.quantity,
        "available_quantity": body.quantity,
        "location": body.location,
        "status": "available",
        "ownership_tier": body.ownership_tier or "barangay",
        "property_code": prop_code,
        "serial_number": body.serial_number or None,
        "category": primary_cat,
        "applicable_hazards": body.applicable_hazards or [primary_cat],
    }

    try:
        result = supabase.table("resources").insert(payload).execute()
    except Exception:
        # Fallback if DB doesn't have applicable_hazards column
        payload.pop("applicable_hazards", None)
        result = supabase.table("resources").insert(payload).execute()

    created = _normalize_resource(result.data[0])
    _write_log(
        resource_id=created["id"],
        resource_name=created["name"],
        resource_type=created["type"],
        event_type="added",
        qty_change=created["quantity"],
        qty_before=0,
        qty_after=created["quantity"],
        new_status="available",
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

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if "applicable_hazards" in updates and updates["applicable_hazards"]:
        updates["category"] = updates["applicable_hazards"][0]

    # Auto-manage available_quantity based on status change
    OUT_OF_SERVICE = {"maintenance", "damaged", "unavailable"}
    if "status" in updates:
        new_status = updates["status"]
        if new_status in OUT_OF_SERVICE:
            # Fetch current resource to zero out availability
            res = supabase.table("resources").select("available_quantity").eq("id", resource_id).single().execute()
            if res.data:
                updates["available_quantity"] = 0
        elif new_status == "available" and "available_quantity" not in updates:
            # Restore available_quantity to full total when returning to service
            res = supabase.table("resources").select("quantity").eq("id", resource_id).single().execute()
            if res.data:
                updates["available_quantity"] = res.data["quantity"]

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = (
            supabase.table("resources")
            .update(updates)
            .eq("id", resource_id)
            .execute()
        )
    except Exception:
        # Fallback if column missing in DB
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
        event_map = {
            "maintenance": "status_changed",
            "damaged":     "status_changed",
            "unavailable": "status_changed",
            "available":   "status_changed",
            "deployed":    "status_changed",
        }
        status_labels = {
            "available":   "Available",
            "deployed":    "Deployed",
            "maintenance": "Under Maintenance",
            "damaged":     "Damaged",
            "unavailable": "Unavailable",
        }
        maint_notes = body.maintenance_notes or ""
        _write_log(
            resource_id=resource_id,
            resource_name=updated["name"],
            resource_type=updated["type"],
            event_type=event_map.get(new_st, "status_changed"),
            qty_before=updated.get("available_quantity"),
            qty_after=updates.get("available_quantity", updated.get("available_quantity")),
            new_status=new_st,
            description=f"Status changed to '{status_labels.get(new_st, new_st)}'.{(' Notes: ' + maint_notes) if maint_notes else ''}",
            performed_by=current_user.get("sub"),
            performed_by_name=current_user.get("full_name"),
        )

    return updated


class RestockRequest(BaseModel):
    add_quantity: int
    notes: Optional[str] = None


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
    new_status = "available" if new_avail > 0 else resource.get("status", "available")

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
    res = (
        supabase.table("resources")
        .select("*")
        .eq("id", body.resource_id)
        .single()
        .execute()
    )
    resource = res.data
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    if resource["available_quantity"] < body.quantity_dispatched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only {resource['available_quantity']} units available"
        )

    new_available = resource["available_quantity"] - body.quantity_dispatched
    new_status = "available" if new_available > 0 else "deployed"

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
        resource_name=resource["name"],
        resource_type=resource["type"],
        event_type="dispatched",
        qty_change=-body.quantity_dispatched,
        qty_before=resource["available_quantity"],
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
    resource = (
        supabase.table("resources")
        .select("name, type, available_quantity, quantity")
        .eq("id", dispatch["resource_id"])
        .single()
        .execute()
    ).data

    new_available = min(
        resource["quantity"],
        resource["available_quantity"] + dispatch["quantity_dispatched"]
    )
    new_status = "available" if new_available > 0 else "deployed"

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
        resource_name=resource.get("name", "Unknown") if isinstance(resource, dict) else "Unknown",
        resource_type=resource.get("type", "other") if isinstance(resource, dict) else "other",
        event_type="returned",
        qty_change=dispatch["quantity_dispatched"],
        qty_before=resource["available_quantity"],
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
