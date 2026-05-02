import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.constants import AppointmentStatus
from backend.app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from backend.app.models.appointment import Appointment, DoctorAvailabilitySlot, DoctorSchedule
from backend.app.models.doctor import Doctor
from backend.app.models.patient import Patient
from backend.app.models.symptom import Symptom
from backend.app.schemas.appointment import AppointmentOut, AvailableSlot
from backend.app.services.lab_recommendation_service import (
    get_lab_recommendations,
    normalize_lab_recommendation_records,
)
from backend.app.services.notification_service import (
    build_notification_dedupe_key,
    create_notification,
    list_manager_user_ids,
)


async def get_doctor_schedule(db: AsyncSession, doctor_id: uuid.UUID) -> list[DoctorSchedule]:
    result = await db.execute(
        select(DoctorSchedule)
        .where(DoctorSchedule.doctor_id == doctor_id)
        .order_by(DoctorSchedule.weekday)
    )
    return list(result.scalars().all())


def _validate_slot_range(start_time: time, end_time: time) -> None:
    if start_time >= end_time:
        raise BadRequestException("End time must be later than start time")


def _slot_scheduled_at(slot: DoctorAvailabilitySlot) -> datetime:
    return datetime.combine(slot.date, slot.start_time, tzinfo=timezone.utc)


async def list_doctor_availability(
    db: AsyncSession,
    doctor_id: uuid.UUID,
    target_date: date | None = None,
    include_booked: bool = True,
) -> list[DoctorAvailabilitySlot]:
    query = select(DoctorAvailabilitySlot).where(DoctorAvailabilitySlot.doctor_id == doctor_id)

    if target_date is not None:
        query = query.where(DoctorAvailabilitySlot.date == target_date)
    else:
        query = query.where(DoctorAvailabilitySlot.date >= date.today())

    if not include_booked:
        query = query.where(DoctorAvailabilitySlot.is_booked == False)

    result = await db.execute(
        query.order_by(DoctorAvailabilitySlot.date.asc(), DoctorAvailabilitySlot.start_time.asc())
    )
    return list(result.scalars().all())


async def get_available_slots(
    db: AsyncSession,
    doctor_id: uuid.UUID,
    target_date: date | None = None,
) -> list[AvailableSlot]:
    slots = await list_doctor_availability(
        db,
        doctor_id=doctor_id,
        target_date=target_date,
        include_booked=False,
    )
    return [
        AvailableSlot(
            id=slot.id,
            doctor_id=slot.doctor_id,
            date=slot.date,
            start_time=slot.start_time,
            end_time=slot.end_time,
        )
        for slot in slots
    ]


async def create_availability_slot(
    db: AsyncSession,
    doctor_id: uuid.UUID,
    slot_date: date,
    start_time: time,
    end_time: time,
) -> DoctorAvailabilitySlot:
    _validate_slot_range(start_time, end_time)

    exact_result = await db.execute(
        select(DoctorAvailabilitySlot).where(
            DoctorAvailabilitySlot.doctor_id == doctor_id,
            DoctorAvailabilitySlot.date == slot_date,
            DoctorAvailabilitySlot.start_time == start_time,
            DoctorAvailabilitySlot.end_time == end_time,
        )
    )
    existing_exact = exact_result.scalar_one_or_none()
    if existing_exact:
        return existing_exact

    overlap_result = await db.execute(
        select(DoctorAvailabilitySlot).where(
            DoctorAvailabilitySlot.doctor_id == doctor_id,
            DoctorAvailabilitySlot.date == slot_date,
            DoctorAvailabilitySlot.start_time < end_time,
            DoctorAvailabilitySlot.end_time > start_time,
        )
    )
    overlapping_slot = overlap_result.scalar_one_or_none()
    if overlapping_slot:
        raise ConflictException("This slot overlaps with an existing availability slot")

    slot = DoctorAvailabilitySlot(
        doctor_id=doctor_id,
        date=slot_date,
        start_time=start_time,
        end_time=end_time,
        is_booked=False,
    )
    db.add(slot)
    await db.flush()
    return slot


async def delete_availability_slot(
    db: AsyncSession,
    doctor_id: uuid.UUID,
    slot_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(DoctorAvailabilitySlot).where(
            DoctorAvailabilitySlot.id == slot_id,
            DoctorAvailabilitySlot.doctor_id == doctor_id,
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise NotFoundException("Availability slot not found")
    if slot.is_booked or slot.appointment_id is not None:
        raise BadRequestException("Booked slots cannot be deleted")

    await db.delete(slot)
    await db.flush()


def _parse_symptom_ids(symptom_ids: list[str] | None) -> list[uuid.UUID]:
    parsed_ids: list[uuid.UUID] = []
    for symptom_id in symptom_ids or []:
        try:
            parsed_ids.append(uuid.UUID(str(symptom_id)))
        except (ValueError, TypeError):
            continue
    return parsed_ids


async def get_symptom_names_by_ids(
    db: AsyncSession,
    symptom_ids: list[str] | None,
) -> list[str]:
    parsed_ids = _parse_symptom_ids(symptom_ids)
    if not parsed_ids:
        return []

    result = await db.execute(
        select(Symptom).where(Symptom.id.in_(parsed_ids)).order_by(Symptom.name.asc())
    )
    return [symptom.name for symptom in result.scalars().all()]


async def _get_appointment_context(
    db: AsyncSession,
    appointment: Appointment,
) -> tuple[Patient | None, Doctor | None]:
    patient_result = await db.execute(
        select(Patient).where(Patient.id == appointment.patient_id)
    )
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.id == appointment.doctor_id)
    )
    return patient_result.scalar_one_or_none(), doctor_result.scalar_one_or_none()


def _appointment_when(appointment: Appointment) -> str:
    return appointment.scheduled_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


async def serialize_appointments(
    db: AsyncSession,
    appointments: list[Appointment],
) -> list[AppointmentOut]:
    if not appointments:
        return []

    patient_ids = {appointment.patient_id for appointment in appointments}
    doctor_ids = {appointment.doctor_id for appointment in appointments}
    appointment_ids = {appointment.id for appointment in appointments}

    patient_result = await db.execute(select(Patient).where(Patient.id.in_(patient_ids)))
    patients = {patient.id: patient for patient in patient_result.scalars().all()}

    doctor_result = await db.execute(select(Doctor).where(Doctor.id.in_(doctor_ids)))
    doctors = {doctor.id: doctor for doctor in doctor_result.scalars().all()}

    slot_result = await db.execute(
        select(DoctorAvailabilitySlot).where(
            DoctorAvailabilitySlot.appointment_id.in_(appointment_ids)
        )
    )
    slots_by_appointment_id = {
        slot.appointment_id: slot
        for slot in slot_result.scalars().all()
        if slot.appointment_id is not None
    }

    symptom_names_by_appointment_id: dict[uuid.UUID, list[str]] = {}
    for appointment in appointments:
        symptom_names_by_appointment_id[appointment.id] = await get_symptom_names_by_ids(
            db,
            appointment.selected_symptom_ids,
        )

    serialized: list[AppointmentOut] = []
    for appointment in appointments:
        slot = slots_by_appointment_id.get(appointment.id)
        patient = patients.get(appointment.patient_id)
        doctor = doctors.get(appointment.doctor_id)
        lab_recommendations = normalize_lab_recommendation_records(appointment.required_tests) or None
        serialized.append(
            AppointmentOut(
                id=appointment.id,
                patient_id=appointment.patient_id,
                doctor_id=appointment.doctor_id,
                scheduled_at=appointment.scheduled_at,
                status=appointment.status,
                reason=appointment.reason,
                notes=appointment.notes,
                selected_symptom_ids=appointment.selected_symptom_ids,
                required_tests=lab_recommendations,
                symptom_names=symptom_names_by_appointment_id.get(appointment.id) or None,
                lab_recommendations=lab_recommendations,
                is_active=appointment.is_active,
                created_at=appointment.created_at,
                updated_at=appointment.updated_at,
                slot_id=slot.id if slot else None,
                slot_date=slot.date if slot else None,
                slot_start_time=slot.start_time if slot else None,
                slot_end_time=slot.end_time if slot else None,
                patient_name=patient.full_name if patient else None,
                doctor_name=doctor.full_name if doctor else None,
                doctor_specialization=doctor.specialization if doctor else None,
            )
        )
    return serialized


async def serialize_appointment(db: AsyncSession, appointment: Appointment) -> AppointmentOut:
    serialized = await serialize_appointments(db, [appointment])
    return serialized[0]


async def book_appointment_for_slot(
    db: AsyncSession,
    patient: Patient,
    slot_id: uuid.UUID,
    reason: str | None = None,
    notes: str | None = None,
    symptom_ids: list[uuid.UUID] | None = None,
) -> tuple[Appointment, bool]:
    slot_result = await db.execute(
        select(DoctorAvailabilitySlot)
        .where(DoctorAvailabilitySlot.id == slot_id)
        .with_for_update()
    )
    slot = slot_result.scalar_one_or_none()
    if not slot:
        raise NotFoundException("Availability slot not found")

    if slot.appointment_id is not None or slot.is_booked:
        existing_appointment = None
        if slot.appointment_id is not None:
            existing_result = await db.execute(
                select(Appointment).where(Appointment.id == slot.appointment_id)
            )
            existing_appointment = existing_result.scalar_one_or_none()
        if existing_appointment and existing_appointment.patient_id == patient.id:
            return existing_appointment, False
        raise ConflictException("This slot is already booked")

    scheduled_at = _slot_scheduled_at(slot)

    duplicate_result = await db.execute(
        select(Appointment).where(
            Appointment.patient_id == patient.id,
            Appointment.doctor_id == slot.doctor_id,
            Appointment.scheduled_at == scheduled_at,
            Appointment.status != AppointmentStatus.CANCELLED.value,
        )
    )
    duplicate = duplicate_result.scalar_one_or_none()
    if duplicate:
        slot.is_booked = True
        slot.appointment_id = duplicate.id
        await db.flush()
        return duplicate, False

    required_tests: list[dict] = []
    serialized_symptom_ids = [str(symptom_id) for symptom_id in (symptom_ids or [])]
    symptom_names = await get_symptom_names_by_ids(db, serialized_symptom_ids)
    if symptom_names:
        required_tests = get_lab_recommendations(symptom_names)

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=slot.doctor_id,
        scheduled_at=scheduled_at,
        status=AppointmentStatus.PENDING.value,
        reason=reason,
        notes=notes,
        selected_symptom_ids=serialized_symptom_ids or None,
        required_tests=required_tests or None,
        is_active=True,
    )
    db.add(appointment)
    await db.flush()

    slot.is_booked = True
    slot.appointment_id = appointment.id
    await db.flush()

    await notify_appointment_created(db, appointment)
    return appointment, True


async def release_appointment_slot(db: AsyncSession, appointment_id: uuid.UUID) -> None:
    slot_result = await db.execute(
        select(DoctorAvailabilitySlot)
        .where(DoctorAvailabilitySlot.appointment_id == appointment_id)
        .with_for_update()
    )
    slot = slot_result.scalar_one_or_none()
    if not slot:
        return

    slot.is_booked = False
    slot.appointment_id = None
    await db.flush()


async def cancel_appointment_record(
    db: AsyncSession,
    appointment: Appointment,
    actor_role: str,
) -> Appointment:
    appointment.status = AppointmentStatus.CANCELLED.value
    appointment.is_active = False
    await release_appointment_slot(db, appointment.id)
    await db.flush()
    await notify_appointment_cancelled(db, appointment, actor_role=actor_role)
    return appointment


async def update_appointment_status_record(
    db: AsyncSession,
    appointment: Appointment,
    status: AppointmentStatus,
    notes: str | None = None,
) -> Appointment:
    previous_status = appointment.status
    previous_scheduled_at = appointment.scheduled_at

    appointment.status = status.value
    if notes is not None:
        appointment.notes = notes
    appointment.is_active = status not in {
        AppointmentStatus.CANCELLED,
        AppointmentStatus.COMPLETED,
    }

    if status == AppointmentStatus.CANCELLED:
        await release_appointment_slot(db, appointment.id)

    await db.flush()
    await notify_appointment_updated(
        db,
        appointment,
        previous_status=previous_status,
        previous_scheduled_at=previous_scheduled_at,
    )
    return appointment


async def notify_appointment_created(db: AsyncSession, appointment: Appointment) -> None:
    patient, doctor = await _get_appointment_context(db, appointment)
    if patient:
        await create_notification(
            db,
            user_id=patient.user_id,
            role="patient",
            type="appointment.confirmed",
            title="Appointment booked",
            message=f"Your appointment is booked for {_appointment_when(appointment)}.",
            metadata={"appointment_id": str(appointment.id), "status": appointment.status},
            dedupe_key=build_notification_dedupe_key("appointment.patient.booked", appointment.id),
        )
    if doctor:
        await create_notification(
            db,
            user_id=doctor.user_id,
            role="doctor",
            type="appointment.new",
            title="New appointment request",
            message=f"A patient booked an appointment for {_appointment_when(appointment)}.",
            metadata={"appointment_id": str(appointment.id), "status": appointment.status},
            dedupe_key=build_notification_dedupe_key("appointment.doctor.booked", appointment.id),
        )

    manager_user_ids = await list_manager_user_ids(db)
    for manager_user_id in manager_user_ids:
        await create_notification(
            db,
            user_id=manager_user_id,
            role="manager",
            type="appointment.new",
            title="New appointment request",
            message=f"A new appointment was booked for {_appointment_when(appointment)}.",
            metadata={"appointment_id": str(appointment.id), "status": appointment.status},
            dedupe_key=build_notification_dedupe_key(
                "appointment.manager.booked",
                appointment.id,
                manager_user_id,
            ),
        )


async def notify_appointment_cancelled(
    db: AsyncSession,
    appointment: Appointment,
    actor_role: str,
) -> None:
    patient, doctor = await _get_appointment_context(db, appointment)
    base_metadata = {"appointment_id": str(appointment.id), "status": appointment.status}
    if patient:
        await create_notification(
            db,
            user_id=patient.user_id,
            role="patient",
            type="appointment.cancelled",
            title="Appointment cancelled",
            message=f"Your appointment on {_appointment_when(appointment)} was cancelled.",
            metadata=base_metadata,
            dedupe_key=build_notification_dedupe_key(
                "appointment.patient.cancelled",
                appointment.id,
                actor_role,
            ),
        )
    if doctor:
        await create_notification(
            db,
            user_id=doctor.user_id,
            role="doctor",
            type="appointment.cancelled",
            title="Appointment cancelled",
            message=f"An appointment on {_appointment_when(appointment)} was cancelled.",
            metadata=base_metadata,
            dedupe_key=build_notification_dedupe_key(
                "appointment.doctor.cancelled",
                appointment.id,
                actor_role,
            ),
        )

    manager_user_ids = await list_manager_user_ids(db)
    for manager_user_id in manager_user_ids:
        await create_notification(
            db,
            user_id=manager_user_id,
            role="manager",
            type="appointment.status_changed",
            title="Appointment cancelled",
            message=f"Appointment on {_appointment_when(appointment)} was cancelled.",
            metadata=base_metadata,
            dedupe_key=build_notification_dedupe_key(
                "appointment.manager.cancelled",
                appointment.id,
                actor_role,
                manager_user_id,
            ),
        )


async def notify_appointment_updated(
    db: AsyncSession,
    appointment: Appointment,
    previous_status: str | None = None,
    previous_scheduled_at: datetime | None = None,
) -> None:
    patient, doctor = await _get_appointment_context(db, appointment)
    changed_status = bool(previous_status and previous_status != appointment.status)
    changed_time = bool(
        previous_scheduled_at and previous_scheduled_at != appointment.scheduled_at
    )

    if appointment.status == AppointmentStatus.CANCELLED.value and changed_status:
        await notify_appointment_cancelled(db, appointment, actor_role="manager")
        return

    if changed_status and appointment.status == AppointmentStatus.CONFIRMED.value:
        metadata = {"appointment_id": str(appointment.id), "status": appointment.status}
        if patient:
            await create_notification(
                db,
                user_id=patient.user_id,
                role="patient",
                type="appointment.confirmed",
                title="Appointment confirmed",
                message=f"Your appointment for {_appointment_when(appointment)} was confirmed.",
                metadata=metadata,
                dedupe_key=build_notification_dedupe_key(
                    "appointment.patient.confirmed",
                    appointment.id,
                ),
            )
        if doctor:
            await create_notification(
                db,
                user_id=doctor.user_id,
                role="doctor",
                type="appointment.status_changed",
                title="Appointment confirmed",
                message=f"Appointment for {_appointment_when(appointment)} was confirmed.",
                metadata=metadata,
                dedupe_key=build_notification_dedupe_key(
                    "appointment.doctor.confirmed",
                    appointment.id,
                ),
            )
        return

    message_suffix = (
        f"Status changed to {appointment.status}."
        if changed_status
        else f"Now scheduled for {_appointment_when(appointment)}."
        if changed_time
        else "Details were updated."
    )
    metadata = {"appointment_id": str(appointment.id), "status": appointment.status}
    dedupe_base = build_notification_dedupe_key(
        "appointment.updated",
        appointment.id,
        appointment.status,
        appointment.scheduled_at,
    )

    if patient:
        await create_notification(
            db,
            user_id=patient.user_id,
            role="patient",
            type="appointment.updated",
            title="Appointment updated",
            message=f"Your appointment was updated. {message_suffix}",
            metadata=metadata,
            dedupe_key=f"{dedupe_base}:patient",
        )
    if doctor:
        await create_notification(
            db,
            user_id=doctor.user_id,
            role="doctor",
            type="appointment.updated",
            title="Appointment updated",
            message=f"An appointment was updated. {message_suffix}",
            metadata=metadata,
            dedupe_key=f"{dedupe_base}:doctor",
        )

    manager_user_ids = await list_manager_user_ids(db)
    for manager_user_id in manager_user_ids:
        await create_notification(
            db,
            user_id=manager_user_id,
            role="manager",
            type="appointment.status_changed",
            title="Appointment updated",
            message=f"Appointment updated. {message_suffix}",
            metadata=metadata,
            dedupe_key=f"{dedupe_base}:manager:{manager_user_id}",
        )
