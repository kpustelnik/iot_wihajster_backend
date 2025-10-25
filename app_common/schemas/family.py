from pydantic import BaseModel, Field

from app_common.models.family import FamilyStatus
from app_common.utils.schemas_decorators import omit


class FamilyModel(BaseModel):
    id: int = Field(ge=1, examples=[2])
    user_id: int = Field(ge=1, examples=[1])
    name: str = Field(examples=["For family"])


class FamilyMemberModel(BaseModel):
    family_id: int = Field(ge=1, examples=[2])
    user_id: int = Field(ge=1, examples=[1])
    status: FamilyStatus = Field(examples=[FamilyStatus.PENDING])


class FamilyDeviceModel(BaseModel):
    device_id: int = Field(ge=1, examples=[2])
    family_id: int = Field(ge=1, examples=[1])


@omit("id", "user_id")
class FamilyCreate(FamilyModel):
    pass
