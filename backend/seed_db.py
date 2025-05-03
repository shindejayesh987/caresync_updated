import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, date, timedelta
import os
from dotenv import load_dotenv
from faker import Faker

# Load environment variables
load_dotenv()

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://<USERNAME>:<PASSWORD>@<CLUSTER>.mongodb.net/hospital?retryWrites=true&w=majority")
client = AsyncIOMotorClient(MONGODB_URL)
db = client.hospital

fake = Faker()

def convert_date_to_datetime(date_obj):
    """Convert date object to datetime object for MongoDB compatibility"""
    return datetime.combine(date_obj, datetime.min.time())

async def seed_database():
    # Drop existing collections
    collections = ["staff", "nurse_availability", "equipment_availability", "ot_availability", "test_history"]
    for collection in collections:
        await db[collection].drop()
        print(f"Dropped collection: {collection}")

    today = date(2024, 5, 3)
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)

    # Seed staff collection (radiologists, assistant doctors, nurses)
    staff_data = []
    for i in range(1, 6):
        staff_data.append({
            "name": fake.name(),
            "role": "radiologist",
            "working_hours": [
                {"day_of_week": today.weekday(), "start": "10:00", "end": "12:00"},  # Only 2 will match
                {"day_of_week": tomorrow.weekday(), "start": "10:00", "end": "18:00"}
            ]
        })
    for i in range(1, 6):
        staff_data.append({
            "name": fake.name(),
            "role": "assistant_doctor",
            "working_hours": [
                {"day_of_week": today.weekday(), "start": "08:00", "end": "09:30"},
                {"day_of_week": day_after.weekday(), "start": "12:00", "end": "20:00"}
            ]
        })
    # Add 5 nurses, only 2 will match the test window
    for i in range(1, 6):
        staff_data.append({
            "name": fake.name(),
            "role": "nurse",
            "working_hours": [
                {"day_of_week": today.weekday(), "start": "10:00", "end": "12:00" if i <= 2 else "11:00"},
                {"day_of_week": tomorrow.weekday(), "start": "09:00", "end": "17:00"}
            ]
        })
    staff_result = await db.staff.insert_many(staff_data)
    print("Seeded staff collection")

    # Get staff IDs for nurse availability (only nurses)
    staff = await db.staff.find({"role": "nurse"}).to_list(length=None)
    staff_ids = [str(doc["_id"]) for doc in staff]

    # Seed nurse availability (only 2 will match the test window)
    nurse_availability = []
    for i, nurse_id in enumerate(staff_ids):
        nurse_availability.append({
            "nurse_id": nurse_id,
            "date": convert_date_to_datetime(today),
            "start": "10:00" if i < 2 else "11:00",
            "end": "12:00" if i < 2 else "12:30"
        })
        nurse_availability.append({
            "nurse_id": nurse_id,
            "date": convert_date_to_datetime(tomorrow),
            "start": "10:00",
            "end": "18:00"
        })
    # Add more for variety
    for i in range(5):
        nurse_availability.append({
            "nurse_id": staff_ids[i % len(staff_ids)],
            "date": convert_date_to_datetime(day_after),
            "start": "08:00",
            "end": "16:00"
        })
    await db.nurse_availability.insert_many(nurse_availability)
    print("Seeded nurse availability collection")

    # Seed equipment availability (only 2 will match the test window)
    equipment_names = [fake.word().capitalize() + " Machine" for _ in range(10)]
    equipment_availability = []
    for i, eq in enumerate(equipment_names):
        equipment_availability.append({
            "equipment_name": eq,
            "date": convert_date_to_datetime(today),
            "start": "10:00" if i < 2 else "13:00",
            "end": "12:00" if i < 2 else "15:00"
        })
        equipment_availability.append({
            "equipment_name": eq,
            "date": convert_date_to_datetime(tomorrow),
            "start": "10:00",
            "end": "18:00"
        })
    await db.equipment_availability.insert_many(equipment_availability)
    print("Seeded equipment availability collection")

    # Seed OT availability (only 2 will match the test window)
    ot_ids = [f"OT{i}" for i in range(1, 11)]
    ot_availability = []
    for i, ot_id in enumerate(ot_ids):
        ot_availability.append({
            "ot_id": ot_id,
            "date": convert_date_to_datetime(today),
            "start": "10:00" if i < 2 else "14:00",
            "end": "12:00" if i < 2 else "16:00"
        })
        ot_availability.append({
            "ot_id": ot_id,
            "date": convert_date_to_datetime(tomorrow),
            "start": "10:00",
            "end": "18:00"
        })
    await db.ot_availability.insert_many(ot_availability)
    print("Seeded OT availability collection")

    # Seed test history (random names, only 2 MRI for today)
    test_types = ["MRI", "X-Ray", "CT Scan", "Blood Test", "Ultrasound"]
    test_history = []
    for i in range(10):
        test_history.append({
            "patient_id": fake.unique.bothify(text='P###'),
            "test_type": "MRI" if i < 2 else test_types[i % len(test_types)],
            "score": 80 + i,
            "date": convert_date_to_datetime(today)
        })
        test_history.append({
            "patient_id": fake.unique.bothify(text='P###'),
            "test_type": test_types[i % len(test_types)],
            "score": 70 + i,
            "date": convert_date_to_datetime(tomorrow)
        })
    await db.test_history.insert_many(test_history)
    print("Seeded test history collection")

    print("Database seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_database()) 