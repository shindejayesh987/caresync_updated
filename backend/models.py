from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

class TimeWindow(BaseModel):
    day_of_week: int
    start: str
    end: str

class AvailabilityRequest(BaseModel):
    requested_date: str
    requested_start: str
    requested_end: str
    required_test_type: str
    required_radiologists: int
    required_assistant_doctors: int
    required_nurses: int
    required_operation_rooms: int
    required_equipment: Optional[str] = None
    time_constraint_type: Literal["exact", "overlap"] = "overlap"

class Resource(BaseModel):
    id: str
    name: str
    email: Optional[str] = None

    class Config:
        exclude_none = True

class TestScore(BaseModel):
    patient_id: str
    score: float
    date: date

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
    match_status: str


class StaffDocument(BaseModel):
    _id: str
    name: str
    role: Literal["radiologist", "assistant_doctor"]
    email: str
    working_hours: List[TimeWindow]

class NurseAvailabilityDocument(BaseModel):
    nurse_id: str
    nurse_name: str
    nurse_email: str
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

class Contact(BaseModel):
    role: str
    name: str
    email: str

class PublishPayload(BaseModel):
    plan_id: str
    doctor_id: str
    timeline: List[Dict[str, Any]]
    crew: List[Dict[str, Any]]
    tasks: List[Dict[str, Any]]
    vitals: Dict[str, Any]
    timestamp: datetime
    tab: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=72)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserResponse(UserBase):
    id: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse


class LogoutPayload(BaseModel):
    user_id: Optional[str] = None
    email: Optional[EmailStr] = None

    @model_validator(mode="after")
    def validate_identifier(self):
        if not (self.user_id or self.email):
            raise ValueError("Either user_id or email must be provided")
        return self


class ChangePasswordPayload(BaseModel):
    email: EmailStr
    old_password: str = Field(min_length=8, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


class TaskEntry(BaseModel):
    label: str
    status: Literal["pending", "in_progress", "completed"]
    note: Optional[str] = None
    time: Optional[str] = None
    priority: Optional[str] = None


class TaskUpdatePayload(BaseModel):
    patient_id: str
    scope: Literal["preop", "surgery", "postop"]
    staff_name: str
    staff_role: Literal["doctor", "nurse"]
    tasks: List[TaskEntry]
    performed_by: Optional[str] = None


class CrewUpdatePayload(BaseModel):
    patient_id: str
    doctors: List[str]
    nurses: List[str]
    performed_by: Optional[str] = None


class TimelineStep(BaseModel):
    id: str
    title: str
    time: str
    owner: str
    status: Literal["done", "active", "upcoming"]


class TimelineUpdatePayload(BaseModel):
    patient_id: str
    steps: List[TimelineStep]
    performed_by: Optional[str] = None


class VitalsPayload(BaseModel):
    patient_id: str
    heart_rate: str
    blood_pressure: str
    spo2: str
    captured_at: Optional[datetime] = None
    performed_by: Optional[str] = None


class SurgeryUpdatePayload(BaseModel):
    patient_name: Optional[str] = None
    procedure: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = None
    doctor_id: Optional[str] = None
    performed_by: Optional[str] = None

    @model_validator(mode="after")
    def ensure_update_fields(self):
        update_fields = {
            key: value
            for key, value in self.model_dump(exclude={"performed_by"}).items()
            if value is not None
        }
        if not update_fields:
            raise ValueError("At least one updatable field must be provided")
        return self
