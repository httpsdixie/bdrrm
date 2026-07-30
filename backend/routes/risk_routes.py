from fastapi import APIRouter, Depends
from database import supabase
from auth.dependencies import get_current_user
from datetime import datetime, timezone, timedelta
import math

router = APIRouter(prefix="/risk", tags=["Risk Analysis"])

# =============================================
# Scoring weights
# =============================================
SEVERITY_WEIGHT = {"critical": 4.0, "high": 3.0, "medium": 2.0, "low": 1.0}
TYPE_WEIGHT     = {"flood": 2.0, "landslide": 2.0, "typhoon": 1.8,
                   "fire": 1.5, "medical": 1.0, "other": 1.0}

# Recency decay: incidents in the last 30 days weigh 2x, 90 days 1.5x, older 1x
def recency_multiplier(created_at_str: str) -> float:
    try:
        created = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        age_days = (datetime.now(timezone.utc) - created).days
        if age_days <= 30:  return 2.0
        if age_days <= 90:  return 1.5
        return 1.0
    except Exception:
        return 1.0

# Grid cell size in degrees (~500m at this latitude)
GRID_SIZE = 0.005

def lat_lng_to_cell(lat: float, lng: float) -> tuple:
    """Snap lat/lng to nearest grid cell center."""
    return (round(lat / GRID_SIZE) * GRID_SIZE, round(lng / GRID_SIZE) * GRID_SIZE)

def haversine(lat1, lng1, lat2, lng2) -> float:
    """Distance in km between two coordinates."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# Recommended resources based on dominant incident type
RESOURCE_RECOMMENDATIONS = {
    "flood":     ["Rescue Boat", "Life Jackets", "Food Packs", "Medical Kit"],
    "landslide": ["Heavy Equipment", "Search & Rescue Team", "Medical Kit", "Tents"],
    "typhoon":   ["Rescue Boat", "Food Packs", "Tents", "Medical Kit"],
    "fire":      ["Fire Extinguishers", "Medical Kit", "Food Packs"],
    "medical":   ["Medical Kit", "Ambulance", "BHS Personnel"],
    "other":     ["Medical Kit", "Food Packs"],
}


@router.get("/analysis")
def get_risk_analysis(current_user: dict = Depends(get_current_user)):
    """
    Automatically analyzes all historical incident data to identify
    high-risk geographic clusters and recommend pre-staged resources.
    No manual trigger needed — runs on every map load.
    """
    # Fetch all incidents with location and metadata
    try:
        result = supabase.table("incidents").select(
            "id, type, severity, status, latitude, longitude, created_at, "
            "people_involved, title"
        ).execute()
    except Exception:
        # Fallback if people_involved column not yet added
        result = supabase.table("incidents").select(
            "id, type, severity, status, latitude, longitude, created_at, title"
        ).execute()

    incidents = result.data or []

    if not incidents:
        return {
            "risk_zones": [],
            "total_incidents_analyzed": 0,
            "high_risk_count": 0,
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ---- Cluster incidents into grid cells ----
    clusters: dict[tuple, dict] = {}

    for inc in incidents:
        lat = inc.get("latitude")
        lng = inc.get("longitude")
        if lat is None or lng is None:
            continue
        # Filter strictly within Barangay Linao geographic boundaries
        if not (11.0100 <= lat <= 11.0270 and 124.5820 <= lng <= 124.5980):
            continue

        cell = lat_lng_to_cell(lat, lng)

        if cell not in clusters:
            clusters[cell] = {
                "cell": cell,
                "incidents": [],
                "score": 0.0,
                "type_counts": {},
                "severity_counts": {},
                "total_people": 0,
            }

        c = clusters[cell]
        c["incidents"].append(inc)

        # Accumulate score
        sev_w  = SEVERITY_WEIGHT.get(inc.get("severity", "medium"), 2.0)
        type_w = TYPE_WEIGHT.get(inc.get("type", "other"), 1.0)
        rec_w  = recency_multiplier(inc.get("created_at", ""))
        c["score"] += sev_w * type_w * rec_w

        # Type counts
        t = inc.get("type", "other")
        c["type_counts"][t] = c["type_counts"].get(t, 0) + 1

        # Severity counts
        s = inc.get("severity", "medium")
        c["severity_counts"][s] = c["severity_counts"].get(s, 0) + 1

        # People
        c["total_people"] += inc.get("people_involved") or 0

    if not clusters:
        return {
            "risk_zones": [],
            "total_incidents_analyzed": len(incidents),
            "high_risk_count": 0,
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ---- Normalize scores to 0–100 ----
    max_score = max(c["score"] for c in clusters.values()) or 1.0

    risk_zones = []
    for cell, c in clusters.items():
        normalized = round((c["score"] / max_score) * 100)

        # Risk level from normalized score
        if normalized >= 75:   risk_level = "critical"
        elif normalized >= 50: risk_level = "high"
        elif normalized >= 25: risk_level = "medium"
        else:                  risk_level = "low"

        # Dominant incident type
        dominant_type = max(c["type_counts"], key=c["type_counts"].get)

        # Most recent incident date in this cluster
        dates = [i.get("created_at", "") for i in c["incidents"] if i.get("created_at")]
        latest = max(dates) if dates else None

        # Active incidents in this cluster
        active_count = sum(1 for i in c["incidents"] if i.get("status") in ("active", "responding"))

        risk_zones.append({
            "latitude":    cell[0],
            "longitude":   cell[1],
            "risk_score":  normalized,
            "risk_level":  risk_level,
            "incident_count": len(c["incidents"]),
            "active_count":   active_count,
            "dominant_type":  dominant_type,
            "type_counts":    c["type_counts"],
            "severity_counts": c["severity_counts"],
            "total_people_involved": c["total_people"],
            "latest_incident": latest,
            "recommended_resources": RESOURCE_RECOMMENDATIONS.get(dominant_type, ["Medical Kit", "Food Packs"]),
            "recent_incidents": [
                {"id": i["id"], "title": i.get("title","—"), "type": i.get("type"), "severity": i.get("severity"), "created_at": i.get("created_at")}
                for i in sorted(c["incidents"], key=lambda x: x.get("created_at",""), reverse=True)[:5]
            ],
        })

    # Sort by risk score descending
    risk_zones.sort(key=lambda z: z["risk_score"], reverse=True)

    high_risk = sum(1 for z in risk_zones if z["risk_level"] in ("critical", "high"))

    return {
        "risk_zones": risk_zones,
        "total_incidents_analyzed": len(incidents),
        "high_risk_count": high_risk,
        "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/public/summary")
def get_public_risk_summary():
    """
    Public-safe risk summary — shows general risk levels per area
    with no incident details or personal data.
    """
    try:
        result = supabase.table("incidents").select(
            "type, severity, latitude, longitude, created_at, status"
        ).execute()
    except Exception:
        return {"risk_zones": [], "high_risk_count": 0}

    incidents = result.data or []
    if not incidents:
        return {"risk_zones": [], "high_risk_count": 0}

    clusters: dict[tuple, dict] = {}
    for inc in incidents:
        lat = inc.get("latitude")
        lng = inc.get("longitude")
        if lat is None or lng is None:
            continue
        # Filter strictly within Barangay Linao geographic boundaries
        if not (11.0100 <= lat <= 11.0270 and 124.5820 <= lng <= 124.5980):
            continue
        cell = lat_lng_to_cell(lat, lng)
        if cell not in clusters:
            clusters[cell] = {"score": 0.0, "count": 0, "dominant_type": {}}
        sev_w  = SEVERITY_WEIGHT.get(inc.get("severity","medium"), 2.0)
        type_w = TYPE_WEIGHT.get(inc.get("type","other"), 1.0)
        rec_w  = recency_multiplier(inc.get("created_at",""))
        clusters[cell]["score"] += sev_w * type_w * rec_w
        clusters[cell]["count"] += 1
        t = inc.get("type","other")
        clusters[cell]["dominant_type"][t] = clusters[cell]["dominant_type"].get(t,0) + 1

    max_score = max(c["score"] for c in clusters.values()) or 1.0
    zones = []
    for cell, c in clusters.items():
        norm = round((c["score"] / max_score) * 100)
        if norm >= 75:   level = "critical"
        elif norm >= 50: level = "high"
        elif norm >= 25: level = "medium"
        else:            level = "low"
        dom = max(c["dominant_type"], key=c["dominant_type"].get)
        zones.append({
            "latitude": cell[0], "longitude": cell[1],
            "risk_level": level, "risk_score": norm,
            "incident_count": c["count"], "dominant_type": dom,
        })

    zones.sort(key=lambda z: z["risk_score"], reverse=True)
    return {
        "risk_zones": zones,
        "high_risk_count": sum(1 for z in zones if z["risk_level"] in ("critical","high")),
    }
