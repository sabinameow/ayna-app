from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.exceptions import BadRequestException, NotFoundException
from backend.app.core.permissions import require_patient
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionDetailOut,
    SubscriptionOut,
    SubscriptionPlanOut,
)
from backend.app.services.cycle_service import get_patient_by_user_id
from backend.app.services.notification_service import create_notification
from backend.app.services.subscription_service import (
    cancel_subscription,
    get_active_subscription,
    get_plan,
    list_plans,
    list_subscriptions,
    subscribe_patient,
)

router = APIRouter(tags=["Subscriptions"])


@router.get("/subscription-plans", response_model=list[SubscriptionPlanOut])
async def get_plans(db: AsyncSession = Depends(get_db)):
    return await list_plans(db)


@router.get(
    "/patient/subscription",
    response_model=SubscriptionDetailOut | None,
)
async def get_current_subscription(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    return await get_active_subscription(db, patient.id)


@router.get("/patient/subscriptions", response_model=list[SubscriptionOut])
async def get_subscription_history(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    return await list_subscriptions(db, patient.id)


@router.post(
    "/patient/subscribe",
    response_model=SubscriptionDetailOut,
    status_code=201,
)
async def subscribe(
    body: SubscriptionCreate,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    plan = await get_plan(db, body.plan_id)
    if not plan:
        raise NotFoundException("Subscription plan not found")

    sub = await subscribe_patient(db, patient.id, plan)

    await create_notification(
        db,
        user_id=current_user.id,
        title="Subscription activated",
        body=(
            f"You are now subscribed to the '{plan.name}' plan "
            f"until {sub.expires_at:%Y-%m-%d}. AI phase insights "
            "and chat with a manager are now available."
        ),
    )
    return sub


@router.post("/patient/subscription/cancel", response_model=SubscriptionOut)
async def cancel_current_subscription(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    sub = await get_active_subscription(db, patient.id)
    if not sub:
        raise BadRequestException("No active subscription to cancel")

    cancelled = await cancel_subscription(db, sub)
    await create_notification(
        db,
        user_id=current_user.id,
        title="Subscription cancelled",
        body=(
            "Your subscription has been cancelled. Premium features "
            "(AI insights, manager chat) remain active until the end "
            "of the paid period."
        ),
    )
    return cancelled