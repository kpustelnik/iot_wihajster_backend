from sqlite3 import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app_common.models.family import Family, FamilyMember, FamilyStatus
from app_common.models.user import User
from app_common.schemas.family import FamilyCreate, FamilyMemberModel
from sqlalchemy import select


async def create_family(
        db: AsyncSession,
        family: FamilyCreate,
        current_user: User
):
    try:
        db_family = Family(**family.model_dump(), user_id=current_user.id)
        db.add(db_family)
        await db.commit()
        return db_family
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Database error: {str(e)}")


async def add_member(
        db: AsyncSession,
        family_id: int,
        user_id: int
):
    query = select(Family).where(Family.id == family_id)
    family = await db.scalar(query)
    if family is None:
        raise ValueError("Family does not exist")  # TODO value error is 500, we want better error, 404 Not Found

    query = select(User).where(User.id == user_id)
    user = await db.scalar(query)
    if user is None:
        raise ValueError("User does not exists")

    query = select(FamilyMember).where(
        (FamilyMember.family_id == family_id) & (FamilyMember.user_id == user_id)
    )
    user_in_family = await db.scalar(query)
    if user_in_family is not None:
        raise ValueError("User already in family")  # TODO 422

    try:
        db_family_member = FamilyMember(family_id=family_id, user_id=user_id, status=FamilyStatus.PENDING)
        db.add(db_family_member)
        await db.commit()
        return db_family_member
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Database error: {str(e)}")
