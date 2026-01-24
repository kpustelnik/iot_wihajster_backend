from sqlalchemy.exc import IntegrityError

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


async def get_owned_devices(
        db: AsyncSession,
        user: User,
        offset: int,
        limit: int
):
    """Get devices directly owned by the user (via user_id field)"""
    count_query = (
        select(func.count(Device.id))
        .where(Device.user_id == user.id)
    )

    query = (
        select(Device)
        .where(Device.user_id == user.id)
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


async def get_devices(
        db: AsyncSession,
        user: User,
        offset: int,
        limit: int
):
    # Subquery for devices accessible through family membership
    family_devices_subquery = (
        select(FamilyDevice.device_id)
        .join(Family, Family.id == FamilyDevice.family_id)
        .join(FamilyMember, FamilyMember.family_id == Family.id)
        .where(or_(
            FamilyMember.user_id == user.id,
            Family.user_id == user.id
        ))
    )
    
    # Main query: devices owned directly OR accessible through family
    count_query = (
        select(func.count(distinct(Device.id)))
        .where(or_(
            Device.user_id == user.id,  # Directly owned by user
            Device.id.in_(family_devices_subquery)  # In user's family
        ))
    )

    query = (
        select(Device).distinct(Device.id)
        .where(or_(
            Device.user_id == user.id,  # Directly owned by user
            Device.id.in_(family_devices_subquery)  # In user's family
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
