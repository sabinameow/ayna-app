import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class SymptomOut(BaseModel):
    id: uuid.UUID
    name: str
    category: str

    model_config = {"from_attributes": True}


class PatientSymptomCreate(BaseModel):
    symptom_id: uuid.UUID
    date: date
    severity: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None


class PatientSymptomOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    symptom_id: uuid.UUID
    date: date
    severity: int
    notes: Optional[str] = None

    model_config = {"from_attributes": True}