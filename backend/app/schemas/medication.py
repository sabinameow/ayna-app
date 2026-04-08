import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class MedicationCreate(BaseModel):
    patient_id: uuid.UUID
    name: str
    dosage: str
    frequency: str
    start_date: date
    end_date: Optional[date] = None
    instructions: Optional[str] = None


class MedicationOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    name: str
    dosage: str
    frequency: str
    start_date: date
    end_date: Optional[date] = None
    instructions: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


class MedicationUpdate(BaseModel):
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    end_date: Optional[date] = None
    instructions: Optional[str] = None
    is_active: Optional[bool] = None


class MedicationLogCreate(BaseModel):
    skipped: bool = False
    notes: Optional[str] = None


class MedicationLogOut(BaseModel):
    id: uuid.UUID
    medication_id: uuid.UUID
    patient_id: uuid.UUID
    taken_at: datetime
    skipped: bool
    notes: Optional[str] = None

    model_config = {"from_attributes": True}