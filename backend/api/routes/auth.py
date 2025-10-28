from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from backend.api.deps import get_auth_service
from backend.models import ChangePasswordPayload, LogoutPayload, TokenResponse, UserCreate, UserLogin, UserResponse
from backend.security import require_roles
from backend.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=201)
async def signup_user(payload: UserCreate, service: AuthService = Depends(get_auth_service)) -> UserResponse:
    return await service.signup(payload)


@router.post("/login", response_model=TokenResponse)
async def login_user(payload: UserLogin, service: AuthService = Depends(get_auth_service)) -> TokenResponse:
    return await service.login(payload)


@router.post("/logout")
async def logout_user(
    payload: LogoutPayload,
    request: Request,
    current_user=Depends(require_roles()),
    service: AuthService = Depends(get_auth_service),
) -> dict:
    return await service.logout(payload, request, current_user)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordPayload,
    current_user=Depends(require_roles()),
    service: AuthService = Depends(get_auth_service),
) -> dict:
    return await service.change_password(payload, current_user)
