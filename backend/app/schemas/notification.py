import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationCreate(BaseModel):
    user_id: uuid.UUID
    role: str | None = None
    type: str
    title: str = Field(..., max_length=200)
    message: str
    metadata: dict[str, Any] | None = None
    dedupe_key: str | None = Field(default=None, max_length=255)


class DeviceTokenUpdate(BaseModel):
    device_token: str | None = Field(default=None, max_length=512)


class NotificationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime
    metadata: dict[str, Any] | None = Field(default=None, alias="payload")

    model_config = {"from_attributes": True, "populate_by_name": True}


class UnreadCountOut(BaseModel):
    unread: int


class MarkAllAsReadOut(BaseModel):
    updated: int
