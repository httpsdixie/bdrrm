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
        .select("id, status, severity, type, created_at")
        .in_("status", list(ONGOING_STATUSES))
        .execute()
    )
    active_incidents = incidents_res.data or []

    # Critical incidents specifically
    critical_count = sum(1 for i in active_incidents if i["severity"] == "critical")

    # Evacuation centers
    evac_res = (
        supabase.table("evacuation_centers")
        .select("id, status, capacity, current_occupancy")
        .execute()
    )
    centers = evac_res.data or []
    total_evacuees  = sum(c["current_occupancy"] for c in centers)
    total_capacity  = sum(c["capacity"] for c in centers)
    available_centers = sum(1 for c in centers if c["status"] == "available")
    full_centers      = sum(1 for c in centers if c["status"] == "full")

    # Resources deployed (out in the field)
    resources_res = (
        supabase.table("resources")
        .select("id, status, available_quantity, quantity")
        .execute()
    )
    resources = resources_res.data or []
    deployed_count    = sum(1 for r in resources if r["status"] == "deployed")
    available_count   = sum(1 for r in resources if r["status"] == "available")
    total_items       = len(resources)

    return {
        "incidents": {
            "active_total": len(active_incidents),
            "critical": critical_count,
        },
        "evacuation": {
            "total_centers": len(centers),
            "available": available_centers,
            "full": full_centers,
            "total_evacuees": total_evacuees,
            "total_capacity": total_capacity,
        },
        "resources": {
            "total_items": total_items,
            "deployed": deployed_count,
            "available": available_count,
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
    # Incident category distribution from DB
    incidents_res = supabase.table("incidents").select("id, type, severity").execute()
    incidents = incidents_res.data or []

    type_counts = {"flood": 0, "fire": 0, "landslide": 0, "typhoon": 0, "medical": 0, "other": 0}
    for inc in incidents:
        t = inc.get("type", "other")
        if t in type_counts:
            type_counts[t] += 1
        else:
            type_counts["other"] += 1

    # If DB is empty, return zeroes for historical charts and hazard distribution
    if sum(type_counts.values()) == 0:
        type_counts = {"flood": 0, "fire": 0, "landslide": 0, "typhoon": 0, "medical": 0, "other": 0}
        return {
            "periods": {
                "6m": {
                    "labels": ["Mar", "Apr", "May", "Jun", "Jul", "Aug"],
                    "incidents": [0, 0, 0, 0, 0, 0],
                    "resolved": [0, 0, 0, 0, 0, 0],
                    "evacuees": [0, 0, 0, 0, 0, 0]
                },
                "30d": {
                    "labels": ["Week 1", "Week 2", "Week 3", "Week 4"],
                    "incidents": [0, 0, 0, 0],
                    "resolved": [0, 0, 0, 0],
                    "evacuees": [0, 0, 0, 0]
                },
                "7d": {
                    "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                    "incidents": [0, 0, 0, 0, 0, 0, 0],
                    "resolved": [0, 0, 0, 0, 0, 0, 0],
                    "evacuees": [0, 0, 0, 0, 0, 0, 0]
                }
            },
            "hazard_distribution": type_counts
        }

