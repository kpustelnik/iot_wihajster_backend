from sqlite3 import IntegrityError
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app_common.models import User
from app_common.models.user import UserType
from app_common.schemas import UserModel
from app_common.schemas.default import LimitedResponse, Delete
from app_common.schemas.user import UserCreate


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    query = select(User).where(User.id == user_id)
    return await db.scalar(query)


async def get_user_by_login(db: AsyncSession, login: str) -> User | None:
    query = select(User).where(User.login == login)
    return await db.scalar(query)


async def get_users(
    db: AsyncSession, user: User, offset: int, limit: int
) -> LimitedResponse[UserModel]:
    count_query = select(func.count()).select_from(User)
    query = select(User).offset(offset).limit(limit)

    if user.type == UserType.CLIENT:
        count_query = count_query.where(User.type == UserType.CLIENT)
        query = query.where(User.type == UserType.CLIENT)

    count = await db.scalar(count_query)
    users = (await db.scalars(query)).all()
    return LimitedResponse(
        total_count=count, offset=offset, limit=limit, content=[*users]
    )


async def delete_user(db: AsyncSession, user_id: int) -> Delete:
    query = select(User).where(User.id == user_id)
    user = await db.scalar(query)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    await db.delete(user)
    await db.commit()
    return Delete(deleted=1, detail="Deleted user.")


async def create_user(db: AsyncSession, user: UserCreate) -> User:
    existing_user = await db.scalar(
        select(User).where((User.email == user.email) | (User.login == user.login))
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="User exists"
        )

    try:
        user_data = user.model_dump()
        user_data['type'] = UserType.CLIENT
        db_user = User(**user_data)
        db.add(db_user)
        await db.commit()
        return db_user
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Database error: {str(e)}")
