from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.symptom import Symptom, PatientSymptom
from backend.app.core.permissions import require_patient
from backend.app.core.exceptions import NotFoundException
from backend.app.schemas.symptom import SymptomOut, PatientSymptomCreate, PatientSymptomOut
from backend.app.services.cycle_service import get_patient_by_user_id
from backend.app.services.notification_service import (
    build_notification_dedupe_key,
    create_notification,
)

router = APIRouter(prefix="/symptoms", tags=["Symptoms"])


@router.get("/symptoms", response_model=list[SymptomOut])
async def list_symptoms(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Symptom).order_by(Symptom.category, Symptom.name))
    return list(result.scalars().all())


@router.post("/patient/symptoms", response_model=PatientSymptomOut, status_code=201)
async def log_symptom(
    body: PatientSymptomCreate,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    entry = PatientSymptom(
        patient_id=patient.id,
        symptom_id=body.symptom_id,
        date=body.date,
        severity=body.severity,
        notes=body.notes,
    )
    db.add(entry)
    await db.flush()
    await create_notification(
        db,
        user_id=current_user.id,
        role="patient",
        type="symptom.saved",
        title="Saved successfully",
        message=f"Symptom data for {body.date.isoformat()} was saved.",
        metadata={"patient_symptom_id": str(entry.id), "patient_id": str(patient.id)},
        dedupe_key=build_notification_dedupe_key(
            "symptom.saved",
            patient.id,
            body.symptom_id,
            body.date,
        ),
    )
    return entry


@router.get("/patient/symptoms", response_model=list[PatientSymptomOut])
async def list_patient_symptoms(
    from_date: date = Query(None, alias="from"),
    to_date: date = Query(None, alias="to"),
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    query = select(PatientSymptom).where(PatientSymptom.patient_id == patient.id)
    if from_date:
        query = query.where(PatientSymptom.date >= from_date)
    if to_date:
        query = query.where(PatientSymptom.date <= to_date)

    result = await db.execute(query.order_by(PatientSymptom.date.desc()))
    return list(result.scalars().all())
