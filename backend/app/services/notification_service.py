import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.doctor import Doctor
from backend.app.models.manager import Manager
from backend.app.models.notification import Notification
from backend.app.models.patient import Patient
from backend.app.models.user import User

SUPPRESSED_NOTIFICATION_TYPES = ("cycle.period.logged",)


def build_notification_dedupe_key(prefix: str, *parts: object) -> str:
    normalized: list[str] = [prefix]
    for part in parts:
        if isinstance(part, uuid.UUID):
            normalized.append(str(part))
        elif isinstance(part, datetime):
            normalized.append(part.isoformat())
        elif isinstance(part, date):
            normalized.append(part.isoformat())
        elif part is None:
            normalized.append("none")
        else:
            normalized.append(str(part))
    return ":".join(normalized)


def _role_value(role: Any) -> str:
    if hasattr(role, "value"):
        return str(role.value)
    return str(role)


async def send_push_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    message: str,
    metadata: dict[str, Any] | None = None,
    notification_type: str | None = None,
) -> dict[str, Any]:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.device_token:
        return {
            "sent": False,
            "provider": "stub",
            "reason": "device_token_missing",
            "notification_type": notification_type,
        }

    return {
        "sent": False,
        "provider": "stub",
        "reason": "push_provider_not_configured",
        "device_token": user.device_token,
        "title": title,
        "message": message,
        "metadata": metadata or {},
        "notification_type": notification_type,
    }


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    message: str,
    metadata: dict[str, Any] | None = None,
    role: str | None = None,
    dedupe_key: str | None = None,
    send_push: bool = False,
) -> Notification:
    if dedupe_key:
        existing_result = await db.execute(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.dedupe_key == dedupe_key,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            return existing

    user: User | None = None
    if role is None or send_push:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

    notif = Notification(
        user_id=user_id,
        role=role or _role_value(user.role if user else "patient"),
        type=type,
        title=title,
        message=message,
        payload=metadata,
        dedupe_key=dedupe_key,
    )
    db.add(notif)
    await db.flush()
    if send_push:
        await send_push_notification(
            db,
            user_id=user_id,
            title=title,
            message=message,
            metadata=metadata,
            notification_type=type,
        )
    return notif


async def get_patient_user_id(db: AsyncSession, patient_id: uuid.UUID) -> uuid.UUID | None:
    result = await db.execute(select(Patient.user_id).where(Patient.id == patient_id))
    return result.scalar_one_or_none()


async def get_doctor_user_id(db: AsyncSession, doctor_id: uuid.UUID) -> uuid.UUID | None:
    result = await db.execute(select(Doctor.user_id).where(Doctor.id == doctor_id))
    return result.scalar_one_or_none()


async def list_manager_user_ids(db: AsyncSession) -> list[uuid.UUID]:
    result = await db.execute(select(Manager.user_id))
    return list(result.scalars().all())


async def list_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    unread_only: bool = False,
    limit: int = 50,
) -> list[Notification]:
    stmt = select(Notification).where(
        Notification.user_id == user_id,
        Notification.type.not_in(SUPPRESSED_NOTIFICATION_TYPES),
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def count_unread(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
            Notification.type.not_in(SUPPRESSED_NOTIFICATION_TYPES),
        )
    )
    return int(result.scalar_one() or 0)


async def mark_as_read(
    db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID
) -> Optional[Notification]:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        return None
    notif.is_read = True
    await db.flush()
    return notif


async def mark_all_as_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
        .values(is_read=True)
    )
    return result.rowcount or 0
