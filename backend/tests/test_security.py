import asyncio
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException
from jose import jwt
from starlette.requests import Request

import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from backend.config import ALGORITHM, JWT_SECRET_KEY
from backend.security import get_current_user, hash_session_identifier, require_roles


class FakeUsersCollection:
    def __init__(self, user_doc):
        self.user_doc = user_doc
        self.updated = []

    async def find_one(self, query):
        matches_id = "_id" not in query or query["_id"] == self.user_doc["_id"]
        matches_email = "email" not in query or query["email"] == self.user_doc["email"]
        if matches_id and matches_email:
            return deepcopy(self.user_doc)
        return None

    async def update_one(self, query, payload):
        self.updated.append((deepcopy(query), deepcopy(payload)))
        return None


class FakeDB:
    def __init__(self, user_doc):
        self.users = FakeUsersCollection(user_doc)


def build_request(fake_db):
    app = SimpleNamespace(state=SimpleNamespace(db=fake_db))
    scope = {"type": "http", "headers": [], "app": app}
    return Request(scope, receive=lambda: None)


def build_token(user_id: ObjectId, session_id: str) -> str:
    expires_at = datetime.utcnow() + timedelta(minutes=5)
    payload = {"sub": str(user_id), "sid": session_id, "exp": expires_at}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)


def test_get_current_user_returns_user_for_active_session():
    user_id = ObjectId()
    session_id = "integration-session"
    fingerprint = hash_session_identifier(session_id)
    user_doc = {
        "_id": user_id,
        "email": "tester@example.com",
        "roles": ["Clinician"],
        "active_sessions": [
            {
                "fingerprint": fingerprint,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(minutes=5),
            }
        ],
    }
    fake_db = FakeDB(user_doc)
    request = build_request(fake_db)
    token = build_token(user_id, session_id)

    current_user = asyncio.run(get_current_user(request, token))

    assert current_user["email"] == "tester@example.com"
    assert request.state.session_fingerprint == fingerprint
    # roles normalized to lowercase
    assert current_user["roles"] == ["clinician"]


def test_require_roles_denies_missing_role():
    user_id = ObjectId()
    session_id = "integration-session"
    fingerprint = hash_session_identifier(session_id)
    user_doc = {
        "_id": user_id,
        "email": "viewer@example.com",
        "roles": ["viewer"],
        "active_sessions": [
            {
                "fingerprint": fingerprint,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(minutes=5),
            }
        ],
    }
    fake_db = FakeDB(user_doc)
    request = build_request(fake_db)
    token = build_token(user_id, session_id)
    current_user = asyncio.run(get_current_user(request, token))

    dependency = require_roles("clinician")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(dependency(current_user=current_user))

    assert exc.value.status_code == 403
    assert exc.value.detail == "Insufficient permissions"
