import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ArticleCreate(BaseModel):
    title: str = Field(..., max_length=300)
    content: str
    summary: Optional[str] = None
    category: str = Field(..., max_length=100)
    requires_subscription: bool = False


class ArticleUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    content: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    requires_subscription: Optional[bool] = None


class ArticleListOut(BaseModel):
    id: uuid.UUID
    title: str
    summary: Optional[str] = None
    category: str
    requires_subscription: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleOut(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    summary: Optional[str] = None
    category: str
    requires_subscription: bool
    created_at: datetime

    model_config = {"from_attributes": True}