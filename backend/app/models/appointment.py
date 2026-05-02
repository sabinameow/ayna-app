import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Text, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import TIMESTAMP
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
    scheduled_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    status: Mapped[str] = mapped_column(Enum(AppointmentStatus, values_callable=lambda x: [e.value for e in x]),
                                        default=AppointmentStatus.PENDING)
    reason = mapped_column(Text, nullable=True)
    notes = mapped_column(Text, nullable=True)
    selected_symptom_ids = mapped_column(JSON, nullable=True)
    required_tests = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    patient = relationship("Patient", backref="appointments")
    doctor = relationship("Doctor", backref="appointments")


class DoctorAvailabilitySlot(Base):
    __tablename__ = "doctor_availability_slots"
    __table_args__ = (
        UniqueConstraint(
            "doctor_id",
            "date",
            "start_time",
            "end_time",
            name="uq_doctor_availability_slot",
        ),
        UniqueConstraint("appointment_id", name="uq_doctor_availability_appointment"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"))
    date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    is_booked: Mapped[bool] = mapped_column(Boolean, default=False)
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("appointments.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    doctor = relationship("Doctor", backref="availability_slots")
