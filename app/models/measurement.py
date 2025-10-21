from datetime import datetime

from sqlalchemy import Numeric, ForeignKey

from app.database import Base
from sqlalchemy.orm import Mapped, mapped_column


class Measurement(Base):
    __tablename__ = "measurements"  # Pomiary

    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    time: Mapped[datetime] = mapped_column(primary_key=True)
    humidity: Mapped[int] = mapped_column()
    temperature: Mapped[float] = mapped_column(Numeric(5, 2, asdecimal=True))  # TODO debate if asdecimal true or false
    pressure: Mapped[int] = mapped_column()
    PM25: Mapped[int] = mapped_column()
    PM10: Mapped[int] = mapped_column()
    longitude: Mapped[float] = mapped_column()
    latitude: Mapped[float] = mapped_column()
