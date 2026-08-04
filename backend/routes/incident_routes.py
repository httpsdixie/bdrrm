from enum import Enum
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from ..database import supabase
from ..auth.dependencies import get_current_user
from datetime import datetime, timezone, timedelta
import uuid

router = APIRouter(prefix="/incidents", tags=["Incidents"])

# =============================================
# Domain Enums
# =============================================

class IncidentSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentStatus(str, Enum):
    ongoing = "ongoing"
    resolved = "resolved"


ONGOING_STATUSES = {"ongoing", "active", "responding"}
LEGACY_STATUS_ALIAS = {"active": "ongoing", "responding": "ongoing"}


def _normalize_incident_status(status: str) -> str:
    if status in LEGACY_STATUS_ALIAS:
        return LEGACY_STATUS_ALIAS[status]
    return status


def _normalize_incident_row(item: dict) -> dict:
    if not isinstance(item, dict):
        return item
    status = item.get("status")
    if status in LEGACY_STATUS_ALIAS:
        item = {**item, "status": LEGACY_STATUS_ALIAS[status]}
    return item


# =============================================
# Schemas
# =============================================

class IncidentCreate(BaseModel):
    title: str
    description: str                   # mandatory per spec
    type: str
    severity: IncidentSeverity = IncidentSeverity.medium
    latitude: float
    longitude: float
    location_address: Optional[str] = None
    geolocation_verified: Optional[bool] = None
    # Parties & casualties
    parties_involved: Optional[str] = None
    casualty_count: Optional[int] = None
    casualty_status: Optional[str] = None
    casualties_dead: Optional[int] = None
    casualties_injured: Optional[int] = None
    casualties_missing: Optional[int] = None
    consciousness_status: Optional[str] = None
    # Root cause
    root_cause: Optional[str] = None
    root_cause_detail: Optional[str] = None
    # Reporter
    reporter_name: Optional[str] = None
    reporter_contact: Optional[str] = None
    occurred_at: Optional[datetime] = None
    # Response
    people_involved: Optional[int] = None
    action_taken: Optional[str] = None
    human_resources: Optional[str] = None
    victims: Optional[list] = None
    suspects: Optional[list] = None
    triage_level: Optional[str] = None


class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    severity: Optional[IncidentSeverity] = None
    status: Optional[IncidentStatus] = None
    triage_level: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    geolocation_verified: Optional[bool] = None
    occurred_at: Optional[datetime] = None
    parties_involved: Optional[str] = None
    casualty_count: Optional[int] = None
    casualty_status: Optional[str] = None
    casualties_dead: Optional[int] = None
    casualties_injured: Optional[int] = None
    casualties_missing: Optional[int] = None
    consciousness_status: Optional[str] = None
    root_cause: Optional[str] = None
    root_cause_detail: Optional[str] = None
    reporter_name: Optional[str] = None
    reporter_contact: Optional[str] = None
    people_involved: Optional[int] = None
    action_taken: Optional[str] = None
    human_resources: Optional[str] = None
    resolution: Optional[str] = None
    victims: Optional[list] = None
    suspects: Optional[list] = None


# =============================================
# New columns guard — columns added via ALTER TABLE
# Only include in DB row if they have values
# =============================================
NEW_COLS = {
    "people_involved", "action_taken", "human_resources",
    "location_address", "parties_involved", "casualty_count",
    "casualty_status", "casualties_dead", "casualties_injured",
    "casualties_missing", "reporter_name", "reporter_contact",
    "photo_url", "consciousness_status", "root_cause",
    "root_cause_detail", "geolocation_verified", "resolution",
    "resolved_at", "occurred_at", "victims", "suspects",
    "triage_level",
}

SENTINEL_IGNORE_VALUES = {
    "casualty_status": {"none"},
    "consciousness_status": {"unknown"},
    "root_cause": {"unknown"},
}


# Fields that are explicitly clearable — sending null/empty should overwrite existing DB value
CLEARABLE_FIELDS = {"suspects", "victims", "parties_involved", "human_resources", "resolution", "action_taken"}


def _is_valid_incident_field(key: str, value) -> bool:
    # Clearable fields: allow None and empty list/string to pass through so DB gets overwritten
    if key in CLEARABLE_FIELDS:
        return True
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    sentinel_values = SENTINEL_IGNORE_VALUES.get(key)
    if sentinel_values and str(value).strip().lower() in sentinel_values:
        return False
    return True


def _serialize_value(value):
    """Convert Python types that are not JSON-serializable to safe equivalents."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    return value


def _sanitize_incident_payload(payload: dict) -> dict:
    result = {}
    for key, value in payload.items():
        if not _is_valid_incident_field(key, value):
            continue
        result[key] = _serialize_value(value)
    return result


def _execute_incident_write(fn, payload: dict):
    import re
    data = dict(payload)
    while True:
        try:
            return fn(data).execute()
        except Exception as exc:
            err_str = str(exc)
            if "PGRST204" in err_str or "schema cache" in err_str:
                match = re.search(r"Could not find the '([^']+)' column", err_str)
                if match:
                    missing_col = match.group(1)
                    if missing_col in data:
                        del data[missing_col]
                        continue
            raise


def _fetch_incident(incident_id: str) -> Optional[dict]:
    result = (
        supabase.table("incidents")
        .select("*")
        .eq("id", incident_id)
        .single()
        .execute()
    )
    return result.data if result.data else None


def _record_incident_audit(
    incident_id: str,
    user_id: Optional[str],
    changes: dict,
    status_before: Optional[str] = None,
    status_after: Optional[str] = None,
    summary: Optional[str] = None,
):
    """Record an audit row and add a normalized event_type for frontend consumption.

    event_type values: 'added', 'updated', 'resolved'
    """
    # Determine event_type deterministically
    summary_text = (summary or "").lower()
    event_type = 'updated'
    if 'created' in summary_text or 'reported' in summary_text or 'incident created' in summary_text:
        event_type = 'added'
    elif status_before and status_before != status_after:
        if str(status_after).lower() == 'resolved':
            event_type = 'resolved'
        else:
            event_type = 'updated'

    try:
        supabase.table("incident_audit_trail").insert({
            "incident_id": incident_id,
            "changed_by": user_id,
            "change_timestamp": datetime.now(timezone.utc).isoformat(),
            "status_before": status_before,
            "status_after": status_after,
            "change_summary": summary or "Incident record updated",
            "changes": changes,
            "event_type": event_type,
        }).execute()
    except Exception:
        pass


# =============================================
# Routes
# =============================================

@router.get("/")
def get_all_incidents(current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("incidents")
        .select("*, users!incidents_reported_by_fkey(full_name, username)")
        .order("created_at", desc=True)
        .execute()
    )
    return [_normalize_incident_row(item) for item in (result.data or [])]


@router.get("/active")
def get_active_incidents(current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("incidents")
        .select("*, users!incidents_reported_by_fkey(full_name, username)")
        .in_("status", list(ONGOING_STATUSES))
        .order("created_at", desc=True)
        .execute()
    )
    return [_normalize_incident_row(item) for item in (result.data or [])]


@router.get("/public/summary")
def get_public_incident_summary():
    """Public-safe summary — Data Privacy Act compliant."""
    try:
        result = supabase.table("incidents").select(
            "type, status, severity, people_involved, casualty_count, casualty_status"
        ).execute()
    except Exception:
        result = supabase.table("incidents").select("type, status, severity").execute()

    incidents = result.data or []
    type_counts = {}
    total_people = 0
    total_casualties = 0

    for inc in incidents:
        t = inc.get("type", "other")
        type_counts[t] = type_counts.get(t, 0) + 1
        total_people     += inc.get("people_involved") or 0
        total_casualties += inc.get("casualty_count")  or 0

    ongoing_count = sum(1 for i in incidents if i["status"] in ONGOING_STATUSES)
    return {
        "total_incidents": len(incidents),
        "total_people_involved": total_people,
        "total_casualties": total_casualties,
        "by_type": type_counts,
        "ongoing": ongoing_count,
        "active": ongoing_count,
        "resolved": sum(1 for i in incidents if i["status"] == "resolved"),
    }


@router.get("/logs")
def get_incident_logs(current_user: dict = Depends(get_current_user)):
    try:
        result = (
            supabase.table("incident_audit_trail")
            .select(
                "id, incident_id, changed_by, change_timestamp, status_before, status_after, change_summary, changes, users!incident_audit_trail_changed_by_fkey(full_name), incidents!incident_audit_trail_incident_id_fkey(title)"
            )
            .order("change_timestamp", desc=True)
            .limit(200)
            .execute()
        )
        return result.data or []
    except Exception:
        try:
            fallback = (
                supabase.table("incident_audit_trail")
                .select("id, incident_id, changed_by, change_timestamp, status_before, status_after, change_summary, changes")
                .order("change_timestamp", desc=True)
                .limit(200)
                .execute()
            )
            return fallback.data or []
        except Exception:
            return []


@router.get("/{incident_id}")
def get_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("incidents")
        .select("*, users!incidents_reported_by_fkey(full_name, username)")
        .eq("id", incident_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return _normalize_incident_row(result.data)


@router.get("/{incident_id}/history")
def get_incident_history(incident_id: str, current_user: dict = Depends(get_current_user)):
    try:
        result = (
            supabase.table("incident_audit_trail")
            .select("id, incident_id, changed_by, change_timestamp, status_before, status_after, change_summary, changes")
            .eq("incident_id", incident_id)
            .order("change_timestamp", desc=True)
            .limit(10)
            .execute()
        )
        return result.data or []
    except Exception:
        return []


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_incident(body: IncidentCreate, current_user: dict = Depends(get_current_user)):
    base = {
        "title":       body.title,
        "description": body.description,
        "type":        body.type,
        "severity":    body.severity.value,
        "status":      "ongoing",
        "latitude":    body.latitude,
        "longitude":   body.longitude,
        "reported_by": current_user["sub"],
    }

    payload = {**base, **_sanitize_incident_payload(body.model_dump(exclude_unset=True))}

    try:
        result = _execute_incident_write(lambda data: supabase.table("incidents").insert(data), payload)
        incident = result.data[0]
        _record_incident_audit(
            incident_id=incident["id"],
            user_id=current_user.get("sub"),
            changes={k: incident.get(k) for k in payload.keys()},
            status_before=None,
            status_after=incident.get("status"),
            summary="Incident created",
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return incident


@router.post("/{incident_id}/photo", status_code=status.HTTP_200_OK)
async def upload_incident_photo(
    incident_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a photo for an incident to Supabase Storage."""
    # Validate file type
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, and WebP images are allowed"
        )

    # Validate size (5MB limit)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB"
        )

    # Generate unique filename
    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    filename = f"{incident_id}/{uuid.uuid4().hex}.{ext}"

    try:
        # Upload to Supabase Storage bucket "incident-photos"
        supabase.storage.from_("incident-photos").upload(
            path=filename,
            file=contents,
            file_options={"content-type": file.content_type},
        )

        # Get public URL
        url_result = supabase.storage.from_("incident-photos").get_public_url(filename)
        photo_url = url_result if isinstance(url_result, str) else url_result.get("publicUrl", "")

        # Update incident record with photo URL
        supabase.table("incidents").update({
            "photo_url": photo_url,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", incident_id).execute()

        return {"photo_url": photo_url}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Photo upload failed: {str(e)}"
        )


@router.patch("/{incident_id}")
def update_incident(
    incident_id: str,
    body: IncidentUpdate,
    current_user: dict = Depends(get_current_user),
):
    updates = _sanitize_incident_payload(body.model_dump(exclude_unset=True))
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    existing = _fetch_incident(incident_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    if existing.get("status") == IncidentStatus.resolved.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Resolved incident is locked and cannot be modified")

    now = datetime.now(timezone.utc).isoformat()
    updates["updated_at"] = now

    if updates.get("status") == IncidentStatus.resolved:
        updates["resolved_at"] = now
    elif "status" in updates and updates["status"] != IncidentStatus.resolved:
        updates["resolved_at"] = None

    try:
        def _incident_update(data):
            return supabase.table("incidents").update(data).eq("id", incident_id)

        result = _execute_incident_write(_incident_update, updates)
        incident = result.data[0] if result.data else None
        _record_incident_audit(
            incident_id=incident_id,
            user_id=current_user.get("sub"),
            changes=updates,
            status_before=existing.get("status"),
            status_after=updates.get("status", existing.get("status")),
            summary="Incident updated",
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


@router.delete("/{incident_id}", status_code=status.HTTP_200_OK)
def delete_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    """
    Soft-archive an incident instead of permanently deleting it.
    Only admin/officer may perform this action. This updates the incident status to 'archived'
    and records an audit trail entry.
    """
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    existing = _fetch_incident(incident_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    now = datetime.now(timezone.utc).isoformat()
    try:
        # Detach resource dispatch links (preserve records but clear association)
        supabase.table("resource_dispatch").update({"incident_id": None}).eq("incident_id", incident_id).execute()

        # Soft-archive: set status to 'archived' and updated_at
        result = supabase.table("incidents").update({"status": "archived", "updated_at": now}).eq("id", incident_id).execute()

        _record_incident_audit(
            incident_id=incident_id,
            user_id=current_user.get("sub"),
            changes={"status": "archived"},
            status_before=existing.get("status"),
            status_after="archived",
            summary="Incident archived by user",
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return {"message": "Incident archived", "incident_id": incident_id}


# =============================================
# Data Verification & QA Endpoints
# =============================================

@router.post("/archive-old", status_code=status.HTTP_200_OK)
def archive_old_resolved_incidents(days: int = 30, current_user: dict = Depends(get_current_user)):
    """
    Archive resolved incidents that were resolved at least `days` days ago.
    This is intended to be run periodically (e.g., daily via cron) by an admin/officer.
    Returns number of incidents archived and their IDs.
    """
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff.isoformat()

    try:
        # Select resolved incidents older than cutoff and not already archived
        resp = (
            supabase.table("incidents")
            .select("id, status, resolved_at")
            .eq("status", "resolved")
            .lte("resolved_at", cutoff_iso)
            .execute()
        )
        to_archive = resp.data or []
        ids = [i.get('id') for i in to_archive if i.get('id')]
        if not ids:
            return {"archived_count": 0, "archived_ids": []}

        now_iso = datetime.now(timezone.utc).isoformat()
        supabase.table("incidents").update({"status": "archived", "updated_at": now_iso}).in_("id", ids).execute()

        for inc in to_archive:
            _record_incident_audit(
                incident_id=inc.get('id'),
                user_id=current_user.get("sub"),
                changes={"status": "archived", "auto_archive_days": days},
                status_before=inc.get('status'),
                status_after="archived",
                summary=f"Auto-archived after {days} days since resolved",
            )

        return {"archived_count": len(ids), "archived_ids": ids}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/purge/all", status_code=status.HTTP_200_OK)
def purge_all_incidents(current_user: dict = Depends(get_current_user)):
    """
    Purge/clear all incident records from the Supabase database.
    Only admin users may perform this bulk operation.
    """
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    try:
        # Clear foreign keys in resource_dispatch
        try:
            supabase.table("resource_dispatch").update({"incident_id": None}).neq("id", "00000000-0000-0000-0000-000000000000").execute()
        except Exception:
            pass

        # Clear audit logs
        try:
            supabase.table("incident_audit_trail").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        except Exception:
            pass

        # Delete all incidents from Supabase
        res = supabase.table("incidents").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        return {"message": "All incident records purged successfully from Supabase", "count": len(res.data) if res.data else 0}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))



# =============================================
# Severity Triage
# =============================================

# Triage level → recommended actions for Barangay Linao responders
TRIAGE_GUIDANCE = {
    "green": {
        "label": "Green — Minor",
        "color": "#22c55e",
        "actions": [
            "Log incident and monitor remotely",
            "No immediate deployment required",
            "Notify Barangay Captain if escalation is expected",
        ],
        "escalate_to": "yellow",
    },
    "yellow": {
        "label": "Yellow — Moderate",
        "color": "#eab308",
        "actions": [
            "Dispatch 1–2 tanod/BRT members to assess on-site",
            "Prepare medical kit and communication radio",
            "Alert BFP or PNP if incident type warrants",
        ],
        "escalate_to": "orange",
    },
    "orange": {
        "label": "Orange — Serious",
        "color": "#f97316",
        "actions": [
            "Deploy BDRRMC response team immediately",
            "Coordinate with BFP / PNP / RHU as applicable",
            "Set up incident command post near site",
            "Begin evacuee check-in if area is at risk",
        ],
        "escalate_to": "red",
    },
    "red": {
        "label": "Red — Critical",
        "color": "#ef4444",
        "actions": [
            "All available responders to mobilize now",
            "Notify CDRRMO Ormoc City immediately",
            "Activate barangay-wide evacuation protocol if needed",
            "Request mutual aid from neighboring barangays",
            "Establish media/information blackout until life safety is secured",
        ],
        "escalate_to": None,
    },
}

TRIAGE_SEVERITY_MAP = {
    "low":      "green",
    "medium":   "yellow",
    "high":     "orange",
    "critical": "red",
}


@router.get("/triage/guidance")
def get_triage_guidance(current_user: dict = Depends(get_current_user)):
    """Return triage level definitions and recommended actions for field responders."""
    return TRIAGE_GUIDANCE


@router.patch("/{incident_id}/triage")
def set_triage_level(
    incident_id: str,
    triage_level: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Set or update the triage level of an ongoing incident.
    triage_level: 'green' | 'yellow' | 'orange' | 'red'
    """
    if triage_level not in TRIAGE_GUIDANCE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid triage level. Must be one of: {list(TRIAGE_GUIDANCE.keys())}",
        )

    existing = _fetch_incident(incident_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    if existing.get("status") == "resolved":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot triage a resolved incident")

    now = datetime.now(timezone.utc).isoformat()
    prev_triage = existing.get("triage_level", "green")

    try:
        result = supabase.table("incidents").update({
            "triage_level": triage_level,
            "updated_at": now,
        }).eq("id", incident_id).execute()

        _record_incident_audit(
            incident_id=incident_id,
            user_id=current_user.get("sub"),
            changes={"triage_level": triage_level},
            status_before=existing.get("status"),
            status_after=existing.get("status"),
            summary=f"Triage level changed from {prev_triage} to {triage_level}",
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    incident = result.data[0] if result.data else existing
    return {
        "incident": incident,
        "triage_guidance": TRIAGE_GUIDANCE[triage_level],
    }


# =============================================
# Responder Dispatch
# =============================================

class DispatchCreate(BaseModel):
    responder_id: Optional[str] = None   # UUID of a user with role='responder'
    responder_name: Optional[str] = None  # free-text name if not a system user
    notes: Optional[str] = None


class DispatchStatusUpdate(BaseModel):
    dispatch_status: str  # 'on_scene' | 'returning' | 'returned' | 'recalled'
    notes: Optional[str] = None


VALID_DISPATCH_STATUSES = {"dispatched", "on_scene", "returning", "returned", "recalled"}


@router.get("/{incident_id}/dispatch")
def get_incident_dispatch(incident_id: str, current_user: dict = Depends(get_current_user)):
    """Get all responder dispatch records for a specific incident."""
    try:
        result = (
            supabase.table("responder_dispatch")
            .select("*, users!responder_dispatch_responder_id_fkey(full_name, role)")
            .eq("incident_id", incident_id)
            .order("dispatched_at", desc=False)
            .execute()
        )
        return result.data or []
    except Exception:
        # Fallback if join fails (FK not resolved)
        result = (
            supabase.table("responder_dispatch")
            .select("*")
            .eq("incident_id", incident_id)
            .order("dispatched_at", desc=False)
            .execute()
        )
        return result.data or []


@router.post("/{incident_id}/dispatch", status_code=status.HTTP_201_CREATED)
def dispatch_responder(
    incident_id: str,
    body: DispatchCreate,
    current_user: dict = Depends(get_current_user),
):
    """Dispatch a responder to an incident."""
    existing = _fetch_incident(incident_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    if existing.get("status") == "resolved":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot dispatch to a resolved incident")

    if not body.responder_id and not body.responder_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either responder_id or responder_name is required",
        )

    # Resolve name: use system user's full_name if responder_id is provided
    responder_name = body.responder_name
    if body.responder_id and not responder_name:
        try:
            user_res = supabase.table("users").select("full_name").eq("id", body.responder_id).single().execute()
            responder_name = user_res.data.get("full_name") if user_res.data else None
        except Exception:
            pass

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "incident_id": incident_id,
        "responder_id": body.responder_id,
        "responder_name": responder_name,
        "dispatched_by": current_user.get("sub"),
        "dispatched_by_name": current_user.get("full_name") or current_user.get("username"),
        "dispatched_at": now,
        "status": "dispatched",
        "notes": body.notes,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = supabase.table("responder_dispatch").insert(record).execute()
        dispatch = result.data[0] if result.data else record

        _record_incident_audit(
            incident_id=incident_id,
            user_id=current_user.get("sub"),
            changes={"responder_dispatched": responder_name or body.responder_id},
            status_before=existing.get("status"),
            status_after=existing.get("status"),
            summary=f"Responder dispatched: {responder_name or 'Unknown'}",
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return dispatch


@router.patch("/{incident_id}/dispatch/{dispatch_id}")
def update_dispatch_status(
    incident_id: str,
    dispatch_id: str,
    body: DispatchStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update the status of a dispatch record (on_scene, returning, returned, recalled)."""
    if body.dispatch_status not in VALID_DISPATCH_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {list(VALID_DISPATCH_STATUSES)}",
        )

    now = datetime.now(timezone.utc).isoformat()
    updates = {
        "status": body.dispatch_status,
        "updated_at": now,
    }
    if body.notes:
        updates["notes"] = body.notes
    if body.dispatch_status in ("returned", "recalled"):
        updates["returned_at"] = now

    try:
        result = (
            supabase.table("responder_dispatch")
            .update(updates)
            .eq("id", dispatch_id)
            .eq("incident_id", incident_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispatch record not found")
    return result.data[0]


@router.delete("/{incident_id}/dispatch/{dispatch_id}", status_code=status.HTTP_200_OK)
def recall_dispatch(
    incident_id: str,
    dispatch_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Recall/delete a dispatch record (before responder has left)."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    try:
        supabase.table("responder_dispatch").delete().eq("id", dispatch_id).eq("incident_id", incident_id).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return {"message": "Dispatch recalled", "dispatch_id": dispatch_id}


# =============================================
# Active Threat Board
# =============================================

@router.get("/threats/active")
def get_active_threats(current_user: dict = Depends(get_current_user)):
    """
    Returns all ongoing incidents ranked by triage severity for the live threat board.
    Each entry includes dispatched responder count and triage guidance.
    """
    TRIAGE_ORDER = {"red": 0, "orange": 1, "yellow": 2, "green": 3}

    try:
        result = (
            supabase.table("incidents")
            .select("id, title, type, status, severity, triage_level, latitude, longitude, location_address, created_at, updated_at, people_involved, casualty_count, casualty_status")
            .in_("status", ["ongoing"])
            .order("created_at", desc=True)
            .execute()
        )
        incidents = result.data or []
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    # Attach responder counts
    incident_ids = [i["id"] for i in incidents]
    responder_counts: dict[str, int] = {}

    if incident_ids:
        try:
            dispatch_res = (
                supabase.table("responder_dispatch")
                .select("incident_id, status")
                .in_("incident_id", incident_ids)
                .in_("status", ["dispatched", "on_scene"])
                .execute()
            )
            for row in (dispatch_res.data or []):
                iid = row["incident_id"]
                responder_counts[iid] = responder_counts.get(iid, 0) + 1
        except Exception:
            pass

    # Build response
    threats = []
    for inc in incidents:
        triage = inc.get("triage_level") or TRIAGE_SEVERITY_MAP.get(inc.get("severity", "medium"), "yellow")
        threats.append({
            **inc,
            "triage_level": triage,
            "triage_guidance": TRIAGE_GUIDANCE.get(triage, {}),
            "active_responders": responder_counts.get(inc["id"], 0),
        })

    # Sort: red first, then orange, yellow, green; within same level sort by created_at asc (oldest first = longest active)
    threats.sort(key=lambda x: (TRIAGE_ORDER.get(x["triage_level"], 9), x.get("created_at", "")))

    return {
        "total": len(threats),
        "red_count":    sum(1 for t in threats if t["triage_level"] == "red"),
        "orange_count": sum(1 for t in threats if t["triage_level"] == "orange"),
        "yellow_count": sum(1 for t in threats if t["triage_level"] == "yellow"),
        "green_count":  sum(1 for t in threats if t["triage_level"] == "green"),
        "threats": threats,
    }
