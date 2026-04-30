from datetime import date, timedelta
from typing import Optional

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.cycle import MenstrualCycle, CycleDay
from backend.app.models.patient import Patient
from backend.app.schemas.cycle import CyclePrediction


async def get_patient_by_user_id(db: AsyncSession, user_id) -> Optional[Patient]:
    result = await db.execute(select(Patient).where(Patient.user_id == user_id))
    return result.scalar_one_or_none()


async def create_cycle(db: AsyncSession, patient_id, data) -> MenstrualCycle:
    cycle = MenstrualCycle(
        patient_id=patient_id,
        start_date=data.start_date,
        end_date=data.end_date,
        cycle_length=data.cycle_length,
        period_length=data.period_length,
        notes=data.notes,
        is_predicted=False,
    )
    db.add(cycle)
    await db.flush()
    return cycle


async def get_cycles(db: AsyncSession, patient_id) -> list[MenstrualCycle]:
    result = await db.execute(
        select(MenstrualCycle)
        .where(MenstrualCycle.patient_id == patient_id)
        .order_by(MenstrualCycle.start_date.desc())
    )
    return list(result.scalars().all())


async def create_cycle_day(db: AsyncSession, patient_id, data) -> CycleDay:
    # Upsert: remove existing entry for this date before inserting
    await db.execute(
        delete(CycleDay).where(
            CycleDay.patient_id == patient_id,
            CycleDay.date == data.date,
        )
    )
    cycle_day = CycleDay(
        patient_id=patient_id,
        date=data.date,
        flow_intensity=data.flow_intensity,
        temperature=data.temperature,
        notes=data.notes,
    )
    db.add(cycle_day)
    await db.flush()
    return cycle_day


async def save_period_range(
    db: AsyncSession, patient_id, start_date: date, duration: int
) -> list[CycleDay]:
    from datetime import timedelta

    def flow_for_day(i: int) -> str:
        if i <= 1:
            return "heavy"
        if i >= duration - 2:
            return "light"
        return "medium"

    # Delete existing days in range first (upsert semantics)
    end_date = start_date + timedelta(days=duration - 1)
    await db.execute(
        delete(CycleDay).where(
            CycleDay.patient_id == patient_id,
            CycleDay.date >= start_date,
            CycleDay.date <= end_date,
        )
    )

    days = []
    for i in range(duration):
        day = CycleDay(
            patient_id=patient_id,
            date=start_date + timedelta(days=i),
            flow_intensity=flow_for_day(i),
        )
        db.add(day)
        days.append(day)

    await db.flush()
    return days


async def delete_cycle_days_range(
    db: AsyncSession, patient_id, start_date: date, end_date: date
) -> None:
    await db.execute(
        delete(CycleDay).where(
            CycleDay.patient_id == patient_id,
            CycleDay.date >= start_date,
            CycleDay.date <= end_date,
        )
    )


async def get_cycle_days(db: AsyncSession, patient_id, month: int, year: int) -> list[CycleDay]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)

    result = await db.execute(
        select(CycleDay)
        .where(
            CycleDay.patient_id == patient_id,
            CycleDay.date >= start,
            CycleDay.date < end,
        )
        .order_by(CycleDay.date)
    )
    return list(result.scalars().all())


async def predict_next_cycle(db: AsyncSession, patient_id) -> Optional[CyclePrediction]:
    result = await db.execute(
        select(MenstrualCycle)
        .where(
            MenstrualCycle.patient_id == patient_id,
            MenstrualCycle.is_predicted == False,
            MenstrualCycle.cycle_length.isnot(None),
        )
        .order_by(MenstrualCycle.start_date.desc())
        .limit(6)
    )
    cycles = list(result.scalars().all())

    if len(cycles) < 2:
        return None

    avg_cycle_length = round(sum(c.cycle_length for c in cycles) / len(cycles))

    last_cycle = cycles[0]
    predicted_start = last_cycle.start_date + timedelta(days=avg_cycle_length)

    avg_period = round(
        sum(c.period_length for c in cycles if c.period_length) /
        max(sum(1 for c in cycles if c.period_length), 1)
    )
    predicted_end = predicted_start + timedelta(days=avg_period - 1)

    ovulation_date = predicted_start + timedelta(days=avg_cycle_length - 14)

    return CyclePrediction(
        predicted_start_date=predicted_start,
        predicted_end_date=predicted_end,
        predicted_ovulation_date=ovulation_date,
        average_cycle_length=avg_cycle_length,
    )