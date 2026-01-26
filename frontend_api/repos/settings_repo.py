"""
Device Settings Repository

Repository for managing device settings including CRUD operations
and synchronization with devices.
"""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app_common.models.device import Device
from app_common.models.device_settings import DeviceSettings, SettingSyncStatus
from app_common.models.device_telemetry import DeviceTelemetry
from app_common.schemas.device_settings import DeviceSettingsUpdate, DeviceSettingsRead
from app_common.schemas.device_telemetry import DeviceTelemetryRead, DeviceTelemetrySummary

logger = logging.getLogger('uvicorn.error')


async def get_device_settings(
    db: AsyncSession,
    device_id: int
) -> Optional[DeviceSettings]:
    """
    Get device settings by device ID.
    Creates default settings if none exist.
    """
    query = select(DeviceSettings).where(DeviceSettings.device_id == device_id)
    settings = await db.scalar(query)
    
    if not settings:
        # Check if device exists
        device_query = select(Device).where(Device.id == device_id)
        device = await db.scalar(device_query)
        
        if not device:
            return None
        
        # Create default settings
        settings = DeviceSettings(device_id=device_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    
    return settings


async def get_device_settings_with_pending(
    db: AsyncSession,
    device_id: int
) -> Optional[DeviceSettingsRead]:
    """
    Get device settings with pending change information.
    """
    settings = await get_device_settings(db, device_id)
    
    if not settings:
        return None
    
    # Convert to Pydantic model with has_pending_changes
    settings_dict = settings.to_dict() if hasattr(settings, 'to_dict') else {
        c.name: getattr(settings, c.name) for c in settings.__table__.columns
    }
    settings_dict["has_pending_changes"] = settings.has_pending_changes()
    
    return DeviceSettingsRead.model_validate(settings_dict)


async def update_device_settings(
    db: AsyncSession,
    device_id: int,
    update_data: DeviceSettingsUpdate
) -> Optional[DeviceSettings]:
    """
    Update device settings by setting pending values.
    These will be synced to the device when it comes online.
    """
    settings = await get_device_settings(db, device_id)
    
    if not settings:
        return None
    
    update_dict = update_data.model_dump(exclude_unset=True)
    
    # Use the model's SETTING_FIELDS to build pending field mapping
    pending_field_mapping = {
        json_key: pending_field
        for _, pending_field, json_key in DeviceSettings.SETTING_FIELDS
    }
    
    updated = False
    for field, value in update_dict.items():
        if field in pending_field_mapping and value is not None:
            # Get the current field name from SETTING_FIELDS
            current_field = next(
                (cf for cf, pf, jk in DeviceSettings.SETTING_FIELDS if jk == field),
                field
            )
            # Only set pending if different from current
            current_value = getattr(settings, current_field, None)
            if current_value != value:
                setattr(settings, pending_field_mapping[field], value)
                updated = True
    
    if updated:
        settings.sync_status = SettingSyncStatus.PENDING_TO_DEVICE
        await db.commit()
        await db.refresh(settings)
        logger.info(f"Updated pending settings for device {device_id}")
    
    return settings


async def clear_pending_settings(
    db: AsyncSession,
    device_id: int
) -> Optional[DeviceSettings]:
    """
    Clear all pending settings for a device.
    """
    settings = await get_device_settings(db, device_id)
    
    if not settings:
        return None
    
    # Use the model's clear_all_pending method
    cleared = settings.clear_all_pending()
    
    if cleared:
        logger.info(f"Cleared pending settings for device {device_id}: {cleared}")
    
    settings.sync_status = SettingSyncStatus.SYNCED
    await db.commit()
    await db.refresh(settings)
    
    return settings


async def trigger_settings_sync(
    db: AsyncSession,
    device_id: int
) -> bool:
    """
    Manually trigger settings sync for a device.
    This publishes the current settings to the device via MQTT.
    """
    from app_common.utils.mqtt_handler import send_settings_sync
    
    settings = await get_device_settings(db, device_id)
    
    if not settings:
        return False
    
    await send_settings_sync(str(device_id))
    return True


# ===== Telemetry Repository Functions =====

async def get_latest_telemetry(
    db: AsyncSession,
    device_id: int
) -> Optional[DeviceTelemetry]:
    """
    Get the latest telemetry record for a device.
    """
    query = (
        select(DeviceTelemetry)
        .where(DeviceTelemetry.device_id == device_id)
        .order_by(DeviceTelemetry.received_at.desc())
        .limit(1)
    )
    return await db.scalar(query)


async def get_telemetry_history(
    db: AsyncSession,
    device_id: int,
    limit: int = 100,
    offset: int = 0
) -> list[DeviceTelemetry]:
    """
    Get telemetry history for a device.
    """
    query = (
        select(DeviceTelemetry)
        .where(DeviceTelemetry.device_id == device_id)
        .order_by(DeviceTelemetry.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_telemetry_summary(
    db: AsyncSession,
    device_id: int
) -> Optional[DeviceTelemetrySummary]:
    """
    Get a summary of the latest telemetry for a device.
    """
    telemetry = await get_latest_telemetry(db, device_id)
    
    if not telemetry:
        return None
    
    # Consider device online if last seen within 5 minutes
    is_online = False
    if telemetry.received_at:
        time_diff = datetime.utcnow() - telemetry.received_at
        is_online = time_diff.total_seconds() < 300
    
    return DeviceTelemetrySummary(
        device_id=device_id,
        serial_number=telemetry.serial_number,
        last_seen=telemetry.received_at,
        is_online=is_online,
        firmware_version=telemetry.firmware_version,
        wifi_connected=telemetry.wifi_connected,
        wifi_rssi=telemetry.wifi_rssi,
        mqtt_connected=telemetry.mqtt_connected,
        lte_connected=telemetry.lte_connected,
        battery_percent=telemetry.battery_percent,
        uptime_sec=telemetry.uptime_sec,
        boot_count=telemetry.boot_count,
        total_errors=telemetry.total_errors,
    )


async def cleanup_old_telemetry(
    db: AsyncSession,
    device_id: int,
    keep_count: int = 1000
) -> int:
    """
    Delete old telemetry records, keeping only the most recent ones.
    Returns the number of deleted records.
    """
    from sqlalchemy import delete, func
    
    # Get IDs to keep
    subquery = (
        select(DeviceTelemetry.id)
        .where(DeviceTelemetry.device_id == device_id)
        .order_by(DeviceTelemetry.received_at.desc())
        .limit(keep_count)
    )
    
    # Delete all others
    stmt = (
        delete(DeviceTelemetry)
        .where(
            and_(
                DeviceTelemetry.device_id == device_id,
                DeviceTelemetry.id.not_in(subquery)
            )
        )
    )
    
    result = await db.execute(stmt)
    await db.commit()
    
    return result.rowcount
