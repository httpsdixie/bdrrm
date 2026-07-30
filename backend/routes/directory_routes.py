from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from database import supabase
from auth.dependencies import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/directory", tags=["Emergency Directory"])


# ===== Schemas =====

class ContactCreate(BaseModel):
    name: str
    agency: str
    category: str       # emergency, medical, disaster, police, fire, other
    hotline: str
    secondary_number: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    available_24h: bool = True
    notes: Optional[str] = None
    sort_order: int = 0


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    agency: Optional[str] = None
    category: Optional[str] = None
    hotline: Optional[str] = None
    secondary_number: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    available_24h: Optional[bool] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


# ===== Public — no auth needed =====

@router.get("/public")
def get_public_directory():
    """Public endpoint — anyone can view the emergency directory."""
    result = (
        supabase.table("emergency_contacts")
        .select("id, name, agency, category, hotline, secondary_number, address, available_24h, sort_order")
        .order("sort_order")
        .execute()
    )
    return result.data or []


# ===== Authenticated =====

@router.get("/")
def get_all_contacts(current_user: dict = Depends(get_current_user)):
    """Full directory including notes and email — officers/admins."""
    result = (
        supabase.table("emergency_contacts")
        .select("*")
        .order("sort_order")
        .execute()
    )
    return result.data or []


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_contact(body: ContactCreate, current_user: dict = Depends(get_current_user)):
    """Add a new emergency contact. Admin/officer only."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    result = supabase.table("emergency_contacts").insert(body.model_dump()).execute()
    return result.data[0]


@router.patch("/{contact_id}")
def update_contact(
    contact_id: str,
    body: ContactUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a contact. Admin/officer only."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = supabase.table("emergency_contacts").update(updates).eq("id", contact_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return result.data[0]


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a contact. Admin only."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    supabase.table("emergency_contacts").delete().eq("id", contact_id).execute()
