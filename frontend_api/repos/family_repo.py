from sqlite3 import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app_common.models.family import Family
from app_common.models.user import User
from app_common.schemas.family import FamilyCreate


async def create_family(
    db: AsyncSession, family: FamilyCreate, current_user: User
) -> Family:
    try:
        family_data = family.model_dump()
        family_data["user_id"] = current_user.id
        db_family = Family(**family_data)
        db.add(db_family)
        await db.commit()
        return db_family
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Database error: {str(e)}")


async def add_member(db: AsyncSession):
    pass
