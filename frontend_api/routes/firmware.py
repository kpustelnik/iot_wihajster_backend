"""
Router do zarządzania firmware i aktualizacji OTA.
Umożliwia upload nowych wersji firmware i dystrybucję na urządzenia.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from starlette import status
from typing import List, Optional
import os
import hashlib
from datetime import datetime
import logging

from app_common.database import get_db
from app_common.models.user import UserType, User
from app_common.models.device import Device
from frontend_api.docs import Tags
from frontend_api.utils.auth.auth import RequireUser

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/firmware",
    tags=[Tags.Device],
    responses={}
)

# Directory to store firmware files
FIRMWARE_DIR = "/certs/firmware"  # Using certs volume for persistence
os.makedirs(FIRMWARE_DIR, exist_ok=True)


class FirmwareInfo(BaseModel):
    """Informacje o firmware"""
    version: str
    filename: str
    size: int
    sha256: str
    upload_date: str
    chip_type: str = "esp32c6"
    url: Optional[str] = None


class FirmwareListResponse(BaseModel):
    """Lista dostępnych firmware"""
    firmwares: List[FirmwareInfo]
    count: int


class OtaDeployRequest(BaseModel):
    """Request do deploymentu OTA"""
    device_id: int = Field(..., description="ID urządzenia")
    version: str = Field(..., description="Wersja firmware do wgrania")


# In-memory storage for firmware metadata (in production use DB)
firmware_registry = {}


@router.post(
    "/upload",
    response_model=FirmwareInfo,
    status_code=status.HTTP_201_CREATED,
    summary="Upload new firmware",
)
async def upload_firmware(
    version: str = Form(..., description="Wersja firmware (np. 1.0.0)"),
    chip_type: str = Form(default="esp32c6", description="Typ chipa (esp32, esp32c6, esp32s3)"),
    file: UploadFile = File(..., description="Plik binary firmware (.bin)"),
    current_user: User = Depends(RequireUser([UserType.ADMIN])),
):
    """
    Upload nowej wersji firmware.
    Tylko dla administratorów.
    """
    if not file.filename.endswith('.bin'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firmware file must have .bin extension"
        )
    
    # Check if version already exists
    if version in firmware_registry:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Firmware version {version} already exists"
        )
    
    # Read file content
    content = await file.read()
    
    # Calculate SHA256 hash
    sha256_hash = hashlib.sha256(content).hexdigest()
    
    # Save file
    filename = f"firmware_{chip_type}_{version.replace('.', '_')}.bin"
    filepath = os.path.join(FIRMWARE_DIR, filename)
    
    with open(filepath, 'wb') as f:
        f.write(content)
    
    logger.info(f"Firmware {version} uploaded: {filepath} ({len(content)} bytes)")
    
    # Register firmware
    firmware_info = FirmwareInfo(
        version=version,
        filename=filename,
        size=len(content),
        sha256=sha256_hash,
        upload_date=datetime.utcnow().isoformat(),
        chip_type=chip_type,
        url=f"/firmware/download/{version}"
    )
    
    firmware_registry[version] = firmware_info.dict()
    
    return firmware_info


@router.get(
    "/list",
    response_model=FirmwareListResponse,
    status_code=status.HTTP_200_OK,
    summary="List available firmware versions",
)
async def list_firmware(
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
):
    """
    Lista wszystkich dostępnych wersji firmware.
    """
    firmwares = [FirmwareInfo(**info) for info in firmware_registry.values()]
    return FirmwareListResponse(
        firmwares=firmwares,
        count=len(firmwares)
    )


@router.get(
    "/latest",
    response_model=FirmwareInfo,
    status_code=status.HTTP_200_OK,
    summary="Get latest firmware version",
)
async def get_latest_firmware(
    chip_type: str = "esp32c6",
):
    """
    Pobierz informacje o najnowszej wersji firmware.
    Endpoint publiczny (dla urządzeń).
    """
    # Filter by chip type and sort by version
    matching = [
        info for info in firmware_registry.values()
        if info.get("chip_type") == chip_type
    ]
    
    if not matching:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No firmware found for chip type: {chip_type}"
        )
    
    # Simple version sorting (assumes semver format)
    def version_key(info):
        try:
            parts = info["version"].split(".")
            return tuple(int(p) for p in parts)
        except:
            return (0, 0, 0)
    
    latest = max(matching, key=version_key)
    return FirmwareInfo(**latest)


@router.get(
    "/download/{version}",
    status_code=status.HTTP_200_OK,
    summary="Download firmware binary",
)
async def download_firmware(version: str):
    """
    Pobierz plik binary firmware.
    Endpoint publiczny (dla urządzeń OTA).
    """
    from fastapi.responses import FileResponse
    
    if version not in firmware_registry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firmware version {version} not found"
        )
    
    firmware_info = firmware_registry[version]
    filepath = os.path.join(FIRMWARE_DIR, firmware_info["filename"])
    
    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Firmware file not found on server"
        )
    
    return FileResponse(
        path=filepath,
        filename=firmware_info["filename"],
        media_type="application/octet-stream"
    )


@router.delete(
    "/{version}",
    status_code=status.HTTP_200_OK,
    summary="Delete firmware version",
)
async def delete_firmware(
    version: str,
    current_user: User = Depends(RequireUser([UserType.ADMIN])),
):
    """
    Usuń wersję firmware.
    Tylko dla administratorów.
    """
    if version not in firmware_registry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firmware version {version} not found"
        )
    
    firmware_info = firmware_registry[version]
    filepath = os.path.join(FIRMWARE_DIR, firmware_info["filename"])
    
    # Delete file
    if os.path.exists(filepath):
        os.remove(filepath)
    
    # Remove from registry
    del firmware_registry[version]
    
    return {"message": f"Firmware {version} deleted", "version": version}


@router.post(
    "/deploy",
    status_code=status.HTTP_200_OK,
    summary="Deploy firmware to device via OTA",
)
async def deploy_firmware(
    req: OtaDeployRequest,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Wyślij komendę OTA do urządzenia, aby zaktualizowało firmware.
    """
    from app_common.utils.mqtt_handler import publish_command
    
    # Check device ownership
    result = await db.execute(select(Device).where(Device.id == req.device_id))
    device = result.scalar_one_or_none()
    
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    if device.user_id != current_user.id and current_user.type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this device"
        )
    
    # Check if firmware version exists
    if req.version not in firmware_registry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firmware version {req.version} not found"
        )
    
    firmware_info = firmware_registry[req.version]
    
    # Build OTA URL (adjust for your server setup)
    # In production, this should be an external HTTPS URL
    ota_url = f"https://your-server.com/firmware/download/{req.version}"
    
    # Send OTA command via MQTT
    success = await publish_command(
        str(req.device_id),
        "ota_update",
        {"url": ota_url, "version": req.version, "sha256": firmware_info["sha256"]}
    )
    
    return {
        "success": success,
        "message": "OTA command sent" if success else "Failed to send OTA command",
        "device_id": req.device_id,
        "version": req.version
    }


@router.get(
    "/check/{device_id}",
    status_code=status.HTTP_200_OK,
    summary="Check for firmware updates",
)
async def check_for_updates(
    device_id: int,
    current_version: str,
    chip_type: str = "esp32c6",
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Sprawdź czy jest dostępna nowa wersja firmware.
    """
    # Check device ownership
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    if device.user_id != current_user.id and current_user.type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this device"
        )
    
    # Find matching firmware
    matching = [
        info for info in firmware_registry.values()
        if info.get("chip_type") == chip_type
    ]
    
    if not matching:
        return {
            "update_available": False,
            "current_version": current_version,
            "message": "No firmware available for this chip type"
        }
    
    # Simple version comparison
    def version_tuple(v):
        try:
            return tuple(int(p) for p in v.split("."))
        except:
            return (0, 0, 0)
    
    current_tuple = version_tuple(current_version)
    latest = max(matching, key=lambda x: version_tuple(x["version"]))
    latest_tuple = version_tuple(latest["version"])
    
    update_available = latest_tuple > current_tuple
    
    return {
        "update_available": update_available,
        "current_version": current_version,
        "latest_version": latest["version"],
        "latest_info": FirmwareInfo(**latest) if update_available else None
    }
