from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from database import supabase
from auth.dependencies import get_current_user
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/incidents", tags=["Incidents"])

# =============================================
# Schemas
# =============================================

class IncidentCreate(BaseModel):
    title: str
    description: str                   # mandatory per spec
    type: str
    severity: str = "medium"
    latitude: float
    longitude: float
    location_address: Optional[str] = None
    geolocation_verified: Optional[bool] = False
    # Parties & casualties
    parties_involved: Optional[str] = None
    casualty_count: Optional[int] = 0
    casualty_status: Optional[str] = "none"
    casualties_dead: Optional[int] = 0
    casualties_injured: Optional[int] = 0
    casualties_missing: Optional[int] = 0
    consciousness_status: Optional[str] = "unknown"
    # Root cause
    root_cause: Optional[str] = "unknown"
    root_cause_detail: Optional[str] = None
    # Reporter
    reporter_name: Optional[str] = None
    reporter_contact: Optional[str] = None
    # Response
    people_involved: Optional[int] = 0
    action_taken: Optional[str] = None
    human_resources: Optional[str] = None


class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    geolocation_verified: Optional[bool] = None
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
    "root_cause_detail", "geolocation_verified",
    "validation_status", "invalidation_reason", "invalidation_notes",
    "validated_by", "validated_at",
}

def safe_row(base: dict, extras: dict) -> dict:
    """Merge base fields with extra fields, skipping None AND zero-default new columns."""
    row = {**base}
    for k, v in extras.items():
        # Skip if value is None
        if v is None:
            continue
        # Skip integer new columns if value is 0 (default) to avoid schema cache errors
        if k in NEW_COLS and isinstance(v, int) and v == 0:
            continue
        if k in NEW_COLS:
            row[k] = v
    return row


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
    return result.data


@router.get("/active")
def get_active_incidents(current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("incidents")
        .select("*, users!incidents_reported_by_fkey(full_name, username)")
        .in_("status", ["active", "responding"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


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

    return {
        "total_incidents": len(incidents),
        "total_people_involved": total_people,
        "total_casualties": total_casualties,
        "by_type": type_counts,
        "active":   sum(1 for i in incidents if i["status"] in ("active", "responding")),
        "resolved": sum(1 for i in incidents if i["status"] == "resolved"),
    }


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
    return result.data


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_incident(body: IncidentCreate, current_user: dict = Depends(get_current_user)):
    # Always-safe base fields (exist in original schema)
    base = {
        "title":       body.title,
        "description": body.description,
        "type":        body.type,
        "severity":    body.severity,
        "status":      "active",
        "latitude":    body.latitude,
        "longitude":   body.longitude,
        "reported_by": current_user["sub"],
    }

    # Try inserting with new fields first; fall back to base only if schema not migrated
    extras = {}
    if body.location_address:   extras["location_address"]   = body.location_address
    if body.parties_involved:   extras["parties_involved"]   = body.parties_involved
    if body.reporter_name:      extras["reporter_name"]      = body.reporter_name
    if body.reporter_contact:   extras["reporter_contact"]   = body.reporter_contact
    if body.action_taken:       extras["action_taken"]       = body.action_taken
    if body.human_resources:    extras["human_resources"]    = body.human_resources
    if body.people_involved:    extras["people_involved"]    = body.people_involved
    if body.casualty_status and body.casualty_status != "none":
        extras["casualty_status"] = body.casualty_status
    if body.casualty_count and body.casualty_count > 0:
        extras["casualty_count"] = body.casualty_count
    if body.casualties_dead and body.casualties_dead > 0:
        extras["casualties_dead"] = body.casualties_dead
    if body.casualties_injured and body.casualties_injured > 0:
        extras["casualties_injured"] = body.casualties_injured
    if body.casualties_missing and body.casualties_missing > 0:
        extras["casualties_missing"] = body.casualties_missing
    # New protocol fields
    if body.consciousness_status and body.consciousness_status != "unknown":
        extras["consciousness_status"] = body.consciousness_status
    if body.root_cause and body.root_cause != "unknown":
        extras["root_cause"]        = body.root_cause
    if body.root_cause_detail:
        extras["root_cause_detail"] = body.root_cause_detail
    if body.geolocation_verified:
        extras["geolocation_verified"] = body.geolocation_verified

    # Try with extras first; if schema cache error, fall back to base only
    try:
        result = supabase.table("incidents").insert({**base, **extras}).execute()
    except Exception as e:
        if "schema cache" in str(e) or "PGRST204" in str(e):
            # New columns not yet in DB — insert base fields only
            result = supabase.table("incidents").insert(base).execute()
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return result.data[0]


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
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    if updates.get("status") == "resolved":
        updates["resolved_at"] = datetime.now(timezone.utc).isoformat()

    # Try full update; fall back removing new cols if schema not migrated
    try:
        result = (
            supabase.table("incidents")
            .update(updates)
            .eq("id", incident_id)
            .execute()
        )
    except Exception as e:
        if "schema cache" in str(e) or "PGRST204" in str(e):
            # Strip new columns and retry with base columns only
            safe_updates = {k: v for k, v in updates.items() if k not in NEW_COLS}
            result = (
                supabase.table("incidents")
                .update(safe_updates)
                .eq("id", incident_id)
                .execute()
            )
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return result.data[0]


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    supabase.table("resource_dispatch").update({"incident_id": None}).eq("incident_id", incident_id).execute()
    supabase.table("incidents").delete().eq("id", incident_id).execute()


# =============================================
# Data Verification & QA Endpoints
# =============================================

class ValidationRequest(BaseModel):
    action: str                              # 'validate' or 'invalidate'
    invalidation_reason: Optional[str] = None  # 'duplicate','misinformation','test_entry','other'
    invalidation_notes: Optional[str] = None


@router.get("/validation/pending")
def get_pending_incidents(current_user: dict = Depends(get_current_user)):
    """Get all incidents pending validation. Officer/admin only."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    try:
        result = (
            supabase.table("incidents")
            .select("*, users!incidents_reported_by_fkey(full_name, username)")
            .eq("validation_status", "pending")
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception:
        # validation_status column not yet added — return all pending as fallback
        result = (
            supabase.table("incidents")
            .select("*, users!incidents_reported_by_fkey(full_name, username)")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return result.data or []


@router.get("/validation/audit-log")
def get_invalidated_incidents(current_user: dict = Depends(get_current_user)):
    """Get audit log of all invalidated reports. Officer/admin only."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    try:
        result = (
            supabase.table("incidents")
            .select("*, users!incidents_reported_by_fkey(full_name, username)")
            .eq("validation_status", "invalidated")
            .order("validated_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception:
        return []


@router.patch("/{incident_id}/validate")
def validate_incident(
    incident_id: str,
    body: ValidationRequest,
    current_user: dict = Depends(get_current_user),
):
    """Validate or invalidate an incident. Officer/admin only."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    if body.action not in ("validate", "invalidate"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Action must be 'validate' or 'invalidate'")

    if body.action == "invalidate" and not body.invalidation_reason:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalidation reason is required")

    updates = {
        "validated_at": datetime.now(timezone.utc).isoformat(),
        "updated_at":   datetime.now(timezone.utc).isoformat(),
    }

    if body.action == "validate":
        updates["validation_status"] = "validated"
    else:
        updates["validation_status"]    = "invalidated"
        updates["invalidation_reason"]  = body.invalidation_reason
        if body.invalidation_notes:
            updates["invalidation_notes"] = body.invalidation_notes
        # Invalidated incidents are effectively resolved/closed
        updates["status"] = "resolved"

    # Try with new cols; fall back if schema not migrated
    try:
        updates["validated_by"] = current_user["sub"]
        result = (
            supabase.table("incidents")
            .update(updates)
            .eq("id", incident_id)
            .execute()
        )
    except Exception as e:
        if "schema cache" in str(e) or "PGRST204" in str(e):
            safe = {k: v for k, v in updates.items() if k not in NEW_COLS}
            result = supabase.table("incidents").update(safe).eq("id", incident_id).execute()
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return result.data[0]


@router.get("/validation/stats")
def get_validation_stats(current_user: dict = Depends(get_current_user)):
    """Summary counts for the validation dashboard."""
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    try:
        result = supabase.table("incidents").select("validation_status, invalidation_reason").execute()
        rows = result.data or []
        stats = {
            "pending":     sum(1 for r in rows if r.get("validation_status") == "pending"),
            "validated":   sum(1 for r in rows if r.get("validation_status") == "validated"),
            "invalidated": sum(1 for r in rows if r.get("validation_status") == "invalidated"),
            "total":       len(rows),
            "by_reason": {},
        }
        for r in rows:
            if r.get("validation_status") == "invalidated" and r.get("invalidation_reason"):
                reason = r["invalidation_reason"]
                stats["by_reason"][reason] = stats["by_reason"].get(reason, 0) + 1
        return stats
    except Exception:
        return {"pending": 0, "validated": 0, "invalidated": 0, "total": 0, "by_reason": {}}
