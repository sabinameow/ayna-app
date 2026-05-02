import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.patient import Patient
from backend.app.models.mood import MoodEntry
from backend.app.models.cycle import MenstrualCycle
from backend.app.models.symptom import PatientSymptom
from backend.app.models.medication import Medication, MedicationLog
from backend.app.models.recommendation import DoctorRecommendation
from backend.app.models.appointment import Appointment
from backend.app.core.permissions import require_patient
from backend.app.core.exceptions import NotFoundException
from backend.app.schemas.mood import MoodCreate, MoodOut, MoodStats
from backend.app.schemas.medication import MedicationOut, MedicationLogCreate, MedicationLogOut
from backend.app.schemas.recommendation import RecommendationOut
from backend.app.schemas.patient import PatientOut, PatientProfileUpdate
from backend.app.services.cycle_service import get_patient_by_user_id
from backend.app.services.notification_service import (
    build_notification_dedupe_key,
    create_notification,
)


router = APIRouter(prefix="/patient", tags=["Patient"])


@router.get("/profile", response_model=PatientOut)
async def get_profile(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    return patient


@router.put("/profile", response_model=PatientOut)
async def update_profile(
    body: PatientProfileUpdate,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)

    await db.flush()
    return patient


@router.post("/mood", response_model=MoodOut, status_code=201)
async def add_mood(
    body: MoodCreate,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    existing_result = await db.execute(
        select(MoodEntry).where(
            MoodEntry.patient_id == patient.id,
            MoodEntry.date == body.date,
        )
    )
    existing_entry = existing_result.scalar_one_or_none()
    if existing_entry:
        return existing_entry

    entry = MoodEntry(
        patient_id=patient.id,
        date=body.date,
        mood=body.mood,
        energy_level=body.energy_level,
        stress_level=body.stress_level,
        sleep_quality=body.sleep_quality,
        notes=body.notes,
    )
    db.add(entry)
    await db.flush()
    await create_notification(
        db,
        user_id=current_user.id,
        role="patient",
        type="mood.saved",
        title="Saved successfully",
        message=f"Your mood entry for {body.date.isoformat()} was saved.",
        metadata={"mood_id": str(entry.id), "patient_id": str(patient.id)},
        dedupe_key=build_notification_dedupe_key("mood.saved", patient.id, body.date),
    )
    return entry


@router.get("/mood", response_model=list[MoodOut])
async def list_mood(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    query = select(MoodEntry).where(MoodEntry.patient_id == patient.id)
    if from_date:
        query = query.where(MoodEntry.date >= from_date)
    if to_date:
        query = query.where(MoodEntry.date <= to_date)
    result = await db.execute(query.order_by(MoodEntry.date))
    return list(result.scalars().all())


@router.get("/mood/stats", response_model=MoodStats)
async def mood_stats(
    from_date: date = Query(None, alias="from"),
    to_date: date = Query(None, alias="to"),
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    query = select(MoodEntry).where(MoodEntry.patient_id == patient.id)
    if from_date:
        query = query.where(MoodEntry.date >= from_date)
    if to_date:
        query = query.where(MoodEntry.date <= to_date)

    result = await db.execute(query)
    entries = list(result.scalars().all())

    if not entries:
        return MoodStats(
            total_entries=0,
            average_energy=0,
            average_stress=0,
            average_sleep=0,
            mood_distribution={},
        )

    mood_dist: dict[str, int] = {}
    for e in entries:
        mood_val = e.mood if isinstance(e.mood, str) else e.mood.value
        mood_dist[mood_val] = mood_dist.get(mood_val, 0) + 1

    return MoodStats(
        total_entries=len(entries),
        average_energy=round(sum(e.energy_level for e in entries) / len(entries), 1),
        average_stress=round(sum(e.stress_level for e in entries) / len(entries), 1),
        average_sleep=round(sum(e.sleep_quality for e in entries) / len(entries), 1),
        mood_distribution=mood_dist,
    )



@router.get("/medications", response_model=list[MedicationOut])
async def list_medications(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    result = await db.execute(
        select(Medication)
        .where(Medication.patient_id == patient.id)
        .order_by(Medication.start_date.desc())
    )
    return list(result.scalars().all())


@router.post("/medications/{medication_id}/log", response_model=MedicationLogOut, status_code=201)
async def log_medication(
    medication_id: uuid.UUID,
    body: MedicationLogCreate,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    result = await db.execute(
        select(Medication).where(
            Medication.id == medication_id,
            Medication.patient_id == patient.id,
        )
    )
    if not result.scalar_one_or_none():
        raise NotFoundException("Medication not found")

    existing_today = await db.execute(
        select(MedicationLog).where(
            MedicationLog.medication_id == medication_id,
            MedicationLog.patient_id == patient.id,
            MedicationLog.skipped.is_(False),
            func.date(MedicationLog.taken_at) == date.today(),
        )
    )
    existing_log = existing_today.scalar_one_or_none()
    if existing_log and not body.skipped:
        return existing_log

    log = MedicationLog(
        medication_id=medication_id,
        patient_id=patient.id,
        skipped=body.skipped,
        notes=body.notes,
    )
    db.add(log)
    await db.flush()
    await create_notification(
        db,
        user_id=current_user.id,
        role="patient",
        type="medication.logged",
        title="Saved successfully",
        message="Medication log saved.",
        metadata={"medication_log_id": str(log.id), "medication_id": str(medication_id)},
        dedupe_key=build_notification_dedupe_key("medication.logged", log.id),
    )
    return log


@router.get("/medications/{medication_id}/logs", response_model=list[MedicationLogOut])
async def list_medication_logs(
    medication_id: uuid.UUID,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    result = await db.execute(
        select(MedicationLog)
        .where(
            MedicationLog.medication_id == medication_id,
            MedicationLog.patient_id == patient.id,
        )
        .order_by(MedicationLog.taken_at.desc())
    )
    return list(result.scalars().all())


@router.get("/recommendations", response_model=list[RecommendationOut])
async def list_recommendations(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    result = await db.execute(
        select(DoctorRecommendation)
        .where(DoctorRecommendation.patient_id == patient.id)
        .order_by(DoctorRecommendation.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/progress")
async def get_progress(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    cycles = await db.execute(
        select(func.count()).where(MenstrualCycle.patient_id == patient.id)
    )
    symptoms = await db.execute(
        select(func.count()).where(PatientSymptom.patient_id == patient.id)
    )
    mood_entries = await db.execute(
        select(func.count()).where(MoodEntry.patient_id == patient.id)
    )
    medications = await db.execute(
        select(func.count()).where(
            Medication.patient_id == patient.id,
            Medication.is_active == True,
        )
    )
    appointments = await db.execute(
        select(func.count()).where(
            Appointment.patient_id == patient.id,
            Appointment.status == "completed",
        )
    )

    return {
        "total_cycles": cycles.scalar(),
        "total_symptoms_logged": symptoms.scalar(),
        "total_mood_entries": mood_entries.scalar(),
        "active_medications": medications.scalar(),
        "completed_appointments": appointments.scalar(),
    }
