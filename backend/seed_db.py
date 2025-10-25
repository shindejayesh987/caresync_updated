import os
from datetime import datetime
from urllib.parse import quote_plus, urlparse, urlunparse

from dotenv import load_dotenv
from pymongo import MongoClient


def _url_quote_plus(url: str) -> str:
    parsed_url = urlparse(url)
    username = parsed_url.username
    password = parsed_url.password

    if username and password:
        netloc = f"{quote_plus(username)}:{quote_plus(password)}@{parsed_url.hostname}"
        if parsed_url.port:
            netloc += f":{parsed_url.port}"
        return urlunparse(
            parsed_url._replace(netloc=netloc)
        )
    elif username:
        netloc = f"{quote_plus(username)}@{parsed_url.hostname}"
        if parsed_url.port:
            netloc += f":{parsed_url.port}"
        return urlunparse(
            parsed_url._replace(netloc=netloc)
        )
    return url


load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_URL = _url_quote_plus(MONGODB_URL)
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "hospital1")

client = MongoClient(MONGODB_URL)
db = client[MONGODB_DB_NAME]


def seed_staff() -> None:
    db.staff.delete_many({})
    staff_docs = [
        {
            "_id": "staff-rad-1",
            "name": "Dr. Alicia Martinez",
            "role": "radiologist",
            "email": "alicia.martinez@example.com",
            "working_hours": [
                {"day_of_week": 2, "start": "08:00", "end": "16:00"},
                {"day_of_week": 3, "start": "09:00", "end": "17:00"},
            ],
        },
        {
            "_id": "staff-rad-2",
            "name": "Dr. Kevin Patel",
            "role": "radiologist",
            "email": "kevin.patel@example.com",
            "working_hours": [
                {"day_of_week": 2, "start": "10:00", "end": "18:00"},
                {"day_of_week": 4, "start": "08:00", "end": "14:00"},
            ],
        },
        {
            "_id": "staff-asst-1",
            "name": "Dr. Priya Wong",
            "role": "assistant_doctor",
            "email": "priya.wong@example.com",
            "working_hours": [
                {"day_of_week": 2, "start": "07:00", "end": "15:00"},
                {"day_of_week": 3, "start": "08:00", "end": "16:00"},
            ],
        },
        {
            "_id": "staff-asst-2",
            "name": "Dr. Jordan Smith",
            "role": "assistant_doctor",
            "email": "jordan.smith@example.com",
            "working_hours": [
                {"day_of_week": 2, "start": "10:00", "end": "18:00"},
                {"day_of_week": 4, "start": "12:00", "end": "20:00"},
            ],
        },
    ]
    db.staff.insert_many(staff_docs)


def seed_nurse_availability(target_date: datetime) -> None:
    db.nurse_availability.delete_many({})
    nurses = [
        {
            "nurse_id": "N-100",
            "nurse_name": "Susan Rivera",
            "nurse_email": "susan.rivera@example.com",
            "date": target_date,
            "start": "08:00",
            "end": "16:00",
        },
        {
            "nurse_id": "N-101",
            "nurse_name": "Elizabeth Hart",
            "nurse_email": "elizabeth.hart@example.com",
            "date": target_date,
            "start": "10:00",
            "end": "18:00",
        },
        {
            "nurse_id": "N-102",
            "nurse_name": "Arnold Blake",
            "nurse_email": "arnold.blake@example.com",
            "date": target_date,
            "start": "07:00",
            "end": "15:00",
        },
    ]
    db.nurse_availability.insert_many(nurses)


def seed_equipment_availability(target_date: datetime) -> None:
    db.equipment_availability.delete_many({})
    equipment = [
        {
            "equipment_name": "Anesthesia Machine",
            "date": target_date,
            "start": "09:00",
            "end": "18:00",
        },
        {
            "equipment_name": "MRI Scanner",
            "date": target_date,
            "start": "08:00",
            "end": "20:00",
        },
    ]
    db.equipment_availability.insert_many(equipment)


def seed_ot_availability(target_date: datetime) -> None:
    db.ot_availability.delete_many({})
    operating_rooms = [
        {"ot_id": "OT-21", "date": target_date, "start": "08:00", "end": "20:00"},
        {"ot_id": "OT-11", "date": target_date, "start": "06:00", "end": "14:00"},
    ]
    db.ot_availability.insert_many(operating_rooms)


def seed_test_history() -> None:
    db.test_history.delete_many({})
    tests = [
        {
            "patient_id": "P-221",
            "test_type": "MRI",
            "score": 88.0,
            "date": datetime(2025, 3, 15),
        },
        {
            "patient_id": "P-564",
            "test_type": "MRI",
            "score": 92.5,
            "date": datetime(2025, 3, 28),
        },
        {
            "patient_id": "P-894",
            "test_type": "MRI",
            "score": 81.0,
            "date": datetime(2025, 3, 30),
        },
    ]
    db.test_history.insert_many(tests)


def main() -> None:
    target_date = datetime(2025, 4, 2)
    seed_staff()
    seed_nurse_availability(target_date)
    seed_equipment_availability(target_date)
    seed_ot_availability(target_date)
    seed_test_history()
    print("✅ Database seeded with sample data.")


if __name__ == "__main__":
    main()
