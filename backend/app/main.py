from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.auth.routes import router as auth_router

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


@app.get("/")
async def root():
    return {"message": "Ayna API is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}