# Ayna App

Ayna is a women's health application with a FastAPI backend and an Expo React Native frontend.
Patients can track cycles, mood, symptoms, medications, appointments, and chat sessions. Doctors
can review assigned patient data, prescribe medications, and add recommendations. Managers can
coordinate chats, appointments, and schedules.

## Tech Stack

| Area | Technology |
| --- | --- |
| Backend | FastAPI, Python, Uvicorn |
| Database | PostgreSQL on Neon |
| ORM / migrations | SQLAlchemy 2, asyncpg, Alembic |
| Auth | JWT access and refresh tokens |
| Background jobs | Celery with Redis |
| Notifications | In-app notifications, optional email/push hooks |
| AI | Google Gemini with deterministic fallback |
| Frontend | Expo React Native |
| Deployment | Docker, Render |

## Repository Structure

```text
.
├── backend/
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── alembic/
│   └── app/
├── frontend/
│   ├── App.tsx
│   ├── package.json
│   └── src/
├── docker-compose.yml
├── render.yaml
└── README.md
```

## Backend Environment Variables

Required for the API:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
JWT_SECRET_KEY=change-me
REDIS_URL=redis://redis:6379/0
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM=noreply@example.com
MAIL_PORT=587
MAIL_SERVER=smtp.example.com
MAIL_FROM_NAME=Ayna
DOMAIN=localhost:8000
```

Optional:

```env
DEBUG=false
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

The backend currently expects a Neon PostgreSQL database URL. If `GEMINI_API_KEY` is empty, AI
features continue to work with deterministic fallback text.

## Frontend Environment Variables

```env
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```


## Local Backend Setup

Create a virtual environment and install dependencies:

```bash
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

Apply migrations:

```bash
PYTHONPATH=. alembic --config backend/alembic.ini upgrade head
```

Run the API:

```bash
PYTHONPATH=. uvicorn backend.app.main:app --reload
```

Open:

- API health: `http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Seed Data

Run seed scripts when you need demo data:

```bash
PYTHONPATH=. python3 -m backend.app.seeds.seed_users
PYTHONPATH=. python3 -m backend.app.seeds.seed_symptoms
PYTHONPATH=. python3 -m backend.app.seeds.seed_articles
PYTHONPATH=. python3 -m backend.app.seeds.seed_subscriptions
```

Seeded test accounts:

| Role | Email | Password |
| --- | --- | --- |
| Doctor | doctor1@ayna.app | Doctor1Pass |
| Doctor | doctor2@ayna.app | Doctor2Pass |
| Patient | patient1@ayna.app | Patient1Pass |
| Patient | patient2@ayna.app | Patient2Pass |
| Patient | patient3@ayna.app | Patient3Pass |
| Manager | manager@ayna.app | Manager1Pass |


```

## Frontend Setup

Install dependencies:

```bash
cd frontend
npm install
```

Run Expo:

```bash
npm start
```

Type-check:

```bash
npm run typecheck
```

Student_ID1: 230103040
Student_ID2: 230103315
