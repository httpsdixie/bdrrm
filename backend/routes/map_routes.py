from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from ..database import supabase
from ..auth.dependencies import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/map", tags=["Map Layers"])

ONGOING_STATUSES = {"ongoing", "active", "responding"}


# =============================================
# Public endpoint — no auth required
# Returns all layers needed for the public map
# =============================================

DEFAULT_BARANGAY_PUROKS = [
    {"name": "Purok 1",  "latitude": 11.0150, "longitude": 124.5888},
    {"name": "Purok 2",  "latitude": 11.0146, "longitude": 124.5895},
    {"name": "Purok 3",  "latitude": 11.0151, "longitude": 124.5902},
    {"name": "Purok 4",  "latitude": 11.0157, "longitude": 124.5910},
    {"name": "Purok 5",  "latitude": 11.0142, "longitude": 124.5905},
    {"name": "Purok 6",  "latitude": 11.0181, "longitude": 124.5921},
    {"name": "Purok 7",  "latitude": 11.0188, "longitude": 124.5925},
    {"name": "Purok 8",  "latitude": 11.0195, "longitude": 124.5932},
    {"name": "Purok 9",  "latitude": 11.0135, "longitude": 124.5918},
    {"name": "Purok 10", "latitude": 11.0128, "longitude": 124.5924},
    {"name": "Purok 11", "latitude": 11.0163, "longitude": 124.5930},
    {"name": "Purok 12", "latitude": 11.0170, "longitude": 124.5941},
    {"name": "Purok 13", "latitude": 11.0155, "longitude": 124.5950},
    {"name": "Purok 14", "latitude": 11.0205, "longitude": 124.5940},
    {"name": "Purok 15", "latitude": 11.0212, "longitude": 124.5948},
    {"name": "Purok 16", "latitude": 11.0175, "longitude": 124.5900},
    {"name": "Purok 17", "latitude": 11.0190, "longitude": 124.5892},
]

@router.get("/puroks")
def get_puroks_list():
    """
    Retrieve constituent Purok registry and geographical centerpoints from Database.
    Returns dynamic database list of Puroks.
    """
    try:
        res = supabase.table("puroks").select("*").order("name").execute()
        if res.data and len(res.data) > 0:
            return res.data
    except Exception:
        pass
    return DEFAULT_BARANGAY_PUROKS

def clamp_lat(lat):
    try:
        val = float(lat)
        if val < 11.0100 or val > 11.0270:
            return min(11.0250, max(11.0110, val))
        return val
    except (ValueError, TypeError):
        return 11.0167

def clamp_lng(lng):
    try:
        val = float(lng)
        if val < 124.5820 or val > 124.5980:
            return min(124.5960, max(124.5840, val))
        return val
    except (ValueError, TypeError):
        return 124.5915

def clamp_linao_payload(data: dict) -> dict:
    if not isinstance(data, dict):
        return data

    for key in ["incidents", "evacuation_centers", "hospitals", "responder_stations", "road_closures"]:
        items = data.get(key)
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and "latitude" in item and "longitude" in item:
                    item["latitude"] = clamp_lat(item["latitude"])
                    item["longitude"] = clamp_lng(item["longitude"])

    hazard_zones = data.get("hazard_zones")
    if isinstance(hazard_zones, list):
        for zone in hazard_zones:
            if isinstance(zone, dict) and isinstance(zone.get("coordinates"), list):
                new_coords = []
                for pt in zone["coordinates"]:
                    if isinstance(pt, list) and len(pt) >= 2:
                        lng, lat = pt[0], pt[1]
                        new_coords.append([clamp_lng(lng), clamp_lat(lat)])
                    else:
                        new_coords.append(pt)
                zone["coordinates"] = new_coords

    return data

@router.get("/public")
def get_public_map_data():
    """
    Single public endpoint for the citizen map.
    No authentication required.
    Returns limited data only — no sensitive details.
    """
    incidents = (
        supabase.table("incidents")
        .select("id, title, type, severity, status, latitude, longitude")
        .in_("status", list(ONGOING_STATUSES))
        .execute()
    ).data or []

    centers = (
        supabase.table("evacuation_centers")
        .select("id, name, address, latitude, longitude, status, capacity, current_occupancy")
        .execute()
    ).data or []

    hazard_zones = (
        supabase.table("hazard_zones")
        .select("id, name, type, risk_level, description, coordinates")
        .execute()
    ).data or []

    hospitals = (
        supabase.table("hospitals")
        .select("id, name, address, latitude, longitude, contact_number, services")
        .execute()
    ).data or []

    try:
        stations = (
            supabase.table("responder_stations")
            .select("id, name, type, address, latitude, longitude, contact_number")
            .execute()
        ).data or []
    except Exception:
        stations = []

    road_closures = (
        supabase.table("road_closures")
        .select("id, title, reason, latitude, longitude, created_at")
        .eq("is_active", True)
        .execute()
    ).data or []

    return clamp_linao_payload({
        "incidents": incidents,
        "evacuation_centers": centers,
        "hazard_zones": hazard_zones,
        "hospitals": hospitals,
        "responder_stations": stations,
        "road_closures": road_closures,
    })


# =============================================
# Authenticated endpoint — full map data
# =============================================

@router.get("/layers")
def get_all_map_layers(current_user: dict = Depends(get_current_user)):
    """Full map data for authenticated officers/admins."""
    incidents = (
        supabase.table("incidents")
        .select("id, title, type, severity, status, latitude, longitude, description, created_at, users!incidents_reported_by_fkey(full_name)")
        .in_("status", list(ONGOING_STATUSES))
        .execute()
    ).data or []

    centers = (
        supabase.table("evacuation_centers")
        .select("*")
        .execute()
    ).data or []

    hazard_zones = (
        supabase.table("hazard_zones")
        .select("*")
        .execute()
    ).data or []

    hospitals = (
        supabase.table("hospitals")
        .select("*")
        .execute()
    ).data or []

    try:
        stations = (
            supabase.table("responder_stations")
            .select("*")
            .execute()
        ).data or []
    except Exception:
        stations = []

    road_closures = (
        supabase.table("road_closures")
        .select("*")
        .eq("is_active", True)
        .execute()
    ).data or []

    return clamp_linao_payload({
        "incidents": incidents,
        "evacuation_centers": centers,
        "hazard_zones": hazard_zones,
        "hospitals": hospitals,
        "responder_stations": stations,
        "road_closures": road_closures,
    })


# =============================================
# Hazard Zones
# =============================================

class HazardZoneCreate(BaseModel):
    name: str
    type: str           # flood, landslide
    risk_level: str = "high"
    description: Optional[str] = None
    coordinates: list   # [[lng,lat], [lng,lat], ...]


class HazardZoneUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    risk_level: Optional[str] = None
    description: Optional[str] = None
    coordinates: Optional[list] = None


@router.get("/hazard-zones")
def get_hazard_zones(current_user: dict = Depends(get_current_user)):
    result = supabase.table("hazard_zones").select("*").order("created_at", desc=True).execute()
    return result.data or []


@router.post("/hazard-zones", status_code=status.HTTP_201_CREATED)
def create_hazard_zone(body: HazardZoneCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    result = supabase.table("hazard_zones").insert({
        "name": body.name,
        "type": body.type,
        "risk_level": body.risk_level,
        "description": body.description,
        "coordinates": body.coordinates,
        "created_by": current_user["sub"],
    }).execute()
    return result.data[0]


@router.patch("/hazard-zones/{zone_id}")
def update_hazard_zone(zone_id: str, body: HazardZoneUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = supabase.table("hazard_zones").update(updates).eq("id", zone_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Zone not found")
    return result.data[0]


@router.delete("/hazard-zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hazard_zone(zone_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    supabase.table("hazard_zones").delete().eq("id", zone_id).execute()


# =============================================
# Hospitals
# =============================================

class HospitalCreate(BaseModel):
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    contact_number: Optional[str] = None
    services: Optional[str] = None


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_number: Optional[str] = None
    services: Optional[str] = None


@router.get("/hospitals")
def get_hospitals(current_user: dict = Depends(get_current_user)):
    result = supabase.table("hospitals").select("*").order("name").execute()
    return result.data or []


@router.post("/hospitals", status_code=status.HTTP_201_CREATED)
def create_hospital(body: HospitalCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    result = supabase.table("hospitals").insert(body.model_dump()).execute()
    return result.data[0]


@router.patch("/hospitals/{hospital_id}")
def update_hospital(hospital_id: str, body: HospitalUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = supabase.table("hospitals").update(updates).eq("id", hospital_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return result.data[0]


@router.delete("/hospitals/{hospital_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hospital(hospital_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    supabase.table("hospitals").delete().eq("id", hospital_id).execute()


# =============================================
# Responder Stations
# =============================================

class StationCreate(BaseModel):
    name: str
    type: str           # bdrrmc, fire_station, police, bhs, coast_guard, other
    address: Optional[str] = None
    latitude: float
    longitude: float
    contact_number: Optional[str] = None
    personnel_count: int = 0


class StationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_number: Optional[str] = None
    personnel_count: Optional[int] = None


@router.get("/responder-stations")
def get_stations(current_user: dict = Depends(get_current_user)):
    result = supabase.table("responder_stations").select("*").order("name").execute()
    return result.data or []


@router.post("/responder-stations", status_code=status.HTTP_201_CREATED)
def create_station(body: StationCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    result = supabase.table("responder_stations").insert(body.model_dump()).execute()
    return result.data[0]


@router.patch("/responder-stations/{station_id}")
def update_station(station_id: str, body: StationUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = supabase.table("responder_stations").update(updates).eq("id", station_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Station not found")
    return result.data[0]


@router.delete("/responder-stations/{station_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_station(station_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    supabase.table("responder_stations").delete().eq("id", station_id).execute()


# =============================================
# Road Closures
# =============================================

class RoadClosureCreate(BaseModel):
    title: str
    reason: str         # flood, landslide, road_work, accident, other
    latitude: float
    longitude: float


@router.get("/road-closures")
def get_road_closures(current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("road_closures")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/road-closures", status_code=status.HTTP_201_CREATED)
def create_road_closure(body: RoadClosureCreate, current_user: dict = Depends(get_current_user)):
    result = supabase.table("road_closures").insert({
        "title": body.title,
        "reason": body.reason,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "is_active": True,
        "reported_by": current_user["sub"],
    }).execute()
    return result.data[0]


@router.patch("/road-closures/{closure_id}/resolve", status_code=status.HTTP_200_OK)
def resolve_road_closure(closure_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a road closure as resolved (removed)."""
    result = supabase.table("road_closures").update({
        "is_active": False,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", closure_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Road closure not found")
    return result.data[0]


@router.delete("/road-closures/{closure_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_road_closure(closure_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    supabase.table("road_closures").delete().eq("id", closure_id).execute()
