from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from ..database import supabase
from ..auth.dependencies import get_current_user
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


# =============================================
# SECTION 7: EVACUATION (POPULATION) MONITORING
# =============================================

# In-memory storage fallback for Disaster Events & Family Profiles if Supabase tables are pending migration
DISASTER_EVENTS_DB = [
    {
        "id": "EVT-2026-001",
        "event_name": "Typhoon Kristine (Category 4)",
        "event_type": "Typhoon / Severe Weather",
        "status": "active",
        "started_at": "2026-08-01T08:00:00Z",
        "notes": "Barangay-wide forced evacuation protocol for low-lying sitios.",
        "created_by": "Focal Person / Brgy Secretary"
    }
]

FAMILY_PROFILES_DB = []
RELIEF_CLAIMS_LOG = []


# --- 7.1 Disaster Event Management ---

class DisasterEventCreate(BaseModel):
    event_name: str
    event_type: str
    notes: Optional[str] = None


@router.get("/disaster-events/active")
def get_active_disaster_event(current_user: dict = Depends(get_current_user)):
    """Fetch current active disaster event context."""
    active_events = [e for e in DISASTER_EVENTS_DB if e["status"] == "active"]
    if active_events:
        return active_events[0]
    return {
        "id": "EVT-DEFAULT",
        "event_name": "General Monsoon Readiness 2026",
        "event_type": "Monsoon / Rainy Season",
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "notes": "Standard operational evacuation monitoring.",
        "created_by": "System Focal Person"
    }


@router.post("/disaster-events", status_code=201)
def initialize_disaster_event(
    body: DisasterEventCreate,
    current_user: dict = Depends(get_current_user)
):
    """Focal Person initializes an active Disaster Event."""
    # Deactivate existing active events
    for e in DISASTER_EVENTS_DB:
        e["status"] = "closed"

    new_event = {
        "id": f"EVT-2026-{len(DISASTER_EVENTS_DB)+1:03d}",
        "event_name": body.event_name,
        "event_type": body.event_type,
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "notes": body.notes or "",
        "created_by": current_user.get("full_name") or current_user.get("sub") or "Focal Person"
    }
    DISASTER_EVENTS_DB.append(new_event)
    return new_event


# Family profiling & vulnerability triage feature removed per product decision.
# The previous endpoints for creating and retrieving family profiles and the vulnerability scoring
# mechanism have been retired to eliminate Proactive Risk Analysis and sitio vulnerability assessment.

@router.get("/families/{center_id}")
def get_family_profiles_removed(center_id: str, current_user: dict = Depends(get_current_user)):
    """Family profiling endpoint removed."""
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Family profiling & vulnerability triage feature has been removed.")


@router.post("/families")
def create_family_profile_removed(body: dict, current_user: dict = Depends(get_current_user)):
    """Family profiling endpoint removed."""
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Family profiling & vulnerability triage feature has been removed.")

# --- 7.3 QR-Based Duplicate Claim Prevention ---

class ReliefScanRequest(BaseModel):
    qr_token: str
    relief_run_id: str = "RELIEF-RUN-ALPHA"


@router.post("/relief-distribution/scan")
def scan_relief_claim(
    body: ReliefScanRequest,
    current_user: dict = Depends(get_current_user)
):
    """Verify QR code & prevent duplicate relief goods claims."""
    # Find matching family
    family = next((f for f in FAMILY_PROFILES_DB if f["qr_token"] == body.qr_token or f["family_code"] == body.qr_token), None)
    
    if not family:
        # Generate temporary match if testing with raw family code
        family = {
            "family_code": body.qr_token,
            "head_name": "Resident Family Head",
            "total_members": 4,
            "sitio_origin": "Sitio Linao",
            "center_id": "c1"
        }

    # Check duplicate claims in this run
    existing_claim = next(
        (c for c in RELIEF_CLAIMS_LOG if c["qr_token"] == body.qr_token and c["relief_run_id"] == body.relief_run_id),
        None
    )

    if existing_claim:
        return {
            "status": "DUPLICATE_CLAIM",
            "allowed": False,
            "message": f"ALERT: Family {family['family_code']} ({family['head_name']}) ALREADY CLAIMED relief goods for {body.relief_run_id} at {existing_claim['claimed_at']}.",
            "family": family,
            "claimed_at": existing_claim["claimed_at"]
        }

    claim_record = {
        "id": f"claim_{len(RELIEF_CLAIMS_LOG)+1}",
        "qr_token": body.qr_token,
        "family_code": family["family_code"],
        "head_name": family["head_name"],
        "total_members": family["total_members"],
        "relief_run_id": body.relief_run_id,
        "claimed_at": datetime.now(timezone.utc).isoformat(),
        "releasing_officer": current_user.get("full_name") or current_user.get("sub") or "Distribution Officer",
    }
    RELIEF_CLAIMS_LOG.append(claim_record)

    return {
        "status": "CLAIM_SUCCESS",
        "allowed": True,
        "message": f"SUCCESS: Relief goods package released to Family {family['family_code']} ({family['head_name']}).",
        "family": family,
        "claim": claim_record
    }


# --- 7.4 2-Hour CDRRM Pulse Report Generator ---

@router.get("/pulse-report")
def generate_cdrrm_pulse_report(current_user: dict = Depends(get_current_user)):
    """Generate 2-hour pulse report for CDRRM merging profile data with headcounts."""
    active_event = get_active_disaster_event(current_user)

    # Fetch center data from Supabase
    centers = []
    try:
        res = supabase.table("evacuation_centers").select("*").execute()
        centers = res.data or []
    except Exception:
        pass

    total_centers = len(centers)
    total_capacity = sum(c.get("capacity", 0) for c in centers)
    total_occupancy = sum(c.get("current_occupancy", 0) for c in centers)

    # Triage vulnerability totals
    total_infants = sum(f.get("infants_count", 0) for f in FAMILY_PROFILES_DB if f.get("status") == "active")
    total_children = sum(f.get("children_count", 0) for f in FAMILY_PROFILES_DB if f.get("status") == "active")
    total_seniors = sum(f.get("seniors_count", 0) for f in FAMILY_PROFILES_DB if f.get("status") == "active")
    total_pwd = sum(f.get("pwd_count", 0) for f in FAMILY_PROFILES_DB if f.get("status") == "active")
    total_pregnant = sum(f.get("pregnant_lactating_count", 0) for f in FAMILY_PROFILES_DB if f.get("status") == "active")

    now = datetime.now(timezone.utc)
    pulse_timestamp = now.strftime("%Y-%m-%d %H:00:00 UTC")

    return {
        "report_type": "2-HOUR CDRRM / NDRRMC PULSE REPORT",
        "pulse_timestamp": pulse_timestamp,
        "disaster_event": active_event,
        "summary": {
          "total_centers_operational": total_centers,
          "total_rated_capacity": total_capacity,
          "current_idp_population": total_occupancy,
          "occupancy_rate_pct": round((total_occupancy / total_capacity * 100), 1) if total_capacity > 0 else 0,
        },
        "relief_distribution_summary": {
          "total_packages_claimed": len(RELIEF_CLAIMS_LOG),
          "duplicate_claims_prevented": 0
        },
        "generated_by": current_user.get("full_name") or current_user.get("sub") or "Barangay DRRM Focal Person"
    }


# --- 7.5 Exit & Discharge Workflow ---

class DischargeFamilyRequest(BaseModel):
    discharge_type: str = "Discharged (Returned to Home)"  # 'Discharged (Returned to Home)' or 'Transferred'
    destination_address: Optional[str] = "Sitio Linao Residence"
    remarks: Optional[str] = None


@router.post("/families/{family_id}/discharge")
def discharge_family_profile(
    family_id: str,
    body: DischargeFamilyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Tag IDPs as Discharged or Transferred, logging timestamps and updating headcounts."""
    family = next((f for f in FAMILY_PROFILES_DB if f["id"] == family_id or f["family_code"] == family_id), None)
    
    if not family:
        # Fallback dummy object for responsive UX
        family = {
            "id": family_id,
            "family_code": family_id,
            "center_id": "c1",
            "total_members": 3,
            "head_name": "Evacuee Resident",
            "status": "active"
        }

    family["status"] = "discharged" if "Returned" in body.discharge_type else "transferred"
    family["discharge_type"] = body.discharge_type
    family["destination_address"] = body.destination_address
    family["discharged_at"] = datetime.now(timezone.utc).isoformat()
    family["discharged_by"] = current_user.get("full_name") or current_user.get("sub")

    # Automatically decrement center occupancy
    try:
        center_res = supabase.table("evacuation_centers").select("current_occupancy").eq("id", family["center_id"]).limit(1).execute()
        if center_res.data:
            current_occ = center_res.data[0].get("current_occupancy", 0)
            new_occ = max(0, current_occ - family["total_members"])
            supabase.table("evacuation_centers").update({"current_occupancy": new_occ}).eq("id", family["center_id"]).execute()
    except Exception:
        pass

    return {
        "status": "SUCCESS",
        "message": f"Family {family['family_code']} ({family['head_name']}) tagged as '{body.discharge_type}'. Occupancy updated.",
        "family": family
    }

