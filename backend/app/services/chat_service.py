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

    async def connect(self, session_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = {}
        self.active_connections[session_id][user_id] = websocket

    def disconnect(self, session_id: str, user_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].pop(user_id, None)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def send_to_session(self, session_id: str, sender_id: str, message: dict):
        if session_id in self.active_connections:
            for uid, ws in self.active_connections[session_id].items():
                if uid != sender_id:
                    await ws.send_json(message)


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