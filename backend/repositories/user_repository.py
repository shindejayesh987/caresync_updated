from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase


class UserRepository:
    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self._db = database

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return await self._db.users.find_one({"email": email})

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._db.users.find_one(query)

    async def insert_user(self, user_doc: Dict[str, Any]) -> Any:
        return await self._db.users.insert_one(user_doc)

    async def update_user(self, query: Dict[str, Any], update: Dict[str, Any]) -> Any:
        return await self._db.users.update_one(query, update)

    async def ensure_default_roles(self, default_roles: Iterable[str]) -> None:
        default_roles_list = list(default_roles)
        await self._db.users.update_many(
            {"$or": [{"roles": {"$exists": False}}, {"roles": []}]},
            {"$set": {"roles": default_roles_list}},
        )

        cursor = self._db.users.find({"roles": {"$exists": True}})
        async for doc in cursor:
            roles = doc.get("roles") or []
            normalized = [role.strip().lower() for role in roles if isinstance(role, str) and role.strip()]
            if normalized != roles:
                await self._db.users.update_one({"_id": doc["_id"]}, {"$set": {"roles": normalized}})

    async def touch_last_login(self, user_id: Any, timestamp: datetime) -> None:
        await self._db.users.update_one(
            {"_id": user_id},
            {"$set": {"last_login": timestamp, "updated_at": timestamp}},
        )
