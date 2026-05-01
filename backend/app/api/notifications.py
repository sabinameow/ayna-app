import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.auth.service import get_current_user
from backend.app.core.exceptions import NotFoundException
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.schemas.notification import (
    DeviceTokenUpdate,
    MarkAllAsReadOut,
    NotificationOut,
    UnreadCountOut,
)
from backend.app.services.notification_service import (
    count_unread,
    list_notifications,
    mark_all_as_read,
    mark_as_read,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationOut])
async def get_my_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_notifications(
        db, user_id=current_user.id, unread_only=unread_only, limit=limit
    )


@router.get("/unread-count", response_model=UnreadCountOut)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    unread = await count_unread(db, current_user.id)
    return {"unread": unread}


@router.put("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notif = await mark_as_read(db, current_user.id, notification_id)
    if not notif:
        raise NotFoundException("Notification not found")
    return notif


@router.put("/read-all", response_model=MarkAllAsReadOut)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await mark_all_as_read(db, current_user.id)
    return {"updated": updated}


@router.put("/device-token", response_model=dict[str, str | None])
async def update_device_token(
    body: DeviceTokenUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.device_token = body.device_token
    await db.flush()
    return {"device_token": current_user.device_token}
