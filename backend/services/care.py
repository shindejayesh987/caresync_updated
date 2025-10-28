from __future__ import annotations

from typing import Dict, List

from fastapi import HTTPException, status

from backend.models import (
    PublishPayload,
    SurgeryUpdatePayload,
    TaskUpdatePayload,
    TimelineUpdatePayload,
    CrewUpdatePayload,
    VitalsPayload,
)
from backend.repositories.care_repository import CareRepository
from backend.services.audit import AuditService
from backend.services.common import current_timestamp, serialize_doc, to_object_id


class CareService:
    def __init__(self, repository: CareRepository, audit: AuditService) -> None:
        self._repository = repository
        self._audit = audit

    async def update_tasks(self, payload: TaskUpdatePayload, performed_by: str) -> Dict[str, str]:
        now = current_timestamp()
        filter_doc = {
            "patient_id": payload.patient_id,
            "scope": payload.scope,
            "staff_name": payload.staff_name,
            "staff_role": payload.staff_role,
        }
        task_docs = [task.model_dump(exclude_none=True) for task in payload.tasks]
        await self._repository.upsert_tasks(
            filter_doc,
            {
                **filter_doc,
                "tasks": task_docs,
                "updated_at": now,
            },
        )
        await self._audit.log_activity(
            "tasks.update",
            performed_by,
            {"patient_id": payload.patient_id, "scope": payload.scope, "updated_at": now},
        )
        return {"detail": "Tasks updated"}

    async def update_crew(self, payload: CrewUpdatePayload, performed_by: str) -> Dict[str, str]:
        now = current_timestamp()
        await self._repository.upsert_crew(
            {"patient_id": payload.patient_id},
            {
                "patient_id": payload.patient_id,
                "doctors": payload.doctors,
                "nurses": payload.nurses,
                "updated_at": now,
            },
        )
        await self._audit.log_activity(
            "crew.update",
            performed_by,
            {"patient_id": payload.patient_id, "updated_at": now},
        )
        return {"detail": "Crew updated"}

    async def update_timeline(self, payload: TimelineUpdatePayload, performed_by: str) -> Dict[str, str]:
        now = current_timestamp()
        await self._repository.upsert_timeline(
            {"patient_id": payload.patient_id},
            {
                "patient_id": payload.patient_id,
                "steps": [step.model_dump() for step in payload.steps],
                "updated_at": now,
            },
        )
        await self._audit.log_activity(
            "timeline.update",
            performed_by,
            {"patient_id": payload.patient_id, "updated_at": now},
        )
        return {"detail": "Timeline updated"}

    async def record_vitals(self, payload: VitalsPayload, performed_by: str) -> Dict[str, str]:
        now = payload.captured_at or current_timestamp()
        record = payload.model_dump()
        record["captured_at"] = now
        record["recorded_at"] = current_timestamp()
        record["recorded_by"] = performed_by
        await self._repository.record_vitals(record)
        await self._audit.log_activity(
            "vitals.record",
            performed_by,
            {"patient_id": payload.patient_id, "captured_at": now},
        )
        return {"detail": "Vitals recorded"}

    async def fetch_tasks(self, patient_id: str) -> Dict[str, List[Dict]]:
        items = [serialize_doc(doc) for doc in await self._repository.fetch_tasks(patient_id)]
        return {"tasks": items}

    async def fetch_crew(self, patient_id: str) -> Dict:
        doc = await self._repository.fetch_crew(patient_id)
        if not doc:
            return {"patient_id": patient_id, "doctors": [], "nurses": []}
        return serialize_doc(doc)  # type: ignore[return-value]

    async def fetch_timeline(self, patient_id: str) -> Dict:
        doc = await self._repository.fetch_timeline(patient_id)
        if not doc:
            return {"patient_id": patient_id, "steps": []}
        return serialize_doc(doc)  # type: ignore[return-value]

    async def fetch_latest_vitals(self, patient_id: str) -> Dict:
        doc = await self._repository.fetch_latest_vitals(patient_id)
        if not doc:
            return {"patient_id": patient_id, "heart_rate": None, "blood_pressure": None, "spo2": None}
        return serialize_doc(doc)  # type: ignore[return-value]

    async def fetch_surgeries_for_doctor(self, doctor_id: str) -> Dict[str, List[Dict]]:
        surgeries = [serialize_doc(doc) for doc in await self._repository.fetch_surgeries_for_doctor(doctor_id)]
        return {"surgeries": surgeries}

    async def update_surgery(self, surgery_id: str, payload: SurgeryUpdatePayload, performed_by: str) -> Dict:
        updates = payload.model_dump(exclude_unset=True, exclude_none=True)
        updates.pop("performed_by", None)
        if not updates:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No updates provided.")
        updates["updated_at"] = current_timestamp()
        object_id = to_object_id(surgery_id)
        result = await self._repository.update_surgery(object_id, updates)
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Surgery not found.")
        record = await self._repository.find_surgery(object_id)
        await self._audit.log_activity(
            "surgeries.update",
            performed_by,
            {"surgery_id": surgery_id, "fields": list(updates.keys())},
        )
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Surgery not found.")
        return serialize_doc(record)  # type: ignore[return-value]

    async def fetch_published_plans(self, patient_id: str) -> Dict[str, List[Dict]]:
        items = [serialize_doc(doc) for doc in await self._repository.fetch_published_plans(patient_id)]
        return {"plans": items}

    async def publish_plan(self, payload: PublishPayload, performed_by: str) -> Dict:
        record = payload.model_dump()
        now = current_timestamp()
        record["created_at"] = now
        record["status"] = "Published"
        record["tab"] = record.get("tab") or "preop"
        record["published_by"] = performed_by
        try:
            insert_result = await self._repository.insert_published_plan(record)
            saved = await self._repository.find_published_plan(insert_result.inserted_id)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Publish failed") from exc

        await self._audit.log_activity(
            "publish_plan",
            performed_by,
            {"plan_id": payload.plan_id, "published_at": now, "record_id": str(insert_result.inserted_id), "tab": record["tab"]},
        )
        return {
            "message": "Plan published successfully",
            "plan_id": str(insert_result.inserted_id),
            "plan": serialize_doc(saved),
        }

    async def fetch_published_plan(self, record_id: str) -> Dict:
        try:
            object_id = to_object_id(record_id)
        except HTTPException as exc:
            if exc.status_code == status.HTTP_400_BAD_REQUEST:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan identifier") from exc
            raise
        doc = await self._repository.find_published_plan(object_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
        return serialize_doc(doc)  # type: ignore[return-value]
