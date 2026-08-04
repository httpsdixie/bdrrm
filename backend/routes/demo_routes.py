from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

router = APIRouter(prefix="/demo", tags=["Prototype Demonstration Suite"])

@router.get("/overview")
def get_demo_overview():
    """Prototype Demonstration structure for Panel Defense."""
    return {
        "institution": "Eastern Visayas State University (EVSU)",
        "project_title": "Smart Disaster Risk Reduction and Management GIS for Barangay Linao, Ormoc City",
        "demo_sections": [
            {
                "step": 1,
                "title": "Secure Access (Login Page)",
                "highlights": [
                    "2FA via TOTP enforcement for Admin & Super Admin",
                    "5-Attempt Failed Login Lockout Policy (30-Minute Duration)",
                    "Time-Bound 24h Invite Links & One-Click Super Admin Approvals",
                    "Account Lifecycle Statuses (Pending, Active, Suspended, Archived)"
                ]
            },
            {
                "step": 2,
                "title": "Command Center (Dashboard)",
                "highlights": [
                    "Real-time GIS Visualization (Flood & Landslide Hazard Layers)",
                    "Toggleable Incident Heatmap & Live Facility Pins",
                    "Executive Module: One-Click Share PDF/Image Export for City Officials",
                    "Scheduled Maintenance & Audit Notification Banner"
                ]
            },
            {
                "step": 3,
                "title": "Main Operational Modules",
                "highlights": [
                    "Incidents: Casualty Triage, Tanod Responder Linking, Immutable Resolved State",
                    "Resources: COA Government Accounting Fields, QR Tagging, Maintenance Statuses",
                    "Facilities: JMC2 2021 Digital 20-Item Compliance Checklist, Running Avg + 15% Buffer Estimation",
                    "Population: Quick-Tap Vulnerability Counting, QR Duplicate Relief Claim Prevention"
                ]
            },
            {
                "step": 4,
                "title": "Sample Reports (Analytical Output)",
                "highlights": [
                    "Automated Daily Incident Summaries",
                    "DILG / DSWD Compliance Audit Briefings",
                    "Asset Disposal / Retirement Lifecycle Reports",
                    "NAP Cold Storage Historical Audit Ledger"
                ]
            },
            {
                "step": 5,
                "title": "Field Accessibility (Mobile View & PWA)",
                "highlights": [
                    "PWA Offline-First Service Worker Caching",
                    "Mobile Field Triage & Rapid QR Scanner",
                    "PWA Offline Data Capture & Synchronization"
                ]
            }
        ]
    }


@router.post("/simulate-lockout")
def simulate_lockout(username: str = "admin"):
    """Simulates 5 failed logins to demonstrate 30-minute security lockout policy."""
    return {
        "status": "LOCKED_OUT",
        "username": username,
        "failed_attempts": 5,
        "lockout_duration_minutes": 30,
        "unlock_time": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat() if 'timedelta' in globals() else "30 minutes from now",
        "policy_rule": "Security Governance Rule: Five-attempt failed login limit with automatic 30-minute account lockout."
    }


@router.post("/simulate-qr-scan")
def simulate_qr_scan(qr_code: str = "IDP-FAMILY-8842"):
    """Simulates mobile PWA QR Code scan for relief claim verification (16.3 & 16.5)."""
    return {
        "qr_code": qr_code,
        "verified": True,
        "head_of_family": "Juan De La Cruz",
        "purok": "Purok 2 Coastal",
        "members_count": 5,
        "notes": "Household vulnerability details have been removed from demo outputs.",
        "relief_run_status": "APPROVED — Pack #084 Claimed",
        "claim_timestamp": datetime.now(timezone.utc).isoformat(),
        "duplicate_claim_prevented": False
    }
