import enum

import sqlalchemy
from sqlalchemy import ForeignKey

from app_common.database import Base
from sqlalchemy.orm import Mapped, mapped_column


class FamilyStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"


class Family(Base):
    __tablename__ = "families"  # rodzina

    main_user_id: Mapped[int] = mapped_column(primary_key=True)
    client_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[FamilyStatus] = mapped_column(sqlalchemy.Enum(FamilyStatus))
