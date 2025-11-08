from __future__ import annotations

import secrets
from datetime import timedelta
from typing import Dict, Optional

from fastapi import HTTPException, Request, status
from passlib.context import CryptContext
from pymongo.errors import DuplicateKeyError

from backend.models import (
    ChangePasswordPayload,
    LogoutPayload,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from backend.repositories.user_repository import UserRepository
from backend.security import decode_access_token, hash_session_identifier, require_roles  # noqa: F401 - re-export
from backend.security import jwt, ALGORITHM, JWT_SECRET_KEY  # type: ignore
from backend.services.audit import AuditService
from backend.services.common import current_timestamp, normalize_roles, to_object_id

try:  # pragma: no cover - support package/script usage
    from config import ACCESS_TOKEN_EXPIRE_MINUTES, DEFAULT_USER_ROLES, SESSION_TTL_MINUTES
except ImportError:  # pragma: no cover - fallback for package imports
    from backend.config import (  # type: ignore
        ACCESS_TOKEN_EXPIRE_MINUTES,
        DEFAULT_USER_ROLES,
        SESSION_TTL_MINUTES,
    )

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(subject: str, session_id: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = current_timestamp() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {"sub": subject, "exp": expire, "sid": session_id}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)


class AuthService:
    def __init__(self, users: UserRepository, audit: AuditService) -> None:
        self._users = users
        self._audit = audit

    async def signup(self, payload: UserCreate) -> UserResponse:
        email = payload.email.lower()
        existing = await self._users.get_by_email(email)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

        try:
            hashed_password = self._hash_password(payload.password)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

        roles = normalize_roles(payload.roles, DEFAULT_USER_ROLES)
        now = current_timestamp()
        user_doc = {
            "email": email,
            "full_name": payload.full_name,
            "hashed_password": hashed_password,
            "created_at": now,
            "updated_at": now,
            "last_login": None,
            "roles": roles,
            "active_sessions": [],
        }

        try:
            insert_result = await self._users.insert_user(user_doc)
        except DuplicateKeyError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        user_doc["_id"] = insert_result.inserted_id
        await self._audit.log_auth_event(str(insert_result.inserted_id), email, "signup", {"full_name": payload.full_name})
        return self._to_user_response(user_doc)

    async def login(self, payload: UserLogin) -> TokenResponse:
        email = payload.email.lower()
        user_doc = await self._users.get_by_email(email)
        if not user_doc or not self._verify_password(payload.password, user_doc.get("hashed_password", "")):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        roles = normalize_roles(user_doc.get("roles"), DEFAULT_USER_ROLES)
        session_id = secrets.token_urlsafe(32)
        session_fingerprint = hash_session_identifier(session_id)
        now = current_timestamp()
        expires_at = now + timedelta(minutes=SESSION_TTL_MINUTES)
        active_sessions = [
            session
            for session in user_doc.get("active_sessions", []) or []
            if session.get("expires_at") and session["expires_at"] > now
        ]
        active_sessions.append(
            {
                "fingerprint": session_fingerprint,
                "created_at": now,
                "expires_at": expires_at,
            }
        )

        await self._users.update_user(
            {"_id": user_doc["_id"]},
            {
                "$set": {
                    "last_login": now,
                    "updated_at": now,
                    "active_sessions": active_sessions,
                    "roles": roles,
                },
                "$unset": {"session_token": ""},
            },
        )

        user_doc["roles"] = roles
        token = create_access_token(str(user_doc["_id"]), session_id)
        await self._audit.log_auth_event(
            str(user_doc["_id"]),
            email,
            "login",
            {"session_fingerprint": session_fingerprint},
        )
        return TokenResponse(access_token=token, user=self._to_user_response(user_doc))

    async def logout(self, payload: LogoutPayload, request: Request, current_user: Dict) -> Dict[str, str]:
        current_user_id = current_user.get("_id")
        current_user_email = (current_user.get("email") or "").lower()
        if not current_user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User context missing")

        current_user_id_str = str(current_user_id)
        if payload.user_id and payload.user_id != current_user_id_str:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot log out other users")
        if payload.email and payload.email.lower() != current_user_email:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot log out other users")

        user_query: Dict[str, object] = {"_id": current_user_id}
        if isinstance(current_user_id, str):
            user_query["_id"] = to_object_id(current_user_id)

        user_doc = await self._users.find_one(user_query)
        if not user_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        before_sessions = len(user_doc.get("active_sessions", []) or [])
        fingerprint_to_remove: Optional[str] = None
        if payload.session_token:
            token_data = decode_access_token(payload.session_token)
            token_user = str(token_data.get("sub"))
            if token_user != str(user_doc["_id"]):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot clear sessions for another user")
            fingerprint_to_remove = hash_session_identifier(token_data["sid"])
        else:
            request_fingerprint = getattr(request.state, "session_fingerprint", None)
            if request_fingerprint and str(user_doc["_id"]) == current_user_id_str:
                fingerprint_to_remove = request_fingerprint

        if not fingerprint_to_remove:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid session token or current session fingerprint is required to logout",
            )

        active_sessions = [
            session
            for session in user_doc.get("active_sessions", []) or []
            if session.get("fingerprint") != fingerprint_to_remove
        ]

        await self._users.update_user(
            {"_id": user_doc["_id"]},
            {
                "$set": {
                    "active_sessions": active_sessions,
                    "updated_at": current_timestamp(),
                },
                "$unset": {"session_token": ""},
            },
        )
        await self._audit.log_auth_event(
            str(user_doc["_id"]),
            user_doc.get("email"),
            "logout",
            {"cleared_sessions": before_sessions - len(active_sessions)},
        )
        return {"detail": "Logged out"}

    async def change_password(self, payload: ChangePasswordPayload, current_user: Dict) -> Dict[str, str]:
        email = payload.email.lower()
        if current_user["email"].lower() != email:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot change password for another user")
        user_doc = await self._users.get_by_email(email)
        if not user_doc or not self._verify_password(payload.old_password, user_doc.get("hashed_password", "")):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        try:
            new_hash = self._hash_password(payload.new_password)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

        now = current_timestamp()
        await self._users.update_user(
            {"_id": user_doc["_id"]},
            {
                "$set": {
                    "hashed_password": new_hash,
                    "updated_at": now,
                }
            },
        )
        await self._audit.log_auth_event(str(user_doc["_id"]), email, "password_change", {})
        return {"detail": "Password updated"}

    async def ensure_default_roles(self) -> None:
        await self._users.ensure_default_roles(DEFAULT_USER_ROLES)

    def _hash_password(self, password: str) -> str:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("Password length exceeds bcrypt limit of 72 bytes")
        return pwd_context.hash(password)

    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False

    def _to_user_response(self, doc: Dict) -> UserResponse:
        roles = normalize_roles(doc.get("roles"), DEFAULT_USER_ROLES)
        return UserResponse(
            id=str(doc["_id"]),
            email=doc["email"],
            full_name=doc.get("full_name"),
            roles=roles,
        )
