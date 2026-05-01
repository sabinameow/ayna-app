from datetime import date, timedelta
from typing import List, Optional, Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.constants import (
    DEFAULT_CYCLE_LENGTH,
    DEFAULT_PERIOD_LENGTH,
    FlowIntensity,
    MAX_PERIOD_LENGTH,
    MIN_CYCLE_GAP_DAYS,
)
from backend.app.models.cycle import CycleDay, MenstrualCycle
from backend.app.models.patient import Patient
from backend.app.schemas.cycle import CyclePrediction
from backend.app.services.notification_service import (
    build_notification_dedupe_key,
    create_notification,
    get_patient_user_id,
)

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
    cycles = list(result.scalars().all())
    return _normalize_cycles_for_read(cycles)


async def create_cycle(
    db: AsyncSession,
    patient_id,
    start_date: date,
    period_length: int = DEFAULT_PERIOD_LENGTH,
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


def _cycle_end(cycle: MenstrualCycle) -> date:
    if cycle.end_date:
        return cycle.end_date
    length = cycle.period_length or DEFAULT_PERIOD_LENGTH
    return cycle.start_date + timedelta(days=length - 1)


def _ranges_overlap(
    start_a: date,
    end_a: date,
    start_b: date,
    end_b: date,
) -> bool:
    return start_a <= end_b and end_a >= start_b


async def _get_actual_cycles(db: AsyncSession, patient_id) -> List[MenstrualCycle]:
    result = await db.execute(
        select(MenstrualCycle)
        .where(
            MenstrualCycle.patient_id == patient_id,
            MenstrualCycle.is_predicted == False,
        )
        .order_by(MenstrualCycle.start_date.asc(), MenstrualCycle.id.asc())
    )
    return list(result.scalars().all())


def _normalize_cycles_for_read(cycles: Sequence[MenstrualCycle]) -> List[MenstrualCycle]:
    normalized: List[MenstrualCycle] = []
    for cycle in sorted(cycles, key=lambda item: item.start_date, reverse=True):
        if any(abs((kept.start_date - cycle.start_date).days) < MIN_CYCLE_GAP_DAYS for kept in normalized):
            continue
        normalized.append(cycle)
    return normalized


async def _get_cycle_days_in_range(
    db: AsyncSession,
    patient_id,
    start_date: date,
    end_date: date,
) -> List[CycleDay]:
    result = await db.execute(
        select(CycleDay)
        .where(
            CycleDay.patient_id == patient_id,
            CycleDay.date >= start_date,
            CycleDay.date <= end_date,
        )
        .order_by(CycleDay.date.asc())
    )
    return list(result.scalars().all())


async def _replace_cycle_days_range(
    db: AsyncSession,
    patient_id,
    start_date: date,
    duration: int,
) -> List[CycleDay]:
    end_date = start_date + timedelta(days=duration - 1)

    await db.execute(
        delete(CycleDay).where(
            CycleDay.patient_id == patient_id,
            CycleDay.date >= start_date,
            CycleDay.date <= end_date,
        )
    )

    days: List[CycleDay] = []
    for offset in range(duration):
        cycle_date = start_date + timedelta(days=offset)
        day = CycleDay(
            patient_id=patient_id,
            date=cycle_date,
            flow_intensity=FlowIntensity.MEDIUM,
        )
        db.add(day)
        days.append(day)

    await db.flush()
    return days


async def _recalculate_cycle_lengths(db: AsyncSession, patient_id) -> None:
    cycles = await _get_actual_cycles(db, patient_id)
    for index, cycle in enumerate(cycles):
        next_cycle = cycles[index + 1] if index + 1 < len(cycles) else None
        cycle.cycle_length = (
            (next_cycle.start_date - cycle.start_date).days if next_cycle else None
        )
        cycle.end_date = _cycle_end(cycle)
        cycle.period_length = cycle.period_length or DEFAULT_PERIOD_LENGTH
    await db.flush()


def _find_correction_candidates(
    cycles: Sequence[MenstrualCycle],
    start_date: date,
) -> List[MenstrualCycle]:
    candidates: List[tuple[int, MenstrualCycle]] = []

    for cycle in cycles:
        gap = abs((cycle.start_date - start_date).days)
        if gap < MIN_CYCLE_GAP_DAYS:
            candidates.append((gap, cycle))

    candidates.sort(key=lambda item: item[0])
    return [cycle for _, cycle in candidates]


def _validate_gap_or_raise(
    cycles: Sequence[MenstrualCycle],
    start_date: date,
) -> List[MenstrualCycle]:
    correction_cycles = _find_correction_candidates(cycles, start_date)
    if correction_cycles:
        return correction_cycles

    return []


def _matching_exact_cycle(
    cycles: Sequence[MenstrualCycle],
    start_date: date,
    end_date: date,
    duration: int,
) -> Optional[MenstrualCycle]:
    for cycle in cycles:
        if (
            cycle.start_date == start_date
            and _cycle_end(cycle) == end_date
            and (cycle.period_length or DEFAULT_PERIOD_LENGTH) == duration
        ):
            return cycle
    return None


async def save_period_range(
    db: AsyncSession,
    patient_id,
    start_date: date,
    duration: int = DEFAULT_PERIOD_LENGTH,
) -> List[CycleDay]:
    duration = max(1, min(duration, MAX_PERIOD_LENGTH))
    end_date = start_date + timedelta(days=duration - 1)

    cycles = await _get_actual_cycles(db, patient_id)
    overlapping_cycles = [
        cycle
        for cycle in cycles
        if _ranges_overlap(cycle.start_date, _cycle_end(cycle), start_date, end_date)
    ]
    exact_match = _matching_exact_cycle(overlapping_cycles, start_date, end_date, duration)

    if exact_match:
        existing_days = await _get_cycle_days_in_range(db, patient_id, start_date, end_date)
        if len(existing_days) == duration:
            return existing_days
        return await _replace_cycle_days_range(db, patient_id, start_date, duration)

    remaining_cycles = [cycle for cycle in cycles if cycle not in overlapping_cycles]
    correction_cycles = _validate_gap_or_raise(remaining_cycles, start_date)
    overlapping_cycle_ids = {cycle.id for cycle in overlapping_cycles}
    replacement_cycles = overlapping_cycles + [
        cycle for cycle in correction_cycles if cycle.id not in overlapping_cycle_ids
    ]

    for cycle in replacement_cycles:
        cycle_end = _cycle_end(cycle)
        await db.execute(
            delete(CycleDay).where(
                CycleDay.patient_id == patient_id,
                CycleDay.date >= cycle.start_date,
                CycleDay.date <= cycle_end,
            )
        )

    if replacement_cycles:
        await db.execute(
            delete(MenstrualCycle).where(
                MenstrualCycle.id.in_([cycle.id for cycle in replacement_cycles])
            )
        )

    days = await _replace_cycle_days_range(db, patient_id, start_date, duration)

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

    await _recalculate_cycle_lengths(db, patient_id)
    return days


async def delete_cycle_days_range(
    db: AsyncSession,
    patient_id,
    start_date: date,
    end_date: date,
) -> None:
    cycles = await _get_actual_cycles(db, patient_id)
    overlapping_cycles = [
        cycle
        for cycle in cycles
        if _ranges_overlap(cycle.start_date, _cycle_end(cycle), start_date, end_date)
    ]

    if overlapping_cycles:
        for cycle in overlapping_cycles:
            cycle_end = _cycle_end(cycle)
            await db.execute(
                delete(CycleDay).where(
                    CycleDay.patient_id == patient_id,
                    CycleDay.date >= cycle.start_date,
                    CycleDay.date <= cycle_end,
                )
            )

        await db.execute(
            delete(MenstrualCycle).where(
                MenstrualCycle.id.in_([cycle.id for cycle in overlapping_cycles])
            )
        )
    else:
        await db.execute(
            delete(CycleDay).where(
                CycleDay.patient_id == patient_id,
                CycleDay.date >= start_date,
                CycleDay.date <= end_date,
            )
        )

    await _recalculate_cycle_lengths(db, patient_id)
    patient_user_id = await get_patient_user_id(db, patient_id)
    if patient_user_id:
        await create_notification(
            db,
            user_id=patient_user_id,
            role="patient",
            type="cycle.period.deleted",
            title="Period deleted",
            message=f"Your period entry from {start_date.isoformat()} to {end_date.isoformat()} was removed.",
            metadata={
                "patient_id": str(patient_id),
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            dedupe_key=build_notification_dedupe_key("cycle.period.deleted", patient_id, start_date, end_date),
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
    cycles = _normalize_cycles_for_read(list(result.scalars().all()))

    if not cycles:
        return None

    starts = sorted({c.start_date for c in cycles})

    if len(starts) >= 2:
        gaps = [(starts[i] - starts[i - 1]).days for i in range(1, len(starts))]
        avg_cycle_length = round(sum(gaps) / len(gaps))
    else:
        avg_cycle_length = DEFAULT_CYCLE_LENGTH

    period_lengths = [c.period_length for c in cycles if c.period_length]
    avg_period = (
        round(sum(period_lengths) / len(period_lengths))
        if period_lengths
        else DEFAULT_PERIOD_LENGTH
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
