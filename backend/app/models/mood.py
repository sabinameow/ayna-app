import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.constants import MoodLevel
from backend.app.database import Base


class MoodEntry(Base):
    __tablename__ = "mood_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    date: Mapped[date] = mapped_column(Date)
    mood: Mapped[str] = mapped_column(Enum(MoodLevel, values_callable=lambda x: [e.value for e in x]))
    energy_level: Mapped[int] = mapped_column(Integer)
    stress_level: Mapped[int] = mapped_column(Integer)
    sleep_quality: Mapped[int] = mapped_column(Integer)
    notes = mapped_column(Text, nullable=True)

    patient = relationship("Patient", backref="mood_entries")