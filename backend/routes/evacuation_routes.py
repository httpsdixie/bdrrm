from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from ..database import supabase
from ..auth.dependencies import get_current_user
from datetime import datetime, timezone
import math
import re

router = APIRouter(prefix="/evacuation-centers", tags=["Evacuation Centers"])


# ===== Standard JMC No. 2 Series 2021 Checklist Criteria (20 Items) =====
JMC2_ITEMS = [
  {"id": "jmc_01", "name": "Information Board / Help Desk", "category": "Administration"},
  {"id": "jmc_02", "name": "Adequate Shelter & Sleeping Space", "category": "Accommodation"},
  {"id": "jmc_03", "name": "Community Kitchen / Cooking Area", "category": "Food Services"},
  {"id": "jmc_04", "name": "Safe Drinking Water Supply & Storage", "category": "WASH"},
  {"id": "jmc_05", "name": "Separate Male & Female Toilets / Latrines", "category": "WASH"},
  {"id": "jmc_06", "name": "Handwashing Stations with Soap", "category": "WASH"},
  {"id": "jmc_07", "name": "Health Station & First Aid Clinic", "category": "Health"},
  {"id": "jmc_08", "name": "Child-Friendly Space & Play Area", "category": "Protection"},
  {"id": "jmc_09", "name": "Women-Friendly & Lactation Space", "category": "Protection"},
  {"id": "jmc_10", "name": "Solid Waste Management / Segregated Bins", "category": "Sanitation"},
  {"id": "jmc_11", "name": "Power Supply & Generator Backup", "category": "Utilities"},
  {"id": "jmc_12", "name": "Emergency Lighting & Flashlights", "category": "Safety"},
  {"id": "jmc_13", "name": "PWD & Senior Citizen Accessibility Ramps", "category": "Accessibility"},
  {"id": "jmc_14", "name": "Security Desk & Barangay Tanod Post", "category": "Safety"},
  {"id": "jmc_15", "name": "Storage for Relief Goods & Supplies", "category": "Logistics"},
  {"id": "jmc_16", "name": "Adequate Ventilation & Natural Airflow", "category": "Accommodation"},
  {"id": "jmc_17", "name": "Laundry & Cloth Washing Area", "category": "WASH"},
  {"id": "jmc_18", "name": "Fire Safety Equipment & Extinguishers", "category": "Safety"},
  {"id": "jmc_19", "name": "Emergency Public Address / Comms System", "category": "Comms"},
  {"id": "jmc_20", "name": "Isolation Area for Infectious Illnesses", "category": "Health"},
]


# ===== Schemas =====

class EvacuationCenterCreate(BaseModel):
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    capacity: int
    year_established: Optional[Any] = None
    floor_area_sqm: Optional[Any] = None
    lot_area: Optional[str] = None
    type: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    personnel_directory: Optional[List[Dict[str, Any]]] = []
    facilities_checklist: Optional[Dict[str, Any]] = None
    camp_layout_filename: Optional[str] = None
    contingency_plan: Optional[str] = None
    prepared_by: Optional[Dict[str, Any]] = None
    approved_by: Optional[Dict[str, Any]] = None
    structural_integrity_report: Optional[str] = None

    @field_validator("floor_area_sqm", mode="before")
    @classmethod
    def coerce_floor_area(cls, v):
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        cleaned = re.sub(r"[^\d.]", "", str(v))
        try:
            return float(cleaned) if cleaned else None
        except ValueError:
            return None

    @field_validator("year_established", mode="before")
    @classmethod
    def coerce_year(cls, v):
        if v is None:
            return None
        if isinstance(v, int):
            return v
        match = re.search(r"\d{4}", str(v))
        return int(match.group()) if match else None


class EvacuationCenterUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    capacity: Optional[int] = None
    current_occupancy: Optional[int] = None
    year_established: Optional[Any] = None
    floor_area_sqm: Optional[Any] = None
    lot_area: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None        # available, full, closed, maintenance, archived
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    status_remarks: Optional[str] = None
    facilities: Optional[str] = None
    facilities_checklist: Optional[Any] = None
    personnel_directory: Optional[List[Dict[str, Any]]] = None
    camp_layout_filename: Optional[str] = None
    contingency_plan: Optional[str] = None
    prepared_by: Optional[Dict[str, Any]] = None
    approved_by: Optional[Dict[str, Any]] = None
    structural_integrity_report: Optional[str] = None
    has_water: Optional[bool] = None
    has_electricity: Optional[bool] = None
    has_first_aid: Optional[bool] = None
    has_food: Optional[bool] = None
    has_sanitation: Optional[bool] = None

    @field_validator("floor_area_sqm", mode="before")
    @classmethod
    def coerce_floor_area(cls, v):
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        cleaned = re.sub(r"[^\d.]", "", str(v))
        try:
            return float(cleaned) if cleaned else None
        except ValueError:
            return None

    @field_validator("year_established", mode="before")
    @classmethod
    def coerce_year(cls, v):
        if v is None:
            return None
        if isinstance(v, int):
            return v
        match = re.search(r"\d{4}", str(v))
        return int(match.group()) if match else None


class JMC2ChecklistSubmit(BaseModel):
    checklist: Dict[str, Dict[str, Any]] # e.g. {"jmc_01": {"status": "compliant"|"issue", "remarks": "..."}}
    inspector_name: Optional[str] = None


class MonthlyArchiveRequest(BaseModel):
    archive_cycle: Optional[str] = None # e.g. "2026-08"
    notes: Optional[str] = None


# ===== Routes =====

@router.get("/jmc2-template")
def get_jmc2_template(current_user: dict = Depends(get_current_user)):
    """Return the standardized 20-item JMC No. 2 Series 2021 checklist template."""
    return {"items": JMC2_ITEMS}


@router.get("/")
def get_all_centers(current_user: dict = Depends(get_current_user)):
    """Get all evacuation centers."""
    result = (
        supabase.table("evacuation_centers")
        .select("*")
        .order("name")
        .execute()
    )
    return result.data or []


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


@router.get("/{center_id}/estimate-capacity")
def estimate_capacity(center_id: str, current_user: dict = Depends(get_current_user)):
    """
    Calculate estimated facility capacity based on:
    Historical Running Average of peak occupancies + 15% safety buffer.
    Fallback: Floor Area (sqm) / 3.5 sqm per person + 15% safety buffer.
    """
    center_res = (
        supabase.table("evacuation_centers")
        .select("*")
        .eq("id", center_id)
        .single()
        .execute()
    )
    center = center_res.data
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")

    # Fetch historical utilization logs
    hist_res = (
        supabase.table("evac_history_log")
        .select("peak_occupancy")
        .eq("center_id", center_id)
        .execute()
    )
    history = hist_res.data or []
    peaks = [h["peak_occupancy"] for h in history if h.get("peak_occupancy") and h["peak_occupancy"] > 0]

    method = "historical_running_average"
    if len(peaks) > 0:
        running_avg = sum(peaks) / len(peaks)
    else:
        # Fallback to floor area calculation (3.5 sqm standard per occupant)
        floor_sqm = float(center.get("floor_area_sqm") or 0.0)
        if floor_sqm > 0:
            running_avg = floor_sqm / 3.5
            method = "floor_area_standard"
        else:
            running_avg = float(center.get("capacity") or 100.0)
            method = "baseline_capacity"

    buffer_pct = 0.15
    estimated = math.ceil(running_avg * (1.0 + buffer_pct))

    return {
        "center_id": center_id,
        "method": method,
        "running_average": round(running_avg, 1),
        "safety_buffer_pct": "15%",
        "estimated_capacity": estimated,
        "historical_records_count": len(peaks),
    }


def _parse_numeric(value) -> float | None:
    """Strip non-numeric characters and return a float, or None if unparseable."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    import re
    cleaned = re.sub(r"[^\d.]", "", str(value))
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _parse_year(value) -> int | None:
    """Extract the first 4-digit year from any value, or None."""
    if value is None:
        return None
    if isinstance(value, int):
        return value
    import re
    match = re.search(r"\d{4}", str(value))
    return int(match.group()) if match else None


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_center(body: EvacuationCenterCreate, current_user: dict = Depends(get_current_user)):
    """Add a new evacuation center with Camp Management Structure."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    now_iso = datetime.now(timezone.utc).isoformat()
    payload = {
        "name": body.name,
        "address": body.address,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "capacity": body.capacity,
        "year_established": body.year_established,
        "floor_area_sqm": _parse_numeric(body.floor_area_sqm),
        "lot_area": body.lot_area,
        "type": body.type,
        "current_occupancy": 0,
        "status": "available",
        "contact_person": body.contact_person,
        "contact_number": body.contact_number,
        "personnel_directory": body.personnel_directory or [],
        "facilities_checklist": body.facilities_checklist or {},
        "camp_layout_filename": body.camp_layout_filename,
        "contingency_plan": body.contingency_plan,
        "prepared_by": body.prepared_by,
        "approved_by": body.approved_by,
        "structural_integrity_report": body.structural_integrity_report,
        "updated_at": now_iso,
    }
    # Include audit columns only if they exist in the table (added via patch)
    try:
        result = supabase.table("evacuation_centers").insert({
            **payload,
            "updated_by": current_user.get("sub"),
            "last_updated_by_name": current_user.get("full_name"),
        }).execute()
    except Exception:
        result = supabase.table("evacuation_centers").insert(payload).execute()
    return result.data[0]


@router.patch("/{center_id}")
def update_center(
    center_id: str,
    body: EvacuationCenterUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an evacuation center's profile, personnel directory, or capacity."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "floor_area_sqm" in updates:
        updates["floor_area_sqm"] = _parse_numeric(updates["floor_area_sqm"])
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    now_iso = datetime.now(timezone.utc).isoformat()
    updates["updated_at"] = now_iso

    # Try with audit columns first; fall back silently if they don't exist yet
    try:
        full_updates = {
            **updates,
            "updated_by": current_user.get("sub"),
            "last_updated_by_name": current_user.get("full_name"),
        }
        result = (
            supabase.table("evacuation_centers")
            .update(full_updates)
            .eq("id", center_id)
            .execute()
        )
    except Exception:
        result = (
            supabase.table("evacuation_centers")
            .update(updates)
            .eq("id", center_id)
            .execute()
        )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evacuation center not found")
    return result.data[0]


@router.post("/{center_id}/jmc2-checklist")
def evaluate_jmc2_checklist(
    center_id: str,
    body: JMC2ChecklistSubmit,
    current_user: dict = Depends(get_current_user),
):
    """
    Evaluate 20-item JMC No. 2 Series 2021 compliance checklist.
    For any items marked with status 'issue', automatically triggers maintenance requests.
    """
    center_res = supabase.table("evacuation_centers").select("*").eq("id", center_id).single().execute()
    center = center_res.data
    if not center:
        raise HTTPException(status_code=404, detail="Evacuation center not found")

    checklist_data = body.checklist or {}
    total_items = len(JMC2_ITEMS)
    compliant_count = sum(1 for k, v in checklist_data.items() if v.get("status") == "compliant")
    score_pct = round((compliant_count / total_items) * 100, 1)

    issues_found = []
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    precise_stamp = now_dt.strftime("%m-%d-%Y %H:%M:%S")

    for item in JMC2_ITEMS:
        item_id = item["id"]
        eval_item = checklist_data.get(item_id, {})
        if eval_item.get("status") == "issue":
            issue_title = f"JMC2 Non-Compliance Defect: {item['name']} at {center['name']}"
            issue_remarks = eval_item.get("remarks") or "Automatic maintenance trigger from JMC2 inspection."
            issues_found.append({
                "item_name": item["name"],
                "remarks": issue_remarks,
            })

            # Auto-trigger a maintenance request log entry
            try:
                supabase.table("resource_logs").insert({
                    "event_type": "maintenance",
                    "resource_name": f"Facility Maintenance: {item['name']}",
                    "resource_type": "facility_maintenance",
                    "new_status": "maintenance_required",
                    "description": f"AUTOMATED MAINTENANCE TICKET (JMC2 Audit): {issue_title}. Details: {issue_remarks}. Inspection Timestamp: {precise_stamp}.",
                    "performed_by": current_user.get("sub"),
                    "performed_by_name": current_user.get("full_name"),
                    "created_at": now_iso,
                }).execute()
            except Exception as ex:
                print(f"Warning: Could not log maintenance item for JMC2 issue: {ex}")

    # Persist updated JMC2 compliance checklist in center record
    updated = (
        supabase.table("evacuation_centers")
        .update({
            "jmc2_checklist": checklist_data,
            "jmc2_score": score_pct,
            "jmc2_last_assessed_at": now_iso,
            "jmc2_inspector": body.inspector_name or current_user.get("full_name"),
            "updated_at": now_iso,
            "updated_by": current_user.get("sub"),
            "last_updated_by_name": current_user.get("full_name"),
        })
        .eq("id", center_id)
        .execute()
    )

    return {
        "center_id": center_id,
        "score_pct": score_pct,
        "compliant_count": compliant_count,
        "total_items": total_items,
        "issues_flagged": len(issues_found),
        "automated_maintenance_tickets_triggered": len(issues_found),
        "last_updated_precise": precise_stamp,
        "center": updated.data[0] if updated.data else None,
    }


@router.post("/{center_id}/archive-monthly")
def archive_center_monthly(
    center_id: str,
    body: MonthlyArchiveRequest,
    current_user: dict = Depends(get_current_user),
):
    """Execute monthly archival workflow for facility profiles."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    now_dt = datetime.now(timezone.utc)
    cycle = body.archive_cycle or now_dt.strftime("%Y-%m")
    now_iso = now_dt.isoformat()
    precise_stamp = now_dt.strftime("%m-%d-%Y %H:%M:%S")

    result = (
        supabase.table("evacuation_centers")
        .update({
            "monthly_archive_cycle": cycle,
            "archived_at": now_iso,
            "updated_at": now_iso,
            "updated_by": current_user.get("sub"),
            "last_updated_by_name": current_user.get("full_name"),
            "status_remarks": f"Monthly Archival Completed for Cycle [{cycle}]. {body.notes or ''}".strip(),
        })
        .eq("id", center_id)
        .execute()
    )

    return {
        "center_id": center_id,
        "archive_cycle": cycle,
        "archived_at_precise": precise_stamp,
        "message": f"Facility profile successfully archived for monthly cycle {cycle}.",
    }


@router.delete("/{center_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_center(center_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an evacuation center. Admin only."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    supabase.table("evacuation_centers").delete().eq("id", center_id).execute()

