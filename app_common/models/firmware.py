"""
Model bazodanowy dla firmware OTA.
Przechowuje metadane o wersjach firmware w bazie danych.
"""
from datetime import datetime
from sqlalchemy import String, BigInteger, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from app_common.database import Base


class Firmware(Base):
    """Model przechowujący metadane firmware w bazie danych."""
    __tablename__ = "firmwares"

    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    version_code: Mapped[int] = mapped_column(nullable=False, index=True)  # int version for ESP32
    chip_type: Mapped[str] = mapped_column(String(50), nullable=False, default="esp32c6")
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    r2_key: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    upload_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    uploaded_by: Mapped[int] = mapped_column(nullable=True, default=None)  # user_id who uploaded
    is_active: Mapped[bool] = mapped_column(default=True)  # soft delete flag
    release_notes: Mapped[str] = mapped_column(String(2000), nullable=True, default=None)

    __table_args__ = (
        Index('ix_firmware_chip_type_version', 'chip_type', 'version'),
        Index('ix_firmware_active_chip', 'is_active', 'chip_type'),
    )
