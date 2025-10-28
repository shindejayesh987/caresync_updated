from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError

from backend.api.routes import auth, care, scheduling
from backend.db.manager import db_manager
from backend.repositories.user_repository import UserRepository
from backend.services.audit import AuditService
from backend.services.auth import AuthService


def create_app() -> FastAPI:
    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:  # noqa: ANN001
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Validation error",
                "detail": exc.errors(),
            },
        )

    @app.exception_handler(JWTError)
    async def jwt_exception_handler(request: Request, exc: JWTError) -> JSONResponse:  # noqa: ANN001
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"error": "Unauthorized", "detail": "Could not validate credentials"},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:  # noqa: ANN001
        print(f"Unhandled server error: {exc}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error",
                "detail": "Something went wrong. Please try again later.",
            },
        )

    @app.on_event("startup")
    async def startup_db_client() -> None:
        database = await db_manager.connect()
        app.state.db = database
        user_repo = UserRepository(database)
        audit_service = AuditService(database)
        auth_service = AuthService(user_repo, audit_service)
        await auth_service.ensure_default_roles()

    @app.on_event("shutdown")
    async def shutdown_db_client() -> None:
        await db_manager.close()

    app.include_router(auth.router)
    app.include_router(care.router)
    app.include_router(scheduling.router)

    return app
