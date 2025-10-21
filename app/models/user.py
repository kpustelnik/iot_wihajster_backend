from sqlalchemy import Enum

from app.database import Base
from sqlalchemy.orm import Mapped, mapped_column


class UserType(Enum):
    CLIENT = "client"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"  # użytkownicy

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)
    login: Mapped[str] = mapped_column()
    password: Mapped[str] = mapped_column()
    type: Mapped[str] = mapped_column(UserType)
