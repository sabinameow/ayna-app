import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.chat import ChatSession, ChatMessage
from backend.app.models.manager import Manager


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