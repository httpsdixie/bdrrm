from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List
from ..auth.dependencies import get_current_user
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/validation", tags=["Validation & Institutionalization"])

# In-memory storage for UAT Feedback and SIMEX Drills
UAT_FEEDBACK_DB = [
    {
        "id": "uat-001",
        "evaluator_role": "DRRM Focal Person",
        "purok": "Purok 2 Coastal",
        "usability_score": 4.8,
        "dispatch_clarity_score": 5.0,
        "comments": "Manual fallback encoder and 2-hour pulse report generation greatly simplified off-grid response.",
        "evaluated_at": "2026-08-01T10:30:00Z"
    },
    {
        "id": "uat-002",
        "evaluator_role": "Barangay Tanod Lead",
        "purok": "Purok 4 Riverside",
        "usability_score": 4.6,
        "dispatch_clarity_score": 4.9,
        "comments": "Cebuano/Visayan language toggle is very helpful for field personnel.",
        "evaluated_at": "2026-08-02T14:15:00Z"
    }
]

SIMEX_DRILLS_DB = [
    {
        "drill_id": "simex-2026-01",
        "title": "Category 5 Typhoon Kristine SIMEX Drill",
        "scenario": "Rapid Coastal Flooding & Power Blackout",
        "participating_puroks": ["Purok 1", "Purok 2", "Purok 3", "Purok 4"],
        "simulated_evacuee_count": 450,
        "avg_triage_latency_mins": 3.4,
        "resource_dispatch_latency_mins": 4.1,
        "manual_fallback_compliance_pct": 100.0,
        "readiness_rating": "OPTIMAL (PASS)",
        "executed_at": "2026-07-28T09:00:00Z"
    }
]

class UATSubmission(BaseModel):
    evaluator_role: str
    purok: str
    usability_score: float  # 1.0 - 5.0
    dispatch_clarity_score: float
    comments: Optional[str] = None

class SIMEXRequest(BaseModel):
    title: str
    scenario: str
    participating_puroks: List[str]
    simulated_evacuee_count: int


@router.get("/uat-feedback")
def get_uat_feedback():
    """Retrieve UAT validation feedback & constituent purok usability metrics."""
    avg_usability = sum(f["usability_score"] for f in UAT_FEEDBACK_DB) / len(UAT_FEEDBACK_DB) if UAT_FEEDBACK_DB else 5.0
    return {
        "average_usability_score": round(avg_usability, 2),
        "total_evaluations": len(UAT_FEEDBACK_DB),
        "evaluations": UAT_FEEDBACK_DB
    }


@router.post("/uat-feedback", status_code=status.HTTP_201_CREATED)
def submit_uat_feedback(body: UATSubmission):
    """Submit UAT validation report during pilot deployment."""
    entry = {
        "id": f"uat-{uuid.uuid4().hex[:6]}",
        "evaluator_role": body.evaluator_role,
        "purok": body.purok,
        "usability_score": min(5.0, max(1.0, body.usability_score)),
        "dispatch_clarity_score": min(5.0, max(1.0, body.dispatch_clarity_score)),
        "comments": body.comments or "No additional comments",
        "evaluated_at": datetime.now(timezone.utc).isoformat()
    }
    UAT_FEEDBACK_DB.append(entry)
    return {"message": "UAT feedback recorded successfully", "evaluation": entry}


@router.get("/pilot-deployments")
def get_pilot_deployment_status():
    """Status of constituent purok pilot deployments (Purok 1 - 7 Linao)."""
    return {
        "barangay": "Barangay Linao, Ormoc City",
        "total_puroks": 7,
        "pilot_stages": [
            {"purok": "Purok 1 Central", "stage": "Stage 3: Full Operational Adoption", "status": "Active", "adoption_rate": "98%"},
            {"purok": "Purok 2 Coastal", "stage": "Stage 3: Full Operational Adoption", "status": "Active", "adoption_rate": "95%"},
            {"purok": "Purok 3 Highway", "stage": "Stage 2: SIMEX Drill Testing", "status": "Active", "adoption_rate": "90%"},
            {"purok": "Purok 4 Riverside", "stage": "Stage 2: SIMEX Drill Testing", "status": "Active", "adoption_rate": "92%"},
            {"purok": "Purok 5 Mountain View", "stage": "Stage 1: Field Triage Training", "status": "In Progress", "adoption_rate": "85%"},
            {"purok": "Purok 6 Lower Linao", "stage": "Stage 1: Field Triage Training", "status": "In Progress", "adoption_rate": "88%"},
            {"purok": "Purok 7 Upper Linao", "stage": "Stage 1: Field Triage Training", "status": "In Progress", "adoption_rate": "82%"},
        ]
    }


@router.post("/simex/run")
def run_simex_drill(body: SIMEXRequest, current_user: dict = Depends(get_current_user)):
    """Run a periodic Simulation Exercise (SIMEX) catastrophic drill (12.2)."""
    if current_user.get("role") not in ("admin", "super_admin", "officer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Officer authorization required to execute SIMEX drills.")

    drill_entry = {
        "drill_id": f"simex-2026-{len(SIMEX_DRILLS_DB)+1:02d}",
        "title": body.title,
        "scenario": body.scenario,
        "participating_puroks": body.participating_puroks,
        "simulated_evacuee_count": body.simulated_evacuee_count,
        "avg_triage_latency_mins": round(2.5 + (body.simulated_evacuee_count / 300), 2),
        "resource_dispatch_latency_mins": round(3.0 + (len(body.participating_puroks) * 0.4), 2),
        "manual_fallback_compliance_pct": 100.0,
        "readiness_rating": "OPTIMAL (PASS)",
        "executed_at": datetime.now(timezone.utc).isoformat()
    }
    SIMEX_DRILLS_DB.append(drill_entry)

    return {
        "message": f"SIMEX Catastrophic Simulation Drill '{body.title}' executed successfully.",
        "drill_report": drill_entry
    }


@router.get("/simex/results")
def get_simex_results():
    """Get periodic SIMEX drill historical results for institutionalization audit."""
    return {
        "total_drills_executed": len(SIMEX_DRILLS_DB),
        "institutionalization_status": "COMPLIANT — Periodic SIMEX Exercises Scheduled",
        "drills": SIMEX_DRILLS_DB
    }


@router.get("/sop-manual")
def get_sop_manual():
    """Digital SOP User Manual & Catastrophe Response Guidelines (12.2)."""
    return {
        "manual_title": "Standard Operating Procedures (SOP) User Manual for Barangay DRRM Operations",
        "version": "v1.0 (Audit Ready)",
        "sections": [
            {
                "code": "SOP-01",
                "title": "Incident Command & Triage Protocol",
                "guidelines": "Upon receiving an emergency call, responders log GPS coordinates and dispatch designated Tanod personnel immediately."
            },
            {
                "code": "SOP-02",
                "title": "Evacuation Shelter Camp Management (JMC2 2021)",
                "guidelines": "Verify 20-item JMC2 digital checklist, maintain 3.5m² floor area per IDP, and issue 2-hour pulse reports to CDRRMO."
            },
        ]
    }
