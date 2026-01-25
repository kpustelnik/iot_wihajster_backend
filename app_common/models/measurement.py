from datetime import datetime

from sqlalchemy import Numeric, ForeignKey

from app_common.database import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Measurement(Base):
    __tablename__ = "measurements"  # Pomiary

    ownership_id: Mapped[int] = mapped_column(ForeignKey("ownerships.id", ondelete="CASCADE"), primary_key=True, index=True)
    time: Mapped[datetime] = mapped_column(primary_key=True)
    humidity: Mapped[int] = mapped_column(nullable=True)
    temperature: Mapped[float] = mapped_column(Numeric(5, 2, asdecimal=True), nullable=True)  # TODO debate if asdecimal true or false
    pressure: Mapped[int] = mapped_column(nullable=True)
    PM25: Mapped[int] = mapped_column(nullable=True)
    PM10: Mapped[int] = mapped_column(nullable=True)
    longitude: Mapped[float] = mapped_column(nullable=True)
    latitude: Mapped[float] = mapped_column(nullable=True)

    # Relacja do Ownership
    ownership = relationship("Ownership", back_populates="measurements")
