import uuid
from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel

from backend.app.core.constants import AppointmentStatus


class AvailableSlot(BaseModel):
    id: uuid.UUID
    doctor_id: uuid.UUID
    date: date
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class DoctorAvailabilityCreate(BaseModel):
    date: date
    start_time: time
    end_time: time


class DoctorAvailabilityOut(BaseModel):
    id: uuid.UUID
    doctor_id: uuid.UUID
    date: date
    start_time: time
    end_time: time
    is_booked: bool
    appointment_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AppointmentCreate(BaseModel):
    slot_id: uuid.UUID
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
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    slot_id: Optional[uuid.UUID] = None
    slot_date: Optional[date] = None
    slot_start_time: Optional[time] = None
    slot_end_time: Optional[time] = None
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None

    model_config = {"from_attributes": True}


class AppointmentUpdate(BaseModel):
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None
