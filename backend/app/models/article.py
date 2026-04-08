import uuid
from datetime import datetime, timezone


from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(300))
    content: Mapped[str] = mapped_column(Text)
    summary = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100))
    requires_subscription: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))