from datetime import date, timedelta
from typing import Optional, List

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.cycle import MenstrualCycle, CycleDay
from backend.app.models.patient import Patient
from backend.app.schemas.cycle import CyclePrediction

PERIOD_LENGTH = 5
DEFAULT_CYCLE_LENGTH = 28
PREDICTION_HORIZON = 6


async def get_patient_by_user_id(db: AsyncSession, user_id) -> Optional[Patient]:
    result = await db.execute(select(Patient).where(Patient.user_id == user_id))
    return result.scalar_one_or_none()


async def get_cycles(db: AsyncSession, patient_id) -> List[MenstrualCycle]:
    result = await db.execute(
        select(MenstrualCycle)
        .where(
            MenstrualCycle.patient_id == patient_id,
            MenstrualCycle.is_predicted == False,
        )
        .order_by(MenstrualCycle.start_date.desc())
    )
    return list(result.scalars().all())


async def create_cycle(
    db: AsyncSession,
    patient_id,
    start_date: date,
    period_length: int = PERIOD_LENGTH,
) -> MenstrualCycle:
    end_date = start_date + timedelta(days=period_length - 1)

    cycle = MenstrualCycle(
        patient_id=patient_id,
        start_date=start_date,
        end_date=end_date,
        period_length=period_length,
        cycle_length=None,
        is_predicted=False,
    )

    db.add(cycle)
    await db.flush()
    return cycle


async def create_cycle_day(db: AsyncSession, patient_id, data) -> CycleDay:
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


async def get_cycle_days(
    db: AsyncSession, patient_id, month: int, year: int
) -> List[CycleDay]:
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

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


async def save_period_range(
    db: AsyncSession,
    patient_id,
    start_date: date,
    duration: int = PERIOD_LENGTH,
) -> List[CycleDay]:

    end_date = start_date + timedelta(days=duration - 1)

    overlap_result = await db.execute(
        select(MenstrualCycle).where(
            MenstrualCycle.patient_id == patient_id,
            MenstrualCycle.is_predicted == False,
            MenstrualCycle.start_date <= end_date,
            MenstrualCycle.end_date >= start_date,
        )
    )
    overlapping_cycles = list(overlap_result.scalars().all())

    if overlapping_cycles:
        for cyc in overlapping_cycles:
            await db.execute(
                delete(CycleDay).where(
                    CycleDay.patient_id == patient_id,
                    CycleDay.date >= cyc.start_date,
                    CycleDay.date <= cyc.end_date,
                )
            )

        await db.execute(
            delete(MenstrualCycle).where(
                MenstrualCycle.id.in_([c.id for c in overlapping_cycles])
            )
        )

    days = []
    for i in range(duration):
        d = start_date + timedelta(days=i)
        day = CycleDay(
            patient_id=patient_id,
            date=d,
        )
        db.add(day)
        days.append(day)

    prev_result = await db.execute(
        select(MenstrualCycle)
        .where(
            MenstrualCycle.patient_id == patient_id,
            MenstrualCycle.is_predicted == False,
            MenstrualCycle.start_date < start_date,
        )
        .order_by(MenstrualCycle.start_date.desc())
        .limit(1)
    )
    prev = prev_result.scalar_one_or_none()

    if prev:
        prev.cycle_length = (start_date - prev.start_date).days

    cycle = MenstrualCycle(
        patient_id=patient_id,
        start_date=start_date,
        end_date=end_date,
        period_length=duration,
        cycle_length=None,
        is_predicted=False,
    )
    db.add(cycle)

    await db.flush()
    return days


async def delete_cycle_days_range(
    db: AsyncSession,
    patient_id,
    start_date: date,
    end_date: date,
) -> None:
    await db.execute(
        delete(CycleDay).where(
            CycleDay.patient_id == patient_id,
            CycleDay.date >= start_date,
            CycleDay.date <= end_date,
        )
    )

    await db.execute(
        delete(MenstrualCycle).where(
            MenstrualCycle.patient_id == patient_id,
            MenstrualCycle.is_predicted == False,
            MenstrualCycle.start_date >= start_date,
            MenstrualCycle.start_date <= end_date,
        )
    )


async def predict_next_cycle(
    db: AsyncSession, patient_id
) -> Optional[CyclePrediction]:

    result = await db.execute(
        select(MenstrualCycle)
        .where(
            MenstrualCycle.patient_id == patient_id,
            MenstrualCycle.is_predicted == False,
        )
        .order_by(MenstrualCycle.start_date.desc())
        .limit(12)
    )
    cycles = list(result.scalars().all())

    if not cycles:
        return None

    starts = sorted({c.start_date for c in cycles})

    if len(starts) >= 2:
        gaps = [
            (starts[i] - starts[i - 1]).days
            for i in range(1, len(starts))
        ]
        avg_cycle_length = round(sum(gaps) / len(gaps))
    else:
        avg_cycle_length = DEFAULT_CYCLE_LENGTH

    period_lengths = [
        c.period_length for c in cycles if c.period_length
    ]
    avg_period = (
        round(sum(period_lengths) / len(period_lengths))
        if period_lengths
        else PERIOD_LENGTH
    )

    last_start = starts[-1]

    upcoming = []
    cursor = last_start

    for _ in range(PREDICTION_HORIZON):
        cursor = cursor + timedelta(days=avg_cycle_length)
        upcoming.append(cursor)

    predicted_start = upcoming[0]
    predicted_end = predicted_start + timedelta(days=avg_period - 1)
    ovulation_date = predicted_start - timedelta(days=14)

    return CyclePrediction(
        predicted_start_date=predicted_start,
        predicted_end_date=predicted_end,
        predicted_ovulation_date=ovulation_date,
        average_cycle_length=avg_cycle_length,
        average_period_length=avg_period,
        upcoming_starts=upcoming,
    )