import datetime

from sqlalchemy import ForeignKey, Time, Interval, Enum

from app.database import Base
from sqlalchemy.orm import Mapped, mapped_column


class PrivacyLevel(Enum):
    PRIVATE = "Private"
    PUBLIC = "Public"
    PROTECTED = "Protected"


class Device(Base):
    __tablename__ = "devices"  # Urządzenia

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True, index=True, default=None)  # null on delete
    day_collection_interval: Mapped[datetime.timedelta] = mapped_column(Interval, default=datetime.timedelta(minutes=5))
    night_collection_interval: Mapped[datetime.timedelta] = mapped_column(Interval, default=datetime.timedelta(minutes=15))
    day_start: Mapped[datetime.time] = mapped_column(Time, default=datetime.time(hour=6))
    day_end: Mapped[datetime.time] = mapped_column(Time, default=datetime.time(hour=6))
    privacy: Mapped[PrivacyLevel] = mapped_column(PrivacyLevel, default=PrivacyLevel.PRIVATE)
    battery: Mapped[int] = mapped_column(nullable=True, default=None)
