from datetime import datetime
import json
from sqlalchemy.exc import IntegrityError
from typing import Optional

from sqlalchemy import func, select, or_, and_, cast, String, Integer
from sqlalchemy.dialects.postgresql import INTERVAL
from sqlalchemy.ext.asyncio import AsyncSession
from math import cos, radians

from app_common.database import sessionmanager
from app_common.models.device import Device, PrivacyLevel
from app_common.models.family import FamilyDevice, FamilyMember, FamilyStatus
from app_common.models.measurement import Measurement
from app_common.models.ownership import Ownership
from app_common.models.user import User
from app_common.schemas.default import LimitedResponse
from app_common.schemas.device import DeviceModel
from app_common.schemas.measurement import MeasurementCreate, Timescale


async def get_measurements(
        db: AsyncSession,
        device_id: Optional[int],
        family_id: Optional[int],
        time_from: Optional[datetime],
        time_to: Optional[datetime],
        timescale: Optional[Timescale],
        lat: Optional[float],
        lon: Optional[float],
        radius_km: Optional[float],
        user: User,
        offset: int,
        limit: int
) -> LimitedResponse[DeviceModel]:
    family_ids_subq = select(FamilyMember.family_id).where(and_(
        FamilyMember.user_id == user.id,
        FamilyMember.status == FamilyStatus.ACCEPTED)
    ).scalar_subquery()

    # Pomiary przez Ownership - użytkownik widzi tylko swoje pomiary (przez aktywny ownership)
    # lub publiczne/protected przez family
    query = (
        select(Measurement)
        .join(Ownership, Measurement.ownership_id == Ownership.id)
        .join(Device, Ownership.device_id == Device.id)
        .outerjoin(FamilyDevice, FamilyDevice.device_id == Device.id)
        .where(or_(
            # Własne pomiary (użytkownik jest właścicielem ownership)
            Ownership.user_id == user.id,
            # Publiczne urządzenia
            Device.privacy == PrivacyLevel.PUBLIC,
            # Protected urządzenia z family użytkownika
            and_(
                FamilyDevice.family_id.in_(family_ids_subq),
                Device.privacy == PrivacyLevel.PROTECTED
            )
        ))
    )

    if device_id is not None:
        query = query.where(Ownership.device_id == device_id)

    if family_id is not None:
        query = query.where(FamilyDevice.family_id == family_id)

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
        .join(Ownership, Measurement.ownership_id == Ownership.id)
        .join(Device, Ownership.device_id == Device.id)
        .outerjoin(FamilyDevice, FamilyDevice.device_id == Device.id)
        .where(or_(
            Ownership.user_id == user.id,
            Device.privacy == PrivacyLevel.PUBLIC,
            and_(
                FamilyDevice.family_id.in_(family_ids_subq),
                Device.privacy == PrivacyLevel.PROTECTED
            )
        ))
    )

    if device_id is not None:
        count_query = count_query.where(Ownership.device_id == device_id)

    if family_id is not None:
        count_query = count_query.where(FamilyDevice.family_id == family_id)

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

    total_count = await db.scalar(count_query)

    if timescale is not None:
        # TODO total count is incorrect
        # TODO this is generated by chat and idk if it is correct
        # TODO maybe require selecting device_id?
        granularity_map = {
            Timescale.LIVE: "minute",    # 5 min, raw or 1-min buckets
            Timescale.HOUR: "minute",    # 1 hour, 1-min buckets
            Timescale.HOURS_6: "minute", # 6 hours, 5-min buckets
            Timescale.DAY: "hour",
            Timescale.WEEK: "day",
            Timescale.MONTH: "day",
            Timescale.YEAR: "month"
        }

        base_granularity = granularity_map[timescale]
        count_subq = query.with_only_columns(func.count()).scalar_subquery()

        # dynamic factor ensuring <= 500 buckets
        factor = func.greatest(1, count_subq / 500)

        # final time bucket = date_trunc(base) + n * interval
        # (cast(factor as integer) ensures whole buckets)
        bucket_granularity = func.concat(
            cast(func.ceil(factor), String),
            f" {base_granularity}"
        )

        bucket_time = func.date_trunc(
            base_granularity, Measurement.time
        ) + cast(func.ceil(factor), Integer) * func.cast(
            func.concat('1 ', base_granularity), INTERVAL
        )

        # Aggregate numeric values - używamy ownership_id i device_id przez join
        query = (
            select(
                Measurement.ownership_id.label("ownership_id"),
                Ownership.device_id.label("device_id"),
                bucket_time.label("time"),
                func.avg(Measurement.humidity).label("humidity"),
                func.avg(Measurement.temperature).label("temperature"),
                func.avg(Measurement.pressure).label("pressure"),
                func.avg(Measurement.PM25).label("PM25"),
                func.avg(Measurement.PM10).label("PM10"),
                func.avg(Measurement.longitude).label("longitude"),  # XD average longitude
                func.avg(Measurement.latitude).label("latitude"),
            )
            .select_from(Measurement)
            .join(Ownership, Measurement.ownership_id == Ownership.id)
            .where(query.whereclause)
            .group_by(bucket_time, Measurement.ownership_id, Ownership.device_id)
            .order_by(bucket_time.desc())
        )
        query = query.offset(offset).limit(limit)
        measurements = (await db.execute(query)).all()
    else:
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
