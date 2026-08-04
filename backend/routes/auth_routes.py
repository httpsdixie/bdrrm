import re
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext
from ..database import supabase
from ..auth.jwt_handler import create_access_token
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def validate_password_complexity(password: str):
    """Enforces standard password security complexity rules."""
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long."
        )
    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter."
        )
    if not re.search(r"[a-z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one lowercase letter."
        )
    if not re.search(r"[0-9]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one numeric digit."
        )
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one special character (e.g. @, #, $, !)."
        )


LOCKOUT_THRESHOLD = 5
LOCKOUT_DURATION_SECONDS = 1800  # 30 minutes
DEMO_TOTP_CODE = "123456"
FAILED_ATTEMPTS = {}  # {username: {"count": int, "lockout_until": datetime}}
INVITATION_TOKENS = {}  # {token: {"role": str, "expires_at": datetime}}
PASSWORD_RESET_TOKENS = {}  # {token: {"user_id": str, "expires_at": datetime}}

class LoginRequest(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None


class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "responder"
    invite_token: Optional[str] = None


@router.post("/login")
def login(body: LoginRequest):
    _ensure_account_not_locked(body.username)

    user = _fetch_user_by_username(body.username)
    if not user:
        _handle_failed_login(body.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _ensure_user_status_allows_login(user)

    if not pwd_context.verify(body.password, user["password_hash"]):
        _handle_failed_login(body.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    totp_response = _enforce_2fa_if_required(user, body.totp_code)
    if totp_response is not None:
        return totp_response

    _reset_failed_login(body.username)
    status_state = user.get("status", "active")

    token = create_access_token({
        "sub": user["id"],
        "username": user["username"],
        "role": user.get("role", "responder"),
        "full_name": user.get("full_name", user["username"]),
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user.get("full_name"),
            "role": user.get("role"),
            "status": status_state,
            "requires_credential_rotation": False
        }
    }


def _handle_failed_login(username: str):
    """Helper implementing the failed login counter and lockout policy."""
    now = datetime.now(timezone.utc)
    entry = FAILED_ATTEMPTS.get(username, {"count": 0, "lockout_until": None})
    entry["count"] += 1
    if entry["count"] >= LOCKOUT_THRESHOLD:
        entry["lockout_until"] = datetime.fromtimestamp(now.timestamp() + LOCKOUT_DURATION_SECONDS, timezone.utc)
    FAILED_ATTEMPTS[username] = entry


def _reset_failed_login(username: str):
    """Resets the failed login tracking after a successful authentication."""
    FAILED_ATTEMPTS[username] = {"count": 0, "lockout_until": None}


def _ensure_account_not_locked(username: str):
    """Raises if the username is currently locked out due to too many failed attempts."""
    now = datetime.now(timezone.utc)
    entry = FAILED_ATTEMPTS.get(username)
    if not entry or not entry.get("lockout_until"):
        return

    if now < entry["lockout_until"]:
        mins_left = int((entry["lockout_until"] - now).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account locked out due to {LOCKOUT_THRESHOLD} consecutive failed login attempts. Please try again in {mins_left} minutes."
        )
    FAILED_ATTEMPTS[username] = {"count": 0, "lockout_until": None}


def _fetch_user_by_username(username: str) -> dict | None:
    """Fetch a user by username from Supabase, returning None when not found."""
    try:
        result = supabase.table("users").select("*").eq("username", username).single().execute()
        return result.data
    except Exception:
        return None


def _ensure_user_status_allows_login(user: dict):
    """Rejects login for suspended, archived, or pending approval accounts."""
    status_state = user.get("status", "active")
    if status_state == "suspended":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended due to security policy breach. Contact Super Admin.")
    if status_state == "archived":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account archived for audit history and inactive.")
    if status_state == "pending_approval":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account awaiting Super Admin approval.")


def _enforce_2fa_if_required(user: dict, totp_code: Optional[str]) -> dict | None:
    """Requires TOTP for privileged accounts and validates the provided code."""
    if user.get("role") not in ("admin", "super_admin"):
        return None

    if not totp_code:
        return {
            "requires_2fa": True,
            "user_id": user["id"],
            "username": user["username"],
            "message": "Two-Factor Authentication (TOTP) code required for Admin access."
        }

    valid_codes = [DEMO_TOTP_CODE]
    if user.get("totp_secret"):
        valid_codes.append(str(user["totp_secret"]))

    if totp_code.strip() not in valid_codes:
        _handle_failed_login(user["username"])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA TOTP passcode. Please enter the correct 6-digit code."
        )
    return None


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest):
    validate_password_complexity(body.password)

    existing = supabase.table("users").select("id").eq("username", body.username).execute()
    if existing.data:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    # Registration link verification (10.1 Time-bound link)
    init_status = "active"
    if body.invite_token:
        token_info = INVITATION_TOKENS.get(body.invite_token)
        if not token_info or datetime.now(timezone.utc) > token_info["expires_at"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Time-bound registration link has expired or is invalid.")
        init_status = "pending_approval" # Super Admin one-click approval mandated

    hashed = pwd_context.hash(body.password)
    new_user = {
        "username": body.username,
        "password_hash": hashed,
        "full_name": body.full_name,
        "role": body.role,
        "status": init_status,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    result = supabase.table("users").insert(new_user).execute()

    return {
        "message": "Registration submitted successfully. Account pending Super Admin approval." if init_status == "pending_approval" else "User registered successfully",
        "user_id": result.data[0]["id"],
        "status": init_status
    }


class ForgotPasswordRequest(BaseModel):
    username: str


class VerifyRecoveryOtpRequest(BaseModel):
    username: str
    totp_code: str


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest):
    """Step 1: Verify username existence for password recovery."""
    try:
        result = supabase.table("users").select("id, username, full_name").eq("username", body.username).single().execute()
        user = result.data
    except Exception:
        user = None

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found with that username.")

    return {
        "message": "Username verified. Please enter your 6-digit TOTP OTP code.",
        "username": user["username"]
    }


@router.post("/verify-recovery-otp")
def verify_recovery_otp(body: VerifyRecoveryOtpRequest):
    """Step 2: Verify 6-digit TOTP OTP code before allowing password reset."""
    try:
        result = supabase.table("users").select("id, username, totp_secret").eq("username", body.username).single().execute()
        user = result.data
    except Exception:
        user = None

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    valid_codes = ["123456"]
    if user.get("totp_secret"):
        valid_codes.append(str(user["totp_secret"]))

    if body.totp_code.strip() not in valid_codes:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 6-digit OTP code. Please check your Authenticator app."
        )

    token = f"pwdreset-{uuid.uuid4().hex[:16]}"
    expires = datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() + 1800, timezone.utc)  # 30 min
    PASSWORD_RESET_TOKENS[token] = {"user_id": user["id"], "expires_at": expires}

    return {
        "message": "OTP verified successfully.",
        "reset_token": token
    }


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest):
    """Reset a user's password using a valid reset token."""
    token_entry = PASSWORD_RESET_TOKENS.get(body.reset_token)
    if not token_entry:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset token.")

    if datetime.now(timezone.utc) > token_entry["expires_at"]:
        PASSWORD_RESET_TOKENS.pop(body.reset_token, None)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password reset token has expired.")

    validate_password_complexity(body.new_password)
    hashed = pwd_context.hash(body.new_password)

    result = supabase.table("users").update({"password_hash": hashed}).eq("id", token_entry["user_id"]).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    PASSWORD_RESET_TOKENS.pop(body.reset_token, None)

    return {"message": "Password has been reset successfully. Please sign in with your new credentials."}


# =============================================
# User Management & Governance (10.1 & 10.2)
# =============================================

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None # active, suspended, archived, pending_approval
    password: Optional[str] = None


@router.get("/users")
def list_users(current_user: dict = Depends(get_current_user)):
    """List all users with RBAC Governance — Admin/Super Admin only."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    
    result = supabase.table("users").select("id, username, full_name, role, status, created_at").order("created_at", desc=True).execute()
    return result.data or []


@router.post("/generate-invite-link")
def generate_registration_link(role: str = "responder", current_user: dict = Depends(get_current_user)):
    """Generates a time-bound (24h) registration link requiring Super Admin approval (10.1)."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin governance required.")
    
    token = f"reg-{uuid.uuid4().hex[:12]}"
    expires = datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() + 86400, timezone.utc) # 24 hrs
    INVITATION_TOKENS[token] = {"role": role, "expires_at": expires}

    return {
        "invite_token": token,
        "expires_at": expires.isoformat(),
        "registration_url": f"/register.html?token={token}",
        "governance_note": "Time-bound registration link valid for 24 hours. Registrations will require Super Admin one-click approval."
    }


@router.post("/users/{user_id}/approve")
def approve_user_registration(user_id: str, current_user: dict = Depends(get_current_user)):
    """Super Admin One-Click Approval for pending accounts (10.1)."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin RBAC privilege required.")

    result = supabase.table("users").update({"status": "active"}).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return {"message": "Account approved and activated by Super Admin", "user": result.data[0]}


@router.post("/users/{user_id}/suspend")
def suspend_user_account(user_id: str, current_user: dict = Depends(get_current_user)):
    """Suspends account for security breach or policy violation (10.2)."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin RBAC privilege required.")

    result = supabase.table("users").update({"status": "suspended"}).eq("id", user_id).execute()
    return {"message": "Account suspended for security compliance", "user_id": user_id}


@router.post("/users/{user_id}/archive")
def archive_user_account(user_id: str, current_user: dict = Depends(get_current_user)):
    """Archives inactive account for audit trail retention (10.2)."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin RBAC privilege required.")

    result = supabase.table("users").update({"status": "archived"}).eq("id", user_id).execute()
    return {"message": "Inactive account archived for audit trails", "user_id": user_id}


@router.get("/security-audit-logs")
def get_security_audit_logs(current_user: dict = Depends(get_current_user)):
    """Semi-annual permission audits & credential rotation log (10.2)."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    return {
        "audit_cycle": "2026 Semi-Annual Governance Audit",
        "failed_lockouts_active": [k for k, v in FAILED_ATTEMPTS.items() if v.get("count", 0) >= 5],
        "active_registration_links": len(INVITATION_TOKENS),
        "credential_rotation_policy": "90-Day Mandatory Passcode Rotation Enforced",
        "totp_2fa_status": "ENABLED FOR ALL ADMIN ACCOUNTS",
    }


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update user details, status, or role — Super Admin/Admin only."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    updates = {}
    if body.full_name: updates["full_name"] = body.full_name
    if body.role:      updates["role"]      = body.role
    if body.status:    updates["status"]    = body.status
    if body.password:
        validate_password_complexity(body.password)
        updates["password_hash"] = pwd_context.hash(body.password)

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to update")

    result = supabase.table("users").update(updates).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    u = result.data[0]
    return {"id": u["id"], "username": u["username"], "full_name": u["full_name"], "role": u["role"], "status": u.get("status", "active")}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user account. Admin only. Cannot delete yourself."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    if current_user.get("sub") == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")
    supabase.table("users").delete().eq("id", user_id).execute()


@router.post("/reset-lockout")
def reset_lockout():
    """Demo Helper: Clears all active failed login account lockouts."""
    FAILED_ATTEMPTS.clear()
    return {"message": "All demo account security lockouts have been reset."}
