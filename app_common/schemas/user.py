from pydantic import BaseModel, Field, EmailStr

from app_common.models.user import UserType
from app_common.utils.schemas_decorators import omit


class UserModel(BaseModel):
    id: int = Field(ge=1, examples=[1])
    email: EmailStr = Field(examples=["IlikeTrains@gmail.com"])
    login: str = Field(examples=["Marek"])
    password: str = Field(examples=["password"])
    type: UserType = Field(examples=[UserType.CLIENT])


@omit("id", "type")
class UserCreate(UserModel):
    pass
