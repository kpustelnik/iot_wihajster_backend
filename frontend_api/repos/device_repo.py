from sqlite3 import IntegrityError

from sqlalchemy import select, distinct, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app_common.models import User, FamilyDevice, Family, FamilyMember
from app_common.models.device import Device
from app_common.schemas.default import LimitedResponse
from app_common.schemas.device import DeviceCreate


async def create_device(
    db: AsyncSession,
    device: DeviceCreate
):
    try:
        db_device = Device(**device.model_dump())
        db.add(db_device)
        await db.commit()
        await db.refresh(db_device)
        return db_device
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Database error: {str(e)}")


async def get_devices(
        db: AsyncSession,
        user: User,
        offset: int,
        limit: int
):
    count_query = (
        select(func.count(distinct(Device.id)))
        .join(FamilyDevice, Device.id == FamilyDevice.device_id)
        .join(Family, Family.id == FamilyDevice.family_id)
        .join(FamilyMember, FamilyMember.family_id == Family.id)
        .where(or_(
            FamilyMember.user_id == user.id,
            Family.user_id == user.id
        ))
    )

    query = (
        select(Device).distinct(Device.id)
        .join(FamilyDevice, Device.id == FamilyDevice.device_id)
        .join(Family, Family.id == FamilyDevice.family_id)
        .join(FamilyMember, FamilyMember.family_id == Family.id)
        .where(or_(
            FamilyMember.user_id == user.id,
            Family.user_id == user.id
        ))
        .order_by(Device.id)
        .offset(offset)
        .limit(limit)
    )

    count = await db.scalar(count_query)
    devices = (await db.scalars(query)).all()

    return LimitedResponse(
        offset=offset,
        limit=limit,
        total_count=count,
        content=[*devices]
    )
