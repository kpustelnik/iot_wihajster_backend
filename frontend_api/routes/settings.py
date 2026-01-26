"""
Device Settings Routes

API endpoints for managing device settings and telemetry.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status
from typing import Optional

from app_common.database import get_db
from app_common.models.user import UserType, User
from app_common.schemas.device_settings import (
    DeviceSettingsRead,
    DeviceSettingsUpdate,
)
from app_common.schemas.device_telemetry import (
    DeviceTelemetryRead,
    DeviceTelemetrySummary,
)
from app_common.schemas.default import LimitedResponse

from frontend_api.docs import Tags
from frontend_api.repos import settings_repo
from frontend_api.utils.auth.auth import RequireUser

router = APIRouter(
    prefix="/devices",
    tags=[Tags.Device],
    responses={}
)


# ===== Device Settings Endpoints =====

@router.get(
    "/{device_id}/settings",
    response_model=DeviceSettingsRead,
    status_code=status.HTTP_200_OK,
    summary="Get device settings",
    response_description="Device settings with pending changes",
)
async def get_device_settings(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Get settings for a device including any pending changes.
    
    Returns both current values and pending values that will be
    synced to the device when it comes online.
    """
    settings = await settings_repo.get_device_settings_with_pending(db, device_id)
    
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found"
        )
    
    return settings


@router.patch(
    "/{device_id}/settings",
    response_model=DeviceSettingsRead,
    status_code=status.HTTP_200_OK,
    summary="Update device settings",
    response_description="Updated device settings",
)
async def update_device_settings(
    device_id: int,
    update_data: DeviceSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Update device settings.
    
    Changes are stored as pending values and will be synced to the
    device when it comes online. The device will acknowledge the
    changes and they will be applied.
    
    Only values that differ from current settings will be marked as pending.
    """
    settings = await settings_repo.update_device_settings(db, device_id, update_data)
    
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found"
        )
    
    # Return updated settings with pending info
    return await settings_repo.get_device_settings_with_pending(db, device_id)


@router.post(
    "/{device_id}/settings/sync",
    status_code=status.HTTP_200_OK,
    summary="Trigger settings sync",
    response_description="Sync triggered",
)
async def trigger_settings_sync(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Manually trigger settings synchronization for a device.
    
    This will publish the current settings to the device via MQTT.
    Useful if the device missed the initial sync when it came online.
    """
    success = await settings_repo.trigger_settings_sync(db, device_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found or settings could not be synced"
        )
    
    return {"message": "Settings sync triggered", "device_id": device_id}


@router.delete(
    "/{device_id}/settings/pending",
    response_model=DeviceSettingsRead,
    status_code=status.HTTP_200_OK,
    summary="Clear pending settings",
    response_description="Settings with pending cleared",
)
async def clear_pending_settings(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Clear all pending settings for a device.
    
    This removes any pending changes that haven't been synced yet.
    """
    settings = await settings_repo.clear_pending_settings(db, device_id)
    
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found"
        )
    
    return await settings_repo.get_device_settings_with_pending(db, device_id)


# ===== Device Telemetry Endpoints =====

@router.get(
    "/{device_id}/telemetry",
    response_model=DeviceTelemetryRead,
    status_code=status.HTTP_200_OK,
    summary="Get latest device telemetry",
    response_description="Latest telemetry data",
)
async def get_device_telemetry(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Get the latest telemetry data for a device.
    
    Includes system info, connectivity status, sensor stats,
    power info, and error counts.
    """
    telemetry = await settings_repo.get_latest_telemetry(db, device_id)
    
    if not telemetry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No telemetry found for device {device_id}"
        )
    
    return DeviceTelemetryRead.model_validate(telemetry)


@router.get(
    "/{device_id}/telemetry/summary",
    response_model=DeviceTelemetrySummary,
    status_code=status.HTTP_200_OK,
    summary="Get device telemetry summary",
    response_description="Telemetry summary",
)
async def get_device_telemetry_summary(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Get a summary of the device's telemetry.
    
    Provides quick status info including online status,
    connectivity, battery level, and error counts.
    """
    summary = await settings_repo.get_telemetry_summary(db, device_id)
    
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No telemetry found for device {device_id}"
        )
    
    return summary


@router.get(
    "/{device_id}/telemetry/history",
    response_model=list[DeviceTelemetryRead],
    status_code=status.HTTP_200_OK,
    summary="Get device telemetry history",
    response_description="Telemetry history",
)
async def get_device_telemetry_history(
    device_id: int,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Get telemetry history for a device.
    
    Returns historical telemetry records ordered by most recent first.
    """
    telemetry_list = await settings_repo.get_telemetry_history(
        db, device_id, limit=limit, offset=offset
    )
    
    return [DeviceTelemetryRead.model_validate(t) for t in telemetry_list]
