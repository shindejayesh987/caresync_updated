from __future__ import annotations

from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.models import Contact


class CareRepository:
    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self._db = database

    async def fetch_tasks(self, patient_id: str) -> List[Dict[str, Any]]:
        cursor = self._db.tasks.find({"patient_id": patient_id})
        return [doc async for doc in cursor]

    async def fetch_crew(self, patient_id: str) -> Optional[Dict[str, Any]]:
        return await self._db.crew_assignments.find_one({"patient_id": patient_id})

    async def fetch_timeline(self, patient_id: str) -> Optional[Dict[str, Any]]:
        return await self._db.timeline.find_one({"patient_id": patient_id})

    async def fetch_latest_vitals(self, patient_id: str) -> Optional[Dict[str, Any]]:
        docs = (
            await self._db.vitals.find({"patient_id": patient_id}).sort("captured_at", -1).limit(1).to_list(length=1)
        )
        return docs[0] if docs else None

    async def record_vitals(self, payload: Dict[str, Any]) -> Any:
        return await self._db.vitals.insert_one(payload)

    async def upsert_tasks(self, filter_doc: Dict[str, Any], update_doc: Dict[str, Any]) -> Any:
        return await self._db.tasks.update_one(filter_doc, {"$set": update_doc}, upsert=True)

    async def upsert_crew(self, filter_doc: Dict[str, Any], update_doc: Dict[str, Any]) -> Any:
        return await self._db.crew_assignments.update_one(filter_doc, {"$set": update_doc}, upsert=True)

    async def upsert_timeline(self, filter_doc: Dict[str, Any], update_doc: Dict[str, Any]) -> Any:
        return await self._db.timeline.update_one(filter_doc, {"$set": update_doc}, upsert=True)

    async def fetch_surgeries_for_doctor(self, doctor_id: str) -> List[Dict[str, Any]]:
        cursor = self._db.surgeries.find({"doctor_id": doctor_id}).sort("date", 1)
        return [doc async for doc in cursor]

    async def update_surgery(self, surgery_id, updates: Dict[str, Any]) -> Any:
        return await self._db.surgeries.update_one({"_id": surgery_id}, {"$set": updates})

    async def find_surgery(self, surgery_id) -> Optional[Dict[str, Any]]:
        return await self._db.surgeries.find_one({"_id": surgery_id})

    async def fetch_published_plans(self, patient_id: str) -> List[Dict[str, Any]]:
        cursor = self._db.published_plans.find({"patient_id": patient_id}).sort("created_at", -1)
        return [doc async for doc in cursor]

    async def insert_published_plan(self, record: Dict[str, Any]) -> Any:
        return await self._db.published_plans.insert_one(record)

    async def find_published_plan(self, record_id) -> Optional[Dict[str, Any]]:
        return await self._db.published_plans.find_one({"_id": record_id})

    async def update_contact(self, contact_id, updates: Dict[str, Any]) -> Any:
        return await self._db.contacts.update_one({"_id": contact_id}, {"$set": updates})

    async def upsert_contact(self, doc: Dict[str, Any]) -> Any:
        return await self._db.contacts.update_one({"email": doc["email"]}, {"$set": doc}, upsert=True)

    async def list_contacts(self) -> List[Dict[str, Any]]:
        cursor = self._db.contacts.find({}).sort("name", 1)
        return [doc async for doc in cursor]

    async def create_contact(self, contact: Contact) -> Any:
        return await self._db.contacts.insert_one(contact.model_dump())

    async def get_contact(self, contact_id) -> Optional[Dict[str, Any]]:
        return await self._db.contacts.find_one({"_id": contact_id})
