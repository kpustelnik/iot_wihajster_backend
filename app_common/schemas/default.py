from typing import TypeVar, Generic

from pydantic import BaseModel, Field


class Post(BaseModel):
    created: int = Field(ge=0, examples=[2])
    detail: str = Field(examples=["Created 2 items"])


class Delete(BaseModel):
    deleted: int = Field(ge=0, examples=[2])
    detail: str = Field(examples=["Deleted 2 items"])


class Put(BaseModel):
    changed: int = Field(ge=0, examples=[1])
    detail: str = Field(examples=["Changed 1 item"])


class Forbidden(BaseModel):
    detail: str = Field(examples=["Forbidden, to access this resource is required to be Admin or Manager"])


class Unauthorized(BaseModel):
    detail: str = Field(examples=["Some thing went wrong in authentication"])


class NotFound(BaseModel):
    detail: str = Field(examples=["Source has not been found"])


DataT = TypeVar('DataT')


class LimitedResponse(BaseModel, Generic[DataT]):
    offset: int = Field(ge=0, examples=[0])
    limit: int = Field(ge=0, le=500, examples=[100])
    total_count: int = Field(ge=0, examples=[420])
    content: list[DataT]
