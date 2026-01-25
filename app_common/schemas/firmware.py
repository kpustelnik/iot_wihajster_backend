"""
Schematy Pydantic dla Firmware OTA.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class FirmwareModel(BaseModel):
    """Pełny model firmware z bazy danych."""
    id: int
    version: str
    version_code: int
    chip_type: str
    filename: str
    r2_key: str
    size: int
    sha256: str
    upload_date: datetime
    uploaded_by: Optional[int] = None
    is_active: bool = True
    release_notes: Optional[str] = None

    class Config:
        from_attributes = True


class FirmwareInfo(BaseModel):
    """Publiczne informacje o firmware (bez wewnętrznych szczegółów)."""
    version: str = Field(..., description="Wersja firmware (semver)")
    version_code: int = Field(..., description="Numer wersji (int) dla ESP32")
    filename: str = Field(..., description="Nazwa pliku firmware")
    size: int = Field(..., description="Rozmiar pliku w bajtach")
    sha256: str = Field(..., description="Hash SHA256 pliku")
    upload_date: datetime = Field(..., description="Data uploadu")
    chip_type: str = Field(default="esp32c6", description="Typ chipa docelowego")
    download_url: Optional[str] = Field(default=None, description="URL do pobrania firmware")
    release_notes: Optional[str] = Field(default=None, description="Notatki do wydania")

    class Config:
        from_attributes = True


class FirmwareListResponse(BaseModel):
    """Odpowiedź z listą firmware."""
    firmwares: List[FirmwareInfo]
    count: int


class FirmwareUploadResponse(BaseModel):
    """Odpowiedź po uploadzie firmware."""
    version: str
    version_code: int
    filename: str
    size: int
    sha256: str
    upload_date: datetime
    chip_type: str
    download_url: str
    message: str = "Firmware uploaded successfully"
    warning: Optional[str] = None


class OtaDeployRequest(BaseModel):
    """Request do deploymentu OTA na urządzenie."""
    device_id: int = Field(..., description="ID urządzenia docelowego")
    version: str = Field(..., description="Wersja firmware do wgrania")


class OtaDeployResponse(BaseModel):
    """Odpowiedź na deploy OTA."""
    success: bool
    message: str
    device_id: int
    version: str
    version_code: Optional[int] = None
    download_url: Optional[str] = None
    sha256: Optional[str] = None


class FirmwareUpdateCheck(BaseModel):
    """Odpowiedź sprawdzenia dostępności aktualizacji."""
    update_available: bool
    current_version: str
    current_version_code: Optional[int] = None
    latest_version: Optional[str] = None
    latest_version_code: Optional[int] = None
    latest_info: Optional[FirmwareInfo] = None
    message: Optional[str] = None


class FirmwareDeleteResponse(BaseModel):
    """Odpowiedź po usunięciu firmware."""
    message: str
    version: str
    deleted_from_storage: bool
