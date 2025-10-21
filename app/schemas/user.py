from pydantic import BaseModel, Field, EmailStr

from app.models.user import UserType


class UserModel(BaseModel):
    id: int = Field(ge=1, examples=[1])
    email: EmailStr = Field(examples=["IlikeTrains@gmail.com"])
    login: str = Field(examples=["Marek"])
    password: str = Field(examples=["password"])
    type: UserType = Field(examples=[UserType.CLIENT])
