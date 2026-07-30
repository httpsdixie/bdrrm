from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from database import supabase
from auth.dependencies import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/evacuation-tracking", tags=["Evacuation Tracking"])


class SectorEntry(BaseModel):
    sector: str
    count: int


class EvacTrackingUpsert(BaseModel):
    center_id: str
    phase: str = "during"    # 'before', 'during', 'after'

    # Demographics
    demo_pwd:       Optional[int] = 0
    demo_pregnant:  Optional[int] = 0
    demo_children:  Optional[int] = 0
    demo_youth:     Optional[int] = 0
    demo_senior:    Optional[int] = 0
    demo_ip:        Optional[int] = 0

    # Sector breakdown
    sector_breakdown: Optional[list] = []

    # Relief
    relief_food:            Optional[str] = "none"
    relief_food_remarks:    Optional[str] = None
    relief_water:           Optional[str] = "none"
    relief_water_remarks:   Optional[str] = None
    relief_clothing:        Optional[str] = "none"
    relief_clothing_remarks: Optional[str] = None

    # Utilities
    water_system:    Optional[str] = "unknown"
    electricity:     Optional[str] = "unknown"
    internet_signal: Optional[str] = "unknown"

    # Equipment & needs
    equipment_notes:  Optional[str] = None
    resources_needed: Optional[str] = None

    # Camp management
    camp_manager:         Optional[str] = None
    camp_manager_contact: Optional[str] = None
    assigned_official:    Optional[str] = None

    # Before-phase fields
    pre_capacity_check:    Optional[bool] = False
    pre_inventory_notes:   Optional[str]  = None
    pre_resource_position: Optional[str]  = None
    pre_staff_deployed:    Optional[int]  = 0
    pre_readiness_level:   Optional[str]  = "not_assessed"

    # After-phase fields
    post_damage_notes:          Optional[str] = None
    post_resources_used:        Optional[str] = None
    post_replenishment_needed:  Optional[str] = None
    post_total_served:          Optional[int] = 0
    post_center_condition:      Optional[str] = "unknown"


@router.get("/{center_id}")
def get_tracking(
    center_id: str,
    phase: str = Query(default="during"),
    current_user: dict = Depends(get_current_user)
):
    """Get the tracking record for a specific evacuation center and phase."""
    result = (
        supabase.table("evacuation_tracking")
        .select("*")
        .eq("center_id", center_id)
        .eq("phase", phase)
        .limit(1)
        .execute()
    )
    if not result.data:
        return {"center_id": center_id, "phase": phase}
    return result.data[0]


@router.put("/{center_id}", status_code=status.HTTP_200_OK)
def upsert_tracking(
    center_id: str,
    body: EvacTrackingUpsert,
    current_user: dict = Depends(get_current_user),
):
    """Create or update the evacuation tracking record for a center."""
    payload = body.model_dump()
    payload["center_id"]  = center_id
    payload["updated_by"] = current_user["sub"]
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Check if record exists for this center + phase
    existing = (
        supabase.table("evacuation_tracking")
        .select("id")
        .eq("center_id", center_id)
        .eq("phase", payload.get("phase", "during"))
        .limit(1)
        .execute()
    )

    try:
        if existing.data:
            record_id = existing.data[0]["id"]
            result = (
                supabase.table("evacuation_tracking")
                .update(payload)
                .eq("id", record_id)
                .execute()
            )
        else:
            result = (
                supabase.table("evacuation_tracking")
                .insert(payload)
                .execute()
            )
        return result.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# =============================================
# Historical Utilization Log
# =============================================

class EvacHistoryCreate(BaseModel):
    event_name:        str
    event_type:        str
    event_date:        str   # ISO date string
    peak_occupancy:    Optional[int] = 0
    total_served:      Optional[int] = 0
    duration_days:     Optional[int] = 1
    bottlenecks:       Optional[str] = None
    structural_notes:  Optional[str] = None
    reliability_rating: Optional[str] = "good"
    lessons_learned:   Optional[str] = None


@router.get("/{center_id}/history")
def get_history(center_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("evac_history_log")
        .select("*")
        .eq("center_id", center_id)
        .order("event_date", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/{center_id}/history", status_code=201)
def add_history(
    center_id: str,
    body: EvacHistoryCreate,
    current_user: dict = Depends(get_current_user),
):
    payload = body.model_dump()
    payload["center_id"] = center_id
    payload["logged_by"] = current_user["sub"]
    result = supabase.table("evac_history_log").insert(payload).execute()
    return result.data[0]


@router.delete("/{center_id}/history/{log_id}", status_code=204)
def delete_history(center_id: str, log_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    supabase.table("evac_history_log").delete().eq("id", log_id).eq("center_id", center_id).execute()
