import uuid
from datetime import datetime, time, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.constants import AppointmentStatus
from backend.app.database import Base


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"))
    weekday: Mapped[int] = mapped_column(Integer)  # 0=Mon, 6=Sun
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=30)

    doctor = relationship("Doctor", backref="schedules")


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(Enum(AppointmentStatus), default=AppointmentStatus.PENDING)
    reason = mapped_column(Text, nullable=True)
    notes = mapped_column(Text, nullable=True)
    selected_symptom_ids = mapped_column(JSON, nullable=True)
    required_tests = mapped_column(JSON, nullable=True)

    patient = relationship("Patient", backref="appointments")
    doctor = relationship("Doctor", backref="appointments")