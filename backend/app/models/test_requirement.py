import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class SymptomTestMapping(Base):
    __tablename__ = "symptom_test_mappings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symptom_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("symptoms.id"))
    test_name: Mapped[str] = mapped_column(String(200))
    test_description = mapped_column(Text, nullable=True)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)

    symptom = relationship("Symptom", backref="test_mappings")