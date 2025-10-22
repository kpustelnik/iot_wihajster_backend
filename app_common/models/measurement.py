from datetime import datetime

from sqlalchemy import Numeric, ForeignKey

from app_common.database import Base
from sqlalchemy.orm import Mapped, mapped_column


class Measurement(Base):
    __tablename__ = "measurements"  # Pomiary

    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    time: Mapped[datetime] = mapped_column(primary_key=True)
    humidity: Mapped[int] = mapped_column(nullable=True)
    temperature: Mapped[float] = mapped_column(Numeric(5, 2, asdecimal=True), nullable=True)  # TODO debate if asdecimal true or false
    pressure: Mapped[int] = mapped_column(nullable=True)
    PM25: Mapped[int] = mapped_column(nullable=True)
    PM10: Mapped[int] = mapped_column(nullable=True)
    longitude: Mapped[float] = mapped_column(nullable=True)
    latitude: Mapped[float] = mapped_column(nullable=True)
