"""
Testowe endpointy do szybkiego tworzenia urządzeń i pomiarów.
DO UŻYCIA TYLKO W CELACH DEWELOPERSKICH/TESTOWYCH!
"""

import random
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app_common.database import get_db
from app_common.models.device import Device, SettingsStatus, PrivacyLevel
from app_common.models.measurement import Measurement
from app_common.models.ownership import Ownership
from app_common.models.user import User, UserType
from frontend_api.docs import Tags
from frontend_api.repos.ownership_repo import create_ownership
from frontend_api.utils.auth.auth import RequireUser

router = APIRouter(
    prefix="/test",
    tags=[Tags.Device],  # or create a new Tags.Test
    responses={}
)


# ============================================================================
# Schemas
# ============================================================================

class TestDeviceCreate(BaseModel):
    """Schema do tworzenia testowego urządzenia"""
    chip_type: str = Field(default="esp32c6", examples=["esp32c6", "esp32", "esp32s3"])
    privacy: str = Field(default="public", examples=["private", "public", "protected"])


class TestDeviceResponse(BaseModel):
    """Response po utworzeniu urządzenia"""
    device_id: int
    ownership_id: int
    message: str


class TestMeasurementCreate(BaseModel):
    """Schema do tworzenia testowego pomiaru"""
    device_id: int = Field(ge=1, examples=[1])
    temperature: Optional[float] = Field(default=None, examples=[21.5])
    humidity: Optional[float] = Field(default=None, examples=[65.0])
    pressure: Optional[float] = Field(default=None, examples=[1013])
    PM25: Optional[float] = Field(default=None, examples=[15])
    PM10: Optional[float] = Field(default=None, examples=[25])
    longitude: Optional[float] = Field(default=None, examples=[19.9450])
    latitude: Optional[float] = Field(default=None, examples=[50.0647])


class TestMeasurementResponse(BaseModel):
    """Response po utworzeniu pomiaru"""
    ownership_id: int
    time: datetime
    message: str


class TestBulkMeasurementsCreate(BaseModel):
    """Schema do tworzenia wielu testowych pomiarów"""
    device_id: int = Field(ge=1, examples=[1])
    count: int = Field(default=10, ge=1, le=1000, examples=[10])
    hours_back: int = Field(default=24, ge=1, le=720, examples=[24])
    base_latitude: float = Field(default=50.0647, examples=[50.0647])
    base_longitude: float = Field(default=19.9450, examples=[19.9450])


class TestBulkResponse(BaseModel):
    """Response po utworzeniu wielu pomiarów"""
    created_count: int
    ownership_id: int
    message: str


# ============================================================================
# Endpoints
# ============================================================================

@router.post(
    "/device",
    response_model=TestDeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="[TEST] Utwórz testowe urządzenie dla zalogowanego użytkownika",
    description="Tworzy nowe urządzenie i przypisuje je do zalogowanego użytkownika. TYLKO DO TESTÓW!",
)
async def create_test_device(
    req: TestDeviceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Tworzy testowe urządzenie i automatycznie przypisuje je do zalogowanego użytkownika.
    """
    # Mapowanie privacy string na enum
    privacy_map = {
        "private": PrivacyLevel.PRIVATE,
        "public": PrivacyLevel.PUBLIC,
        "protected": PrivacyLevel.PROTECTED,
    }
    privacy = privacy_map.get(req.privacy.lower(), PrivacyLevel.PUBLIC)
    
    # Utwórz urządzenie
    device = Device(
        user_id=current_user.id,
        chip_type=req.chip_type,
        privacy=privacy,
        status=SettingsStatus.ACCEPTED,
    )
    db.add(device)
    await db.flush()  # Żeby uzyskać device.id
    
    # Zapisz device_id przed create_ownership (który robi commit i expiruje obiekt)
    device_id = device.id
    
    # Utwórz ownership (reaktywuje istniejący jeśli użytkownik już miał to urządzenie)
    ownership = await create_ownership(db, current_user, device_id)
    ownership_id = ownership.id
    
    return TestDeviceResponse(
        device_id=device_id,
        ownership_id=ownership_id,
        message=f"Utworzono urządzenie {device_id} z ownership {ownership_id} dla użytkownika {current_user.login}"
    )


@router.post(
    "/measurement",
    response_model=TestMeasurementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="[TEST] Dodaj testowy pomiar",
    description="Dodaje pojedynczy pomiar do urządzenia użytkownika. TYLKO DO TESTÓW!",
)
async def create_test_measurement(
    req: TestMeasurementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Dodaje testowy pomiar do urządzenia.
    Sprawdza czy użytkownik ma aktywny ownership do urządzenia.
    """
    # Znajdź aktywny ownership dla tego urządzenia i użytkownika
    result = await db.execute(
        select(Ownership).where(
            Ownership.device_id == req.device_id,
            Ownership.user_id == current_user.id,
            Ownership.is_active == True
        )
    )
    ownership = result.scalar_one_or_none()
    
    if not ownership:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nie znaleziono aktywnego ownership dla urządzenia {req.device_id}"
        )
    
    # Zapisz ID przed użyciem w innym kontekście
    ownership_id = ownership.id
    measurement_time = datetime.utcnow()
    
    # Utwórz pomiar
    measurement = Measurement(
        ownership_id=ownership_id,
        time=measurement_time,
        temperature=req.temperature,
        humidity=req.humidity,
        pressure=req.pressure,
        PM25=req.PM25,
        PM10=req.PM10,
        longitude=req.longitude,
        latitude=req.latitude,
    )
    db.add(measurement)
    await db.commit()
    
    return TestMeasurementResponse(
        ownership_id=ownership_id,
        time=measurement_time,
        message=f"Dodano pomiar dla urządzenia {req.device_id}"
    )


@router.post(
    "/measurements/bulk",
    response_model=TestBulkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="[TEST] Dodaj wiele testowych pomiarów",
    description="Generuje losowe pomiary dla urządzenia z ostatnich X godzin. TYLKO DO TESTÓW!",
)
async def create_bulk_test_measurements(
    req: TestBulkMeasurementsCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Generuje wiele losowych pomiarów dla urządzenia.
    Pomiary są rozłożone równomiernie w czasie od teraz do X godzin wstecz.
    """
    # Znajdź aktywny ownership
    result = await db.execute(
        select(Ownership).where(
            Ownership.device_id == req.device_id,
            Ownership.user_id == current_user.id,
            Ownership.is_active == True
        )
    )
    ownership = result.scalar_one_or_none()
    
    if not ownership:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nie znaleziono aktywnego ownership dla urządzenia {req.device_id}"
        )
    
    # Zapisz ID przed użyciem w innym kontekście
    ownership_id = ownership.id
    
    # Generuj pomiary
    now = datetime.utcnow()
    time_step = timedelta(hours=req.hours_back) / req.count
    
    measurements = []
    for i in range(req.count):
        # Czas pomiaru
        measurement_time = now - (time_step * i)
        
        # Losowe dane z realistycznymi zakresami
        measurement = Measurement(
            ownership_id=ownership_id,
            time=measurement_time,
            temperature=round(random.uniform(15.0, 30.0), 2),
            humidity=round(random.uniform(30.0, 80.0), 1),
            pressure=random.randint(990, 1030),
            PM25=random.randint(5, 50),
            PM10=random.randint(10, 80),
            # Losowa pozycja w okolicy base location (±0.01 stopnia ≈ ±1km)
            latitude=req.base_latitude + random.uniform(-0.01, 0.01),
            longitude=req.base_longitude + random.uniform(-0.01, 0.01),
        )
        measurements.append(measurement)
    
    db.add_all(measurements)
    await db.commit()
    
    return TestBulkResponse(
        created_count=len(measurements),
        ownership_id=ownership_id,
        message=f"Utworzono {len(measurements)} pomiarów dla urządzenia {req.device_id} z ostatnich {req.hours_back}h"
    )


@router.delete(
    "/device/{device_id}",
    status_code=status.HTTP_200_OK,
    summary="[TEST] Usuń testowe urządzenie",
    description="Usuwa urządzenie wraz z ownership i pomiarami. TYLKO DO TESTÓW!",
)
async def delete_test_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Usuwa urządzenie. Kaskadowo usuwa ownership i pomiary.
    """
    # Sprawdź czy urządzenie należy do użytkownika
    result = await db.execute(
        select(Device).where(
            Device.id == device_id,
            Device.user_id == current_user.id
        )
    )
    device = result.scalar_one_or_none()
    
    if not device:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nie znaleziono urządzenia {device_id} należącego do użytkownika"
        )
    
    await db.delete(device)
    await db.commit()
    
    return {"message": f"Usunięto urządzenie {device_id} wraz z powiązanymi danymi"}


# ============================================================================
# Transfer Device Endpoint
# ============================================================================

class TestTransferDeviceRequest(BaseModel):
    """Schema do przekazania urządzenia innemu użytkownikowi"""
    device_id: int = Field(ge=1, examples=[1])
    new_user_id: int = Field(ge=1, examples=[2], description="ID użytkownika, któremu przekazujemy urządzenie")


class TestTransferDeviceResponse(BaseModel):
    """Response po przekazaniu urządzenia"""
    device_id: int
    old_user_id: int
    new_user_id: int
    old_ownership_id: int
    new_ownership_id: int
    message: str


@router.post(
    "/device/transfer",
    response_model=TestTransferDeviceResponse,
    status_code=status.HTTP_200_OK,
    summary="[TEST] Przekaż urządzenie innemu użytkownikowi",
    description="""
    Przekazuje urządzenie od obecnego właściciela do nowego użytkownika.
    
    Proces:
    1. Dezaktywuje obecny ownership (is_active=False, ustawia deactivated_at)
    2. Tworzy nowy ownership dla nowego użytkownika
    3. Aktualizuje device.user_id na nowego użytkownika
    
    Stare pomiary pozostają powiązane ze starym ownership, więc nowy użytkownik NIE powinien ich widzieć.
    TYLKO DO TESTÓW!
    """,
)
async def transfer_test_device(
    req: TestTransferDeviceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Przekazuje urządzenie innemu użytkownikowi.
    Tworzy nowy ownership, dezaktywuje stary.
    """
    from fastapi import HTTPException
    
    # Sprawdź czy urządzenie należy do obecnego użytkownika
    device_result = await db.execute(
        select(Device).where(
            Device.id == req.device_id,
            Device.user_id == current_user.id
        )
    )
    device = device_result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nie znaleziono urządzenia {req.device_id} należącego do Ciebie"
        )
    
    # Sprawdź czy nowy użytkownik istnieje
    new_user_result = await db.execute(
        select(User).where(User.id == req.new_user_id)
    )
    new_user = new_user_result.scalar_one_or_none()
    
    if not new_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nie znaleziono użytkownika o ID {req.new_user_id}"
        )
    
    if new_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie możesz przekazać urządzenia samemu sobie"
        )
    
    # Znajdź aktywny ownership obecnego użytkownika (dla celów informacyjnych)
    ownership_result = await db.execute(
        select(Ownership).where(
            Ownership.device_id == req.device_id,
            Ownership.user_id == current_user.id,
            Ownership.is_active == True
        )
    )
    old_ownership = ownership_result.scalar_one_or_none()
    
    if not old_ownership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nie znaleziono aktywnego ownership dla urządzenia {req.device_id}"
        )
    
    # Zapisz ID przed modyfikacjami
    old_ownership_id = old_ownership.id
    old_user_id = current_user.id
    
    # Użyj create_ownership - ta funkcja:
    # 1. Dezaktywuje stary ownership
    # 2. Reaktywuje istniejący ownership jeśli nowy użytkownik już miał to urządzenie
    # 3. Lub tworzy nowy ownership jeśli nie miał
    new_ownership = await create_ownership(db, new_user, req.device_id)
    new_ownership_id = new_ownership.id
    
    # Zaktualizuj właściciela urządzenia
    device.user_id = req.new_user_id
    await db.commit()
    
    return TestTransferDeviceResponse(
        device_id=req.device_id,
        old_user_id=old_user_id,
        new_user_id=req.new_user_id,
        old_ownership_id=old_ownership_id,
        new_ownership_id=new_ownership_id,
        message=f"Urządzenie {req.device_id} zostało przekazane z użytkownika {old_user_id} do użytkownika {req.new_user_id}. Stary ownership ({old_ownership_id}) dezaktywowany, ownership ({new_ownership_id}) aktywny dla nowego użytkownika."
    )
