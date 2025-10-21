import datetime

from sqlalchemy import ForeignKey, Time, Interval, Enum

from app.database import Base
from sqlalchemy.orm import Mapped, mapped_column


class FamilyStatus(Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"


class Family(Base):
    __tablename__ = "families"  # rodzina

    main_user_id: Mapped[int] = mapped_column(primary_key=True)
    client_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    status: Mapped[FamilyStatus] = mapped_column(FamilyStatus)
