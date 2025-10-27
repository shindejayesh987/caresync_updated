import asyncio
import secrets
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Union

from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient

try:
    import email_validator  # noqa: F401
except ImportError as exc:  # pragma: no cover
    raise RuntimeError(
        "Optional dependency 'email-validator' is required. "
        "Install with `pip install email-validator` or reinstall requirements."
    ) from exc

try:
    from jose import JWTError, jwt
except ImportError as exc:  # pragma: no cover
    raise RuntimeError(
        "Optional dependency 'python-jose' is required. "
        "Install with `pip install python-jose` or reinstall requirements."
    ) from exc

from passlib.context import CryptContext
from pymongo.errors import DuplicateKeyError

try:  # pragma: no cover - support running as module or package
    from config import (
        ACCESS_TOKEN_EXPIRE_MINUTES,
        ALGORITHM,
        DEFAULT_USER_ROLES,
        JWT_SECRET_KEY,
        MONGODB_DB_NAME,
        MONGODB_URL,
        SESSION_TTL_MINUTES,
    )
except ImportError:  # pragma: no cover - fallback for package imports
    from backend.config import (  # type: ignore
        ACCESS_TOKEN_EXPIRE_MINUTES,
        ALGORITHM,
        DEFAULT_USER_ROLES,
        JWT_SECRET_KEY,
        MONGODB_DB_NAME,
        MONGODB_URL,
        SESSION_TTL_MINUTES,
    )
from models import (
    AvailabilityRequest,
    AvailabilityResponse,
    Resource,
    TestScore,
    Contact,
    PublishPayload,
    UserCreate,
    UserResponse,
    UserLogin,
    TokenResponse,
    LogoutPayload,
    ChangePasswordPayload,
    TaskUpdatePayload,
    CrewUpdatePayload,
    TimelineUpdatePayload,
    VitalsPayload,
    SurgeryUpdatePayload,
)

from security import decode_access_token, hash_session_identifier, require_roles

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[MONGODB_DB_NAME]

CLINICAL_ROLES = ("clinician", "admin")
SCHEDULER_ROLES = ("scheduler", "clinician", "admin")
ADMIN_ROLES = ("admin",)


def normalize_roles(roles: Optional[List[str]]) -> List[str]:
    if not roles:
        return list(DEFAULT_USER_ROLES)
    normalized: List[str] = []
    for role in roles:
        if not isinstance(role, str):
            continue
        trimmed = role.strip().lower()
        if trimmed and trimmed not in normalized:
            normalized.append(trimmed)
    return normalized or list(DEFAULT_USER_ROLES)


def current_timestamp() -> datetime:
    return datetime.utcnow()


def to_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid identifier: {value}") from exc


async def log_auth_event(user_id: Optional[str], email: Optional[str], event: str, metadata: Optional[Dict] = None) -> None:
    doc = {
        "user_id": user_id,
        "email": email,
        "event": event,
        "metadata": metadata or {},
        "timestamp": current_timestamp(),
    }
    await db.auth_logs.insert_one(doc)


async def log_activity(action: str, performed_by: Optional[str], payload: Dict) -> None:
    doc = {
        "action": action,
        "performed_by": performed_by,
        "payload": payload,
        "timestamp": current_timestamp(),
    }
    await db.activity_logs.insert_one(doc)


async def ensure_default_user_roles() -> None:
    default_roles = list(DEFAULT_USER_ROLES)
    await db.users.update_many(
        {"$or": [{"roles": {"$exists": False}}, {"roles": []}]},
        {"$set": {"roles": default_roles}},
    )

    cursor = db.users.find({"roles": {"$exists": True}})
    async for doc in cursor:
        normalized = normalize_roles(doc.get("roles"))
        if normalized != doc.get("roles"):
            await db.users.update_one({"_id": doc["_id"]}, {"$set": {"roles": normalized}})


def serialize_doc(doc: dict) -> dict:
    if not doc:
        return doc
    serialized = {**doc}
    oid = serialized.get("_id")
    if isinstance(oid, ObjectId):
        serialized["_id"] = str(oid)

    for key in [
        "created_at",
        "updated_at",
        "last_login",
        "captured_at",
        "recorded_at",
        "timestamp",
    ]:
        value = serialized.get(key)
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()

    return serialized


def get_password_hash(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password length exceeds bcrypt limit of 72 bytes")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def generate_session_id() -> str:
    return secrets.token_urlsafe(32)


def create_access_token(subject: str, session_id: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {"sub": subject, "exp": expire, "sid": session_id}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)


def user_doc_to_response(doc: dict) -> UserResponse:
    roles = normalize_roles(doc.get("roles"))
    return UserResponse(
        id=str(doc["_id"]),
        email=doc["email"],
        full_name=doc.get("full_name"),
        roles=roles,
    )


async def get_user_by_email(email: str) -> Optional[dict]:
    return await db.users.find_one({"email": email})


app = FastAPI()
app.state.db = db

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation error",
            "detail": exc.errors(),
        },
    )


@app.exception_handler(JWTError)
async def jwt_exception_handler(request: Request, exc: JWTError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"error": "Unauthorized", "detail": "Could not validate credentials"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
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
    try:
        await db.command("ping")
        await db.users.create_index("email", unique=True)
        app.state.db = db
        await ensure_default_user_roles()
    except Exception as exc:
        print(f"Error connecting to MongoDB: {exc}")
        raise


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


def convert_date_to_datetime(date_input: Union[str, date]) -> datetime:
    if isinstance(date_input, date):
        return datetime(date_input.year, date_input.month, date_input.day)
    return datetime.strptime(date_input, "%Y-%m-%d")


def time_window_match(start1: str, end1: str, start2: str, end2: str, constraint: str) -> bool:
    fmt = "%H:%M"
    s1 = datetime.strptime(start1, fmt).time()
    e1 = datetime.strptime(end1, fmt).time()
    s2 = datetime.strptime(start2, fmt).time()
    e2 = datetime.strptime(end2, fmt).time()
    if constraint == "exact":
        return s1 <= s2 and e1 >= e2
    return not (e1 < s2 or s1 > e2)


async def find_staff(
    role: str,
    date: date,
    start: str,
    end: str,
    constraint_type: str
) -> List[Resource]:
    weekday = date.weekday()
    cursor = db.staff.find({"role": role})
    results: List[Resource] = []
    async for doc in cursor:
        for wh in doc["working_hours"]:
            if wh["day_of_week"] == weekday and time_window_match(wh["start"], wh["end"], start, end, constraint_type):
                results.append(Resource(id=str(doc["_id"]), name=doc["name"], email=doc.get("email")))
                break
    return results


async def find_generic_availability(
    collection: str,
    date: date,
    start: str,
    end: str,
    id_field: str,
    name_field: str,
    constraint_type: str
) -> List[Resource]:
    query_date = convert_date_to_datetime(date)
    cursor = db[collection].find({"date": query_date})
    results: List[Resource] = []
    async for doc in cursor:
        doc_start = doc.get("start")
        doc_end = doc.get("end")
        if not (doc_start and doc_end):
            continue
        if time_window_match(str(doc_start), str(doc_end), start, end, constraint_type):
            identifier = doc.get(id_field) or doc.get("_id")
            if identifier is None:
                continue
            name = doc.get(name_field) or str(identifier)
            email = doc.get("nurse_email") if collection == "nurse_availability" else doc.get("email")
            results.append(Resource(id=str(identifier), name=name, email=email))
    return results


async def get_latest_test_scores(test_type: str) -> List[TestScore]:
    cursor = db.test_history.find({"test_type": test_type}).sort("date", -1).limit(2)
    scores: List[TestScore] = []
    async for doc in cursor:
        scores.append(TestScore(patient_id=doc["patient_id"], score=doc["score"], date=doc["date"]))
    return scores


@app.post("/auth/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup_user(payload: UserCreate) -> UserResponse:
    email = payload.email.lower()
    existing = await get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    try:
        hashed_password = get_password_hash(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    roles = normalize_roles(payload.roles)
    now = current_timestamp()
    user_doc = {
        "email": email,
        "full_name": payload.full_name,
        "hashed_password": hashed_password,
        "created_at": now,
        "updated_at": now,
        "last_login": None,
        "roles": roles,
        "active_sessions": [],
    }

    try:
        result = await db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user_doc["_id"] = result.inserted_id
    await log_auth_event(str(result.inserted_id), email, "signup", {"full_name": payload.full_name})
    return user_doc_to_response(user_doc)


@app.post("/auth/login", response_model=TokenResponse)
async def login_user(payload: UserLogin) -> TokenResponse:
    email = payload.email.lower()
    user_doc = await get_user_by_email(email)
    if not user_doc or not verify_password(payload.password, user_doc.get("hashed_password", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    roles = normalize_roles(user_doc.get("roles"))
    session_id = generate_session_id()
    session_fingerprint = hash_session_identifier(session_id)
    now = current_timestamp()
    expires_at = now + timedelta(minutes=SESSION_TTL_MINUTES)
    active_sessions = [
        session
        for session in user_doc.get("active_sessions", []) or []
        if session.get("expires_at") and session["expires_at"] > now
    ]
    active_sessions.append(
        {
            "fingerprint": session_fingerprint,
            "created_at": now,
            "expires_at": expires_at,
        }
    )

    await db.users.update_one(
        {"_id": user_doc["_id"]},
        {
            "$set": {
                "last_login": now,
                "updated_at": now,
                "active_sessions": active_sessions,
                "roles": roles,
            },
            "$unset": {"session_token": ""},
        },
    )

    user_doc["roles"] = roles
    token = create_access_token(str(user_doc["_id"]), session_id)
    await log_auth_event(
        str(user_doc["_id"]),
        email,
        "login",
        {"session_fingerprint": session_fingerprint},
    )
    user = user_doc_to_response(user_doc)
    return TokenResponse(access_token=token, user=user)


@app.post("/auth/logout")
async def logout_user(
    payload: LogoutPayload,
    request: Request,
    current_user=Depends(require_roles()),
) -> Dict[str, str]:
    query: Dict[str, Union[str, ObjectId]] = {}
    if payload.user_id:
        query["_id"] = to_object_id(payload.user_id)
    if payload.email:
        query["email"] = payload.email.lower()
    if not query:
        query["_id"] = current_user["_id"]

    user_doc = await db.users.find_one(query)
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    before_sessions = len(user_doc.get("active_sessions", []) or [])
    fingerprint_to_remove: Optional[str] = None
    if payload.session_token:
        token_data = decode_access_token(payload.session_token)
        fingerprint_to_remove = hash_session_identifier(token_data["sid"])
    else:
        request_fingerprint = getattr(request.state, "session_fingerprint", None)
        if request_fingerprint and user_doc["_id"] == current_user["_id"]:
            fingerprint_to_remove = request_fingerprint

    if fingerprint_to_remove:
        active_sessions = [
            session
            for session in user_doc.get("active_sessions", []) or []
            if session.get("fingerprint") != fingerprint_to_remove
        ]
    else:
        active_sessions = []

    await db.users.update_one(
        {"_id": user_doc["_id"]},
        {
            "$set": {
                "active_sessions": active_sessions,
                "updated_at": current_timestamp(),
            },
            "$unset": {"session_token": ""},
        },
    )
    await log_auth_event(
        str(user_doc["_id"]),
        user_doc["email"],
        "logout",
        {"cleared_sessions": before_sessions - len(active_sessions)},
    )
    return {"detail": "Logged out"}


@app.post("/auth/change-password")
async def change_password(
    payload: ChangePasswordPayload,
    current_user=Depends(require_roles()),
) -> Dict[str, str]:
    email = payload.email.lower()
    if current_user["email"].lower() != email:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot change password for another user")
    user_doc = await get_user_by_email(email)
    if not user_doc or not verify_password(payload.old_password, user_doc.get("hashed_password", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    try:
        new_hash = get_password_hash(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    now = current_timestamp()
    await db.users.update_one(
        {"_id": user_doc["_id"]},
        {
            "$set": {
                "hashed_password": new_hash,
                "updated_at": now,
            }
        },
    )
    await log_auth_event(str(user_doc["_id"]), email, "password_change", {})
    return {"detail": "Password updated"}


@app.post(
    "/availability",
    response_model=AvailabilityResponse,
    response_model_exclude_none=True
)
async def check_availability(
    req: AvailabilityRequest,
    current_user=Depends(require_roles(*SCHEDULER_ROLES)),
):
    try:
        requested_date = datetime.strptime(req.requested_date, "%Y-%m-%d").date()
        datetime.strptime(req.requested_start, "%H:%M")
        datetime.strptime(req.requested_end, "%H:%M")
        constraint = req.time_constraint_type

        rad_raw, asst_raw, nurse_raw, equip_raw, ot_raw, scores = await asyncio.gather(
            find_staff("radiologist", requested_date, req.requested_start, req.requested_end, constraint),
            find_staff("assistant_doctor", requested_date, req.requested_start, req.requested_end, constraint),
            find_generic_availability("nurse_availability", requested_date, req.requested_start, req.requested_end, "nurse_id", "nurse_name", constraint),
            find_generic_availability("equipment_availability", requested_date, req.requested_start, req.requested_end, "equipment_name", "equipment_name", constraint),
            find_generic_availability("ot_availability", requested_date, req.requested_start, req.requested_end, "ot_id", "ot_id", constraint),
            get_latest_test_scores(req.required_test_type)
        )

        radiologists = rad_raw[:req.required_radiologists]
        assistant_doctors = asst_raw[:req.required_assistant_doctors]
        nurses = nurse_raw[:req.required_nurses]
        ots = ot_raw[:req.required_operation_rooms]

        if req.required_equipment:
            equipment = [e for e in equip_raw if e.name == req.required_equipment]
        else:
            equipment = equip_raw

        enough = all([
            len(rad_raw) >= req.required_radiologists,
            len(asst_raw) >= req.required_assistant_doctors,
            len(nurse_raw) >= req.required_nurses,
            len(ots) >= req.required_operation_rooms,
            (not req.required_equipment) or bool(equipment)
        ])
        status = "Requirements matched" if enough else "Requirements not met"

        return AvailabilityResponse(
            date=req.requested_date,
            start=req.requested_start,
            end=req.requested_end,
            radiologists_available=radiologists,
            assistant_doctors_available=assistant_doctors,
            nurses_available=nurses,
            equipment_available=equipment,
            operation_theatres_available=ots,
            latest_test_scores=scores,
            match_status=status
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date/time format: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@app.post("/tasks/update")
async def update_tasks(
    payload: TaskUpdatePayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> Dict[str, str]:
    now = current_timestamp()
    performed_by = payload.performed_by or current_user.get("email")
    filter_doc = {
        "patient_id": payload.patient_id,
        "scope": payload.scope,
        "staff_name": payload.staff_name,
        "staff_role": payload.staff_role,
    }
    task_docs = [task.model_dump(exclude_none=True) for task in payload.tasks]
    await db.tasks.update_one(
        filter_doc,
        {
            "$set": {
                "patient_id": payload.patient_id,
                "scope": payload.scope,
                "staff_name": payload.staff_name,
                "staff_role": payload.staff_role,
                "tasks": task_docs,
                "updated_at": now,
                "performed_by": performed_by,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await log_activity(
        "tasks.update",
        performed_by,
        {**filter_doc, "task_count": len(task_docs)},
    )
    return {"detail": "Tasks updated"}


@app.post("/crew/update")
async def update_crew(
    payload: CrewUpdatePayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> Dict[str, str]:
    now = current_timestamp()
    performed_by = payload.performed_by or current_user.get("email")
    await db.crew_assignments.update_one(
        {"patient_id": payload.patient_id},
        {
            "$set": {
                "doctors": payload.doctors,
                "nurses": payload.nurses,
                "updated_at": now,
                "performed_by": performed_by,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await log_activity(
        "crew.update",
        performed_by,
        {"patient_id": payload.patient_id, "doctor_count": len(payload.doctors), "nurse_count": len(payload.nurses)},
    )
    return {"detail": "Crew updated"}


@app.post("/timeline/update")
async def update_timeline(
    payload: TimelineUpdatePayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> Dict[str, str]:
    now = current_timestamp()
    performed_by = payload.performed_by or current_user.get("email")
    steps_doc = [step.model_dump() for step in payload.steps]
    await db.timeline.update_one(
        {"patient_id": payload.patient_id},
        {
            "$set": {
                "steps": steps_doc,
                "updated_at": now,
                "performed_by": performed_by,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await log_activity(
        "timeline.update",
        performed_by,
        {"patient_id": payload.patient_id, "step_count": len(steps_doc)},
    )
    return {"detail": "Timeline updated"}


@app.post("/vitals/update")
async def record_vitals(
    payload: VitalsPayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> Dict[str, str]:
    now = payload.captured_at or current_timestamp()
    recorded_by = payload.performed_by or current_user.get("email")
    vitals_doc = {
        "patient_id": payload.patient_id,
        "heart_rate": payload.heart_rate,
        "blood_pressure": payload.blood_pressure,
        "spo2": payload.spo2,
        "captured_at": now,
        "recorded_at": current_timestamp(),
        "recorded_by": recorded_by,
    }
    await db.vitals.insert_one(vitals_doc)
    await log_activity(
        "vitals.record",
        recorded_by,
        {"patient_id": payload.patient_id, "captured_at": now},
    )
    return {"detail": "Vitals recorded"}


@app.get("/tasks/{patient_id}")
async def fetch_tasks(
    patient_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> Dict[str, List[dict]]:
    cursor = db.tasks.find({"patient_id": patient_id})
    items: List[dict] = []
    async for doc in cursor:
        items.append(serialize_doc(doc))
    return {"tasks": items}


@app.get("/crew/{patient_id}")
async def fetch_crew(
    patient_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> dict:
    doc = await db.crew_assignments.find_one({"patient_id": patient_id})
    return serialize_doc(doc) if doc else {"patient_id": patient_id, "doctors": [], "nurses": []}


@app.get("/timeline/{patient_id}")
async def fetch_timeline(
    patient_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> dict:
    doc = await db.timeline.find_one({"patient_id": patient_id})
    return serialize_doc(doc) if doc else {"patient_id": patient_id, "steps": []}


@app.get("/vitals/{patient_id}/latest")
async def fetch_latest_vitals(
    patient_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> dict:
    doc = await db.vitals.find({"patient_id": patient_id}).sort("captured_at", -1).limit(1).to_list(length=1)
    if not doc:
        return {"patient_id": patient_id, "heart_rate": None, "blood_pressure": None, "spo2": None}
    return serialize_doc(doc[0])


@app.get("/surgeries/{doctor_id}")
async def fetch_surgeries_for_doctor(
    doctor_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> Dict[str, List[dict]]:
    cursor = db.surgeries.find({"doctor_id": doctor_id}).sort("date", 1)
    surgeries: List[dict] = []
    async for doc in cursor:
        surgeries.append(serialize_doc(doc))
    return {"surgeries": surgeries}


@app.put("/surgeries/update/{surgery_id}")
async def update_surgery(
    surgery_id: str,
    payload: SurgeryUpdatePayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> dict:
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    performed_by = updates.pop("performed_by", None)
    actor = performed_by or current_user.get("email")
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No updates provided.")

    updates["updated_at"] = current_timestamp()

    object_id = to_object_id(surgery_id)
    result = await db.surgeries.update_one({"_id": object_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Surgery not found.")

    record = await db.surgeries.find_one({"_id": object_id})
    await log_activity(
        "surgeries.update",
        actor,
        {"surgery_id": surgery_id, "fields": list(updates.keys())},
    )
    return serialize_doc(record)


@app.get("/published/{patient_id}")
async def fetch_published_plans(
    patient_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> Dict[str, List[dict]]:
    cursor = db.published_plans.find({"patient_id": patient_id}).sort("created_at", -1)
    items: List[dict] = []
    async for doc in cursor:
        items.append(serialize_doc(doc))
    return {"plans": items}


@app.post("/publish")
async def publish_plan(
    data: PublishPayload,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
):
    try:
        record = data.model_dump()
        now = current_timestamp()
        record["created_at"] = now
        record["status"] = "Published"
        if not record.get("tab"):
            record["tab"] = "preop"
        record["published_by"] = current_user.get("email")

        insert_result = await db.published_plans.insert_one(record)
        saved = await db.published_plans.find_one({"_id": insert_result.inserted_id})

        await log_activity(
            "publish_plan",
            current_user.get("email"),
            {
                "plan_id": data.plan_id,
                "published_at": now,
                "record_id": str(insert_result.inserted_id),
                "tab": data.tab or "preop",
            },
        )

        return {
            "message": "Plan published successfully",
            "plan_id": str(insert_result.inserted_id),
            "plan": serialize_doc(saved),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Publish failed",
        ) from exc


@app.get("/publish/{record_id}")
async def fetch_published_plan(
    record_id: str,
    current_user=Depends(require_roles(*CLINICAL_ROLES)),
) -> dict:
    try:
        doc = await db.published_plans.find_one({"_id": to_object_id(record_id)})
    except HTTPException:
        raise
    except Exception as exc:  # fallback for invalid ids
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan identifier") from exc

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return serialize_doc(doc)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
