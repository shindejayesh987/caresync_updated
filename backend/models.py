from pydantic import BaseModel, EmailStr, Field
from typing import List, Literal, Optional
from datetime import date

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
    patient_id: str
    contacts: List[Contact]
    ot_id: Optional[str]      


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
