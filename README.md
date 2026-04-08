# Ayna App

Ayna.app – every day reflects you.

## About the Project

Ayna is a clinical information system designed for gynecological offices and women's health clinics. Patients track their menstrual cycles and symptoms, doctors analyze data and prescribe treatments, and an AI agent assists with pattern analysis and personalized recommendations.

Our project is supported by a practicing gynecologist, Ulzhan Bakytovna, to ensure clear problem framing.

### Roles

**Patient**: self-registers, tracks menstrual cycles, logs mood and symptoms, books appointments, receives AI insights, chats with manager, views doctor's prescriptions (read-only).

**Doctor**: created by admin, views only assigned patients' medical data (cycles, symptoms, mood, medications), leaves recommendations and prescriptions, receives LLM-generated chat summaries.

**Manager**: handles chats with patients, manages appointments and doctor schedules, accesses LLM-generated session reports. This role is dedicated to deligate doctor's tasks.

---

## SDLC Approach

We are developing this project following the Software Development Life Cycle (SDLC). A significant portion of this semester was dedicated to the first three stages: Requirements Analysis, Planning, and Design , as proper Problem Framing is a key success factor. The following deliverables were completed: CusDev interviews, JTBD framework, User Personas, functional and non-functional requirements, a technical specifications, and UX/UI Design.

---

## Tech Stack

| Component       | Technology                              |
|-----------------|-----------------------------------------|
| Framework       | FastAPI (Python)                        |
| ORM             | SQLAlchemy 2.0 + asyncpg               |
| Database        | PostgreSQL (Neon DB)                    |
| Migrations      | Alembic                                 |
| Auth            | JWT (access + refresh tokens) — python-jose + passlib[bcrypt] |
| Validation      | Pydantic v2                             |
| Real-time Chat  | WebSocket (FastAPI)                     |
| Background Tasks| Celery + Redis                          |
| Cache/Broker    | Redis (Upstash)                         |
| Frontend        | React Native (upcoming)                 |

---

## Current Backend Progress (as of 09.04.2026)

### Sprint 1: Foundation 
- Project structure with modular architecture (models, schemas, api, services, core, seeds)
- Async SQLAlchemy engine with Neon DB (PostgreSQL) over SSL
- Pydantic-settings based configuration (`config.py`)
- Alembic migrations — full initial migration covering all 16+ tables
- JWT authentication: register, login, refresh, email verification, password reset, password change
- Email sending via Celery + Redis + FastMail
- RBAC permission system (`require_role`, `require_patient`, `require_doctor`, `require_manager`)
- Custom HTTP exceptions (401, 403, 404, 409, 400)
- Database seeding: 3 patients, 2 doctors, 1 manager with hashed passwords

### Sprint 2: Menstrual Calendar + Mood 
- MenstrualCycle and CycleDay models with full CRUD
- Cycle prediction service: predicts next period start, end, and ovulation date based on the average of the last 2–6 cycles
- CycleDay logging with flow intensity tracking (none, light, medium, heavy)
- Monthly cycle day retrieval with year/month filtering
- MoodEntry model with mood level, energy, stress, sleep quality
- Mood statistics endpoint with averages and mood distribution

### Sprint 3: Symptoms + Appointments 
- Symptom catalog (20 symptoms across 5 categories: Pain, Menstrual, General, Skin & Hair, Reproductive)
- Symptom-to-test mappings: automatic test recommendations based on selected symptoms
- Patient symptom logging with severity and date filtering
- Doctor schedule management (weekday-based with configurable slot duration)
- Available slot generation: calculates free slots excluding already booked appointments
- Appointment booking with auto-populated required tests from symptom mappings
- Appointment listing and cancellation for patients
- Doctor-side: view own patients, schedule, and appointments

### Sprint 4: Medications + Doctor Recommendations 
- Doctor prescribes medications to assigned patients (name, dosage, frequency, instructions)
- Doctor updates or deactivates medications
- Patient views prescribed medications and logs daily intake (taken/skipped)
- Medication log history per medication
- Doctor leaves clinical recommendations for patients
- Patient views recommendations (read-only)
- Patient and doctor-side progress endpoints (aggregated cycle, mood, symptom, medication, appointment stats)
- Patient profile GET/PUT (name, date of birth, cycle/period length)
- Doctor views patient cycles, symptoms, mood, and medications (only for assigned patients)

### Sprint 5: Chat (WebSocket) 
- Real-time WebSocket chat between patients and managers
- Connection manager handling multiple concurrent sessions
- Token-based WebSocket authentication
- Automatic session creation when a patient connects
- Message persistence in the database
- Manager: list sessions, view message history, close sessions
- Patient: list own sessions, view message history
- Manager appointment management (create, update, cancel)
- Manager access to all doctor schedules and available slots

### Upcoming Sprints
- **Sprint 6:** AI Integration (Google Gemini API: personalized insights, chat summaries, manager reports)
- **Sprint 7:** Subscriptions, Articles, and Notifications
- **Sprint 8:** Testing and Deployment

---

## Notes

The backend requires further development (AI integration, subscriptions, articles, notifications, testing, and deployment are upcoming sprints). The current repository contains only the backend. The React Native frontend will be developed and added in the upcoming sprints alongside AI integration, subscriptions, notifications, and deployment.

To simplify the setup process, the `.env` file is included in the repository since it currently contains no sensitive credentials. It will be removed once email credentials and production secrets are added. This should not be an issue as the system will be deployed before the final presentation. During the presentation, all work from the first to the last stage of SDLC will be demonstrated.

---

## Setup Instructions

### Prerequisites
- Python 3.14
- PostgreSQL (Neon DB — already provisioned)
- Redis (Upstash or local)
- pip

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd ayna-app
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate          # Windows
```

### 3. Install dependencies

```bash
pip install -r backend/requirements.txt
pip install psycopg2-binary     # required for Alembic migrations
```

### 4. Set up environment variables

The `.env` file is located inside the `backend/` folder. Verify the values are correct:

```bash
cat backend/.env
```

### 5. Apply database migrations

```bash
PYTHONPATH=. alembic --config backend/alembic.ini upgrade head
```

### 6. Seed the database

```bash
PYTHONPATH=. python3 -m backend.app.seeds.seed_users
PYTHONPATH=. python3 -m backend.app.seeds.seed_symptoms
```

### 7. Start the FastAPI server

```bash
PYTHONPATH=. uvicorn backend.app.main:app --reload
```


### 9. Access API docs

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Test Accounts (from seed data)

| Role    | Email              | Password     |
|---------|--------------------|--------------|
| Doctor  | doctor1@ayna.app   | Doctor1Pass  |
| Doctor  | doctor2@ayna.app   | Doctor2Pass  |
| Patient | patient1@ayna.app  | Patient1Pass |
| Patient | patient2@ayna.app  | Patient2Pass |
| Patient | patient3@ayna.app  | Patient3Pass |
| Manager | manager@ayna.app   | Manager1Pass |

---

## Project Structure

```
ayna-app/
├── backend/                 # FastAPI backend (current)
│   ├── .env
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── celery_app.py
│       ├── mail.py
│       ├── auth/            # Authentication (register, login, JWT, email verification)
│       ├── core/            # Constants, exceptions, RBAC permissions
│       ├── models/          # SQLAlchemy models (16+ tables)
│       ├── schemas/         # Pydantic request/response schemas
│       ├── api/             # Route handlers (patients, doctors, managers, chat, etc.)
│       ├── services/        # Business logic (cycles, appointments, chat, AI)
│       └── seeds/           # Database seed scripts
├── frontend/                # React Native app (upcoming)
```
