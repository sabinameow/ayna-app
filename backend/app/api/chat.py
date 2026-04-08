import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db, AsyncSessionLocal
from backend.app.models.user import User
from backend.app.models.chat import ChatSession, ChatMessage
from backend.app.models.manager import Manager
from backend.app.core.permissions import require_patient, require_manager
from backend.app.core.exceptions import NotFoundException, ForbiddenException
from backend.app.schemas.chat import ChatSessionOut, ChatMessageOut
from backend.app.services.chat_service import (
    manager as connection_manager,
    get_or_create_session,
    save_message,
    close_session,
    get_session_messages,
)
from backend.app.services.cycle_service import get_patient_by_user_id
from backend.app.auth.service import decode_token


router = APIRouter(tags=["Chat"])


async def _get_user_from_token(token: str, db: AsyncSession) -> User:
    payload = decode_token(token)
    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("User not found")
    return user


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Token required")
        return

    async with AsyncSessionLocal() as db:
        try:
            user = await _get_user_from_token(token, db)
        except Exception:
            await websocket.close(code=4001, reason="Invalid token")
            return

        if user.role == "patient":
            patient = await get_patient_by_user_id(db, user.id)
            if not patient:
                await websocket.close(code=4003, reason="Patient profile not found")
                return
            try:
                session = await get_or_create_session(db, patient.id)
                await db.commit()
            except ValueError as e:
                await websocket.close(code=4003, reason=str(e))
                return
            session_id = str(session.id)

        elif user.role == "manager":
            session_id_param = websocket.query_params.get("session_id")
            if not session_id_param:
                await websocket.close(code=4002, reason="session_id required for manager")
                return
            session_id = session_id_param

        else:
            await websocket.close(code=4003, reason="Only patients and managers can chat")
            return

        await connection_manager.connect(session_id, str(user.id), websocket)

        try:
            while True:
                data = await websocket.receive_json()
                content = data.get("content", "").strip()
                if not content:
                    continue

                msg = await save_message(db, uuid.UUID(session_id), user.id, content)
                await db.commit()

                message_data = {
                    "id": str(msg.id),
                    "session_id": session_id,
                    "sender_id": str(user.id),
                    "content": content,
                    "sent_at": msg.sent_at.isoformat(),
                }


                await connection_manager.send_to_session(
                    session_id, str(user.id), message_data
                )

                await websocket.send_json(message_data)

        except WebSocketDisconnect:
            connection_manager.disconnect(session_id, str(user.id))



@router.get("/patient/chat/sessions", response_model=list[ChatSessionOut])
async def patient_sessions(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.patient_id == patient.id)
        .order_by(ChatSession.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/patient/chat/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
async def patient_session_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")

    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.patient_id == patient.id,
        )
    )
    if not result.scalar_one_or_none():
        raise NotFoundException("Session not found")

    return await get_session_messages(db, session_id)