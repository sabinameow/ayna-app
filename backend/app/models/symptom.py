import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class Symptom(Base):
    __tablename__ = "symptoms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(100))

    patient_symptoms = relationship("PatientSymptom", back_populates="symptom")


class PatientSymptom(Base):
    __tablename__ = "patient_symptoms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    symptom_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("symptoms.id"))
    date: Mapped[date] = mapped_column(Date)
    severity: Mapped[int] = mapped_column(Integer)
    notes = mapped_column(Text, nullable=True)

    patient = relationship("Patient", backref="patient_symptoms")
    symptom = relationship("Symptom", back_populates="patient_symptoms")