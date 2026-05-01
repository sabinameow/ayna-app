from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.appointment import Appointment, DoctorSchedule
from backend.app.models.doctor import Doctor
from backend.app.models.patient import Patient
from backend.app.models.symptom import Symptom
from backend.app.models.test_requirement import SymptomTestMapping
from backend.app.schemas.appointment import AvailableSlot
from backend.app.services.notification_service import (
    build_notification_dedupe_key,
    create_notification,
    list_manager_user_ids,
)


async def get_doctor_schedule(db: AsyncSession, doctor_id) -> list[DoctorSchedule]:
    result = await db.execute(
        select(DoctorSchedule)
        .where(DoctorSchedule.doctor_id == doctor_id)
        .order_by(DoctorSchedule.weekday)
    )
    return list(result.scalars().all())


async def get_available_slots(
    db: AsyncSession, doctor_id, target_date: date
) -> list[AvailableSlot]:
    weekday = target_date.weekday()

    result = await db.execute(
        select(DoctorSchedule).where(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.weekday == weekday,
        )
    )
    schedule = result.scalar_one_or_none()

    if not schedule:
        return []

    day_start = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    day_end = datetime.combine(target_date, time.max, tzinfo=timezone.utc)

    result = await db.execute(
        select(Appointment.scheduled_at).where(
            Appointment.doctor_id == doctor_id,
            Appointment.scheduled_at >= day_start,
            Appointment.scheduled_at <= day_end,
            Appointment.status.in_(["pending", "confirmed"]),
        )
    )
    booked_times = {row[0].time() for row in result.all()}

    slots = []
    current = schedule.start_time
    duration = timedelta(minutes=schedule.slot_duration_minutes)

    while current < schedule.end_time:
        end = (datetime.combine(target_date, current) + duration).time()
        if end > schedule.end_time:
            break
        if current not in booked_times:
            slots.append(AvailableSlot(start_time=current, end_time=end))
        current = end

    return slots


async def get_required_tests(db: AsyncSession, symptom_ids: list) -> list[dict]:
    if not symptom_ids:
        return []

    result = await db.execute(
        select(SymptomTestMapping).where(
            SymptomTestMapping.symptom_id.in_(symptom_ids)
        ).order_by(SymptomTestMapping.priority)
    )
    mappings = result.scalars().all()

    return [
        {
            "test_name": m.test_name,
            "test_description": m.test_description,
            "is_mandatory": m.is_mandatory,
            "priority": m.priority,
        }
        for m in mappings
    ]


async def _get_appointment_context(db: AsyncSession, appointment: Appointment) -> tuple[Patient | None, Doctor | None]:
    patient_result = await db.execute(
        select(Patient).where(Patient.id == appointment.patient_id)
    )
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.id == appointment.doctor_id)
    )
    return patient_result.scalar_one_or_none(), doctor_result.scalar_one_or_none()


def _appointment_when(appointment: Appointment) -> str:
    return appointment.scheduled_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


async def notify_appointment_created(db: AsyncSession, appointment: Appointment) -> None:
    patient, doctor = await _get_appointment_context(db, appointment)
    if patient:
        await create_notification(
            db,
            user_id=patient.user_id,
            role="patient",
            type="appointment.confirmed",
            title="Appointment booked",
            message=f"Your appointment is booked for {_appointment_when(appointment)}.",
            metadata={"appointment_id": str(appointment.id), "status": appointment.status},
            dedupe_key=build_notification_dedupe_key("appointment.patient.booked", appointment.id),
        )
    if doctor:
        await create_notification(
            db,
            user_id=doctor.user_id,
            role="doctor",
            type="appointment.new",
            title="New appointment booked",
            message=f"A patient booked an appointment for {_appointment_when(appointment)}.",
            metadata={"appointment_id": str(appointment.id), "status": appointment.status},
            dedupe_key=build_notification_dedupe_key("appointment.doctor.booked", appointment.id),
        )

    manager_user_ids = await list_manager_user_ids(db)
    for manager_user_id in manager_user_ids:
        await create_notification(
            db,
            user_id=manager_user_id,
            role="manager",
            type="appointment.new",
            title="New appointment request",
            message=f"A new appointment was booked for {_appointment_when(appointment)}.",
            metadata={"appointment_id": str(appointment.id), "status": appointment.status},
            dedupe_key=build_notification_dedupe_key(
                "appointment.manager.booked",
                appointment.id,
                manager_user_id,
            ),
        )


async def notify_appointment_cancelled(
    db: AsyncSession,
    appointment: Appointment,
    actor_role: str,
) -> None:
    patient, doctor = await _get_appointment_context(db, appointment)
    base_metadata = {"appointment_id": str(appointment.id), "status": appointment.status}
    if patient:
        await create_notification(
            db,
            user_id=patient.user_id,
            role="patient",
            type="appointment.cancelled",
            title="Appointment cancelled",
            message=f"Your appointment on {_appointment_when(appointment)} was cancelled.",
            metadata=base_metadata,
            dedupe_key=build_notification_dedupe_key(
                "appointment.patient.cancelled",
                appointment.id,
                actor_role,
            ),
        )
    if doctor:
        await create_notification(
            db,
            user_id=doctor.user_id,
            role="doctor",
            type="appointment.cancelled",
            title="Appointment cancelled",
            message=f"An appointment on {_appointment_when(appointment)} was cancelled.",
            metadata=base_metadata,
            dedupe_key=build_notification_dedupe_key(
                "appointment.doctor.cancelled",
                appointment.id,
                actor_role,
            ),
        )

    manager_user_ids = await list_manager_user_ids(db)
    for manager_user_id in manager_user_ids:
        await create_notification(
            db,
            user_id=manager_user_id,
            role="manager",
            type="appointment.status_changed",
            title="Appointment cancelled",
            message=f"Appointment on {_appointment_when(appointment)} was cancelled.",
            metadata=base_metadata,
            dedupe_key=build_notification_dedupe_key(
                "appointment.manager.cancelled",
                appointment.id,
                actor_role,
                manager_user_id,
            ),
        )


async def notify_appointment_updated(
    db: AsyncSession,
    appointment: Appointment,
    previous_status: str | None = None,
    previous_scheduled_at: datetime | None = None,
) -> None:
    patient, doctor = await _get_appointment_context(db, appointment)
    changed_status = bool(previous_status and previous_status != appointment.status)
    changed_time = bool(
        previous_scheduled_at and previous_scheduled_at != appointment.scheduled_at
    )

    if appointment.status == "cancelled" and changed_status:
        await notify_appointment_cancelled(db, appointment, actor_role="manager")
        return

    message_suffix = (
        f"Status changed to {appointment.status}."
        if changed_status
        else f"Now scheduled for {_appointment_when(appointment)}."
        if changed_time
        else "Details were updated."
    )
    metadata = {"appointment_id": str(appointment.id), "status": appointment.status}
    dedupe_base = build_notification_dedupe_key(
        "appointment.updated",
        appointment.id,
        appointment.status,
        appointment.scheduled_at,
    )

    if patient:
        await create_notification(
            db,
            user_id=patient.user_id,
            role="patient",
            type="appointment.updated",
            title="Appointment updated",
            message=f"Your appointment was updated. {message_suffix}",
            metadata=metadata,
            dedupe_key=f"{dedupe_base}:patient",
        )
    if doctor:
        await create_notification(
            db,
            user_id=doctor.user_id,
            role="doctor",
            type="appointment.updated",
            title="Appointment updated",
            message=f"An appointment was updated. {message_suffix}",
            metadata=metadata,
            dedupe_key=f"{dedupe_base}:doctor",
        )

    manager_user_ids = await list_manager_user_ids(db)
    for manager_user_id in manager_user_ids:
        await create_notification(
            db,
            user_id=manager_user_id,
            role="manager",
            type="appointment.status_changed",
            title="Appointment updated",
            message=f"Appointment updated. {message_suffix}",
            metadata=metadata,
            dedupe_key=f"{dedupe_base}:manager:{manager_user_id}",
        )
