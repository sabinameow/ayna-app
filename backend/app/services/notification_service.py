import uuid
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    body: str,
) -> Notification:
    notif = Notification(user_id=user_id, title=title, body=body)
    db.add(notif)
    await db.flush()
    return notif


async def list_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    unread_only: bool = False,
    limit: int = 50,
) -> list[Notification]:
    stmt = select(Notification).where(Notification.user_id == user_id)
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