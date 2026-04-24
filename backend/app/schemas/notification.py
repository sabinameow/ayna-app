import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class NotificationCreate(BaseModel):
    user_id: uuid.UUID
    title: str = Field(..., max_length=200)
    body: str


class NotificationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    body: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountOut(BaseModel):
    unread: int