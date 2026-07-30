from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from database import supabase
from auth.dependencies import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/evacuation-centers", tags=["Evacuation Centers"])


# ===== Schemas =====

class EvacuationCenterCreate(BaseModel):
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    capacity: int
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None


class EvacuationCenterUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    capacity: Optional[int] = None
    current_occupancy: Optional[int] = None
    status: Optional[str] = None        # available, full, closed, maintenance
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    status_remarks: Optional[str] = None
    facilities: Optional[str] = None
    has_water: Optional[bool] = None
    has_electricity: Optional[bool] = None
    has_first_aid: Optional[bool] = None
    has_food: Optional[bool] = None
    has_sanitation: Optional[bool] = None


# ===== Routes =====

@router.get("/")
def get_all_centers(current_user: dict = Depends(get_current_user)):
    """Get all evacuation centers."""
    result = (
        supabase.table("evacuation_centers")
        .select("*")
        .order("name")
        .execute()
    )
    return result.data


@router.get("/{center_id}")
def get_center(center_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single evacuation center by ID."""
    result = (
        supabase.table("evacuation_centers")
        .select("*")
        .eq("id", center_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evacuation center not found")
    return result.data


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_center(body: EvacuationCenterCreate, current_user: dict = Depends(get_current_user)):
    """Add a new evacuation center. Admin/officer only."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    result = supabase.table("evacuation_centers").insert({
        "name": body.name,
        "address": body.address,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "capacity": body.capacity,
        "current_occupancy": 0,
        "status": "available",
        "contact_person": body.contact_person,
        "contact_number": body.contact_number,
    }).execute()
    return result.data[0]


@router.patch("/{center_id}")
def update_center(
    center_id: str,
    body: EvacuationCenterUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an evacuation center's info or occupancy."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Auto-set status based on occupancy vs capacity if both are present
    # We'll handle this on the frontend for simplicity and just persist what's sent

    result = (
        supabase.table("evacuation_centers")
        .update(updates)
        .eq("id", center_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evacuation center not found")
    return result.data[0]


@router.delete("/{center_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_center(center_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an evacuation center. Admin only."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    supabase.table("evacuation_centers").delete().eq("id", center_id).execute()
