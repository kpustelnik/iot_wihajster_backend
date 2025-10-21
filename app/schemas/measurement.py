from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class MeasurementModel(BaseModel):
    device_id: int = Field(ge=1, examples=[1])
    time: datetime = Field(examples=[datetime.now()])
    humidity: Optional[int] = Field(examples=[10], default=None)
    temperature: Optional[Decimal] = Field(examples=[Decimal(21.37)], default=None)
    pressure: Optional[int] = Field(examples=[1024], default=None)
    PM25: Optional[int] = Field(examples=[10], default=None)
    PM10: Optional[int] = Field(examples=[25], default=None)
    longitude: Optional[float] = Field(examples=[2.2772], default=None)
    latitude: Optional[float] = Field(examples=[53.4006], default=None)


class MeasurementCreate(MeasurementModel):
    time: Optional[datetime] = Field(examples=[datetime.now()], default=datetime.now())
