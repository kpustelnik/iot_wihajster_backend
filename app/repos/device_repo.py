import logging

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.models.measurement import Measurement
from app.schemas.device import DeviceSettings, DeviceData, DeviceUpdateModel
from app.schemas.measurement import MeasurementCreate

logger = logging.getLogger('uvicorn.error')


async def create_measurement(
        db: AsyncSession,
        device_data: DeviceData
) -> DeviceSettings:
    device_data_dict = device_data.model_dump()
    query = select(Device).where(Device.id == device_data.id)
    settings = await db.scalar(query)
    settings = DeviceSettings.model_validate(settings.to_dict())

    measurement = MeasurementCreate.model_validate(device_data_dict | {"device_id": device_data.id})
    measurement = Measurement(**measurement.model_dump())
    # TODO user can change settings but the device will override them, do it better
    device_update = DeviceUpdateModel.model_validate(device_data_dict)
    try:
        db.add(measurement)
        stmt = (update(Device).
                where(Device.id == device_data.id).
                values({k: v if v != "null" else None for k, v in device_update.model_dump().items()}))
        await db.execute(stmt)
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        logger.log(f"Database error: {e}")

    return settings
