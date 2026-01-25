from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class OwnershipBase(BaseModel):
    user_id: int = Field(ge=1, examples=[1])
    device_id: int = Field(ge=1, examples=[1])
    is_active: bool = Field(default=True, examples=[True])


class OwnershipCreate(OwnershipBase):
    """Schema do tworzenia nowego Ownership"""
    pass


class OwnershipModel(OwnershipBase):
    """Schema do zwracania Ownership z API"""
    id: int = Field(ge=1, examples=[1])
    created_at: datetime = Field(examples=[datetime.now()])
    deactivated_at: Optional[datetime] = Field(default=None, examples=[None])

    class Config:
        from_attributes = True


class OwnershipDeactivate(BaseModel):
    """Schema do dezaktywacji Ownership (przy zmianie właściciela)"""
    device_id: int = Field(ge=1, examples=[1])
