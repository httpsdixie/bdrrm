from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext
from database import supabase
from auth.jwt_handler import create_access_token
from auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "responder"  # default role


@router.post("/login")
def login(body: LoginRequest):
    # Fetch user from Supabase
    result = supabase.table("users").select("*").eq("username", body.username).single().execute()
    user = result.data

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not pwd_context.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"],
        "full_name": user["full_name"],
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
        }
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest):
    # Check if username already exists
    existing = supabase.table("users").select("id").eq("username", body.username).execute()
    if existing.data:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    hashed = pwd_context.hash(body.password)
    result = supabase.table("users").insert({
        "username": body.username,
        "password_hash": hashed,
        "full_name": body.full_name,
        "role": body.role,
    }).execute()

    return {"message": "User registered successfully", "user_id": result.data[0]["id"]}


# =============================================
# User Management (Admin only)
# =============================================

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


@router.get("/users")
def list_users(current_user: dict = Depends(get_current_user)):
    """List all users. Admin only."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    result = supabase.table("users").select("id, username, full_name, role, created_at").order("created_at", desc=True).execute()
    return result.data or []


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update user details or reset password. Admin only."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    updates = {}
    if body.full_name: updates["full_name"] = body.full_name
    if body.role:      updates["role"]      = body.role
    if body.password:  updates["password_hash"] = pwd_context.hash(body.password)

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to update")

    result = supabase.table("users").update(updates).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    u = result.data[0]
    return {"id": u["id"], "username": u["username"], "full_name": u["full_name"], "role": u["role"]}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user account. Admin only. Cannot delete yourself."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    if current_user.get("sub") == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")
    supabase.table("users").delete().eq("id", user_id).execute()
