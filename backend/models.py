from pydantic import BaseModel
from typing import List, Literal
from datetime import date

class TimeWindow(BaseModel):
    start: str    # "HH:MM"
    end: str      # "HH:MM"

class AvailabilityRequest(BaseModel):
    requested_date: str       # "YYYY-MM-DD"
    requested_start: str      # "HH:MM"
    requested_end: str        # "HH:MM"
    required_test_type: str
    required_nurses: int      # NEW
    required_operation_rooms: int  # NEW
    time_constraint_type: Literal["exact", "overlap"] = "overlap"  # NEW

class Resource(BaseModel):
    id: str
    name: str

class TestScore(BaseModel):
    patient_id: str
    test_type: str
    score: float

class AvailabilityResponse(BaseModel):
    date: str
    start: str
    end: str
    radiologists_available: List[Resource]
    assistant_doctors_available: List[Resource]
    nurses_available: List[Resource]
    equipment_available: List[Resource]
    operation_theatres_available: List[Resource]
    latest_test_scores: List[TestScore]
    match_status: str  # NEW

# MongoDB Document Models
class StaffDocument(BaseModel):
    name: str
    role: Literal["radiologist", "assistant_doctor"]
    working_hours: List[dict]  # List of {day_of_week: int, start: str, end: str}

class NurseAvailabilityDocument(BaseModel):
    nurse_id: str
    date: date
    start: str
    end: str

class EquipmentAvailabilityDocument(BaseModel):
    equipment_name: str
    date: date
    start: str
    end: str

class OTAvailabilityDocument(BaseModel):
    ot_id: str
    date: date
    start: str
    end: str

class TestHistoryDocument(BaseModel):
    patient_id: str
    test_type: str
    score: float
    date: date 