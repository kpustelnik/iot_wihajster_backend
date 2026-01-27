"""
Router do sterowania urządzeniami przez MQTT.
Umożliwia wysyłanie komend do urządzeń IoT.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status
from typing import Optional, Dict, Any
import logging

from app_common.database import get_db
from app_common.models.user import UserType, User
from app_common.models.device import Device, SettingsStatus
from app_common.utils.mqtt_handler import publish_command, send_command_and_wait
from frontend_api.docs import Tags
from frontend_api.utils.auth.auth import RequireUser

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/control",
    tags=[Tags.Device],
    responses={}
)


class CommandRequest(BaseModel):
    """Bazowa klasa dla komend MQTT"""
    device_id: int = Field(..., description="ID urządzenia")


class LedColorCommand(CommandRequest):
    """Komenda ustawienia koloru LED"""
    r: int = Field(..., ge=0, le=255, description="Red component (0-255)")
    g: int = Field(..., ge=0, le=255, description="Green component (0-255)")
    b: int = Field(..., ge=0, le=255, description="Blue component (0-255)")


class LedModeCommand(CommandRequest):
    """Komenda ustawienia trybu LED"""
    mode: str = Field(..., description="LED mode: off, static, blink, breath, fast_blink")


class LedBrightnessCommand(CommandRequest):
    """Komenda ustawienia jasności LED"""
    brightness: int = Field(..., ge=0, le=100, description="Brightness percentage (0-100)")


class IntervalCommand(CommandRequest):
    """Komenda ustawienia interwału pomiarów"""
    interval_ms: int = Field(..., ge=1000, le=3600000, description="Interval in milliseconds (1s - 1h)")


class OtaUpdateCommand(CommandRequest):
    """Komenda aktualizacji OTA"""
    url: str = Field(..., description="URL do firmware binary (HTTPS)")


# NOTE: Alarmy zakomentowane - koncept do przemyślenia
# class AlarmThresholdsCommand(CommandRequest):
#     """Komenda ustawienia progów alarmowych"""
#     pm25_high: Optional[int] = Field(None, description="Próg wysokiego PM2.5 (µg/m³)")
#     pm10_high: Optional[int] = Field(None, description="Próg wysokiego PM10 (µg/m³)")
#     temp_low: Optional[float] = Field(None, description="Próg niskiej temperatury (°C)")
#     temp_high: Optional[float] = Field(None, description="Próg wysokiej temperatury (°C)")


class Bmp280SettingsCommand(CommandRequest):
    """Komenda ustawienia parametrów czujnika BMP280"""
    settings: int = Field(..., ge=0, le=65535, description="BMP280 settings (uint16): bits 0-2: filter, bits 3-5: pressure oversampling, bits 6-8: temperature oversampling")


class WifiConfigCommand(CommandRequest):
    """Komenda konfiguracji WiFi"""
    ssid: str = Field(..., description="WiFi SSID")
    password: Optional[str] = Field(None, description="WiFi password")


class DeviceModeCommand(CommandRequest):
    """Komenda ustawienia trybu urządzenia"""
    mode: int = Field(..., ge=0, le=2, description="Device mode: 0=Setup, 1=WiFi, 2=Zigbee")


class GenericCommand(CommandRequest):
    """Generyczna komenda dla niestandardowych akcji"""
    command: str = Field(..., description="Nazwa komendy")
    params: Optional[Dict[str, Any]] = Field(None, description="Parametry komendy")


class CommandResponse(BaseModel):
    """Odpowiedź na komendę"""
    success: bool
    message: str
    device_id: int


async def verify_device_ownership(db: AsyncSession, device_id: int, user: User) -> Device:
    """
    Sprawdza czy użytkownik jest właścicielem urządzenia.
    """
    from sqlalchemy import select
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    if device.user_id != user.id and user.type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to control this device"
        )
    
    return device


@router.post(
    "/led/color",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Set LED color",
)
async def set_led_color(
    cmd: LedColorCommand,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Ustaw kolor LED na urządzeniu."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(
        str(cmd.device_id),
        "led_color",
        {"r": cmd.r, "g": cmd.g, "b": cmd.b}
    )
    
    return CommandResponse(
        success=success,
        message="LED color command sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


@router.post(
    "/led/mode",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Set LED mode",
)
async def set_led_mode(
    cmd: LedModeCommand,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Ustaw tryb LED na urządzeniu."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    valid_modes = ["off", "static", "blink", "breath", "fast_blink"]
    if cmd.mode not in valid_modes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mode. Valid modes: {valid_modes}"
        )
    
    success = await publish_command(
        str(cmd.device_id),
        "led_mode",
        {"mode": cmd.mode}
    )
    
    return CommandResponse(
        success=success,
        message="LED mode command sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


@router.post(
    "/led/brightness",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Set LED brightness",
)
async def set_led_brightness(
    cmd: LedBrightnessCommand,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Ustaw jasność LED na urządzeniu."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(
        str(cmd.device_id),
        "led_brightness",
        {"brightness": cmd.brightness}
    )
    
    return CommandResponse(
        success=success,
        message="LED brightness command sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


@router.post(
    "/sensor/interval",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Set sensor measurement interval",
)
async def set_sensor_interval(
    cmd: IntervalCommand,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Ustaw interwał pomiarów sensorów."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(
        str(cmd.device_id),
        "set_interval",
        {"interval_ms": cmd.interval_ms}
    )
    
    return CommandResponse(
        success=success,
        message="Interval command sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


@router.post(
    "/ota/update",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Start OTA firmware update",
)
async def start_ota_update(
    cmd: OtaUpdateCommand,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Rozpocznij aktualizację firmware OTA."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(
        str(cmd.device_id),
        "ota_update",
        {"url": cmd.url}
    )
    
    return CommandResponse(
        success=success,
        message="OTA update command sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


@router.post(
    "/ota/cancel",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel OTA firmware update",
)
async def cancel_ota_update(
    cmd: CommandRequest,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Anuluj aktualizację firmware OTA."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(str(cmd.device_id), "ota_cancel", {})
    
    return CommandResponse(
        success=success,
        message="OTA cancel command sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


@router.post(
    "/ota/status",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Get OTA update status",
)
async def get_ota_status(
    cmd: CommandRequest,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Pobierz status aktualizacji OTA."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(str(cmd.device_id), "ota_status", {})
    
    return CommandResponse(
        success=success,
        message="OTA status request sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


# NOTE: Alarmy zakomentowane - koncept do przemyślenia
# @router.post(
#     "/alarms/thresholds",
#     response_model=CommandResponse,
#     status_code=status.HTTP_200_OK,
#     summary="Set alarm thresholds",
# )
# async def set_alarm_thresholds(
#     cmd: AlarmThresholdsCommand,
#     current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Ustaw progi alarmowe na urządzeniu."""
#     await verify_device_ownership(db, cmd.device_id, current_user)
#     
#     params = {}
#     if cmd.pm25_high is not None:
#         params["pm25_high"] = cmd.pm25_high
#     if cmd.pm10_high is not None:
#         params["pm10_high"] = cmd.pm10_high
#     if cmd.temp_low is not None:
#         params["temp_low"] = cmd.temp_low
#     if cmd.temp_high is not None:
#         params["temp_high"] = cmd.temp_high
#     
#     success = await publish_command(str(cmd.device_id), "set_alarm_thresholds", params)
#     
#     return CommandResponse(
#         success=success,
#         message="Alarm thresholds command sent" if success else "Failed to send command",
#         device_id=cmd.device_id
#     )


@router.post(
    "/sensor/bmp280",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Set BMP280 sensor settings",
)
async def set_bmp280_settings(
    cmd: Bmp280SettingsCommand,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Ustaw parametry czujnika BMP280.
    
    Format settings (uint16):
    - bits 0-2: IIR filter coefficient (0=off, 1=2x, 2=4x, 3=8x, 4=16x)
    - bits 3-5: pressure oversampling (0=skip, 1=1x, 2=2x, 3=4x, 4=8x, 5=16x)
    - bits 6-8: temperature oversampling (0=skip, 1=1x, 2=2x, 3=4x, 4=8x, 5=16x)
    """
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(
        str(cmd.device_id),
        "set_bmp280",
        {"settings": cmd.settings}
    )
    
    return CommandResponse(
        success=success,
        message="BMP280 settings command sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


@router.post(
    "/wifi/config",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Configure WiFi on device",
)
async def configure_wifi(
    cmd: WifiConfigCommand,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Skonfiguruj WiFi na urządzeniu (przez LTE)."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    params = {"ssid": cmd.ssid}
    if cmd.password:
        params["password"] = cmd.password
    
    success = await publish_command(str(cmd.device_id), "set_wifi", params)
    
    return CommandResponse(
        success=success,
        message="WiFi config command sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


@router.post(
    "/device/mode",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Set device operating mode",
)
async def set_device_mode(
    cmd: DeviceModeCommand,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Ustaw tryb pracy urządzenia (Setup/WiFi/Zigbee)."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(
        str(cmd.device_id),
        "set_device_mode",
        {"mode": cmd.mode}
    )
    
    return CommandResponse(
        success=success,
        message="Device mode command sent (device will reboot)" if success else "Failed to send command",
        device_id=cmd.device_id
    )


@router.post(
    "/device/reboot",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Reboot device",
)
async def reboot_device(
    cmd: CommandRequest,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Zrestartuj urządzenie."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(str(cmd.device_id), "reboot", {})
    
    return CommandResponse(
        success=success,
        message="Reboot command sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


@router.post(
    "/device/factory-reset",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Request factory reset (requires physical access)",
)
async def factory_reset_device(
    cmd: CommandRequest,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Żądanie factory reset urządzenia.
    
    UWAGA: Factory reset wymaga fizycznego dostępu do urządzenia!
    Aby zresetować urządzenie:
    1. Połącz się z urządzeniem przez BLE (aplikacja mobilna)
    2. Zapisz wartość 0xDEAD do charakterystyki Factory Reset (UUID: 0x1957)
    3. Urządzenie zrestartuje się i wyczyści wszystkie ustawienia
    
    Ten endpoint tylko aktualizuje bazę danych backendu.
    """
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    # Only clear owner in database - actual device reset must be done via BLE
    from sqlalchemy import update
    stmt = update(Device).where(Device.id == cmd.device_id).values(
        user_id=None,
        status=SettingsStatus.PENDING
    )
    await db.execute(stmt)
    await db.commit()
    
    return CommandResponse(
        success=True,
        message="Device released in database. To fully reset the device, connect via BLE and write 0xDEAD to the Factory Reset characteristic (UUID 0x1957).",
        device_id=cmd.device_id
    )


@router.post(
    "/device/status",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Get device status",
)
async def get_device_status(
    cmd: CommandRequest,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Pobierz status urządzenia (fire-and-forget)."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(str(cmd.device_id), "get_status", {})
    
    return CommandResponse(
        success=success,
        message="Status request sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )


class SyncCommandRequest(CommandRequest):
    """Request for synchronous command that waits for response"""
    timeout: float = Field(default=10.0, ge=1.0, le=60.0, description="Timeout in seconds")


class SyncCommandResponse(BaseModel):
    """Response from synchronous command"""
    success: bool
    message: str
    device_id: int
    response: Optional[Dict[str, Any]] = None


@router.post(
    "/device/status/sync",
    response_model=SyncCommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Get device status (synchronous)",
)
async def get_device_status_sync(
    cmd: SyncCommandRequest,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Pobierz status urządzenia i czekaj na odpowiedź.
    Timeout domyślnie 10 sekund.
    """
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    response = await send_command_and_wait(
        str(cmd.device_id), 
        "get_status", 
        {}, 
        timeout=cmd.timeout
    )
    
    if response is None:
        return SyncCommandResponse(
            success=False,
            message="Device did not respond within timeout",
            device_id=cmd.device_id,
            response=None
        )
    
    return SyncCommandResponse(
        success=True,
        message="Status received",
        device_id=cmd.device_id,
        response=response
    )


@router.post(
    "/device/settings/sync",
    response_model=SyncCommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Sync device settings (synchronous)",
)
async def sync_device_settings(
    cmd: SyncCommandRequest,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Synchronizuj ustawienia z urządzeniem i czekaj na odpowiedź.
    Urządzenie zwróci aktualne ustawienia lub zastosuje nowe.
    """
    from app_common.utils.mqtt_handler import send_settings_sync
    
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    # Send config_sync command and wait for response
    response = await send_command_and_wait(
        str(cmd.device_id),
        "config_sync",
        {},  # Device will be sent current backend settings
        timeout=cmd.timeout
    )
    
    if response is None:
        return SyncCommandResponse(
            success=False,
            message="Device did not respond within timeout",
            device_id=cmd.device_id,
            response=None
        )
    
    return SyncCommandResponse(
        success=True,
        message=f"Settings sync: {response.get('status', 'unknown')}",
        device_id=cmd.device_id,
        response=response
    )


@router.post(
    "/custom",
    response_model=CommandResponse,
    status_code=status.HTTP_200_OK,
    summary="Send custom command",
)
async def send_custom_command(
    cmd: GenericCommand,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Wyślij niestandardową komendę do urządzenia."""
    await verify_device_ownership(db, cmd.device_id, current_user)
    
    success = await publish_command(str(cmd.device_id), cmd.command, cmd.params or {})
    
    return CommandResponse(
        success=success,
        message=f"Command '{cmd.command}' sent" if success else "Failed to send command",
        device_id=cmd.device_id
    )
