from pydantic import BaseModel, Field


class LoginModel(BaseModel):
    login: str = Field(example=["Ździsiu"])
    password: str = Field(example=["Patyk"])


class PasswordRecoverModel(BaseModel):
    password: str = Field(example=["Patyk"])
