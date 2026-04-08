import uuid
from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.constants import FlowIntensity
from backend.app.database import Base


class MenstrualCycle(Base):
    __tablename__ = "menstrual_cycles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    start_date: Mapped[date] = mapped_column(Date)
    end_date = mapped_column(Date, nullable=True)
    cycle_length = mapped_column(Integer, nullable=True)
    period_length = mapped_column(Integer, nullable=True)
    is_predicted: Mapped[bool] = mapped_column(Boolean, default=False)
    notes = mapped_column(Text, nullable=True)

    patient = relationship("Patient", backref="cycles")


class CycleDay(Base):
    __tablename__ = "cycle_days"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    date: Mapped[date] = mapped_column(Date)
    flow_intensity: Mapped[str] = mapped_column(Enum(FlowIntensity, values_callable=lambda x: [e.value for e in x]),
                                                default=FlowIntensity.NONE)
    temperature = mapped_column(String(10), nullable=True)
    notes = mapped_column(Text, nullable=True)

    patient = relationship("Patient", backref="cycle_days")