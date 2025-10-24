import enum

import sqlalchemy
from sqlalchemy import ForeignKey

from app_common.database import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship


class FamilyStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"


class Family(Base):
    __tablename__ = "families"  # rodzina

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column()

    family_member = relationship(
        "FamilyMember",
        passive_deletes=True,
        cascade="all, delete"
    )

    family_device = relationship(
        "FamilyDevice",
        passive_deletes=True,
        cascade="all, delete"
    )


class FamilyMember(Base):
    __tablename__ = "family_members"  # mapowanie z użytkownika do rodziny

    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[FamilyStatus] = mapped_column(sqlalchemy.Enum(FamilyStatus))


class FamilyDevice(Base):
    __tablename__ = "family_devices"  # mapowanie z urządzenia do rodziny

    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
