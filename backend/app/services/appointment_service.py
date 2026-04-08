from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.appointment import Appointment, DoctorSchedule
from backend.app.models.symptom import Symptom
from backend.app.models.test_requirement import SymptomTestMapping
from backend.app.schemas.appointment import AvailableSlot


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