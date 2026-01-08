import datetime
from decimal import Decimal
from typing import Optional, Literal

from pydantic import BaseModel, Field

from app_common.schemas import DeviceModel
from app_common.utils.schemas_decorators import update_model


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
    time: datetime.datetime = Field(examples=[datetime.datetime.now()], default=datetime.datetime.now())
    humidity: Optional[float] = Field(examples=[10.5], default=None)
    temperature: Optional[float] = Field(examples=[21.37], default=None)
    pressure: Optional[float] = Field(examples=[1024.5], default=None)
    PM25: Optional[float] = Field(examples=[10.5], default=None)
    PM10: Optional[float] = Field(examples=[25.5], default=None)
    longitude: Optional[float] = Field(examples=[2.2772], default=None)
    latitude: Optional[float] = Field(examples=[53.4006], default=None)
