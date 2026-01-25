import enum
import sqlalchemy

from app_common.database import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship


class UserType(str, enum.Enum):
    CLIENT = "client"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"  # użytkownicy

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)
    login: Mapped[str] = mapped_column(unique=True)
    password: Mapped[str] = mapped_column()
    type: Mapped[str] = mapped_column(sqlalchemy.Enum(UserType))
    discord_id: Mapped[str] = mapped_column(unique=True, nullable=True, default=None)
    discord_username: Mapped[str] = mapped_column(nullable=True, default=None)
    discord_avatar: Mapped[str] = mapped_column(nullable=True, default=None)

    devices = relationship(
        "Device",
        uselist=True
    )

    family_member = relationship(
        "FamilyMember",
        passive_deletes=True,
        cascade="all, delete"
    )

    family = relationship(
        "Family",
        passive_deletes=True,
        cascade="all, delete"
    )