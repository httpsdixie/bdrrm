from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.auth_routes import router as auth_router
from routes.incident_routes import router as incident_router
from routes.evacuation_routes import router as evacuation_router
from routes.resource_routes import router as resource_router
from routes.dashboard_routes import router as dashboard_router
from routes.map_routes import router as map_router
from routes.reports_routes import router as reports_router
from routes.risk_routes import router as risk_router
from routes.directory_routes import router as directory_router
from routes.evac_tracking_routes import router as evac_tracking_router
from routes.asset_routes import router as asset_router

app = FastAPI(
    title="Barangay DRRM API",
    description="Smart GIS for Barangay Linao, Ormoc City — Disaster Risk Reduction and Management",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(incident_router)
app.include_router(evacuation_router)
app.include_router(resource_router)
app.include_router(dashboard_router)
app.include_router(map_router)
app.include_router(reports_router)
app.include_router(risk_router)
app.include_router(directory_router)
app.include_router(evac_tracking_router)
app.include_router(asset_router)


@app.get("/")
def root():
    return {"message": "Barangay DRRM API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
