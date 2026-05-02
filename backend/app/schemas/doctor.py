import uuid
from datetime import time
from typing import Optional

from pydantic import BaseModel


class DoctorOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    specialization: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_available: bool

    model_config = {"from_attributes": True}


class DoctorProfileUpdate(BaseModel):
    specialization: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class ScheduleSlot(BaseModel):
    weekday: int
    start_time: time
    end_time: time
    slot_duration_minutes: int = 30


class ScheduleOut(BaseModel):
    id: uuid.UUID
    doctor_id: uuid.UUID
    weekday: int
    start_time: time
    end_time: time
    slot_duration_minutes: int

    model_config = {"from_attributes": True}


class ScheduleUpdate(BaseModel):
    slots: list[ScheduleSlot]
