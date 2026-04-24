from __future__ import annotations

import asyncio
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.celery_app import celery_app
from backend.app.core.constants import CyclePhase
from backend.app.database import AsyncSessionLocal
from backend.app.models.patient import Patient
from backend.app.services.ai_service import (
    detect_current_phase,
    generate_phase_insight,
)
from backend.app.services.notification_service import create_notification
from backend.app.services.subscription_service import has_active_subscription


async def _run_daily_insights() -> dict:
    created = 0
    skipped_no_subscription = 0
    skipped_unknown_phase = 0

    async with AsyncSessionLocal() as db:  # type: AsyncSession
        patients_res = await db.execute(select(Patient))
        patients = list(patients_res.scalars().all())

        for patient in patients:
            if not await has_active_subscription(db, patient.id):
                skipped_no_subscription += 1
                continue

            phase, cycle_day = await detect_current_phase(db, patient)
            if phase is CyclePhase.UNKNOWN:
                skipped_unknown_phase += 1
                continue

            title, body = await generate_phase_insight(phase, cycle_day)
            await create_notification(
                db,
                user_id=patient.user_id,
                title=title,
                body=body,
            )
            created += 1

        await db.commit()

    return {
        "created": created,
        "skipped_no_subscription": skipped_no_subscription,
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

        if not await has_active_subscription(db, patient.id):
            return {"created": 0, "reason": "no_active_subscription"}

        phase, cycle_day = await detect_current_phase(db, patient)
        if phase is CyclePhase.UNKNOWN:
            return {"created": 0, "reason": "unknown_phase"}

        title, body = await generate_phase_insight(phase, cycle_day)
        await create_notification(
            db, user_id=patient.user_id, title=title, body=body
        )
        await db.commit()
        return {
            "created": 1,
            "phase": phase.value,
            "cycle_day": cycle_day,
        }