import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app_common.models.device import PrivacyLevel, SettingsStatus
from app_common.utils.schemas_decorators import omit


class DeviceModel(BaseModel):
    id: int = Field(ge=1, examples=[1])
    user_id: int | None = Field(ge=1, examples=[1], default=None)
    day_collection_interval: datetime.timedelta = Field(examples=[datetime.timedelta(minutes=5)], default=datetime.timedelta(minutes=5))
    night_collection_interval: datetime.timedelta = Field(examples=[datetime.timedelta(minutes=15)], default=datetime.timedelta(minutes=15))
    day_start: datetime.time = Field(examples=[datetime.time(hour=22)], default=datetime.time(hour=22))
    day_end: datetime.time = Field(examples=[datetime.time(hour=6)], default=datetime.time(hour=6))
    privacy: PrivacyLevel = Field(examples=[PrivacyLevel.PRIVATE], default=PrivacyLevel.PRIVATE)
    battery: Optional[int] = Field(examples=[50], default=None)
    status: SettingsStatus = Field(examples=[SettingsStatus.ACCEPTED])


@omit("user_id", "privacy", "battery")
class DeviceSettings(DeviceModel):
    pass

class DeviceConnectInit(BaseModel):
    cert: str