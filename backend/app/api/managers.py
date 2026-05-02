import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.manager import Manager
from backend.app.models.chat import ChatSession
from backend.app.models.appointment import Appointment, DoctorSchedule
from backend.app.core.permissions import require_manager
from backend.app.core.exceptions import NotFoundException, BadRequestException, ForbiddenException
from backend.app.schemas.chat import ChatSessionOut, ChatMessageOut
from backend.app.schemas.appointment import AppointmentOut, AppointmentUpdate, AvailableSlot
from backend.app.schemas.doctor import ScheduleOut
from backend.app.schemas.manager import ManagerOut
from backend.app.services.chat_service import close_session, get_session_messages
from backend.app.services.appointment_service import (
    cancel_appointment_record,
    get_available_slots,
    notify_appointment_updated,
    serialize_appointment,
    serialize_appointments,
    update_appointment_status_record,
)

router = APIRouter(prefix="/manager", tags=["Manager"])


async def _get_manager(db: AsyncSession, user_id) -> Manager:
    result = await db.execute(select(Manager).where(Manager.user_id == user_id))
    mgr = result.scalar_one_or_none()
    if not mgr:
        raise NotFoundException("Manager profile not found")
    return mgr

@router.get("/profile", response_model=ManagerOut)
async def get_profile(
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    return await _get_manager(db, current_user.id)


@router.get("/chat/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    mgr = await _get_manager(db, current_user.id)
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.manager_id == mgr.id)
        .order_by(ChatSession.created_at.desc())
    )
    return list(result.scalars().all())


@router.get(
    "/chat/sessions/{session_id}/messages",
    response_model=list[ChatMessageOut],
)
async def get_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    mgr = await _get_manager(db, current_user.id)
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundException("Session not found")
    if session.manager_id != mgr.id:
        raise ForbiddenException("Not your session")
    return await get_session_messages(db, session_id)


@router.put("/chat/sessions/{session_id}/close", response_model=ChatSessionOut)
async def close_chat_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    mgr = await _get_manager(db, current_user.id)
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundException("Session not found")
    if session.manager_id != mgr.id:
        raise ForbiddenException("Not your session")

    closed = await close_session(db, session_id)
    return closed


@router.get("/appointments", response_model=list[AppointmentOut])
async def list_appointments(
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).order_by(Appointment.scheduled_at.desc())
    )
    return await serialize_appointments(db, list(result.scalars().all()))


@router.put("/appointments/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentUpdate,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise NotFoundException("Appointment not found")

    if body.status is not None:
        updated = await update_appointment_status_record(
            db,
            appointment=appointment,
            status=body.status,
            notes=body.notes,
        )
        return await serialize_appointment(db, updated)

    previous_status = appointment.status
    previous_scheduled_at = appointment.scheduled_at
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(appointment, field, value)

    await db.flush()
    await notify_appointment_updated(
        db,
        appointment,
        previous_status=previous_status,
        previous_scheduled_at=previous_scheduled_at,
    )
    return await serialize_appointment(db, appointment)


@router.delete("/appointments/{appointment_id}", status_code=204)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise NotFoundException("Appointment not found")
    await cancel_appointment_record(db, appointment, actor_role="manager")
    return None


@router.get("/schedules", response_model=list[ScheduleOut])
async def list_all_schedules(
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DoctorSchedule))
    return list(result.scalars().all())


@router.get("/doctors/{doctor_id}/available-slots", response_model=list[AvailableSlot])
async def available_slots(
    doctor_id: uuid.UUID,
    date: date | None = Query(default=None),
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    return await get_available_slots(db, doctor_id, date)
