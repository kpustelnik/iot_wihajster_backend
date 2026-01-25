from datetime import datetime

from sqlalchemy import ForeignKey, Index

from app_common.database import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Ownership(Base):
    """
    Reprezentuje relację własności między użytkownikiem a urządzeniem.
    Pomiary są powiązane z Ownership zamiast bezpośrednio z Device,
    co pozwala na izolację danych między różnymi właścicielami urządzenia.
    
    Tylko jeden Ownership może być aktywny dla danego urządzenia w danym momencie.
    """
    __tablename__ = "ownerships"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    deactivated_at: Mapped[datetime] = mapped_column(nullable=True, default=None)

    # Partial unique index dla PostgreSQL - tylko jeden aktywny ownership per device
    __table_args__ = (
        Index(
            'ix_unique_active_ownership_per_device',
            'device_id',
            unique=True,
            postgresql_where=(is_active == True)
        ),
    )

    # Relacje
    user = relationship("User", back_populates="ownerships")
    device = relationship("Device", back_populates="ownerships")
    measurements = relationship("Measurement", back_populates="ownership", passive_deletes=True)
    measurements = relationship("Measurement", back_populates="ownership", passive_deletes=True)
