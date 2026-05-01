import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from backend.app.core.constants import (
    DEFAULT_PERIOD_LENGTH,
    FlowIntensity,
    MAX_PERIOD_LENGTH,
)


class CycleCreate(BaseModel):
    start_date: date
    end_date: Optional[date] = None
    cycle_length: Optional[int] = None
    period_length: Optional[int] = None
    notes: Optional[str] = None


class CycleOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    start_date: date
    end_date: Optional[date] = None
    cycle_length: Optional[int] = None
    period_length: Optional[int] = None
    is_predicted: bool
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class CyclePrediction(BaseModel):
    predicted_start_date: date
    predicted_end_date: date
    predicted_ovulation_date: date
    average_cycle_length: int
    average_period_length: int = 5
    upcoming_starts: list[date] = []


class PeriodRangeCreate(BaseModel):
    start_date: date
    duration: int = Field(default=DEFAULT_PERIOD_LENGTH, ge=1, le=MAX_PERIOD_LENGTH)


class CycleDayCreate(BaseModel):
    date: date
    flow_intensity: FlowIntensity = FlowIntensity.NONE
    temperature: Optional[str] = None
    notes: Optional[str] = None


class CycleDayOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    date: date
    flow_intensity: FlowIntensity
    temperature: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}
