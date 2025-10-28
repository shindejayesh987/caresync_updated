from __future__ import annotations

from datetime import datetime, date
from typing import Any, Dict, Iterable, List, Optional, Union

from bson import ObjectId
from fastapi import HTTPException, status

DEFAULT_TIME_KEYS = (
    "created_at",
    "updated_at",
    "last_login",
    "captured_at",
    "recorded_at",
    "timestamp",
)


def current_timestamp() -> datetime:
    """Return a timezone-naive UTC timestamp."""

    return datetime.utcnow()


def normalize_roles(roles: Optional[Iterable[str]], fallback: Iterable[str]) -> List[str]:
    normalized: List[str] = []
    for role in roles or fallback:
        if not isinstance(role, str):
            continue
        trimmed = role.strip().lower()
        if trimmed and trimmed not in normalized:
            normalized.append(trimmed)
    return normalized or list(fallback)


def serialize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return doc

    serialized: Dict[str, Any] = {**doc}
    oid = serialized.get("_id")
    if isinstance(oid, ObjectId):
        serialized["_id"] = str(oid)

    for key in DEFAULT_TIME_KEYS:
        value = serialized.get(key)
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()

    return serialized


def convert_date_to_datetime(date_input: Union[str, date]) -> datetime:
    if isinstance(date_input, date):
        return datetime(date_input.year, date_input.month, date_input.day)
    return datetime.strptime(date_input, "%Y-%m-%d")


def to_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid identifier: {value}",
        ) from exc
