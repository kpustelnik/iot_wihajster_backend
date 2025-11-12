from sqlite3 import IntegrityError

from sqlalchemy.ext.asyncio import AsyncSession

from app_common.models.device import Device
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
