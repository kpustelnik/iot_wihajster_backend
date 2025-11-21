from sqlite3 import IntegrityError

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app_common.models.device import Device, PrivacyLevel
from app_common.models.family import Family, FamilyDevice, FamilyMember, FamilyStatus
from app_common.models.measurement import Measurement
from app_common.models.user import User
from app_common.schemas.default import LimitedResponse
from app_common.schemas.device import DeviceModel
from app_common.schemas.measurement import CriteriaModel

async def get_measurements(
        db: AsyncSession,
        criteria: CriteriaModel,
        user: User,
        offset: int,
        limit: int
) -> LimitedResponse[DeviceModel]:
    
    # query = select(FamilyMember).where(
    #     (FamilyMember.family_id == family_id) & (FamilyMember.user_id == user.id) & (FamilyMember.status == FamilyStatus.ACCEPTED)
    # )
    # user = await db.scalar(query)
    # if user is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED, detail="User not in this family"
    #     )

    # query = select(Family).where(Family.id == family_id)
    # family = await db.scalar(query)
    # if family is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_404_NOT_FOUND, detail="Family not found"
    #     )

    # count_query = (
    #     select(func.count())
    #     .select_from(FamilyMember)
    #     .where(FamilyMember.family_id == family_id)
    # )

    # query = (
    #     select(User)
    #     .join(FamilyMember, User.id == FamilyMember.user_id)
    #     .where(FamilyMember.family_id == family_id)
    #     .order_by(User.id)
    #     .offset(offset)
    #     .limit(limit)
    # )

    # publiczne - niezalogowany
    # query = (
    #     select(Measurement)
    #     .join(Device, Measurement.device_id == Device.id)
    #     .where(Device.privacy == PrivacyLevel.PUBLIC)
    #     .offset(offset)
    #     .limit(limit)
    # )

    family_ids = (
        select(FamilyMember.family_id)
        .where(FamilyMember, FamilyMember.user_id == user.id)
    )

    # publiczne + własne + family
    query = (
        select(Measurement)
        .join(Device, Measurement.device_id == Device.id)
        .join(FamilyDevice, FamilyDevice.device_id == Measurement.device_id)
        .where((FamilyDevice.family_id.in_(family_ids) & Device.privacy == PrivacyLevel.PROTECTED) 
               | 
               (Device.privacy == PrivacyLevel.PUBLIC))
        .offset(offset)
        .limit(limit)
    )

    query = query.where()

    # count = await db.scalar(count_query)

    # users = (await db.scalars(query)).all()

    return LimitedResponse(
        # total_count=count, 
        offset=offset, 
        limit=limit, 
        # content=[*users]
    )
