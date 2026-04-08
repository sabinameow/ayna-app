import uuid

from sqlalchemy import ForeignKey, Integer, String, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True)
    full_name: Mapped[str] = mapped_column(String(100))
    date_of_birth = mapped_column(Date, nullable=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id"), nullable=True)
    average_cycle_length: Mapped[int] = mapped_column(Integer, default=28)
    average_period_length: Mapped[int] = mapped_column(Integer, default=5)

    user = relationship("User", back_populates="patient")
    doctor = relationship("Doctor", back_populates="patients")