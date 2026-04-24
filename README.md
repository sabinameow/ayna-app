# Ayna App

Ayna.app – every day reflects you.

## About the Project

Ayna is a clinical information system designed for gynecological offices and women's health clinics. Patients track their menstrual cycles and symptoms, doctors analyze data and prescribe treatments, and an AI agent assists with pattern analysis and personalized recommendations.

Our project is supported by a practicing gynecologist, Ulzhan Bakytovna, to ensure clear problem framing.

### Roles

**Patient**: self-registers, tracks menstrual cycles, logs mood and symptoms, books appointments, receives AI phase-based insights (premium), chats with manager (premium), views doctor's prescriptions (read-only).

**Doctor**: created by admin, views only assigned patients' medical data (cycles, symptoms, mood, medications), leaves recommendations and prescriptions, receives LLM-generated chat summaries automatically when a manager closes a session.

**Manager**: handles chats with patients, manages appointments and doctor schedules. Chat sessions are summarised by the AI for the treating doctor on close.

---

## SDLC Approach

We are developing this project following the Software Development Life Cycle (SDLC). A significant portion of this semester was dedicated to the first three stages: Requirements Analysis, Planning, and Design — as proper Problem Framing is a key success factor. The following deliverables were completed: CusDev interviews, JTBD framework, User Personas, functional and non-functional requirements, a technical specification, and UX/UI Design.

---

## Tech Stack

| Component         | Technology                                                    |
|-------------------|---------------------------------------------------------------|
| Framework         | FastAPI (Python 3.14)                                         |
| ORM               | SQLAlchemy 2.0 + asyncpg                                      |
| Database          | PostgreSQL (Neon DB)                                          |
| Migrations        | Alembic                                                       |
| Auth              | JWT (access + refresh) — python-jose + passlib[bcrypt]        |
| Validation        | Pydantic v2                                                   |
| Real-time Chat    | WebSocket (FastAPI)                                           |
| Background Tasks  | Celery + Redis (worker + beat)                                |
| Cache / Broker    | Redis (Upstash)                                               |
| AI                | Google Gemini (gemini-1.5-flash) via google-generativeai      |
| Frontend          | React Native (upcoming)                                       |

---

## Backend Progress

### Sprint 1: Foundation ✅
- Project structure with modular architecture (models, schemas, api, services, core, seeds)
- Async SQLAlchemy engine with Neon DB (PostgreSQL) over SSL
- Pydantic-settings configuration (`config.py`)
- Alembic migrations — full initial migration covering all 16+ tables
- JWT authentication: register, login, refresh, email verification, password reset, password change
- Email sending via Celery + Redis + FastMail
- RBAC permission system (`require_role`, `require_patient`, `require_doctor`, `require_manager`)
- Custom HTTP exceptions (401, 403, 404, 409, 400)
- Database seeding: 3 patients, 2 doctors, 1 manager with hashed passwords

### Sprint 2: Menstrual Calendar + Mood ✅
- MenstrualCycle and CycleDay models with full CRUD
- Cycle prediction service: next period start, end, and ovulation date based on the average of the last 2–6 cycles
- CycleDay logging with flow intensity tracking (none, light, medium, heavy)
- Monthly cycle day retrieval with year/month filtering
- MoodEntry model with mood level, energy, stress, sleep quality
- Mood statistics endpoint

### Sprint 3: Symptoms + Appointments ✅
- Symptom catalog (20 symptoms across 5 categories)
- Symptom-to-test mappings: automatic test recommendations based on selected symptoms
- Patient symptom logging with severity and date filtering
- Doctor schedule management (weekday-based)
- Available slot generation
- Appointment booking with auto-populated required tests
- Appointment listing and cancellation

### Sprint 4: Medications + Doctor Recommendations ✅
- Doctor prescribes, updates, deactivates medications
- Patient views prescribed medications and logs daily intake
- Medication log history per medication
- Doctor clinical recommendations (patient read-only)
- Aggregated progress endpoints
- Patient profile GET/PUT
- Doctor views patient data (only for assigned patients)

### Sprint 5: Chat (WebSocket) ✅
- Real-time WebSocket chat between patients and managers
- Token-based WebSocket authentication
- Automatic session creation when a patient connects
- Message persistence in the database
- Manager: list sessions, view message history, close sessions
- Patient: list own sessions, view message history
- Manager appointment management
- Manager access to all doctor schedules and available slots

### Sprint 6: AI Integration ✅
- Google Gemini integration (`services/ai_service.py`) with lazy client init and a full deterministic fallback when no API key is configured — the backend works with or without Gemini
- **Cycle phase detection** (menstrual / follicular / ovulatory / luteal) derived from the patient's last logged cycle, period length, and cycle length
- **Daily personalised insights** — Celery beat task `ayna.daily_phase_insights` runs every day at 08:00 UTC, detects each premium patient's current phase, generates a short phase-based insight via Gemini, and stores it as a Notification (e.g. "Ovulation window — you may notice a slight temperature rise…")
- **Automatic chat summaries** — when a manager closes a chat session, a clinical summary is generated and saved to `ChatSession.summary` so the treating doctor sees the key concerns without reading the full transcript

### Sprint 7: Subscriptions, Articles, Notifications ✅
- SubscriptionPlan catalog with duration and JSON features, seeded with Monthly / Yearly tiers
- Patient-facing subscribe / cancel / history endpoints; cancelling an active subscription auto-kicks it into `CANCELLED` status
- **Premium gate:** AI phase insights and chat with manager are locked behind an active subscription (WebSocket rejects with code 4003; REST returns 403). Base tracking, predictions, appointments, and doctor content remain free
- Articles CRUD with `requires_subscription` flag; locked articles show in listings with titles + summaries but require an active subscription on the detail endpoint
- Notifications system: service + REST API (list, unread count, mark one / mark all as read). Auto-generated notifications on subscribe, cancel, and daily AI insights

### Upcoming
- **Sprint 8:** audit log, scheduled appointment reminders, push / email delivery of in-app notifications, automated tests, production deployment
- **Frontend:** React Native app

---

## Setup Instructions

### Prerequisites
- Python 3.14
- PostgreSQL (Neon DB — already provisioned)
- Redis (Upstash or local)
- pip
- (Optional) Google Gemini API key from https://aistudio.google.com/app/apikey

### 1. Clone and enter the repo

```bash
git clone <your-repo-url>
cd ayna-app
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows
```

### 3. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Environment variables

The `.env` file lives in `backend/`. Verify it and optionally add your Gemini key:
GEMINI_API_KEY=your_key_here         # optional — fallback text is used if empty
GEMINI_MODEL=gemini-1.5-flash

Without a key, AI insights and chat summaries still work — they just use deterministic fallback text instead of live Gemini output.

### 5. Apply database migrations

```bash
PYTHONPATH=. alembic --config backend/alembic.ini upgrade head
```

### 6. Seed the database

```bash
PYTHONPATH=. python3 -m backend.app.seeds.seed_users
PYTHONPATH=. python3 -m backend.app.seeds.seed_symptoms
PYTHONPATH=. python3 -m backend.app.seeds.seed_articles
PYTHONPATH=. python3 -m backend.app.seeds.seed_subscriptions
```

### 7. Start the FastAPI server

```bash
PYTHONPATH=. uvicorn backend.app.main:app --reload
```

### 8. (Optional) Start Celery worker + beat for AI insights and email delivery

In two separate terminals:

```bash
# Worker — executes tasks
celery -A backend.app.celery_app worker --loglevel=info

# Beat — schedules recurring tasks (daily phase insights at 08:00 UTC)
celery -A backend.app.celery_app beat --loglevel=info
```

Uvicorn still works without Celery; you just won't get daily AI-generated notifications or outgoing email.

To manually fire the daily insight job once (for a demo or testing without waiting for 08:00 UTC):

```bash
PYTHONPATH=. python3 -c "from backend.app.services.scheduled_tasks import _run_daily_insights; import asyncio; print(asyncio.run(_run_daily_insights()))"
```

### 9. Access the API

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

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

**Note:** seeded patients start without an active subscription. To exercise premium features end-to-end, call `POST /api/v1/patient/subscribe` with a plan id from `GET /api/v1/subscription-plans` after logging in as a patient.

---

## Project Structure
ayna-app/
├── backend/
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
│       ├── celery_app.py         # worker + beat configuration
│       ├── auth/                 # Registration, login, JWT, email verification
│       ├── core/                 # Constants (incl. CyclePhase), exceptions, RBAC
│       ├── models/               # SQLAlchemy models (16+ tables)
│       ├── schemas/              # Pydantic request/response schemas
│       ├── api/                  # Route handlers
│       │   ├── articles.py       # Article catalog + premium gate
│       │   ├── notifications.py  # User-scoped notifications
│       │   ├── subscriptions.py  # Plans, subscribe, cancel, history
│       │   └── …                 # cycles, patients, symptoms, appointments, doctors, chat, managers
│       ├── services/
│       │   ├── ai_service.py         # Gemini: phase detection, insights, chat summary
│       │   ├── scheduled_tasks.py    # Celery beat task: daily_phase_insights
│       │   ├── subscription_service.py
│       │   ├── notification_service.py
│       │   └── …                     # cycle, appointment, chat, auth
│       └── seeds/
│           ├── seed_users.py
│           ├── seed_symptoms.py
│           ├── seed_articles.py
│           └── seed_subscriptions.py
└── frontend/                     # React Native (upcoming)

