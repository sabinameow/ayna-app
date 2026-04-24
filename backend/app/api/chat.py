import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db, AsyncSessionLocal
from backend.app.models.user import User
from backend.app.models.chat import ChatSession, ChatMessage
from backend.app.core.constants import UserRole
from backend.app.core.permissions import require_patient
from backend.app.core.exceptions import NotFoundException, ForbiddenException
from backend.app.schemas.chat import ChatSessionOut, ChatMessageOut
from backend.app.services.chat_service import (
    manager as connection_manager,
    get_or_create_session,
    save_message,
    get_session_messages,
)
from backend.app.services.cycle_service import get_patient_by_user_id
from backend.app.services.subscription_service import has_active_subscription
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

        if user.role == UserRole.PATIENT:
            patient = await get_patient_by_user_id(db, user.id)
            if not patient:
                await websocket.close(code=4003, reason="Patient profile not found")
                return
            if not await has_active_subscription(db, patient.id):
                await websocket.close(
                    code=4003, reason="Active subscription required"
                )
                return
            session = await get_or_create_session(db, patient.id)
            await db.commit()
        elif user.role == UserRole.MANAGER:
            session_id_str = websocket.query_params.get("session_id")
            if not session_id_str:
                await websocket.close(code=4002, reason="session_id required")
                return
            try:
                session_id = uuid.UUID(session_id_str)
            except ValueError:
                await websocket.close(code=4002, reason="Invalid session_id")
                return
            result = await db.execute(
                select(ChatSession).where(ChatSession.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session:
                await websocket.close(code=4004, reason="Session not found")
                return
        else:
            await websocket.close(code=4003, reason="Role not allowed")
            return

    await connection_manager.connect(str(session.id), str(user.id), websocket)
    try:
        while True:
            data = await websocket.receive_json()
            content = (data or {}).get("content", "").strip()
            if not content:
                continue

            async with AsyncSessionLocal() as db:
                msg = await save_message(db, session.id, user.id, content)
                await db.commit()

            await connection_manager.send_to_session(
                str(session.id),
                str(user.id),
                {
                    "id": str(msg.id),
                    "session_id": str(session.id),
                    "sender_id": str(user.id),
                    "content": content,
                    "sent_at": msg.sent_at.isoformat(),
                },
            )
    except WebSocketDisconnect:
        connection_manager.disconnect(str(session.id), str(user.id))



@router.get("/patient/chat/sessions", response_model=list[ChatSessionOut])
async def patient_list_sessions(
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    if not await has_active_subscription(db, patient.id):
        raise ForbiddenException("Active subscription required to access chat")

    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.patient_id == patient.id)
        .order_by(ChatSession.created_at.desc())
    )
    return list(result.scalars().all())


@router.get(
    "/patient/chat/sessions/{session_id}/messages",
    response_model=list[ChatMessageOut],
)
async def patient_session_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(require_patient()),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_user_id(db, current_user.id)
    if not patient:
        raise NotFoundException("Patient profile not found")
    if not await has_active_subscription(db, patient.id):
        raise ForbiddenException("Active subscription required to access chat")

    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session or session.patient_id != patient.id:
        raise NotFoundException("Session not found")

    return await get_session_messages(db, session_id)