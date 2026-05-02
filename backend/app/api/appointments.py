import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.exceptions import BadRequestException, NotFoundException
from backend.app.core.permissions import require_patient
from backend.app.database import get_db
from backend.app.models.appointment import Appointment
from backend.app.models.doctor import Doctor
from backend.app.models.user import User
from backend.app.schemas.appointment import AppointmentCreate, AppointmentOut, AvailableSlot
from backend.app.schemas.appointment import (
    LabRecommendationRequest,
    LabRecommendationResponse,
)
from backend.app.schemas.doctor import DoctorOut
from backend.app.services.lab_recommendation_service import DISCLAIMER, get_lab_recommendations
from backend.app.services.appointment_service import (
    book_appointment_for_slot,
    cancel_appointment_record,
    get_available_slots,
    serialize_appointment,
    serialize_appointments,
)
from backend.app.services.cycle_service import get_patient_by_user_id

router = APIRouter(tags=["Appointments"])


@router.get("/doctors", response_model=list[DoctorOut])
async def list_available_doctors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Doctor)
        .where(Doctor.is_available == True)
        .order_by(Doctor.full_name.asc())
    )
    return list(result.scalars().all())


@router.get("/patient/doctors", response_model=list[DoctorOut])
async def list_patient_doctors(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    _ = current_user
    return await list_available_doctors(db)


@router.get(
    "/doctors/{doctor_id}/available-slots",
    response_model=list[AvailableSlot],
)
async def available_slots(
    doctor_id: uuid.UUID,
    date: date = Query(...),
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    _ = current_user
    return await get_available_slots(db, doctor_id, date)


@router.get(
    "/patient/doctors/{doctor_id}/availability",
    response_model=list[AvailableSlot],
)
async def patient_doctor_availability(
    doctor_id: uuid.UUID,
    date: date = Query(...),
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    _ = current_user
    return await get_available_slots(db, doctor_id, date)


@router.post(
    "/patient/appointments/lab-recommendations",
    response_model=LabRecommendationResponse,
)
async def appointment_lab_recommendations(
    body: LabRecommendationRequest,
    current_user: User = Depends(require_patient()),
):
    _ = current_user
    return LabRecommendationResponse(
        recommendations=get_lab_recommendations(body.symptoms),
        disclaimer=DISCLAIMER,
    )


@router.post("/patient/appointments", response_model=AppointmentOut, status_code=201)
async def book_appointment(
    body: AppointmentCreate,
    response: Response,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    appointment, created = await book_appointment_for_slot(
        db,
        patient=patient,
        slot_id=body.slot_id,
        reason=body.reason,
        notes=body.notes,
        symptom_ids=body.selected_symptom_ids,
    )
    if not created:
        response.status_code = status.HTTP_200_OK
    return await serialize_appointment(db, appointment)


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
    return await serialize_appointments(db, list(result.scalars().all()))


@router.get("/patient/appointments/{appointment_id}", response_model=AppointmentOut)
async def get_patient_appointment(
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

    return await serialize_appointment(db, appointment)


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

    await cancel_appointment_record(db, appointment, actor_role="patient")
    return None
