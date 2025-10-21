import datetime
from decimal import Decimal
from typing import Optional, Literal

from pydantic import BaseModel, Field

from app.models.device import PrivacyLevel
from app.utils.schemas_decorators import omit, update_model


class DeviceModel(BaseModel):
    id: int = Field(ge=1, examples=[1])
    user_id: int | None = Field(ge=1, examples=[1], default=None)
    day_collection_interval: datetime.timedelta = Field(examples=[datetime.timedelta(minutes=5)], default=datetime.timedelta(minutes=5))
    night_collection_interval: datetime.timedelta = Field(examples=[datetime.timedelta(minutes=15)], default=datetime.timedelta(minutes=15))
    day_start: datetime.time = Field(examples=[datetime.time(hour=22)], default=datetime.time(hour=22))
    day_end: datetime.time = Field(examples=[datetime.time(hour=6)], default=datetime.time(hour=6))
    privacy: PrivacyLevel = Field(examples=[PrivacyLevel.PRIVATE], default=PrivacyLevel.PRIVATE)
    battery: Optional[int] = Field(examples=[50], default=None)


@omit("user_id", "privacy", "battery")
class DeviceSettings(DeviceModel):
    pass


@update_model(omit=["id", "user_id", "privacy"], nullable="battery")
class DeviceUpdateModel(DeviceModel):
    pass


class DeviceData(BaseModel):
    id: int = Field(ge=1, examples=[1])
    # settings
    day_collection_interval: datetime.timedelta = Field(examples=[datetime.timedelta(minutes=5)])
    night_collection_interval: datetime.timedelta = Field(examples=[datetime.timedelta(minutes=15)])
    day_start: datetime.time = Field(examples=[datetime.time(hour=22)])
    day_end: datetime.time = Field(examples=[datetime.time(hour=6)])
    battery: Optional[int | Literal["null"]] = Field(examples=[50], default="null")  # battery is null if it can't be read
    # measurement
    time: datetime = Field(examples=[datetime.datetime.now()], default=datetime.datetime.now())
    humidity: Optional[int] = Field(examples=[10], default=None)
    temperature: Optional[Decimal] = Field(examples=[Decimal(21.37)], default=None)
    pressure: Optional[int] = Field(examples=[1024], default=None)
    PM25: Optional[int] = Field(examples=[10], default=None)
    PM10: Optional[int] = Field(examples=[25], default=None)
    longitude: Optional[float] = Field(examples=[2.2772], default=None)
    latitude: Optional[float] = Field(examples=[53.4006], default=None)
