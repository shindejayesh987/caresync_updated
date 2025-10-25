# from fastapi import FastAPI, HTTPException
# from motor.motor_asyncio import AsyncIOMotorClient
# from datetime import datetime, date
# from fastapi.middleware.cors import CORSMiddleware  # ✅ Already present

# import asyncio
# from typing import List, Dict
# from models import (
#     AvailabilityRequest,
#     AvailabilityResponse,
#     Resource,
#     TestScore,
#     StaffDocument,
#     NurseAvailabilityDocument,
#     EquipmentAvailabilityDocument,
#     OTAvailabilityDocument,
#     TestHistoryDocument
# )
# import os
# from dotenv import load_dotenv

# # Load environment variables
# load_dotenv()

# app = FastAPI(title="Hospital Resource Management API")

# # ✅ CORS configuration added here



# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],           # ✅ allow ALL domains
#     allow_credentials=True,
#     allow_methods=["*"],           # ✅ allow all methods: GET, POST, OPTIONS, etc.
#     allow_headers=["*"],           # ✅ allow all headers
# )



# # MongoDB connection
# MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://<USERNAME>:<PASSWORD>@<CLUSTER>.mongodb.net/hospital?retryWrites=true&w=majority")
# client = AsyncIOMotorClient(MONGODB_URL)
# db = client.hospital

# @app.on_event("startup")
# async def startup_db_client():
#     print("Connecting to MongoDB...")
#     # Test the connection
#     try:
#         await db.command("ping")
#         print("Successfully connected to MongoDB!")
#     except Exception as e:
#         print(f"Error connecting to MongoDB: {e}")
#         raise

# @app.on_event("shutdown")
# async def shutdown_db_client():
#     print("Closing MongoDB connection...")
#     client.close()

# def convert_date_to_datetime(date_obj):
#     """Convert date object to datetime object for MongoDB compatibility"""
#     return datetime.combine(date_obj, datetime.min.time())

# def time_window_match(resource_start, resource_end, req_start, req_end, constraint_type):
#     if constraint_type == "exact":
#         return resource_start == req_start and resource_end == req_end
#     # overlap
#     return not (resource_end <= req_start or resource_start >= req_end)

# async def find_staff(role: str, date: date, start: str, end: str, constraint_type: str) -> List[Resource]:
#     weekday = date.weekday()
#     cursor = db.staff.find({"role": role})
#     staff_list = []
#     async for doc in cursor:
#         for wh in doc["working_hours"]:
#             if wh["day_of_week"] == weekday and time_window_match(wh["start"], wh["end"], start, end, constraint_type):
#                 staff_list.append(Resource(id=str(doc["_id"]), name=doc["name"]))
#                 break
#     return staff_list[:2]

# async def find_generic_availability(collection: str, date: date, start: str, end: str, id_field: str, name_field: str, constraint_type: str) -> List[Resource]:
#     cursor = db[collection].find({"date": convert_date_to_datetime(date)})
#     resources = []
#     async for doc in cursor:
#         if time_window_match(doc["start"], doc["end"], start, end, constraint_type):
#             resources.append(Resource(id=str(doc[id_field]), name=doc.get(name_field, str(doc[id_field]))))
#     return resources[:2]

# async def get_latest_test_scores(test_type: str, limit: int = 5) -> List[TestScore]:
#     """Get the latest test scores for a given test type."""
#     cursor = db.test_history.find(
#         {"test_type": test_type}
#     ).sort("date", -1).limit(limit)
    
#     scores = []
#     async for doc in cursor:
#         scores.append(TestScore(
#             patient_id=doc["patient_id"],
#             test_type=doc["test_type"],
#             score=doc["score"]
#         ))
    
#     return scores

# @app.post("/check-availability/", response_model=AvailabilityResponse)
# async def check_availability(req: AvailabilityRequest):
#     try:
#         requested_date = datetime.strptime(req.requested_date, "%Y-%m-%d").date()
#         datetime.strptime(req.requested_start, "%H:%M")
#         datetime.strptime(req.requested_end, "%H:%M")
#         constraint_type = req.time_constraint_type
#         radiologists, assistant_doctors, nurses, equipment, ots, test_scores = await asyncio.gather(
#             find_staff("radiologist", requested_date, req.requested_start, req.requested_end, constraint_type),
#             find_staff("assistant_doctor", requested_date, req.requested_start, req.requested_end, constraint_type),
#             find_generic_availability("nurse_availability", requested_date, req.requested_start, req.requested_end, "nurse_id", "name", constraint_type),
#             find_generic_availability("equipment_availability", requested_date, req.requested_start, req.requested_end, "equipment_name", "equipment_name", constraint_type),
#             find_generic_availability("ot_availability", requested_date, req.requested_start, req.requested_end, "ot_id", "ot_id", constraint_type),
#             get_latest_test_scores(req.required_test_type)
#         )
#         enough_nurses = len(nurses) >= req.required_nurses
#         enough_ots = len(ots) >= req.required_operation_rooms
#         if enough_nurses and enough_ots:
#             match_status = "Requirements matched"
#         else:
#             match_status = "Requirements NOT matched"
#         return AvailabilityResponse(
#             date=req.requested_date,
#             start=req.requested_start,
#             end=req.requested_end,
#             radiologists_available=radiologists,
#             assistant_doctors_available=assistant_doctors,
#             nurses_available=nurses,
#             equipment_available=equipment,
#             operation_theatres_available=ots,
#             latest_test_scores=test_scores,
#             match_status=match_status
#         )
#     except ValueError as e:
#         raise HTTPException(status_code=400, detail=f"Invalid date or time format: {str(e)}")
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)






#--------------------------------------------------------------------------------------------------------------

# ===== main.py =====
import os
from fastapi import FastAPI, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, date, timedelta
import asyncio
from typing import List, Union, Optional
from fastapi.middleware.cors import CORSMiddleware  # ✅ Already present
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv

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
)

# Load variables from a local .env file if present
load_dotenv()

# Read MongoDB configuration from environment variables
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "hospital1")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[MONGODB_DB_NAME]


def get_password_hash(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password length exceeds bcrypt limit of 72 bytes")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)


def user_doc_to_response(doc: dict) -> UserResponse:
    return UserResponse(
        id=str(doc["_id"]),
        email=doc["email"],
        full_name=doc.get("full_name")
    )


async def get_user_by_email(email: str) -> Optional[dict]:
    return await db.users.find_one({"email": email})


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # ✅ allow ALL domains
    allow_credentials=True,
    allow_methods=["*"],           # ✅ allow all methods: GET, POST, OPTIONS, etc.
    allow_headers=["*"],           # ✅ allow all headers
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

    user_doc = {
        "email": email,
        "full_name": payload.full_name,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
    }

    try:
        result = await db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user_doc["_id"] = result.inserted_id
    return user_doc_to_response(user_doc)


@app.post("/auth/login", response_model=TokenResponse)
async def login_user(payload: UserLogin) -> TokenResponse:
    email = payload.email.lower()
    user_doc = await get_user_by_email(email)
    if not user_doc or not verify_password(payload.password, user_doc.get("hashed_password", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(str(user_doc["_id"]))
    user = user_doc_to_response(user_doc)
    return TokenResponse(access_token=token, user=user)


@app.post(
    "/availability",
    response_model=AvailabilityResponse,
    response_model_exclude_none=True
)
async def check_availability(req: AvailabilityRequest):
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

        # filter equipment by required_equipment if specified
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
            date=req.requested_date,  # <- sending these
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


@app.post("/publish")
async def publish_plan(data: PublishPayload):
    confirmations = []

    for contact in data.contacts:
        confirmations.append(
            f"📧 Confirmation sent to {contact.name} ({contact.role}) at {contact.email} for patient {data.patient_id}."
        )

    return {
        "status": "Published",
        "patient_id": data.patient_id,
        "confirmations": confirmations,
        "ot_booked": True,
        "ot_id": data.ot_id
    }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
