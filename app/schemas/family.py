from pydantic import BaseModel, Field

from app.models.family import FamilyStatus


class FamilyModel(BaseModel):
    main_user_id: int = Field(ge=1, examples=[2])
    client_user_id: int = Field(ge=1, examples=[1])
    status: FamilyStatus = Field(examples=[FamilyStatus.PENDING])
