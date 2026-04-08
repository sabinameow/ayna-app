import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from backend.app.core.constants import MoodLevel


class MoodCreate(BaseModel):
    date: date
    mood: MoodLevel
    energy_level: int = Field(..., ge=1, le=5)
    stress_level: int = Field(..., ge=1, le=5)
    sleep_quality: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None


class MoodOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    date: date
    mood: MoodLevel
    energy_level: int
    stress_level: int
    sleep_quality: int
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class MoodStats(BaseModel):
    total_entries: int
    average_energy: float
    average_stress: float
    average_sleep: float
    mood_distribution: dict[str, int]