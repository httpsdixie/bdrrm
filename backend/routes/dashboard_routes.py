from fastapi import APIRouter, Depends
from ..database import supabase
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

ONGOING_STATUSES = {"ongoing", "active", "responding"}


@router.get("/stats")
def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """
    Single endpoint that aggregates all dashboard numbers.
    Minimizes round trips from the frontend.
    """

    # Ongoing incidents
    incidents_res = (
        supabase.table("incidents")
        .select("id, status, type, created_at")
        .in_("status", list(ONGOING_STATUSES))
        .execute()
    )
    active_incidents = incidents_res.data or []

    # Total incidents ever recorded (all statuses)
    total_res = (
        supabase.table("incidents")
        .select("id", count="exact")
        .execute()
    )
    total_incidents = total_res.count if total_res.count is not None else len(total_res.data or [])

    # Evacuation centers
    evac_res = (
        supabase.table("evacuation_centers")
        .select("id, status, capacity, current_occupancy, facilities_checklist, personnel_directory")
        .execute()
    )
    centers = evac_res.data or []
    total_capacity = sum(c["capacity"] for c in centers)
    # Facilities Evaluated = centers with a non-empty facilities_checklist (matches evacuation-monitoring.js logic)
    facilities_evaluated = sum(
        1 for c in centers
        if c.get("facilities_checklist") and len(c["facilities_checklist"]) > 0
    )
    # Staffed Centers = centers with at least one personnel_directory entry with a name (matches evacuation-monitoring.js logic)
    staffed_centers = sum(
        1 for c in centers
        if c.get("personnel_directory") and any(
            p.get("first_name") or p.get("last_name")
            for p in c["personnel_directory"]
        )
    )

    # Resources — total from resources table (matches Resource Tracking page)
    assets_res = (
        supabase.table("resources")
        .select("id, status")
        .execute()
    )
    assets = assets_res.data or []
    total_assets     = len(assets)
    deployed_assets  = sum(1 for a in assets if a.get("status") == "deployed")
    available_assets = sum(1 for a in assets if a.get("status") == "available")

    return {
        "incidents": {
            "active_total": len(active_incidents),
            "total": total_incidents,
        },
        "evacuation": {
            "total_centers": len(centers),
            "facilities_evaluated": facilities_evaluated,
            "staffed_centers": staffed_centers,
            "total_capacity": total_capacity,
        },
        "resources": {
            "total_items": total_assets,
            "deployed": deployed_assets,
            "available": available_assets,
        },
    }


@router.get("/recent-incidents")
def get_recent_incidents(current_user: dict = Depends(get_current_user)):
    """Get 5 most recent incidents for the dashboard feed."""
    result = (
        supabase.table("incidents")
        .select("id, title, type, severity, status, created_at, users!incidents_reported_by_fkey(full_name)")
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    return result.data or []


@router.get("/evac-status")
def get_evac_status(current_user: dict = Depends(get_current_user)):
    """Get evacuation centers for the dashboard status panel."""
    result = (
        supabase.table("evacuation_centers")
        .select("id, name, capacity, current_occupancy, status")
        .order("name")
        .execute()
    )
    return result.data or []


@router.get("/analytics")
def get_dashboard_analytics(current_user: dict = Depends(get_current_user)):
    """
    Returns aggregated historical trend data and hazard type distribution for dashboard charts.
    """
    from datetime import datetime, timezone, timedelta
    from collections import defaultdict

    now = datetime.now(timezone.utc)

    # Fetch all incidents with created_at, type, status
    incidents_res = supabase.table("incidents").select("id, type, status, created_at").execute()
    incidents = incidents_res.data or []

    # Hazard type distribution
    type_counts = {"flood": 0, "fire": 0, "landslide": 0, "typhoon": 0, "medical": 0, "other": 0}
    for inc in incidents:
        t = inc.get("type", "other")
        if t in type_counts:
            type_counts[t] += 1
        else:
            type_counts["other"] += 1

    def is_resolved(inc):
        return (inc.get("status") or "").lower() in ("resolved", "closed")

    def parse_dt(s):
        if not s:
            return None
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None

    # ── 6 Months ──
    labels_6m = []
    data_6m = []
    resolved_6m = []
    for i in range(5, -1, -1):
        month_dt = now - timedelta(days=i * 30)
        label = month_dt.strftime("%b")
        labels_6m.append(label)
        month_start = (now - timedelta(days=(i + 1) * 30))
        month_end   = (now - timedelta(days=i * 30))
        bucket = [inc for inc in incidents if month_start <= (parse_dt(inc["created_at"]) or now) < month_end]
        data_6m.append(len(bucket))
        resolved_6m.append(sum(1 for inc in bucket if is_resolved(inc)))

    # ── 30 Days (4 weeks) ──
    labels_30d = ["Week 1", "Week 2", "Week 3", "Week 4"]
    data_30d = []
    resolved_30d = []
    for i in range(4):
        week_start = now - timedelta(days=(4 - i) * 7)
        week_end   = now - timedelta(days=(3 - i) * 7)
        bucket = [inc for inc in incidents if week_start <= (parse_dt(inc["created_at"]) or now) < week_end]
        data_30d.append(len(bucket))
        resolved_30d.append(sum(1 for inc in bucket if is_resolved(inc)))

    # ── 7 Days ──
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    labels_7d = []
    data_7d = []
    resolved_7d = []
    for i in range(6, -1, -1):
        day_dt = now - timedelta(days=i)
        labels_7d.append(day_names[day_dt.weekday()])
        day_start = day_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)
        bucket = [inc for inc in incidents if day_start <= (parse_dt(inc["created_at"]) or now) < day_end]
        data_7d.append(len(bucket))
        resolved_7d.append(sum(1 for inc in bucket if is_resolved(inc)))

    return {
        "periods": {
            "6m":  {"labels": labels_6m,  "incidents": data_6m,  "resolved": resolved_6m},
            "30d": {"labels": labels_30d, "incidents": data_30d, "resolved": resolved_30d},
            "7d":  {"labels": labels_7d,  "incidents": data_7d,  "resolved": resolved_7d},
        },
        "hazard_distribution": type_counts,
    }

