from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.auth.routes import router as auth_router
from backend.app.api.cycles import router as cycles_router
from backend.app.api.patients import router as patients_router
from backend.app.api.symptoms import router as symptoms_router
from backend.app.api.appointments import router as appointments_router
from backend.app.api.doctors import router as doctors_router
from backend.app.api.chat import router as chat_router
from backend.app.api.managers import router as managers_router
from backend.app.api.articles import router as articles_router
from backend.app.api.notifications import router as notifications_router
from backend.app.api.subscriptions import router as subscriptions_router

app = FastAPI(
    title="Ayna App",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(cycles_router, prefix="/api/v1")
app.include_router(patients_router, prefix="/api/v1")
app.include_router(symptoms_router, prefix="/api/v1")
app.include_router(appointments_router, prefix="/api/v1")
app.include_router(doctors_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(managers_router, prefix="/api/v1")
app.include_router(articles_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(subscriptions_router, prefix="/api/v1")



@app.get("/")
async def root():
    return {"message": "Ayna API is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}