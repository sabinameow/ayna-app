# ayna-app
Ayna.app – every day reflects you.

# Ayna App — Backend

FastAPI backend with async SQLAlchemy, Neon PostgreSQL, Redis, Celery, and Alembic migrations.

---

## Requirements

- Python 3.14
- PostgreSQL (Neon DB)
- Redis
- pip

---

## Setup

### 1. Clone the repo and navigate to the root

```bash
git clone <your-repo-url>
cd ayna-app
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r backend/requirements.txt
pip install psycopg2-binary  # required for Alembic migrations
```

### 4. Set up environment variables

Create a `.env` file inside the `backend/` folder:

```bash
cp backend/.env.example backend/.env
```

Fill in the values:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname?sslmode=require&channel_binding=require
JWT_SECRET_KEY=your_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
REDIS_URL=redis://localhost:6379
MAIL_USERNAME=your_email
MAIL_PASSWORD=your_email_password
MAIL_FROM=your_email
MAIL_PORT=587
MAIL_SERVER=smtp.yourprovider.com
MAIL_FROM_NAME=Ayna App
DOMAIN=yourdomain.com
DEBUG=False
```

---

## Running the App

Always run commands from the **project root** (`ayna-app/`):

```bash
cd ayna-app
```

### Start the FastAPI server

```bash
PYTHONPATH=. uvicorn backend.app.main:app --reload
```

### Start Celery worker

```bash
PYTHONPATH=. celery -A backend.app.celery_app worker --loglevel=info
```

---

## Database Migrations (Alembic)

All migration commands must be run from the **project root** with `PYTHONPATH=.`:

### Generate a new migration after changing models

```bash
PYTHONPATH=. alembic --config backend/alembic.ini revision --autogenerate -m "describe your change"
```

### Apply migrations to the database

```bash
PYTHONPATH=. alembic --config backend/alembic.ini upgrade head
```

### Rollback the last migration

```bash
PYTHONPATH=. alembic --config backend/alembic.ini downgrade -1
```

### Check current migration status

```bash
PYTHONPATH=. alembic --config backend/alembic.ini current
```

### View migration history

```bash
PYTHONPATH=. alembic --config backend/alembic.ini history
```

---

## Project Structure

```
ayna-app/
├── backend/
│   ├── .env                  # Environment variables (not committed to git)
│   ├── alembic.ini           # Alembic config (script_location = backend/alembic)
│   ├── requirements.txt
│   ├── alembic/
│   │   ├── env.py            # Migration environment setup
│   │   ├── script.py.mako    # Migration file template
│   │   └── versions/         # Generated migration files
│   └── app/
│       ├── main.py           # FastAPI app entry point
│       ├── config.py         # Settings loaded from .env
│       ├── database.py       # Async SQLAlchemy engine and session
│       ├── models/           # SQLAlchemy models
│       ├── schemas/          # Pydantic schemas
│       ├── api/              # Route handlers
│       ├── services/         # Business logic
│       ├── core/             # Constants, exceptions, permissions
│       └── seeds/            # Database seed scripts
```

---

## Key Notes

- **Run everything from `ayna-app/` root** with `PYTHONPATH=.` — the codebase uses `from backend.app.xxx` imports
- **Neon DB** requires `?sslmode=require` in the `DATABASE_URL` for the app; Alembic strips this automatically and uses `psycopg2` for sync migrations
- **`.env` lives in `backend/`**, not in `backend/app/` — `config.py` finds it using an absolute path

---

## API Docs

Once the server is running, visit:

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
