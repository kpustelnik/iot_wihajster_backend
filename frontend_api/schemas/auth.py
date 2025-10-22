from pydantic import BaseModel, Field


class LoginModel(BaseModel):
    login: str = Field(examples=["Ździsiu"])
    password: str = Field(examples=["Patyk"])


class PasswordRecoverModel(BaseModel):
    password: str = Field(examples=["Patyk"])
