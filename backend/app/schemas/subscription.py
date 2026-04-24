import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from backend.app.core.constants import SubscriptionStatus


class SubscriptionPlanOut(BaseModel):
    id: uuid.UUID
    name: str
    price: float
    features: Optional[Any] = None
    duration_days: int

    model_config = {"from_attributes": True}


class SubscriptionCreate(BaseModel):
    plan_id: uuid.UUID


class SubscriptionOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    plan_id: uuid.UUID
    status: SubscriptionStatus
    started_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionDetailOut(SubscriptionOut):
    plan: SubscriptionPlanOut

    model_config = {"from_attributes": True}