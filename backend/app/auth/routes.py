from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.user import User

from backend.app.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from backend.app.auth.service import (
    authenticate_user,
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_password_reset_token,
    decode_token,
    get_current_user,
    get_user_by_email,
    hash_password,
    register_user,
    verify_password,
)
from backend.app.auth.tasks import (
    send_password_reset_task,
    send_password_changed_notification_task,
)
from backend.app.core.exceptions import (
    BadRequestException,
    CredentialsException,
    NotFoundException,
)
from backend.app.services.notification_service import (
    build_notification_dedupe_key,
    create_notification,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await register_user(
        db=db,
        email=body.email,
        password=body.password,
        role="patient",
        full_name=body.full_name,
        phone=body.phone,
    )
    await create_notification(
        db,
        user_id=user.id,
        role="patient",
        type="auth.registered",
        title="Welcome to Ayna",
        message="Your account is ready. Start logging your cycle, symptoms, and mood.",
        metadata={"user_id": str(user.id)},
        dedupe_key=build_notification_dedupe_key("auth.registered", user.id),
    )
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.email, body.password)

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)

    if payload.get("type") != "refresh":
        raise CredentialsException("Invalid refresh token")

    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise CredentialsException("User not found or deactivated")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password")
async def forgot_password(
    body: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_by_email(db, body.email)

    if user:
        token = create_password_reset_token(user.id)
        send_password_reset_task.delay(user.email, token)

    return {"message": "If this email is registered, a password reset link has been sent"}


@router.post("/reset-password")
async def reset_password(body: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    user_id = decode_password_reset_token(body.token)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise NotFoundException("User not found")

    user.hashed_password = hash_password(body.new_password)
    await db.flush()

    return {"message": "Password has been reset successfully"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise BadRequestException("Current password is incorrect")

    current_user.hashed_password = hash_password(body.new_password)
    await db.flush()

    send_password_changed_notification_task.delay(current_user.email)

    return {"message": "Password changed successfully"}
