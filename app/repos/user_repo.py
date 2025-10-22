from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


async def get_user(
        db: AsyncSession,
        user_id: int
) -> User | None:
    query = select(User).where(User.id == user_id)
    return await db.scalar(query)


async def get_user_by_login(
        db: AsyncSession,
        login: str
) -> User | None:
    query = select(User).where(User.login == login)
    return await db.scalar(query)
