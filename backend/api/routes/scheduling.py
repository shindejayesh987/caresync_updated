from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.deps import get_availability_service
from backend.models import AvailabilityRequest, AvailabilityResponse
from backend.security import require_roles
from backend.services.availability import AvailabilityService

SCHEDULER_ROLES = ("scheduler", "clinician", "admin")

router = APIRouter(tags=["scheduling"])


@router.post("/availability", response_model=AvailabilityResponse, response_model_exclude_none=True)
async def check_availability(
    req: AvailabilityRequest,
    current_user=Depends(require_roles(*SCHEDULER_ROLES)),  # noqa: ARG001 - used for dependency validation
    service: AvailabilityService = Depends(get_availability_service),
) -> AvailabilityResponse:
    return await service.check_availability(req)
