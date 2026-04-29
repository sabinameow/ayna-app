import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.doctor import Doctor
from backend.app.models.user import User
from backend.app.models.appointment import Appointment
from backend.app.core.permissions import require_patient
from backend.app.core.exceptions import NotFoundException, BadRequestException
from backend.app.schemas.appointment import (
    AppointmentCreate, AppointmentOut, AvailableSlot,
)
from backend.app.schemas.doctor import DoctorOut
from backend.app.services.cycle_service import get_patient_by_user_id
from backend.app.services.appointment_service import (
    get_available_slots, get_required_tests,
)

router = APIRouter(tags=["Appointments"])


@router.get("/doctors", response_model=list[DoctorOut])
async def list_available_doctors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Doctor)
        .where(Doctor.is_available == True)
        .order_by(Doctor.full_name.asc())
    )
    return list(result.scalars().all())


@router.get("/doctors/{doctor_id}/available-slots", response_model=list[AvailableSlot])
async def available_slots(
    doctor_id: uuid.UUID,
    date: date = Query(...),
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    return await get_available_slots(db, doctor_id, date)


@router.post("/patient/appointments", response_model=AppointmentOut, status_code=201)
async def book_appointment(
    body: AppointmentCreate,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")


    required_tests = []
    symptom_ids = body.selected_symptom_ids or []
    if symptom_ids:
        required_tests = await get_required_tests(db, [str(s) for s in symptom_ids])

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=body.doctor_id,
        scheduled_at=body.scheduled_at,
        reason=body.reason,
        notes=body.notes,
        selected_symptom_ids=[str(s) for s in symptom_ids],
        required_tests=required_tests,
    )
    db.add(appointment)
    await db.flush()
    return appointment


@router.get("/patient/appointments", response_model=list[AppointmentOut])
async def list_appointments(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    result = await db.execute(
        select(Appointment)
        .where(Appointment.patient_id == patient.id)
        .order_by(Appointment.scheduled_at.desc())
    )
    return list(result.scalars().all())


@router.delete("/patient/appointments/{appointment_id}", status_code=204)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.patient_id == patient.id,
        )
    )
    appointment = result.scalar_one_or_none()

    if not appointment:
        raise NotFoundException("Appointment not found")
    if appointment.status in ("cancelled", "completed"):
        raise BadRequestException("Cannot cancel this appointment")

    appointment.status = "cancelled"
    await db.flush()
