# Hospital Resource Management API

A FastAPI application that manages and queries hospital resources using MongoDB Atlas.

## Features

- Staff management (radiologists and assistant doctors)
- Nurse availability tracking
- Equipment availability tracking
- Operation Theatre (OT) availability tracking
- Test history management
- Resource availability checking API

## Prerequisites

- Python 3.8+
- MongoDB (Atlas or local `mongod` instance)

## Setup

1. Clone the repository and open the `backend/` folder.
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy `.env.example` to `.env` (the file can live inside `backend/`) and adjust values as needed. If you are running MongoDB locally, the defaults work out of the box.
   ```
   MONGODB_URL=mongodb://localhost:27017
   MONGODB_DB_NAME=hospital1
   JWT_SECRET_KEY=your-secret-key
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   ```

## Database Setup

The project ships with a simple seeding script that loads sample staff, nurse schedules, operating rooms, equipment, and MRI test scores for **2 April 2025**.

1. Make sure your MongoDB server is running and reachable through `MONGODB_URL` and that the database named in `MONGODB_DB_NAME` exists (it will be created automatically the first time you seed).
2. Run the seed script to populate the database:
   ```bash
   python seed_db.py
   ```

## Running the Application

1. Start the FastAPI server (reload is handy while developing):
   ```bash
   uvicorn main:app --reload
   ```
2. The API will be available at `http://localhost:8000`
3. Access the API documentation at `http://localhost:8000/docs`

## API Endpoints

### Check Resource Availability

- **Endpoint**: `POST /availability`
- **Request Body**:
  ```json
  {
    "requested_date": "2025-04-02",
    "requested_start": "10:00",
    "requested_end": "18:00",
    "required_test_type": "MRI",
    "required_radiologists": 1,
    "required_assistant_doctors": 2,
    "required_nurses": 2,
    "required_operation_rooms": 1,
    "required_equipment": "Anesthesia Machine",
    "time_constraint_type": "exact"
  }
  ```
- **Response**: Returns matching staff, nurses, OT rooms, equipment, latest MRI test scores, and whether the request is fully satisfied.

### Publish Plan

- **Endpoint**: `POST /publish`
- Use this endpoint to simulate confirming a plan with a list of contacts; the response echoes confirmation messages for each contact.

### Authentication

- **Endpoint**: `POST /auth/signup`
  - Body: `{"email": "user@example.com", "password": "secret123", "full_name": "Dr. Jane Doe"}`
  - Response: Newly created user (without password).
- **Endpoint**: `POST /auth/login`
  - Body: `{"email": "user@example.com", "password": "secret123"}`
  - Response: `{"access_token": "...", "token_type": "bearer", "user": {...}}`
  - Include the token in subsequent requests as `Authorization: Bearer <token>`.

## Data Models

### Staff
- Roles: radiologist, assistant_doctor
- Working hours per day of week

### Nurse Availability
- Daily availability slots
- References staff documents

### Equipment Availability
- Equipment name
- Daily availability slots

### OT Availability
- OT ID
- Daily availability slots

### Test History
- Patient ID
- Test type
- Score
- Date

## Error Handling

The API includes proper error handling for:
- Invalid date/time formats
- Database connection issues
- Resource not found scenarios 
