import uuid
from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel

from backend.app.core.constants import AppointmentStatus


class AvailableSlot(BaseModel):
    start_time: time
    end_time: time


class AppointmentCreate(BaseModel):
    doctor_id: uuid.UUID
    scheduled_at: datetime
    reason: Optional[str] = None
    notes: Optional[str] = None
    selected_symptom_ids: Optional[list[uuid.UUID]] = None


class AppointmentOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    scheduled_at: datetime
    status: AppointmentStatus
    reason: Optional[str] = None
    notes: Optional[str] = None
    selected_symptom_ids: Optional[list] = None
    required_tests: Optional[list] = None

    model_config = {"from_attributes": True}


class AppointmentUpdate(BaseModel):
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None