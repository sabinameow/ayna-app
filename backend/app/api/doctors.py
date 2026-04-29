import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.doctor import Doctor
from backend.app.models.patient import Patient
from backend.app.models.appointment import Appointment, DoctorSchedule
from backend.app.models.cycle import MenstrualCycle
from backend.app.models.mood import MoodEntry
from backend.app.models.symptom import PatientSymptom
from backend.app.models.medication import Medication, MedicationLog
from backend.app.models.recommendation import DoctorRecommendation
from backend.app.core.permissions import require_doctor
from backend.app.core.exceptions import NotFoundException, ForbiddenException
from backend.app.schemas.doctor import DoctorOut, ScheduleOut, ScheduleUpdate
from backend.app.schemas.appointment import AppointmentOut
from backend.app.schemas.patient import PatientOut
from backend.app.schemas.cycle import CycleOut
from backend.app.schemas.symptom import PatientSymptomOut
from backend.app.schemas.mood import MoodOut
from backend.app.schemas.medication import MedicationCreate, MedicationOut, MedicationUpdate
from backend.app.schemas.recommendation import RecommendationCreate, RecommendationOut


router = APIRouter(prefix="/doctor", tags=["Doctor"])


async def _get_doctor(db: AsyncSession, user_id) -> Doctor:
    result = await db.execute(select(Doctor).where(Doctor.user_id == user_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise NotFoundException("Doctor profile not found")
    return doctor


async def _verify_my_patient(db: AsyncSession, doctor_id, patient_id) -> Patient:
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.doctor_id == doctor_id,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise ForbiddenException("This patient is not assigned to you")
    return patient


@router.get("/profile", response_model=DoctorOut)
async def get_profile(
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    return await _get_doctor(db, current_user.id)



@router.get("/patients", response_model=list[PatientOut])
async def list_patients(
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    result = await db.execute(
        select(Patient).where(Patient.doctor_id == doctor.id)
    )
    return list(result.scalars().all())


@router.get("/patients/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    return await _verify_my_patient(db, doctor.id, patient_id)


@router.get("/patients/{patient_id}/cycles", response_model=list[CycleOut])
async def get_patient_cycles(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    await _verify_my_patient(db, doctor.id, patient_id)
    result = await db.execute(
        select(MenstrualCycle)
        .where(MenstrualCycle.patient_id == patient_id)
        .order_by(MenstrualCycle.start_date.desc())
    )
    return list(result.scalars().all())


@router.get("/patients/{patient_id}/symptoms", response_model=list[PatientSymptomOut])
async def get_patient_symptoms(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    await _verify_my_patient(db, doctor.id, patient_id)
    result = await db.execute(
        select(PatientSymptom)
        .where(PatientSymptom.patient_id == patient_id)
        .order_by(PatientSymptom.date.desc())
    )
    return list(result.scalars().all())


@router.get("/patients/{patient_id}/mood", response_model=list[MoodOut])
async def get_patient_mood(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    await _verify_my_patient(db, doctor.id, patient_id)
    result = await db.execute(
        select(MoodEntry)
        .where(MoodEntry.patient_id == patient_id)
        .order_by(MoodEntry.date.desc())
    )
    return list(result.scalars().all())


@router.get("/patients/{patient_id}/medications", response_model=list[MedicationOut])
async def get_patient_medications(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    await _verify_my_patient(db, doctor.id, patient_id)
    result = await db.execute(
        select(Medication)
        .where(Medication.patient_id == patient_id)
        .order_by(Medication.start_date.desc())
    )
    return list(result.scalars().all())


@router.post("/patients/{patient_id}/medications", response_model=MedicationOut, status_code=201)
async def prescribe_medication(
    patient_id: uuid.UUID,
    body: MedicationCreate,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    await _verify_my_patient(db, doctor.id, patient_id)

    med = Medication(
        patient_id=patient_id,
        doctor_id=doctor.id,
        name=body.name,
        dosage=body.dosage,
        frequency=body.frequency,
        start_date=body.start_date,
        end_date=body.end_date,
        instructions=body.instructions,
        is_active=True,
    )
    db.add(med)
    await db.flush()
    return med


@router.put("/medications/{medication_id}", response_model=MedicationOut)
async def update_medication(
    medication_id: uuid.UUID,
    body: MedicationUpdate,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    result = await db.execute(
        select(Medication).where(
            Medication.id == medication_id,
            Medication.doctor_id == doctor.id,
        )
    )
    med = result.scalar_one_or_none()
    if not med:
        raise NotFoundException("Medication not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(med, field, value)

    await db.flush()
    return med


@router.post("/patients/{patient_id}/recommendations", response_model=RecommendationOut, status_code=201)
async def add_recommendation(
    patient_id: uuid.UUID,
    body: RecommendationCreate,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    await _verify_my_patient(db, doctor.id, patient_id)

    rec = DoctorRecommendation(
        doctor_id=doctor.id,
        patient_id=patient_id,
        content=body.content,
    )
    db.add(rec)
    await db.flush()
    return rec


@router.get(
    "/patients/{patient_id}/recommendations",
    response_model=list[RecommendationOut],
)
async def get_patient_recommendations(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    await _verify_my_patient(db, doctor.id, patient_id)
    result = await db.execute(
        select(DoctorRecommendation)
        .where(DoctorRecommendation.patient_id == patient_id)
        .order_by(DoctorRecommendation.created_at.desc())
    )
    return list(result.scalars().all())



@router.get("/patients/{patient_id}/progress")
async def get_patient_progress(
    patient_id: uuid.UUID,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    await _verify_my_patient(db, doctor.id, patient_id)

    cycles = await db.execute(
        select(func.count()).where(MenstrualCycle.patient_id == patient_id)
    )
    symptoms = await db.execute(
        select(func.count()).where(PatientSymptom.patient_id == patient_id)
    )
    mood_entries = await db.execute(
        select(func.count()).where(MoodEntry.patient_id == patient_id)
    )
    medications = await db.execute(
        select(func.count()).where(
            Medication.patient_id == patient_id,
            Medication.is_active == True,
        )
    )
    appointments = await db.execute(
        select(func.count()).where(
            Appointment.patient_id == patient_id,
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



@router.get("/schedule", response_model=list[ScheduleOut])
async def get_schedule(
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    result = await db.execute(
        select(DoctorSchedule)
        .where(DoctorSchedule.doctor_id == doctor.id)
        .order_by(DoctorSchedule.weekday)
    )
    return list(result.scalars().all())


@router.put("/schedule", response_model=list[ScheduleOut])
async def update_schedule(
    body: ScheduleUpdate,
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)

    result = await db.execute(
        select(DoctorSchedule).where(DoctorSchedule.doctor_id == doctor.id)
    )
    for old in result.scalars().all():
        await db.delete(old)

    new_schedules = []
    for slot in body.slots:
        s = DoctorSchedule(
            doctor_id=doctor.id,
            weekday=slot.weekday,
            start_time=slot.start_time,
            end_time=slot.end_time,
            slot_duration_minutes=slot.slot_duration_minutes,
        )
        db.add(s)
        new_schedules.append(s)

    await db.flush()
    return new_schedules



@router.get("/appointments", response_model=list[AppointmentOut])
async def list_doctor_appointments(
    current_user: User = Depends(require_doctor()),
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.id)
    result = await db.execute(
        select(Appointment)
        .where(Appointment.doctor_id == doctor.id)
        .order_by(Appointment.scheduled_at.desc())
    )
    return list(result.scalars().all())
