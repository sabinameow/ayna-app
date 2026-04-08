import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel


class PatientOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    date_of_birth: Optional[date] = None
    doctor_id: Optional[uuid.UUID] = None
    average_cycle_length: int
    average_period_length: int

    model_config = {"from_attributes": True}


class PatientProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    average_cycle_length: Optional[int] = None
    average_period_length: Optional[int] = None