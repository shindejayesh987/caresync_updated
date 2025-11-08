from __future__ import annotations

from datetime import date
from datetime import datetime
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.models import Resource, TestScore
from backend.services.common import convert_date_to_datetime


class SchedulingRepository:
    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self._db = database

    async def find_staff(
        self,
        role: str,
        target_date: date,
        start: str,
        end: str,
    ) -> List[dict]:
        weekday = target_date.weekday()
        cursor = self._db.staff.find({"role": role})
        results: List[dict] = []
        async for doc in cursor:
            for wh in doc.get("working_hours", []):
                if wh.get("day_of_week") == weekday:
                    results.append(doc)
                    break
        return results

    async def find_generic_availability(
        self,
        collection: str,
        target_date: date,
        start: str,
        end: str,
        constraint: str,
    ) -> List[dict]:
        query_date = convert_date_to_datetime(target_date)
        cursor = self._db[collection].find({"date": query_date})
        return [doc async for doc in cursor]

    async def get_latest_test_scores(self, test_type: str, limit: int = 2) -> List[TestScore]:
        cursor = self._db.test_history.find({"test_type": test_type}).sort("date", -1).limit(limit)
        scores: List[TestScore] = []
        async for doc in cursor:
            scores.append(TestScore(patient_id=doc["patient_id"], score=doc["score"], date=doc["date"]))
        return scores

    async def map_resource(self, document: dict, *, identifier: str, name: str, email_field: Optional[str] = None) -> Resource:
        resource_id = document.get(identifier) or document.get("_id")
        resource_name = document.get(name) or str(resource_id)
        resource_email = document.get(email_field) if email_field else document.get("email")
        return Resource(id=str(resource_id), name=resource_name, email=resource_email)

    async def save_optimization_snapshot(self, document: dict) -> None:
        await self._db.optimization_snapshots.update_one(
            {"request_key": document["request_key"]},
            {"$set": document},
            upsert=True,
        )

    async def save_optimization_feedback(self, document: dict) -> None:
        await self._db.optimization_feedback.insert_one(document)

    async def fetch_recent_feedback(self, since: datetime) -> List[dict]:
        cursor = self._db.optimization_feedback.find({"submitted_at": {"$gte": since}})
        return [doc async for doc in cursor]
