from __future__ import annotations

import asyncio
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.constants import CyclePhase
from backend.app.models.chat import ChatMessage, ChatSession
from backend.app.models.cycle import MenstrualCycle
from backend.app.models.patient import Patient


_GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
_gemini_model = None


def _get_model():
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        import google.generativeai as genai  # type: ignore
    except ImportError:
        return None

    genai.configure(api_key=api_key)
    _gemini_model = genai.GenerativeModel(_GEMINI_MODEL_NAME)
    return _gemini_model


async def _generate(prompt: str, fallback: str) -> str:
    """Run the prompt through Gemini off the event loop."""
    model = _get_model()
    if model is None:
        return fallback
    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = (getattr(response, "text", "") or "").strip()
        return text or fallback
    except Exception:
        return fallback



async def _get_latest_real_cycle(
    db: AsyncSession, patient_id: uuid.UUID
) -> Optional[MenstrualCycle]:
    result = await db.execute(
        select(MenstrualCycle)
        .where(
            MenstrualCycle.patient_id == patient_id,
            MenstrualCycle.is_predicted == False,
        )
        .order_by(MenstrualCycle.start_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _detect_phase_for_day(
    cycle_day: int, period_length: int, cycle_length: int
) -> CyclePhase:
    """Classic 4-phase model adapted to the patient's actual cycle length.

    Ovulation is assumed to occur at `cycle_length - 14`.  The fertile /
    ovulatory window is that day ±2.  Anything before it (after menses)
    is follicular, anything after it is luteal.
    """
    if cycle_day < 1 or cycle_day > cycle_length:
        return CyclePhase.UNKNOWN

    if cycle_day <= period_length:
        return CyclePhase.MENSTRUAL

    ovulation_day = max(1, cycle_length - 14)
    if ovulation_day - 2 <= cycle_day <= ovulation_day + 2:
        return CyclePhase.OVULATORY

    if cycle_day < ovulation_day - 2:
        return CyclePhase.FOLLICULAR
    return CyclePhase.LUTEAL


async def detect_current_phase(
    db: AsyncSession,
    patient: Patient,
    reference_date: Optional[date] = None,
) -> tuple[CyclePhase, Optional[int]]:
    """Return the patient's current cycle phase + day-of-cycle.

    Falls back to ``UNKNOWN`` when there is not enough data yet.
    """
    ref = reference_date or date.today()
    last_cycle = await _get_latest_real_cycle(db, patient.id)
    if not last_cycle:
        return CyclePhase.UNKNOWN, None

    cycle_length = (
        last_cycle.cycle_length
        or patient.average_cycle_length
        or 28
    )
    period_length = (
        last_cycle.period_length
        or patient.average_period_length
        or 5
    )

    days_since_start = (ref - last_cycle.start_date).days
    if days_since_start < 0:
        return CyclePhase.UNKNOWN, None

    cycle_day = (days_since_start % cycle_length) + 1
    return _detect_phase_for_day(cycle_day, period_length, cycle_length), cycle_day


_PHASE_FALLBACKS: dict[CyclePhase, tuple[str, str]] = {
    CyclePhase.MENSTRUAL: (
        "Menstrual phase",
        "Your period is here. Energy may be lower — rest, hydrate, and "
        "choose gentle movement like walking or stretching. Iron-rich "
        "foods can help with fatigue.",
    ),
    CyclePhase.FOLLICULAR: (
        "Follicular phase",
        "Estrogen is rising, so energy and mood usually lift. This is a "
        "good window for new workouts, creative work, and social plans.",
    ),
    CyclePhase.OVULATORY: (
        "Ovulation window",
        "You are near ovulation. You may notice increased libido, a slight "
        "temperature rise, or mild one-sided pelvic twinges. Fertility is "
        "at its peak during these days.",
    ),
    CyclePhase.LUTEAL: (
        "Luteal phase",
        "Progesterone is rising. You may feel bloated, crave sweets, or "
        "notice breast tenderness and mood shifts in the days before your "
        "period. Prioritise sleep and magnesium-rich foods.",
    ),
    CyclePhase.UNKNOWN: (
        "Keep logging your cycles",
        "We need at least one logged cycle to personalise insights. Add "
        "your last period on the calendar to unlock phase-based tips.",
    ),
}


def _phase_prompt(phase: CyclePhase, cycle_day: Optional[int]) -> str:
    day_str = f"day {cycle_day} of her cycle" if cycle_day else "an unknown cycle day"
    return (
        "You are a women's health assistant for a gynecology app. "
        "Write a short, warm notification (2-3 sentences, under 280 "
        f"characters) for a patient currently in the {phase.value} phase "
        f"({day_str}). Mention 1-2 common sensations for this phase and "
        "ONE practical self-care tip. Never give a diagnosis. Do not use "
        "emojis. Plain text only."
    )


async def generate_phase_insight(
    phase: CyclePhase, cycle_day: Optional[int] = None
) -> tuple[str, str]:
    """Return ``(title, body)`` suitable for a Notification row."""
    title, fallback_body = _PHASE_FALLBACKS[phase]
    if phase is CyclePhase.UNKNOWN:
        return title, fallback_body

    prompt = _phase_prompt(phase, cycle_day)
    body = await _generate(prompt, fallback_body)
    return title, body


async def _get_session_with_messages(
    db: AsyncSession, session_id: uuid.UUID
) -> tuple[Optional[ChatSession], list[ChatMessage]]:
    s_res = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = s_res.scalar_one_or_none()
    if session is None:
        return None, []

    m_res = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.sent_at)
    )
    return session, list(m_res.scalars().all())


def _format_chat_transcript(messages: list[ChatMessage]) -> str:
    if not messages:
        return "(empty conversation)"
    return "\n".join(
        f"[{m.sent_at:%Y-%m-%d %H:%M}] {str(m.sender_id)[:8]}: {m.content}"
        for m in messages
    )


async def summarize_chat_for_doctor(
    db: AsyncSession, session_id: uuid.UUID
) -> Optional[str]:
    """Generate a clinical summary and store it on the ChatSession row."""
    session, messages = await _get_session_with_messages(db, session_id)
    if session is None:
        return None

    transcript = _format_chat_transcript(messages)
    prompt = (
        "You are summarizing a patient-manager chat from a gynecology "
        "clinic for the treating doctor. Produce:\n"
        "  1. A 2-3 sentence clinical summary.\n"
        "  2. Key concerns raised by the patient.\n"
        "  3. Suggested follow-up actions for the doctor.\n"
        "Keep it professional and concise. Do not invent facts.\n\n"
        f"Transcript:\n{transcript}"
    )
    fallback = (
        f"Chat summary ({len(messages)} messages). Automated summary "
        "unavailable — please review the full transcript manually."
    )
    summary = await _generate(prompt, fallback)

    session.summary = summary
    await db.flush()
    return summary