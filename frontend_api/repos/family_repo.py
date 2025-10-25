from sqlite3 import IntegrityError

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app_common.models.family import Family, FamilyMember, FamilyStatus
from app_common.models.user import User
from app_common.schemas.default import Delete
from app_common.schemas.family import FamilyCreate


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
        user_id: int,
        current_user: User
):    
    query = select(Family).where(
        (Family.id == family_id) & (Family.user_id == current_user.id)
        )
    main_user = await db.scalar(query)
    if main_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="You cant add member to this family fucker"
        )

    query = select(Family).where(Family.id == family_id)
    family = await db.scalar(query)
    if family is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Family not found"
        )
    
    query = select(User).where(User.id == user_id)
    user = await db.scalar(query)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    query = select(FamilyMember).where(
        (FamilyMember.family_id == family_id) & (FamilyMember.user_id == user_id)
    )
    user_in_family = await db.scalar(query)
    if user_in_family is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="User already in family"
        )

    try:
        db_family_member = FamilyMember(family_id=family_id, user_id=user_id, status=FamilyStatus.PENDING)
        db.add(db_family_member)
        await db.commit()
        return db_family_member
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Database error: {str(e)}")


async def delete_member(
        db: AsyncSession,
        family_id: int,
        user_id: int,
        current_user: User
):
    query = select(Family).where(
        (Family.id == family_id) & (Family.user_id == current_user.id)
        )
    main_user = await db.scalar(query)
    if main_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="You cant delete member from this family fucker"
        )
    
    query = select(Family).where(Family.id == family_id)
    family = await db.scalar(query)
    if family is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Family not found"
        )
    
    query = select(User).where(User.id == user_id)
    user = await db.scalar(query)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    
    query = select(FamilyMember).where(
        (FamilyMember.family_id == family_id) & (FamilyMember.user_id == user_id)
    )
    family_member = await db.scalar(query)
    if family_member is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="User not selected family"
        )
    
    try:
        await db.delete(family_member)
        await db.commit()
        return Delete(deleted=1, detail="Deleted family member.")
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Database error: {str(e)}")
