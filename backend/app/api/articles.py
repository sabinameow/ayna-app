import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.auth.service import get_current_user
from backend.app.core.constants import UserRole
from backend.app.core.exceptions import ForbiddenException, NotFoundException
from backend.app.core.permissions import require_doctor_or_manager
from backend.app.database import get_db
from backend.app.models.article import Article
from backend.app.models.user import User
from backend.app.schemas.article import (
    ArticleCreate,
    ArticleListOut,
    ArticleOut,
    ArticleUpdate,
)
from backend.app.services.cycle_service import get_patient_by_user_id
from backend.app.services.subscription_service import has_active_subscription

router = APIRouter(prefix="/articles", tags=["Articles"])


@router.get("", response_model=list[ArticleListOut])
async def list_articles(
    category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    stmt = select(Article).order_by(Article.created_at.desc())
    if category:
        stmt = stmt.where(Article.category == category)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{article_id}", response_model=ArticleOut)
async def get_article(
    article_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise NotFoundException("Article not found")

    if current_user.role in (UserRole.DOCTOR, UserRole.MANAGER):
        return article

    if article.requires_subscription:
        patient = await get_patient_by_user_id(db, current_user.id)
        if not patient:
            raise ForbiddenException("Active subscription required")
        if not await has_active_subscription(db, patient.id):
            raise ForbiddenException(
                "Active subscription required to read this article"
            )

    return article


@router.post("", response_model=ArticleOut, status_code=201)
async def create_article(
    body: ArticleCreate,
    current_user: User = Depends(require_doctor_or_manager()),
    db: AsyncSession = Depends(get_db),
):
    article = Article(**body.model_dump())
    db.add(article)
    await db.flush()
    return article


@router.put("/{article_id}", response_model=ArticleOut)
async def update_article(
    article_id: uuid.UUID,
    body: ArticleUpdate,
    current_user: User = Depends(require_doctor_or_manager()),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise NotFoundException("Article not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(article, field, value)

    await db.flush()
    return article


@router.delete("/{article_id}", status_code=204)
async def delete_article(
    article_id: uuid.UUID,
    current_user: User = Depends(require_doctor_or_manager()),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise NotFoundException("Article not found")
    await db.delete(article)
    await db.flush()
    return None