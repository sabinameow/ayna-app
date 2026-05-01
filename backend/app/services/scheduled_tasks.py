from __future__ import annotations

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.celery_app import celery_app
from backend.app.core.constants import CyclePhase
from backend.app.models.appointment import Appointment
from backend.app.models.cycle import CycleDay
from backend.app.models.medication import Medication, MedicationLog
from backend.app.models.mood import MoodEntry
from backend.app.database import AsyncSessionLocal
from backend.app.models.patient import Patient
from backend.app.models.symptom import PatientSymptom
from backend.app.services.ai_service import (
    detect_current_phase,
    generate_phase_insight,
)
from backend.app.services.cycle_service import predict_next_cycle
from backend.app.services.notification_service import (
    build_notification_dedupe_key,
    create_notification,
    get_doctor_user_id,
)


async def _run_daily_insights() -> dict:
    created = 0
    skipped_unknown_phase = 0

    async with AsyncSessionLocal() as db:  # type: AsyncSession
        patients_res = await db.execute(select(Patient))
        patients = list(patients_res.scalars().all())

        for patient in patients:
            phase, cycle_day = await detect_current_phase(db, patient)
            if phase is CyclePhase.UNKNOWN:
                skipped_unknown_phase += 1
                continue

            title, body = await generate_phase_insight(phase, cycle_day)
            await create_notification(
                db,
                user_id=patient.user_id,
                role="patient",
                type="cycle.phase.insight",
                title=title,
                message=body,
                metadata={"patient_id": str(patient.id), "phase": phase.value, "cycle_day": cycle_day},
                dedupe_key=build_notification_dedupe_key("cycle.phase.insight", patient.id, date.today()),
            )
            created += 1

        await db.commit()

    return {
        "created": created,
        "skipped_unknown_phase": skipped_unknown_phase,
        "date": date.today().isoformat(),
    }


@celery_app.task(name="ayna.daily_phase_insights")
def daily_phase_insights() -> dict:
    return asyncio.run(_run_daily_insights())


async def _run_for_single_patient(patient_id: uuid.UUID) -> dict:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Patient).where(Patient.id == patient_id))
        patient = result.scalar_one_or_none()
        if patient is None:
            return {"created": 0, "reason": "patient_not_found"}

        phase, cycle_day = await detect_current_phase(db, patient)
        if phase is CyclePhase.UNKNOWN:
            return {"created": 0, "reason": "unknown_phase"}

        title, body = await generate_phase_insight(phase, cycle_day)
        await create_notification(
            db,
            user_id=patient.user_id,
            role="patient",
            type="cycle.phase.insight",
            title=title,
            message=body,
            metadata={"patient_id": str(patient.id), "phase": phase.value, "cycle_day": cycle_day},
            dedupe_key=build_notification_dedupe_key("cycle.phase.insight", patient.id, date.today()),
        )
        await db.commit()
        return {
            "created": 1,
            "phase": phase.value,
            "cycle_day": cycle_day,
        }


async def _run_predicted_period_reminders() -> dict:
    reminder_date = date.today() + timedelta(days=1)
    created = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Patient))
        patients = list(result.scalars().all())

        for patient in patients:
            prediction = await predict_next_cycle(db, patient.id)
            if not prediction or prediction.predicted_start_date != reminder_date:
                continue
            await create_notification(
                db,
                user_id=patient.user_id,
                role="patient",
                type="cycle.predicted_period.reminder",
                title="Predicted period starts tomorrow",
                message=f"Your next predicted period is expected on {prediction.predicted_start_date.isoformat()}.",
                metadata={"patient_id": str(patient.id), "predicted_start_date": prediction.predicted_start_date.isoformat()},
                dedupe_key=build_notification_dedupe_key("cycle.predicted_period.reminder", patient.id, prediction.predicted_start_date),
                send_push=True,
            )
            created += 1

        await db.commit()

    return {"created": created, "date": date.today().isoformat()}


@celery_app.task(name="ayna.predicted_period_reminders")
def predicted_period_reminders() -> dict:
    return asyncio.run(_run_predicted_period_reminders())


async def _run_medication_reminders() -> dict:
    today = date.today()
    created = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Medication).where(
                Medication.is_active == True,
                Medication.start_date <= today,
            )
        )
        medications = list(result.scalars().all())

        for medication in medications:
            if medication.end_date and medication.end_date < today:
                continue
            log_result = await db.execute(
                select(func.count(MedicationLog.id)).where(
                    MedicationLog.medication_id == medication.id,
                    func.date(MedicationLog.taken_at) == today,
                )
            )
            if int(log_result.scalar_one() or 0) > 0:
                continue

            patient_result = await db.execute(
                select(Patient).where(Patient.id == medication.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            if not patient:
                continue

            await create_notification(
                db,
                user_id=patient.user_id,
                role="patient",
                type="medication.reminder",
                title="Medication reminder",
                message=f"Don't forget to take {medication.name} today.",
                metadata={"medication_id": str(medication.id), "patient_id": str(patient.id)},
                dedupe_key=build_notification_dedupe_key("medication.reminder", medication.id, today),
                send_push=True,
            )
            created += 1

        await db.commit()

    return {"created": created, "date": today.isoformat()}


@celery_app.task(name="ayna.medication_reminders")
def medication_reminders() -> dict:
    return asyncio.run(_run_medication_reminders())


async def _run_appointment_reminders() -> dict:
    now = datetime.now(timezone.utc)
    created = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Appointment).where(Appointment.status.in_(["pending", "confirmed"]))
        )
        appointments = list(result.scalars().all())

        for appointment in appointments:
            delta = appointment.scheduled_at - now
            if delta.total_seconds() <= 0:
                continue

            reminder_type: str | None = None
            if delta <= timedelta(hours=1):
                reminder_type = "appointment.reminder.1h"
                title = "Appointment in 1 hour"
            elif delta <= timedelta(hours=24):
                reminder_type = "appointment.reminder.24h"
                title = "Appointment tomorrow"
            else:
                continue

            patient_result = await db.execute(
                select(Patient).where(Patient.id == appointment.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            doctor_user_id = await get_doctor_user_id(db, appointment.doctor_id)
            metadata = {
                "appointment_id": str(appointment.id),
                "scheduled_at": appointment.scheduled_at.isoformat(),
            }

            if patient:
                await create_notification(
                    db,
                    user_id=patient.user_id,
                    role="patient",
                    type=reminder_type,
                    title=title,
                    message=f"Your appointment is scheduled for {appointment.scheduled_at.strftime('%Y-%m-%d %H:%M UTC')}.",
                    metadata=metadata,
                    dedupe_key=build_notification_dedupe_key(reminder_type, appointment.id, patient.user_id),
                    send_push=True,
                )
                created += 1

            if doctor_user_id:
                await create_notification(
                    db,
                    user_id=doctor_user_id,
                    role="doctor",
                    type=reminder_type,
                    title=title,
                    message=f"An appointment is scheduled for {appointment.scheduled_at.strftime('%Y-%m-%d %H:%M UTC')}.",
                    metadata=metadata,
                    dedupe_key=build_notification_dedupe_key(reminder_type, appointment.id, doctor_user_id),
                    send_push=True,
                )
                created += 1

        await db.commit()

    return {"created": created, "date": now.date().isoformat()}


@celery_app.task(name="ayna.appointment_reminders")
def appointment_reminders() -> dict:
    return asyncio.run(_run_appointment_reminders())


async def _run_inactivity_reminders() -> dict:
    today = date.today()
    created = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Patient))
        patients = list(result.scalars().all())

        for patient in patients:
            latest_dates = []
            for model, field in (
                (CycleDay, CycleDay.date),
                (PatientSymptom, PatientSymptom.date),
                (MoodEntry, MoodEntry.date),
            ):
                latest_result = await db.execute(
                    select(func.max(field)).where(model.patient_id == patient.id)
                )
                latest = latest_result.scalar_one_or_none()
                if latest:
                    latest_dates.append(latest)

            if latest_dates and max(latest_dates) > today - timedelta(days=3):
                continue

            await create_notification(
                db,
                user_id=patient.user_id,
                role="patient",
                type="cycle.inactivity.reminder",
                title="Log your health data",
                message="It has been a few days since your last update. Add your cycle, symptoms, or mood to keep predictions accurate.",
                metadata={"patient_id": str(patient.id)},
                dedupe_key=build_notification_dedupe_key("cycle.inactivity.reminder", patient.id, today),
                send_push=True,
            )
            created += 1

        await db.commit()

    return {"created": created, "date": today.isoformat()}


@celery_app.task(name="ayna.inactivity_reminders")
def inactivity_reminders() -> dict:
    return asyncio.run(_run_inactivity_reminders())
