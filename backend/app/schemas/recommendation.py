import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class RecommendationCreate(BaseModel):
    content: str


class RecommendationOut(BaseModel):
    id: uuid.UUID
    doctor_id: uuid.UUID
    patient_id: uuid.UUID
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}