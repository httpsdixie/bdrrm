from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from ..database import supabase
from ..auth.dependencies import get_current_user
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


DEFAULT_HOTLINES = [
    {
        "id": "h-1",
        "name": "Barangay Linao BDRRMC Command Center",
        "agency": "BDRRMC",
        "category": "command",
        "hotline": "(053) 561-2345 / 0917-123-4567",
        "secondary_number": "0917-123-4567",
        "address": "Barangay Hall, Sitio 1, Linao, Ormoc City",
        "available_24h": True,
        "sort_order": 1
    },
    {
        "id": "h-2",
        "name": "CDRRMO Ormoc Emergency Operations Center",
        "agency": "CDRRMO",
        "category": "command",
        "hotline": "(053) 561-8888 / 911",
        "secondary_number": "911",
        "address": "City Hall Compound, Ormoc City",
        "available_24h": True,
        "sort_order": 2
    },
    {
        "id": "h-3",
        "name": "Ormoc City Fire Station (BFP)",
        "agency": "BFP",
        "category": "fire",
        "hotline": "(053) 561-2222 / 0928-555-1199",
        "secondary_number": "0928-555-1199",
        "address": "Aunubing St., Ormoc City",
        "available_24h": True,
        "sort_order": 3
    },
    {
        "id": "h-4",
        "name": "Ormoc City PNP Central Police Station",
        "agency": "PNP",
        "category": "fire",
        "hotline": "(053) 561-3333 / 0998-598-8123",
        "secondary_number": "0998-598-8123",
        "address": "Lilia Ave, Ormoc City",
        "available_24h": True,
        "sort_order": 4
    },
    {
        "id": "h-5",
        "name": "Barangay Linao Health Station",
        "agency": "City Health",
        "category": "medical",
        "hotline": "0917-888-4321",
        "secondary_number": None,
        "address": "Purok 3, Barangay Linao, Ormoc City",
        "available_24h": True,
        "sort_order": 5
    },
    {
        "id": "h-6",
        "name": "Ormoc District Hospital (OMVH)",
        "agency": "DOH / OMVH",
        "category": "medical",
        "hotline": "(053) 561-4444",
        "secondary_number": None,
        "address": "Brgy. Cogon, Ormoc City",
        "available_24h": True,
        "sort_order": 6
    }
]

def auto_seed_contacts():
    """Seed default institutional hotlines into Supabase database if empty."""
    try:
        seed_payload = []
        for item in DEFAULT_HOTLINES:
            row = item.copy()
            if "id" in row:
                del row["id"]
            seed_payload.append(row)
        res = supabase.table("emergency_contacts").insert(seed_payload).execute()
        return res.data or []
    except Exception as e:
        print("Auto-seed contacts notice:", e)
        return DEFAULT_HOTLINES


# ===== Public — no auth needed =====

@router.get("/public")
def get_public_directory():
    """Public endpoint — anyone can view the emergency directory."""
    try:
        result = (
            supabase.table("emergency_contacts")
            .select("id, name, agency, category, hotline, secondary_number, address, available_24h, sort_order")
            .order("sort_order")
            .execute()
        )
        if result.data and len(result.data) > 0:
            return result.data
        return auto_seed_contacts()
    except Exception:
        return DEFAULT_HOTLINES


# ===== Authenticated =====

@router.get("/")
def get_all_contacts(current_user: dict = Depends(get_current_user)):
    """Full directory including notes and email — officers/admins."""
    try:
        result = (
            supabase.table("emergency_contacts")
            .select("*")
            .order("sort_order")
            .execute()
        )
        if result.data and len(result.data) > 0:
            return result.data
        return auto_seed_contacts()
    except Exception:
        return DEFAULT_HOTLINES


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
