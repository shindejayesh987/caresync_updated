import hashlib
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from bson import ObjectId
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

try:  # pragma: no cover - allow package and script usage
    from config import ALGORITHM, DEFAULT_USER_ROLES, JWT_SECRET_KEY
except ImportError:  # pragma: no cover - fallback when imported as package
    from backend.config import ALGORITHM, DEFAULT_USER_ROLES, JWT_SECRET_KEY

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_session_identifier(identifier: str) -> str:
    return hashlib.sha256(identifier.encode("utf-8")).hexdigest()


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:  # pragma: no cover - defensive re-raise
        raise JWTError("Invalid access token") from exc

    subject = payload.get("sub")
    session_id = payload.get("sid")
    if not subject or not session_id:
        raise JWTError("Token payload missing required claims")

    return {"sub": subject, "sid": session_id, "exp": payload.get("exp")}


def _clean_active_sessions(sessions: Iterable[Dict[str, Any]]) -> Iterable[Dict[str, Any]]:
    now = datetime.utcnow()
    for session in sessions or []:
        expires_at = session.get("expires_at")
        if expires_at and expires_at >= now:
            yield session


def _normalize_roles(roles: Optional[Iterable[str]]) -> List[str]:
    normalized: List[str] = []
    for role in roles or DEFAULT_USER_ROLES:
        if not isinstance(role, str):
            continue
        trimmed = role.strip().lower()
        if trimmed and trimmed not in normalized:
            normalized.append(trimmed)
    return normalized or list(DEFAULT_USER_ROLES)


async def get_current_user(request: Request, token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    token_data = decode_access_token(token)
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database not configured")

    try:
        user = await db.users.find_one({"_id": ObjectId(token_data["sub"])})
    except Exception as exc:  # pragma: no cover - propagates as auth failure
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials") from exc

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    hashed_session = hash_session_identifier(token_data["sid"])
    active_sessions = list(_clean_active_sessions(user.get("active_sessions", [])))
    session_valid = any(session.get("fingerprint") == hashed_session for session in active_sessions)

    if not session_valid:
        if active_sessions != user.get("active_sessions"):
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"active_sessions": active_sessions}})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid")

    if active_sessions != user.get("active_sessions"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"active_sessions": active_sessions}})

    request.state.session_fingerprint = hashed_session
    request.state.current_user = user
    user["roles"] = _normalize_roles(user.get("roles"))
    user["id"] = str(user["_id"])
    return user


def require_roles(*roles: str):
    async def dependency(current_user=Depends(get_current_user)):
        if roles:
            user_roles = set(current_user.get("roles") or [])
            if not user_roles.intersection(roles):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return dependency
