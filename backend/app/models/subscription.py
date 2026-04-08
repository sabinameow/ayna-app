import uuid
from datetime import datetime, timezone

from sqlalchemy import Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import TIMESTAMP

from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.constants import SubscriptionStatus
from backend.app.database import Base


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50))
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    features = mapped_column(JSON, nullable=True)
    duration_days: Mapped[int] = mapped_column(Integer)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"))
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subscription_plans.id"))
    status: Mapped[str] = mapped_column(Enum(SubscriptionStatus, values_callable=lambda x: [e.value for e in x]),
                                        default=SubscriptionStatus.ACTIVE)
    started_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))

    patient = relationship("Patient", backref="subscriptions")
    plan = relationship("SubscriptionPlan")