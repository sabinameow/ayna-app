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

## Environment Files

Real environment files are intentionally ignored by Git:

- `backend/.env`
- `frontend/.env`
- any other `.env.*` file

Use the examples as templates:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Do not commit real secrets. If a real `.env` was previously tracked, remove it from the Git index
without deleting the local file:

```bash
git rm --cached backend/.env frontend/.env
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

For a physical phone on the same Wi-Fi network, set this to your machine's LAN address, for example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.50:8000
```

For production mobile builds, point it to the Render backend URL.

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

## Docker Compose

Docker Compose is for local development and production-like smoke testing. It runs the backend and
a local Redis instance. The database remains external through `DATABASE_URL`.

Start the API:

```bash
docker compose up --build backend
```

Start the API with Celery worker and beat:

```bash
docker compose --profile workers up --build
```

Run migrations inside the backend image:

```bash
docker compose run --rm backend alembic --config backend/alembic.ini upgrade head
```

Check the compose file:

```bash
docker compose config
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

## Deploy Backend to Render

Render should deploy the backend as a Docker web service. The repository includes:

- `backend/Dockerfile` - builds and starts the FastAPI service.
- `render.yaml` - Render Blueprint for the backend service.
- `docker-compose.yml` - local-only compose workflow.

Recommended Render setup:

1. Push the repo to GitHub/GitLab/Bitbucket.
2. In Render, create a new Blueprint from `render.yaml`, or create a Docker Web Service manually.
3. Use `backend/Dockerfile` with repository root as the Docker build context.
4. Set required environment variables in Render:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET_KEY`
   - mail variables
   - optional `GEMINI_API_KEY`
5. Use `/health` as the health check path.
6. Run migrations before deploy with:

```bash
PYTHONPATH=. alembic --config backend/alembic.ini upgrade head
```

The included `render.yaml` sets this as `preDeployCommand`.

## Background Jobs on Render

The API can run without Celery, but scheduled notifications, email tasks, and daily AI jobs require
workers. On Render, create separate worker services from the same Dockerfile with these commands:

```bash
celery -A backend.app.celery_app worker --loglevel=info
celery -A backend.app.celery_app beat --loglevel=info
```

Use the same environment variables as the backend service.

## Useful Commands

```bash
# Backend type/import sanity
PYTHONPATH=. python -m compileall backend/app

# Frontend type-check
cd frontend && npm run typecheck

# Docker config validation
docker compose config
```

## Notes

- Keep real `.env` files local.
- Keep Render secrets in the Render dashboard.
- Do not commit generated folders such as `node_modules`, `.expo`, caches, or local logs.
- The mobile app should use the deployed Render backend URL in `EXPO_PUBLIC_API_URL`.
