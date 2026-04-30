from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.core.permissions import require_patient
from backend.app.core.exceptions import NotFoundException
from backend.app.schemas.cycle import (
    CycleCreate, CycleOut, CycleDayCreate, CycleDayOut, CyclePrediction,
    PeriodRangeCreate,
)
from backend.app.services.cycle_service import (
    get_patient_by_user_id, create_cycle, get_cycles,
    create_cycle_day, get_cycle_days, predict_next_cycle,
    delete_cycle_days_range, save_period_range,
)

router = APIRouter(prefix="/patient", tags=["Cycles"])


@router.post("/cycles", response_model=CycleOut, status_code=201)
async def add_cycle(
    body: CycleCreate,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    return await create_cycle(db, patient.id, body)


@router.get("/cycles", response_model=list[CycleOut])
async def list_cycles(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    return await get_cycles(db, patient.id)


@router.get("/cycles/predictions", response_model=CyclePrediction)
async def get_predictions(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    prediction = await predict_next_cycle(db, patient.id)
    if not prediction:
        raise NotFoundException("Not enough cycle data for prediction (need at least 2 cycles)")
    return prediction


@router.post("/period", response_model=list[CycleDayOut], status_code=201)
async def log_period(
    body: PeriodRangeCreate,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    return await save_period_range(db, patient.id, body.start_date, body.duration)


@router.post("/cycle-days", response_model=CycleDayOut, status_code=201)
async def add_cycle_day(
    body: CycleDayCreate,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    return await create_cycle_day(db, patient.id, body)


@router.delete("/cycle-days", status_code=204)
async def delete_cycle_days(
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    await delete_cycle_days_range(db, patient.id, start_date, end_date)


@router.get("/cycle-days", response_model=list[CycleDayOut])
async def list_cycle_days(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2030),
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    return await get_cycle_days(db, patient.id, month, year)