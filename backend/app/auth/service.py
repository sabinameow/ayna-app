import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.core.exceptions import (
    BadRequestException,
    ConflictException,
    CredentialsException, ForbiddenException,
)
from backend.app.database import get_db
from backend.app.models.user import User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        raise CredentialsException("Invalid or expired token")


def create_verification_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    payload = {
        "sub": str(user_id),
        "type": "email_verification",
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_verification_token(token: str) -> uuid.UUID:
    payload = decode_token(token)
    if payload.get("type") != "email_verification":
        raise BadRequestException("Invalid verification token")
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise BadRequestException("Invalid verification token")


def create_password_reset_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=30)
    payload = {
        "sub": str(user_id),
        "type": "password_reset",
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_password_reset_token(token: str) -> uuid.UUID:
    payload = decode_token(token)
    if payload.get("type") != "password_reset":
        raise BadRequestException("Invalid password reset token")
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise BadRequestException("Invalid password reset token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise CredentialsException("Invalid token type")

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise CredentialsException()

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise CredentialsException("User not found")
    if not user.is_active:
        raise CredentialsException("Account is deactivated")

    return user


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_phone(db: AsyncSession, phone: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.phone == phone))
    return result.scalar_one_or_none()


async def register_user(
    db: AsyncSession,
    email: str,
    password: str,
    role: str,
    full_name: str,
    phone: Optional[str] = None,
) -> User:

    if role != "patient":
        raise ForbiddenException("Only patient registration is allowed")

    existing = await get_user_by_email(db, email)

    if existing:
        raise ConflictException("Email is already registered")

    if phone:
        existing_phone = await get_user_by_phone(db, phone)
        if existing_phone:
            raise ConflictException("Phone number is already registered")

    user = User(
        email=email,
        phone=phone,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    await _create_role_profile(db, user, full_name)

    return user


async def _create_role_profile(db: AsyncSession, user: User, full_name: str):
    from backend.app.models.patient import Patient
    from backend.app.models.doctor import Doctor
    from backend.app.models.manager import Manager

    if user.role == "patient":
        db.add(Patient(user_id=user.id, full_name=full_name))
    elif user.role == "doctor":
        db.add(Doctor(user_id=user.id, full_name=full_name))
    elif user.role == "manager":
        db.add(Manager(user_id=user.id, full_name=full_name))

    await db.flush()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise CredentialsException("Invalid email or password")
    if not user.is_active:
        raise CredentialsException("Account is deactivated")
    return user