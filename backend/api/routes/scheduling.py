from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.deps import get_availability_service, get_optimized_availability_service
from backend.models import (
    AvailabilityRequest,
    AvailabilityResponse,
    OptimizedAvailabilityResponse,
    ScenarioFeedbackPayload,
)
from backend.security import require_roles
from backend.services.ai import OptimizedAvailabilityService
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


@router.post(
    "/availability/optimized",
    response_model=OptimizedAvailabilityResponse,
    response_model_exclude_none=True,
)
async def optimized_availability(
    req: AvailabilityRequest,
    current_user=Depends(require_roles(*SCHEDULER_ROLES)),  # noqa: ARG001 - used for dependency validation
    service: OptimizedAvailabilityService = Depends(get_optimized_availability_service),
) -> OptimizedAvailabilityResponse:
    return await service.optimized_availability(req)


@router.post("/availability/optimized/feedback", status_code=201)
async def submit_optimization_feedback(
    payload: ScenarioFeedbackPayload,
    current_user=Depends(require_roles(*SCHEDULER_ROLES)),
    service: OptimizedAvailabilityService = Depends(get_optimized_availability_service),
) -> dict:
    return await service.record_feedback(payload, performed_by=current_user.get("id"))
