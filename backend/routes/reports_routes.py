from fastapi import APIRouter, Depends
from database import supabase
from auth.dependencies import get_current_user
from datetime import datetime, timezone, date

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/incidents")
def get_incident_report(current_user: dict = Depends(get_current_user)):
    """
    Full incident summary report — DRRM officers and admin only.
    Returns today's incidents plus all-time summary.
    """
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()

    # Fetch incidents — try with new columns first, fall back to base columns
    # if ALTER TABLE hasn't been run yet
    NEW_COLS = "id, title, type, status, severity, latitude, longitude, created_at, updated_at, reported_by, description, people_involved, action_taken, human_resources, resolution, resolved_at, users(full_name)"
    BASE_COLS = "id, title, type, status, severity, latitude, longitude, created_at, updated_at, reported_by, description, users!incidents_reported_by_fkey(full_name)"

    try:
        all_res = supabase.table("incidents").select(NEW_COLS).order("created_at", desc=True).execute()
        all_incidents = all_res.data or []
        today_res = supabase.table("incidents").select(NEW_COLS).gte("created_at", today_start).order("created_at", desc=True).execute()
        today_incidents = today_res.data or []
    except Exception:
        # New columns not yet added — fall back to base schema
        all_res = supabase.table("incidents").select(BASE_COLS).order("created_at", desc=True).execute()
        all_incidents = all_res.data or []
        today_res = supabase.table("incidents").select(BASE_COLS).gte("created_at", today_start).order("created_at", desc=True).execute()
        today_incidents = today_res.data or []

    # Type breakdown
    type_counts = {}
    for inc in all_incidents:
        t = inc.get("type", "other")
        type_counts[t] = type_counts.get(t, 0) + 1

    # Severity breakdown
    severity_counts = {}
    for inc in all_incidents:
        s = inc.get("severity", "medium")
        severity_counts[s] = severity_counts.get(s, 0) + 1

    # People involved
    total_people = sum(inc.get("people_involved") or 0 for inc in all_incidents)
    today_people = sum(inc.get("people_involved") or 0 for inc in today_incidents)

    # Resource usage per incident type (from dispatch log)
    dispatch_res = (
        supabase.table("resource_dispatch")
        .select("*, resources(name, type), incidents(title, type), users(full_name)")
        .order("dispatched_at", desc=True)
        .execute()
    )
    dispatches = dispatch_res.data or []

    # Rescue items dispatched (from dispatch log grouped by resource type)
    rescue_items = {}
    for d in dispatches:
        rtype = d.get("resources", {}).get("type", "other") if d.get("resources") else "other"
        rescue_items[rtype] = rescue_items.get(rtype, 0) + d.get("quantity_dispatched", 0)

    # Ongoing operations (active/responding with dispatched resources)
    ongoing = []
    active_ids = {i["id"] for i in all_incidents if i["status"] in ("active", "responding")}
    for inc in all_incidents:
        if inc["status"] not in ("active", "responding"):
            continue
        inc_dispatches = [d for d in dispatches if d.get("incident_id") == inc["id"] and not d.get("returned_at")]
        ongoing.append({
            "id": inc["id"],
            "title": inc["title"],
            "type": inc["type"],
            "severity": inc["severity"],
            "status": inc["status"],
            "people_involved": inc.get("people_involved") or 0,
            "action_taken": inc.get("action_taken"),
            "human_resources": inc.get("human_resources"),
            "dispatched_resources": [
                {
                    "resource_name": d["resources"]["name"] if d.get("resources") else "—",
                    "resource_type": d["resources"]["type"] if d.get("resources") else "—",
                    "quantity": d["quantity_dispatched"],
                    "dispatched_by": d["users"]["full_name"] if d.get("users") else "—",
                }
                for d in inc_dispatches
            ],
            "created_at": inc["created_at"],
            "latitude": inc["latitude"],
            "longitude": inc["longitude"],
        })

    # Resolved incidents with resolution notes
    resolved = [
        {
            "id": inc["id"],
            "title": inc["title"],
            "type": inc["type"],
            "severity": inc["severity"],
            "people_involved": inc.get("people_involved") or 0,
            "action_taken": inc.get("action_taken"),
            "resolution": inc.get("resolution"),
            "resolved_at": inc.get("resolved_at"),
            "reported_by": inc["users"]["full_name"] if inc.get("users") else "—",
        }
        for inc in all_incidents if inc["status"] == "resolved"
    ]

    return {
        "summary": {
            "total_incidents": len(all_incidents),
            "today_incidents": len(today_incidents),
            "active": sum(1 for i in all_incidents if i["status"] == "active"),
            "responding": sum(1 for i in all_incidents if i["status"] == "responding"),
            "resolved": sum(1 for i in all_incidents if i["status"] == "resolved"),
            "total_people_involved": total_people,
            "today_people_involved": today_people,
        },
        "by_type": type_counts,
        "by_severity": severity_counts,
        "rescue_items_dispatched": rescue_items,
        "ongoing_operations": ongoing,
        "resolved_incidents": resolved[:20],  # last 20 resolved
        "today_incidents": today_incidents,
    }


@router.get("/resources")
def get_resource_report(current_user: dict = Depends(get_current_user)):
    """
    Full resource summary report — DRRM only.
    """
    # All resources
    resources_res = supabase.table("resources").select("*").order("name").execute()
    resources = resources_res.data or []

    # Dispatch log with joins
    dispatch_res = (
        supabase.table("resource_dispatch")
        .select("*, resources(name, type), incidents(title, type, latitude, longitude), users(full_name)")
        .order("dispatched_at", desc=True)
        .execute()
    )
    dispatches = dispatch_res.data or []

    # Currently deployed (not returned)
    deployed = [d for d in dispatches if not d.get("returned_at")]

    # Resources by status
    status_counts = {}
    for r in resources:
        s = r.get("status", "available")
        status_counts[s] = status_counts.get(s, 0) + 1

    # Total quantity vs available
    total_qty     = sum(r.get("quantity", 0) for r in resources)
    available_qty = sum(r.get("available_quantity", 0) for r in resources)
    deployed_qty  = total_qty - available_qty

    # Resources by type summary
    type_summary = {}
    for r in resources:
        t = r.get("type", "other")
        if t not in type_summary:
            type_summary[t] = {"total": 0, "available": 0, "deployed": 0}
        type_summary[t]["total"]     += r.get("quantity", 0)
        type_summary[t]["available"] += r.get("available_quantity", 0)
        type_summary[t]["deployed"]  += r.get("quantity", 0) - r.get("available_quantity", 0)

    # Affected zones — active incidents
    try:
        affected_incidents = (
            supabase.table("incidents")
            .select("id, title, type, severity, status, latitude, longitude, people_involved")
            .in_("status", ["active", "responding"])
            .execute()
        ).data or []
    except Exception:
        affected_incidents = (
            supabase.table("incidents")
            .select("id, title, type, severity, status, latitude, longitude")
            .in_("status", ["active", "responding"])
            .execute()
        ).data or []

    # Hazard zones for cross-reference
    hz_res = supabase.table("hazard_zones").select("id, name, type, risk_level, coordinates").execute()
    hazard_zones = hz_res.data or []

    return {
        "summary": {
            "total_items": len(resources),
            "total_quantity": total_qty,
            "available_quantity": available_qty,
            "deployed_quantity": deployed_qty,
            "status_counts": status_counts,
        },
        "by_type": type_summary,
        "dispatch_log": dispatches[:50],          # last 50 dispatches
        "currently_deployed": deployed,
        "affected_zones": {
            "active_incidents": affected_incidents,
            "hazard_zones": hazard_zones,
        },
        "resources": resources,
    }
