import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from backend.app.core.constants import ChatSessionStatus


class ChatSessionOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    manager_id: uuid.UUID
    status: ChatSessionStatus
    summary: Optional[str] = None
    created_at: datetime
    closed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    sent_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    content: str