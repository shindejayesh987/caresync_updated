from __future__ import annotations

from typing import Any, Dict, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.services.common import current_timestamp


class AuditService:
    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self._db = database

    async def log_auth_event(self, user_id: Optional[str], email: Optional[str], event: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        doc = {
            "user_id": user_id,
            "email": email,
            "event": event,
            "metadata": metadata or {},
            "timestamp": current_timestamp(),
        }
        await self._db.auth_logs.insert_one(doc)

    async def log_activity(self, action: str, performed_by: Optional[str], payload: Dict[str, Any]) -> None:
        doc = {
            "action": action,
            "performed_by": performed_by,
            "payload": payload,
            "timestamp": current_timestamp(),
        }
        await self._db.activity_logs.insert_one(doc)
