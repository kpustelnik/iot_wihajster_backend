import logging

from sqlalchemy import select, update, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app_common.models.device import Device
from app_common.models.measurement import Measurement
from app_common.models.ownership import Ownership
from app_common.schemas.device import DeviceSettings
from app_common.schemas.measurement import MeasurementCreate

from device_api.schemas.device import DeviceUpdateModel, DeviceData

logger = logging.getLogger('uvicorn.error')


async def get_active_ownership(db: AsyncSession, device_id: int) -> Ownership | None:
    """Pobiera aktywny ownership dla urządzenia"""
    query = select(Ownership).where(
        and_(
            Ownership.device_id == device_id,
            Ownership.is_active == True
        )
    )
    return await db.scalar(query)


async def create_measurement(
        db: AsyncSession,
        device_data: DeviceData
) -> DeviceSettings:
    device_data_dict = device_data.model_dump()
    query = select(Device).where(Device.id == device_data.id)
    settings = await db.scalar(query)
    settings = DeviceSettings.model_validate(settings.to_dict())

    # Pobierz aktywny ownership dla urządzenia
    ownership = await get_active_ownership(db, device_data.id)
    if ownership is None:
        logger.warning(f"No active ownership found for device {device_data.id}, skipping measurement")
        return settings

    measurement_data = device_data_dict.copy()
    measurement_data["ownership_id"] = ownership.id
    measurement = MeasurementCreate.model_validate(measurement_data)
    measurement = Measurement(**measurement.model_dump())
    
    try:
        db.add(measurement)
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        logger.log(0, f"Database error: {e}")  # FIXME why does it need level?

    return settings
