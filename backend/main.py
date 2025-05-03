from fastapi import FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, date
from fastapi.middleware.cors import CORSMiddleware  # ✅ Already present

import asyncio
from typing import List, Dict
from models import (
    AvailabilityRequest,
    AvailabilityResponse,
    Resource,
    TestScore,
    StaffDocument,
    NurseAvailabilityDocument,
    EquipmentAvailabilityDocument,
    OTAvailabilityDocument,
    TestHistoryDocument
)
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Hospital Resource Management API")

# ✅ CORS configuration added here



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # ✅ allow ALL domains
    allow_credentials=True,
    allow_methods=["*"],           # ✅ allow all methods: GET, POST, OPTIONS, etc.
    allow_headers=["*"],           # ✅ allow all headers
)



# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://<USERNAME>:<PASSWORD>@<CLUSTER>.mongodb.net/hospital?retryWrites=true&w=majority")
client = AsyncIOMotorClient(MONGODB_URL)
db = client.hospital

@app.on_event("startup")
async def startup_db_client():
    print("Connecting to MongoDB...")
    # Test the connection
    try:
        await db.command("ping")
        print("Successfully connected to MongoDB!")
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_db_client():
    print("Closing MongoDB connection...")
    client.close()

def convert_date_to_datetime(date_obj):
    """Convert date object to datetime object for MongoDB compatibility"""
    return datetime.combine(date_obj, datetime.min.time())

def time_window_match(resource_start, resource_end, req_start, req_end, constraint_type):
    if constraint_type == "exact":
        return resource_start == req_start and resource_end == req_end
    # overlap
    return not (resource_end <= req_start or resource_start >= req_end)

async def find_staff(role: str, date: date, start: str, end: str, constraint_type: str) -> List[Resource]:
    weekday = date.weekday()
    cursor = db.staff.find({"role": role})
    staff_list = []
    async for doc in cursor:
        for wh in doc["working_hours"]:
            if wh["day_of_week"] == weekday and time_window_match(wh["start"], wh["end"], start, end, constraint_type):
                staff_list.append(Resource(id=str(doc["_id"]), name=doc["name"]))
                break
    return staff_list[:2]

async def find_generic_availability(collection: str, date: date, start: str, end: str, id_field: str, name_field: str, constraint_type: str) -> List[Resource]:
    cursor = db[collection].find({"date": convert_date_to_datetime(date)})
    resources = []
    async for doc in cursor:
        if time_window_match(doc["start"], doc["end"], start, end, constraint_type):
            resources.append(Resource(id=str(doc[id_field]), name=doc.get(name_field, str(doc[id_field]))))
    return resources[:2]

async def get_latest_test_scores(test_type: str, limit: int = 5) -> List[TestScore]:
    """Get the latest test scores for a given test type."""
    cursor = db.test_history.find(
        {"test_type": test_type}
    ).sort("date", -1).limit(limit)
    
    scores = []
    async for doc in cursor:
        scores.append(TestScore(
            patient_id=doc["patient_id"],
            test_type=doc["test_type"],
            score=doc["score"]
        ))
    
    return scores

@app.post("/check-availability/", response_model=AvailabilityResponse)
async def check_availability(req: AvailabilityRequest):
    try:
        requested_date = datetime.strptime(req.requested_date, "%Y-%m-%d").date()
        datetime.strptime(req.requested_start, "%H:%M")
        datetime.strptime(req.requested_end, "%H:%M")
        constraint_type = req.time_constraint_type
        radiologists, assistant_doctors, nurses, equipment, ots, test_scores = await asyncio.gather(
            find_staff("radiologist", requested_date, req.requested_start, req.requested_end, constraint_type),
            find_staff("assistant_doctor", requested_date, req.requested_start, req.requested_end, constraint_type),
            find_generic_availability("nurse_availability", requested_date, req.requested_start, req.requested_end, "nurse_id", "name", constraint_type),
            find_generic_availability("equipment_availability", requested_date, req.requested_start, req.requested_end, "equipment_name", "equipment_name", constraint_type),
            find_generic_availability("ot_availability", requested_date, req.requested_start, req.requested_end, "ot_id", "ot_id", constraint_type),
            get_latest_test_scores(req.required_test_type)
        )
        enough_nurses = len(nurses) >= req.required_nurses
        enough_ots = len(ots) >= req.required_operation_rooms
        if enough_nurses and enough_ots:
            match_status = "Requirements matched"
        else:
            match_status = "Requirements NOT matched"
        return AvailabilityResponse(
            date=req.requested_date,
            start=req.requested_start,
            end=req.requested_end,
            radiologists_available=radiologists,
            assistant_doctors_available=assistant_doctors,
            nurses_available=nurses,
            equipment_available=equipment,
            operation_theatres_available=ots,
            latest_test_scores=test_scores,
            match_status=match_status
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date or time format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)