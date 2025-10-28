from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.deps import get_care_service
from backend.models import (
    CrewUpdatePayload,
    PublishPayload,
    SurgeryUpdatePayload,
    TaskUpdatePayload,
    TimelineUpdatePayload,
    VitalsPayload,
)
from backend.security import require_roles
from backend.services.care import CareService

CLINICAL_ROLES = ("clinician", "admin")

router = APIRouter(tags=["care"])


@router.post("/tasks/update")
async def update_tasks(
    payload: TaskUpdatePayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    performed_by = payload.performed_by or current_user.get("email")
    return await service.update_tasks(payload, performed_by)


@router.post("/crew/update")
async def update_crew(
    payload: CrewUpdatePayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    performed_by = payload.performed_by or current_user.get("email")
    return await service.update_crew(payload, performed_by)


@router.post("/timeline/update")
async def update_timeline(
    payload: TimelineUpdatePayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    performed_by = payload.performed_by or current_user.get("email")
    return await service.update_timeline(payload, performed_by)


@router.post("/vitals/update")
async def update_vitals(
    payload: VitalsPayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    performed_by = payload.performed_by or current_user.get("email")
    return await service.record_vitals(payload, performed_by)


@router.get("/tasks/{patient_id}")
async def fetch_tasks(
    patient_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    return await service.fetch_tasks(patient_id)


@router.get("/crew/{patient_id}")
async def fetch_crew(
    patient_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    return await service.fetch_crew(patient_id)


@router.get("/timeline/{patient_id}")
async def fetch_timeline(
    patient_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    return await service.fetch_timeline(patient_id)


@router.get("/vitals/{patient_id}/latest")
async def fetch_latest_vitals(
    patient_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    return await service.fetch_latest_vitals(patient_id)


@router.get("/surgeries/{doctor_id}")
async def fetch_surgeries_for_doctor(
    doctor_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    return await service.fetch_surgeries_for_doctor(doctor_id)


@router.put("/surgeries/update/{surgery_id}")
async def update_surgery(
    surgery_id: str,
    payload: SurgeryUpdatePayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    performed_by = payload.performed_by or current_user.get("email")
    return await service.update_surgery(surgery_id, payload, performed_by)


@router.get("/published/{patient_id}")
async def fetch_published_plans(
    patient_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    return await service.fetch_published_plans(patient_id)


@router.post("/publish")
async def publish_plan(
    payload: PublishPayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    performed_by = current_user.get("email")
    return await service.publish_plan(payload, performed_by)


@router.get("/publish/{record_id}")
async def fetch_published_plan(
    record_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
    service: CareService = Depends(get_care_service),
) -> dict:
    return await service.fetch_published_plan(record_id)
