from __future__ import annotations

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

try:  # pragma: no cover - support running as module or package
    from config import MONGODB_DB_NAME, MONGODB_URL
except ImportError:  # pragma: no cover - fallback for package imports
    from backend.config import MONGODB_DB_NAME, MONGODB_URL  # type: ignore


class MongoConnectionManager:
    """Lifecycle manager for a Motor client."""

    def __init__(self) -> None:
        self._client: Optional[AsyncIOMotorClient] = None
        self._database: Optional[AsyncIOMotorDatabase] = None

    @property
    def database(self) -> AsyncIOMotorDatabase:
        if self._database is None:
            raise RuntimeError("Database has not been initialised")
        return self._database

    async def connect(self) -> AsyncIOMotorDatabase:
        if self._client is None:
            self._client = AsyncIOMotorClient(MONGODB_URL)
            self._database = self._client[MONGODB_DB_NAME]
            await self._database.command("ping")
        return self.database

    async def close(self) -> None:
        if self._client:
            self._client.close()
        self._client = None
        self._database = None


db_manager = MongoConnectionManager()
