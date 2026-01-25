"""
Router do zarządzania firmware i aktualizacji OTA.
Umożliwia upload nowych wersji firmware do Cloudflare R2 i dystrybucję na urządzenia.

Produkcyjna wersja z:
- Przechowywaniem metadanych w PostgreSQL
- Przechowywaniem plików binarnych w Cloudflare R2
- Presigned URLs dla bezpiecznego pobierania
- Pełnym wsparciem dla OTA ESP32
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app_common.database import get_db
from app_common.models.device import Device
from app_common.models.firmware import Firmware
from app_common.models.user import UserType, User
from app_common.schemas.firmware import (
    FirmwareInfo,
    FirmwareListResponse,
    FirmwareUploadResponse,
    FirmwareDeleteResponse,
    FirmwareUpdateCheck,
    OtaDeployRequest,
    OtaDeployResponse,
)
from app_common.utils.r2_client import r2_client, compute_sha256, generate_firmware_key
from frontend_api.docs import Tags
from frontend_api.utils.auth.auth import RequireUser

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/firmware",
    tags=[Tags.Device],
    responses={}
)


async def firmware_to_info(firmware: Firmware, include_url: bool = True) -> FirmwareInfo:
    """
    Konwertuje model Firmware do FirmwareInfo z opcjonalnym URL.
    
    Args:
        firmware: Model Firmware z bazy
        include_url: Czy generować presigned URL
        
    Returns:
        FirmwareInfo z danymi
    """
    download_url = None
    if include_url:
        try:
            download_url = await r2_client.get_public_url(firmware.r2_key)
        except Exception as e:
            logger.warning(f"Failed to generate URL for {firmware.version}: {e}")

    return FirmwareInfo(
        version=firmware.version,
        version_code=firmware.version_code,
        filename=firmware.filename,
        size=firmware.size,
        sha256=firmware.sha256,
        upload_date=firmware.upload_date,
        chip_type=firmware.chip_type,
        download_url=download_url,
        release_notes=firmware.release_notes
    )


@router.post(
    "/upload",
    response_model=FirmwareUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload new firmware",
)
async def upload_firmware(
    version: str = Form(..., description="Wersja firmware (np. 1.0.0)", pattern=r"^\d+\.\d+\.\d+$"),
    version_code: int = Form(..., description="Numer wersji (int) dla ESP32, np. 1, 2, 3...", ge=1),
    chip_type: str = Form(default="esp32c6", description="Typ chipa (esp32, esp32c6, esp32s3)"),
    release_notes: Optional[str] = Form(default=None, description="Notatki do wydania"),
    force: bool = Form(default=False, description="Wymuś upload nawet jeśli istnieje nowsza wersja"),
    file: UploadFile = File(..., description="Plik binary firmware (.bin)"),
    current_user: User = Depends(RequireUser([UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload nowej wersji firmware do Cloudflare R2.
    
    Tylko dla administratorów. Plik jest przechowywany w R2,
    metadane w bazie danych PostgreSQL.
    """
    # Walidacja rozszerzenia pliku
    if not file.filename or not file.filename.endswith('.bin'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firmware file must have .bin extension"
        )

    # Walidacja typu chipa
    valid_chips = {'esp32', 'esp32c6', 'esp32s3', 'esp32c3', 'esp32s2', 'esp32h2'}
    if chip_type not in valid_chips:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid chip type. Valid options: {', '.join(valid_chips)}"
        )

    # Sprawdź czy wersja (string) już istnieje
    existing = await db.execute(
        select(Firmware).where(
            Firmware.version == version,
            Firmware.chip_type == chip_type,
            Firmware.is_active == True
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Firmware version {version} for {chip_type} already exists"
        )

    # Sprawdź czy version_code już istnieje
    warning_message = None
    existing_code_query = await db.execute(
        select(Firmware).where(
            Firmware.chip_type == chip_type,
            Firmware.is_active == True,
            Firmware.version_code == version_code
        )
    )
    existing_with_same_code = existing_code_query.scalar_one_or_none()
    if existing_with_same_code:
        if not force:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Firmware z version_code={version_code} już istnieje dla {chip_type} "
                       f"(wersja: {existing_with_same_code.version}). "
                       f"Użyj flagi force=true, aby nadpisać."
            )
        # Nadpisz - dezaktywuj stary firmware
        existing_with_same_code.is_active = False
        warning_message = (
            f"Nadpisano firmware z version_code={version_code} "
            f"(poprzednia wersja: {existing_with_same_code.version})"
        )

    # Sprawdź czy istnieje nowsza wersja (według version_code)
    newer_query = await db.execute(
        select(Firmware).where(
            Firmware.chip_type == chip_type,
            Firmware.is_active == True,
            Firmware.version_code > version_code
        ).order_by(desc(Firmware.version_code)).limit(1)
    )
    newer_firmware = newer_query.scalar_one_or_none()
    if newer_firmware:
        if not force:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Istnieje już nowsza wersja firmware: {newer_firmware.version} "
                       f"(version_code={newer_firmware.version_code}) dla {chip_type}. "
                       f"Użyj flagi force=true, aby wymusić upload starszej wersji."
            )
        newer_warning = (
            f"Uwaga: Uploadowano wersję {version} (version_code={version_code}), "
            f"ale istnieje już nowsza wersja {newer_firmware.version} (version_code={newer_firmware.version_code})"
        )
        # Połącz warningi jeśli oba występują
        if warning_message:
            warning_message = f"{warning_message}. {newer_warning}"
        else:
            warning_message = newer_warning

    # Wczytaj zawartość pliku
    content = await file.read()
    
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firmware file is empty"
        )

    # Limit rozmiaru (16MB dla ESP32)
    max_size = 16 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Firmware file too large. Maximum size: {max_size // (1024*1024)}MB"
        )

    # Oblicz hash SHA256
    sha256_hash = compute_sha256(content)

    # Wygeneruj klucz R2 i nazwę pliku
    r2_key = generate_firmware_key(chip_type, version)
    filename = f"firmware_{chip_type}_{version.replace('.', '_')}.bin"

    try:
        # Upload do R2
        await r2_client.upload_firmware(
            content=content,
            key=r2_key,
            metadata={
                'version': version,
                'chip_type': chip_type,
                'sha256': sha256_hash,
                'uploaded_by': str(current_user.id)
            }
        )
    except Exception as e:
        logger.error(f"Failed to upload firmware to R2: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload firmware to storage"
        )

    # Zapisz metadane w bazie
    try:
        db_firmware = Firmware(
            version=version,
            version_code=version_code,
            chip_type=chip_type,
            filename=filename,
            r2_key=r2_key,
            size=len(content),
            sha256=sha256_hash,
            upload_date=datetime.utcnow(),
            uploaded_by=current_user.id,
            release_notes=release_notes
        )
        db.add(db_firmware)
        await db.commit()
        await db.refresh(db_firmware)
    except Exception as e:
        # Rollback: usuń plik z R2
        await r2_client.delete_firmware(r2_key)
        logger.error(f"Failed to save firmware metadata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save firmware metadata"
        )

    logger.info(f"Firmware {version} ({chip_type}) uploaded by user {current_user.id}: {r2_key} ({len(content)} bytes)")

    # Wygeneruj URL do pobrania
    download_url = await r2_client.get_public_url(r2_key)

    return FirmwareUploadResponse(
        version=version,
        version_code=version_code,
        filename=filename,
        size=len(content),
        sha256=sha256_hash,
        upload_date=db_firmware.upload_date,
        chip_type=chip_type,
        download_url=download_url,
        message="Firmware uploaded successfully to R2",
        warning=warning_message
    )


@router.get(
    "/list",
    response_model=FirmwareListResponse,
    status_code=status.HTTP_200_OK,
    summary="List available firmware versions",
)
async def list_firmware(
    chip_type: Optional[str] = None,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista wszystkich dostępnych wersji firmware.
    
    Opcjonalnie filtruj po typie chipa.
    """
    query = select(Firmware).where(Firmware.is_active == True)
    
    if chip_type:
        query = query.where(Firmware.chip_type == chip_type)
    
    query = query.order_by(desc(Firmware.upload_date))
    
    result = await db.execute(query)
    firmwares = result.scalars().all()

    firmware_list = []
    for fw in firmwares:
        info = await firmware_to_info(fw, include_url=True)
        firmware_list.append(info)

    return FirmwareListResponse(
        firmwares=firmware_list,
        count=len(firmware_list)
    )


@router.get(
    "/latest",
    response_model=FirmwareInfo,
    status_code=status.HTTP_200_OK,
    summary="Get latest firmware version",
)
async def get_latest_firmware(
    chip_type: str = "esp32c6",
    db: AsyncSession = Depends(get_db)
):
    """
    Pobierz informacje o najnowszej wersji firmware.
    
    Endpoint publiczny (dla urządzeń ESP32).
    Sortuje po wersji semver, nie po dacie uploadu.
    """
    query = select(Firmware).where(
        Firmware.is_active == True,
        Firmware.chip_type == chip_type
    )
    
    result = await db.execute(query)
    firmwares = result.scalars().all()

    if not firmwares:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No firmware found for chip type: {chip_type}"
        )

    # Sortuj po version_code (int)
    latest = max(firmwares, key=lambda fw: fw.version_code)
    
    return await firmware_to_info(latest, include_url=True)


@router.get(
    "/download/{version}",
    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    summary="Download firmware binary",
)
async def download_firmware(
    version: str,
    chip_type: str = "esp32c6",
    db: AsyncSession = Depends(get_db)
):
    """
    Przekieruj do presigned URL w R2 dla pobrania firmware.
    
    Endpoint publiczny (dla urządzeń OTA).
    Używa HTTP 307 redirect do presigned URL.
    """
    result = await db.execute(
        select(Firmware).where(
            Firmware.version == version,
            Firmware.chip_type == chip_type,
            Firmware.is_active == True
        )
    )
    firmware = result.scalar_one_or_none()

    if not firmware:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firmware version {version} for {chip_type} not found"
        )

    try:
        # Wygeneruj presigned URL (ważny 1 godzinę)
        download_url = await r2_client.get_presigned_url(firmware.r2_key, expires_in=3600)
        return RedirectResponse(url=download_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    except Exception as e:
        logger.error(f"Failed to generate download URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download URL"
        )


@router.get(
    "/url/{version}",
    status_code=status.HTTP_200_OK,
    summary="Get download URL for firmware",
)
async def get_firmware_url(
    version: str,
    chip_type: str = "esp32c6",
    expires_in: int = 3600,
    db: AsyncSession = Depends(get_db)
):
    """
    Pobierz presigned URL do firmware bez przekierowania.
    
    Endpoint publiczny (dla urządzeń OTA które potrzebują URL).
    
    Args:
        version: Wersja firmware
        chip_type: Typ chipa
        expires_in: Czas ważności URL w sekundach (max 86400 = 24h)
    """
    # Limit expires_in
    expires_in = min(max(expires_in, 300), 86400)  # 5 min - 24h

    result = await db.execute(
        select(Firmware).where(
            Firmware.version == version,
            Firmware.chip_type == chip_type,
            Firmware.is_active == True
        )
    )
    firmware = result.scalar_one_or_none()

    if not firmware:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firmware version {version} for {chip_type} not found"
        )

    try:
        download_url = await r2_client.get_presigned_url(firmware.r2_key, expires_in=expires_in)
        return {
            "version": version,
            "chip_type": chip_type,
            "download_url": download_url,
            "sha256": firmware.sha256,
            "size": firmware.size,
            "expires_in": expires_in
        }
    except Exception as e:
        logger.error(f"Failed to generate download URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download URL"
        )


@router.delete(
    "/{version}",
    response_model=FirmwareDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete firmware version",
)
async def delete_firmware(
    version: str,
    chip_type: str = "esp32c6",
    hard_delete: bool = False,
    current_user: User = Depends(RequireUser([UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Usuń wersję firmware.
    
    Tylko dla administratorów.
    
    Args:
        version: Wersja do usunięcia
        chip_type: Typ chipa
        hard_delete: Jeśli True, usuwa też plik z R2. Domyślnie soft delete.
    """
    result = await db.execute(
        select(Firmware).where(
            Firmware.version == version,
            Firmware.chip_type == chip_type
        )
    )
    firmware = result.scalar_one_or_none()

    if not firmware:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firmware version {version} for {chip_type} not found"
        )

    deleted_from_storage = False

    if hard_delete:
        # Hard delete: usuń z R2 i z bazy
        try:
            deleted_from_storage = await r2_client.delete_firmware(firmware.r2_key)
        except Exception as e:
            logger.warning(f"Failed to delete firmware from R2: {e}")

        await db.delete(firmware)
    else:
        # Soft delete: oznacz jako nieaktywny
        firmware.is_active = False

    await db.commit()

    logger.info(f"Firmware {version} ({chip_type}) deleted by user {current_user.id} (hard={hard_delete})")

    return FirmwareDeleteResponse(
        message=f"Firmware {version} {'permanently deleted' if hard_delete else 'deactivated'}",
        version=version,
        deleted_from_storage=deleted_from_storage
    )


@router.post(
    "/deploy",
    response_model=OtaDeployResponse,
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
    
    Generuje presigned URL ważny 24h i wysyła przez MQTT.
    """
    from app_common.utils.mqtt_handler import publish_command

    # Sprawdź czy urządzenie istnieje i użytkownik ma dostęp
    device_result = await db.execute(select(Device).where(Device.id == req.device_id))
    device = device_result.scalar_one_or_none()

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

    # Znajdź firmware
    # TODO: dodać chip_type do Device i używać go tutaj
    firmware_result = await db.execute(
        select(Firmware).where(
            Firmware.version == req.version,
            Firmware.is_active == True
        )
    )
    firmware = firmware_result.scalar_one_or_none()

    if not firmware:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firmware version {req.version} not found"
        )

    # Wygeneruj presigned URL ważny 24h
    try:
        ota_url = await r2_client.get_presigned_url(firmware.r2_key, expires_in=86400)
    except Exception as e:
        logger.error(f"Failed to generate OTA URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download URL"
        )

    # Wyślij komendę OTA przez MQTT
    success = await publish_command(
        str(req.device_id),
        "ota_update",
        {
            "url": ota_url,
            "version": req.version,
            "sha256": firmware.sha256,
            "size": firmware.size
        }
    )

    return OtaDeployResponse(
        success=success,
        message="OTA command sent successfully" if success else "Failed to send OTA command",
        device_id=req.device_id,
        version=req.version,
        version_code=firmware.version_code if success else None,
        download_url=ota_url if success else None,
        sha256=firmware.sha256 if success else None
    )


@router.get(
    "/check/{device_id}",
    response_model=FirmwareUpdateCheck,
    status_code=status.HTTP_200_OK,
    summary="Check for firmware updates",
)
async def check_for_updates(
    device_id: int,
    current_version: str,
    current_version_code: int,
    chip_type: str = "esp32c6",
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Sprawdź czy jest dostępna nowa wersja firmware dla urządzenia.
    """
    # Sprawdź czy urządzenie istnieje i użytkownik ma dostęp
    device_result = await db.execute(select(Device).where(Device.id == device_id))
    device = device_result.scalar_one_or_none()

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

    # Znajdź dostępne firmware dla tego typu chipa
    query = select(Firmware).where(
        Firmware.is_active == True,
        Firmware.chip_type == chip_type
    )
    result = await db.execute(query)
    firmwares = result.scalars().all()

    if not firmwares:
        return FirmwareUpdateCheck(
            update_available=False,
            current_version=current_version,
            current_version_code=current_version_code,
            message=f"No firmware available for chip type: {chip_type}"
        )

    # Znajdź najnowszą wersję (po version_code)
    latest = max(firmwares, key=lambda fw: fw.version_code)

    update_available = latest.version_code > current_version_code

    latest_info = None
    if update_available:
        latest_info = await firmware_to_info(latest, include_url=True)

    return FirmwareUpdateCheck(
        update_available=update_available,
        current_version=current_version,
        current_version_code=current_version_code,
        latest_version=latest.version,
        latest_version_code=latest.version_code,
        latest_info=latest_info,
        message="Update available" if update_available else "You have the latest version"
    )


@router.post(
    "/init",
    status_code=status.HTTP_200_OK,
    summary="Initialize R2 bucket",
)
async def init_r2_bucket(
    current_user: User = Depends(RequireUser([UserType.ADMIN])),
):
    """
    Inicjalizuje bucket R2 dla firmware.
    
    Tylko dla administratorów. Tworzy bucket jeśli nie istnieje.
    """
    try:
        success = await r2_client.ensure_bucket_exists()
        return {
            "success": success,
            "message": "R2 bucket initialized" if success else "Failed to initialize bucket"
        }
    except Exception as e:
        logger.error(f"Failed to initialize R2 bucket: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize R2 bucket: {str(e)}"
        )
