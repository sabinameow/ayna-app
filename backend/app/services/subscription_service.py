import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.constants import SubscriptionStatus
from backend.app.models.subscription import Subscription, SubscriptionPlan


async def list_plans(db: AsyncSession) -> list[SubscriptionPlan]:
    result = await db.execute(select(SubscriptionPlan).order_by(SubscriptionPlan.price))
    return list(result.scalars().all())


async def get_plan(db: AsyncSession, plan_id: uuid.UUID) -> Optional[SubscriptionPlan]:
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
    return result.scalar_one_or_none()


async def get_active_subscription(
    db: AsyncSession, patient_id: uuid.UUID
) -> Optional[Subscription]:
    """Return the patient's currently active subscription, if any.

    A subscription is considered active when its status is ACTIVE
    and the expiration time has not passed.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(
            Subscription.patient_id == patient_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.expires_at > now,
        )
        .order_by(Subscription.expires_at.desc())
    )
    return result.scalars().first()


async def list_subscriptions(
    db: AsyncSession, patient_id: uuid.UUID
) -> list[Subscription]:
    result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(Subscription.patient_id == patient_id)
        .order_by(Subscription.started_at.desc())
    )
    return list(result.scalars().all())


async def subscribe_patient(
    db: AsyncSession, patient_id: uuid.UUID, plan: SubscriptionPlan
) -> Subscription:
    now = datetime.now(timezone.utc)
    existing = await get_active_subscription(db, patient_id)
    if existing:
        existing.status = SubscriptionStatus.CANCELLED

    sub = Subscription(
        patient_id=patient_id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE,
        started_at=now,
        expires_at=now + timedelta(days=plan.duration_days),
    )
    db.add(sub)
    await db.flush()
    await db.refresh(sub, attribute_names=["plan"])
    return sub


async def cancel_subscription(
    db: AsyncSession, subscription: Subscription
) -> Subscription:
    subscription.status = SubscriptionStatus.CANCELLED
    await db.flush()
    return subscription


async def has_active_subscription(db: AsyncSession, patient_id: uuid.UUID) -> bool:
    return (await get_active_subscription(db, patient_id)) is not None