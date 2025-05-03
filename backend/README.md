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
- MongoDB Atlas account
- MongoDB connection string

## Setup

1. Clone the repository
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the root directory with your MongoDB connection string:
   ```
   MONGODB_URL=mongodb+srv://<USERNAME>:<PASSWORD>@<CLUSTER>.mongodb.net/hospital?retryWrites=true&w=majority
   ```

## Database Setup

1. Run the seed script to populate the database with sample data:
   ```bash
   python seed_db.py
   ```

## Running the Application

1. Start the FastAPI server:
   ```bash
   python main.py
   ```
2. The API will be available at `http://localhost:8000`
3. Access the API documentation at `http://localhost:8000/docs`

## API Endpoints

### Check Resource Availability

- **Endpoint**: `POST /check-availability/`
- **Request Body**:
  ```json
  {
    "requested_date": "2023-11-15",
    "requested_start": "09:00",
    "requested_end": "17:00",
    "required_test_type": "MRI"
  }
  ```
- **Response**: Returns available resources and latest test scores

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