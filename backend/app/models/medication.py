import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"))
    name: Mapped[str] = mapped_column(String(200))
    dosage: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[date] = mapped_column(Date)
    end_date = mapped_column(Date, nullable=True)
    instructions = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    patient = relationship("Patient", backref="medications")
    doctor = relationship("Doctor", backref="prescribed_medications")
    logs = relationship("MedicationLog", back_populates="medication")


class MedicationLog(Base):
    __tablename__ = "medication_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medication_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medications.id"))
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    taken_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    skipped: Mapped[bool] = mapped_column(Boolean, default=False)
    notes = mapped_column(Text, nullable=True)

    medication = relationship("Medication", back_populates="logs")
    patient = relationship("Patient", backref="medication_logs")