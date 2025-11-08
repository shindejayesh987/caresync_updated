from __future__ import annotations

from fastapi import Depends, Request

from fastapi import Depends, Request

from backend.repositories.care_repository import CareRepository
from backend.repositories.scheduling_repository import SchedulingRepository
from backend.repositories.user_repository import UserRepository
from backend.services.ai import AIOptimizationService, OptimizedAvailabilityService
from backend.services.audit import AuditService
from backend.services.auth import AuthService
from backend.services.availability import AvailabilityService
from backend.services.care import CareService


def get_database(request: Request):
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise RuntimeError("Database not initialised on application state")
    return db


def get_user_repository(db=Depends(get_database)) -> UserRepository:
    return UserRepository(db)


def get_care_repository(db=Depends(get_database)) -> CareRepository:
    return CareRepository(db)


def get_scheduling_repository(db=Depends(get_database)) -> SchedulingRepository:
    return SchedulingRepository(db)


def get_audit_service(db=Depends(get_database)) -> AuditService:
    return AuditService(db)


def get_auth_service(
    user_repo: UserRepository = Depends(get_user_repository),
    audit_service: AuditService = Depends(get_audit_service),
) -> AuthService:
    return AuthService(user_repo, audit_service)


def get_availability_service(
    repository: SchedulingRepository = Depends(get_scheduling_repository),
) -> AvailabilityService:
    return AvailabilityService(repository)


def get_ai_service(request: Request) -> AIOptimizationService:
    service = getattr(request.app.state, "ai_service", None)
    if service is None:
        db = get_database(request)
        repository = SchedulingRepository(db)
        service = AIOptimizationService(repository)
        request.app.state.ai_service = service
    return service


def get_optimized_availability_service(request: Request) -> OptimizedAvailabilityService:
    service = getattr(request.app.state, "optimized_availability_service", None)
    if service is None:
        db = get_database(request)
        repository = SchedulingRepository(db)
        availability_service = AvailabilityService(repository)
        audit_service = AuditService(db)
        ai_service = get_ai_service(request)
        service = OptimizedAvailabilityService(availability_service, ai_service, repository, audit_service)
        request.app.state.optimized_availability_service = service
    return service


def get_care_service(
    repository: CareRepository = Depends(get_care_repository),
    audit_service: AuditService = Depends(get_audit_service),
) -> CareService:
    return CareService(repository, audit_service)
