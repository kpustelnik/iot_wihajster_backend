from datetime import datetime
import json
from sqlite3 import IntegrityError
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from math import cos, radians

from app_common.database import sessionmanager
from app_common.models.device import Device, PrivacyLevel
from app_common.models.family import FamilyDevice, FamilyMember, FamilyStatus
from app_common.models.measurement import Measurement
from app_common.models.user import User
from app_common.schemas.default import LimitedResponse
from app_common.schemas.device import DeviceModel
from app_common.schemas.measurement import MeasurementCreate

async def get_measurements(
        db: AsyncSession,
        device_id: Optional[int],
        family_id: Optional[int],
        time_from: Optional[datetime],
        time_to: Optional[datetime],
        lat: Optional[float],
        lon: Optional[float],
        radius_km: Optional[float],
        user: User,
        offset: int,
        limit: int
) -> LimitedResponse[DeviceModel]:
    
    family_ids_subq = select(FamilyMember.family_id).where(
        FamilyMember.user_id == user.id & FamilyMember.status == FamilyStatus.ACCEPTED
    ).scalar_subquery()

    # publiczne + własne + family
    query = (
        select(Measurement)
        .join(Device, Measurement.device_id == Device.id)
        .join(FamilyDevice, FamilyDevice.device_id == Measurement.device_id)
        .where((FamilyDevice.family_id.in_(family_ids_subq) & Device.privacy == PrivacyLevel.PROTECTED) 
               | 
               (Device.privacy == PrivacyLevel.PUBLIC))
        .offset(offset)
        .limit(limit)
    )

    if device_id is not None:
        query = query.where(Measurement.device_id == device_id)

    if family_id is not None:
        query = query.join(FamilyDevice, FamilyDevice.device_id == Measurement.device_id).where(FamilyDevice.family_id == family_id)

    if time_from is not None:
        query = query.where(Measurement.time >= time_from)
    if time_to is not None:
        query = query.where(Measurement.time <= time_to)

    def bbox_from_center(lat: float, lon: float, radius_km: float):
        lat_delta = radius_km / 111.0
        lon_delta = radius_km / (111.320 * cos(radians(lat)))
        return lat - lat_delta, lat + lat_delta, lon - lon_delta, lon + lon_delta

    if lat is not None and lon is not None and radius_km is not None:
        min_latitude, max_latitude, min_longitude, max_longitude = bbox_from_center(lat, lon, radius_km)
    else:
        min_latitude = max_latitude = min_longitude = max_longitude = None

    if min_latitude is not None:
        query = query.where(Measurement.latitude >= min_latitude)
    if max_latitude is not None:
        query = query.where(Measurement.latitude <= max_latitude)
    if min_longitude is not None:
        query = query.where(Measurement.longitude >= min_longitude)
    if max_longitude is not None:
        query = query.where(Measurement.longitude <= max_longitude)


    count_query = (
        select(func.count())
        .select_from(Measurement)
        .join(Device, Measurement.device_id == Device.id)
        .join(FamilyDevice, FamilyDevice.device_id == Measurement.device_id)
        .where((FamilyDevice.family_id.in_(family_ids_subq) & Device.privacy == PrivacyLevel.PROTECTED)
               |
               (Device.privacy == PrivacyLevel.PUBLIC))
    )

    if device_id is not None:
        count_query = count_query.where(Measurement.device_id == device_id)

    if family_id is not None:
        count_query = count_query.join(FamilyDevice, FamilyDevice.device_id == Measurement.device_id).where(FamilyDevice.family_id == family_id)

    if time_from is not None:
        count_query = count_query.where(Measurement.time >= time_from)
    if time_to is not None:
        count_query = count_query.where(Measurement.time <= time_to)

    if min_latitude is not None:
        count_query = count_query.where(Measurement.latitude >= min_latitude)
    if max_latitude is not None:
        count_query = count_query.where(Measurement.latitude <= max_latitude)
    if min_longitude is not None:
        count_query = count_query.where(Measurement.longitude >= min_longitude)
    if max_longitude is not None:
        count_query = count_query.where(Measurement.longitude <= max_longitude)


    total_count = await db.scalar(count_query) or 0

    query = query.order_by(Measurement.time.desc()).offset(offset).limit(limit)
    measurements = (await db.scalars(query)).all()

    return LimitedResponse(
        total_count=total_count,
        offset=offset,
        limit=limit,
        content=[*measurements]
    )



async def save_measurement(
        data: json, 
):
    db = sessionmanager.session()
    if db is None:
        raise Exception("DatabaseSessionManager is not initalized")

    device_data = MeasurementCreate.model_validate(data) 
        
    try:
        db_measurement = Measurement(**device_data)
        db.add(db_measurement)
        await db.commit()
        # nic nie zwracamy bo to nie do endpointa
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Database error: {str(e)}")