import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.chat import ChatSession, ChatMessage
from backend.app.models.manager import Manager
from backend.app.models.patient import Patient
from backend.app.models.user import User
from backend.app.services.notification_service import (
    build_notification_dedupe_key,
    create_notification,
)


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, dict[str, WebSocket]] = {}

    async def register(self, session_id: str, user_id: str, websocket: WebSocket) -> Optional[WebSocket]:
        """Register an already-accepted socket. If the same (session,user) had a
        previous socket, return it so the caller can close it cleanly."""
        previous = self.active_connections.get(session_id, {}).get(user_id)
        self.active_connections.setdefault(session_id, {})[user_id] = websocket
        return previous

    async def connect(self, session_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        await self.register(session_id, user_id, websocket)

    def disconnect(self, session_id: str, user_id: str, websocket: Optional[WebSocket] = None):
        bucket = self.active_connections.get(session_id)
        if not bucket:
            return
        # Only remove if it is the same socket (avoid race where reconnect already replaced it)
        if websocket is None or bucket.get(user_id) is websocket:
            bucket.pop(user_id, None)
        if not bucket:
            self.active_connections.pop(session_id, None)

    async def send_to_session(self, session_id: str, message: dict):
        bucket = self.active_connections.get(session_id)
        if not bucket:
            return
        # Snapshot to be safe against mutation during iteration
        for ws in list(bucket.values()):
            try:
                await ws.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


async def get_or_create_session(
    db: AsyncSession, patient_id: uuid.UUID
) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.patient_id == patient_id,
            ChatSession.status == "active",
        )
    )
    session = result.scalar_one_or_none()
    if session:
        return session

    result = await db.execute(select(Manager).limit(1))
    mgr = result.scalar_one_or_none()
    if not mgr:
        raise ValueError("No managers available")

    session = ChatSession(
        patient_id=patient_id,
        manager_id=mgr.id,
        status="active",
    )
    db.add(session)
    await db.flush()
    await create_notification(
        db,
        user_id=mgr.user_id,
        role="manager",
        type="chat.new_request",
        title="New patient request",
        message="A patient started a new support chat.",
        metadata={"session_id": str(session.id), "patient_id": str(patient_id)},
        dedupe_key=build_notification_dedupe_key("chat.session.created", session.id, mgr.user_id),
        send_push=True,
    )
    return session


async def save_message(
    db: AsyncSession,
    session_id: uuid.UUID,
    sender_id: uuid.UUID,
    content: str,
) -> ChatMessage:
    msg = ChatMessage(
        session_id=session_id,
        sender_id=sender_id,
        content=content,
    )
    db.add(msg)
    await db.flush()

    session_result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    sender_result = await db.execute(select(User).where(User.id == sender_id))
    session = session_result.scalar_one_or_none()
    sender = sender_result.scalar_one_or_none()

    if session and sender:
        patient_result = await db.execute(
            select(Patient).where(Patient.id == session.patient_id)
        )
        manager_result = await db.execute(
            select(Manager).where(Manager.id == session.manager_id)
        )
        patient = patient_result.scalar_one_or_none()
        manager_profile = manager_result.scalar_one_or_none()

        if sender.role == "patient" and manager_profile:
            await create_notification(
                db,
                user_id=manager_profile.user_id,
                role="manager",
                type="chat.message.patient",
                title="New message from patient",
                message=content[:180],
                metadata={"session_id": str(session.id), "message_id": str(msg.id)},
                dedupe_key=build_notification_dedupe_key("chat.message", msg.id, manager_profile.user_id),
                send_push=True,
            )
        elif sender.role == "manager" and patient:
            await create_notification(
                db,
                user_id=patient.user_id,
                role="patient",
                type="chat.message.manager",
                title="New message from manager",
                message=content[:180],
                metadata={"session_id": str(session.id), "message_id": str(msg.id)},
                dedupe_key=build_notification_dedupe_key("chat.message", msg.id, patient.user_id),
                send_push=True,
            )
    return msg


async def close_session(
    db: AsyncSession, session_id: uuid.UUID, summary: Optional[str] = None
) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    session.status = "closed"
    session.closed_at = datetime.now(timezone.utc)
    session.summary = summary
    await db.flush()
    return session


async def get_session_messages(
    db: AsyncSession, session_id: uuid.UUID
) -> list[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.sent_at)
    )
    return list(result.scalars().all())
