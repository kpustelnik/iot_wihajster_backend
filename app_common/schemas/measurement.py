from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Optional

from pydantic import BaseModel, Field


class Timescale(StrEnum):
    LIVE = "live"       # Last 5 minutes, raw data
    HOUR = "hour"       # Last hour, 1-minute granularity
    HOURS_6 = "hours_6" # Last 6 hours, 5-minute granularity
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


class MeasurementModel(BaseModel):
    ownership_id: int = Field(ge=1, examples=[1])
    device_id: Optional[int] = Field(ge=1, examples=[1], default=None)  # Opcjonalne - może być pobrane z ownership
    time: datetime = Field(examples=[datetime.now()])
    humidity: Optional[float] = Field(examples=[10.5], default=None)
    temperature: Optional[float] = Field(examples=[21.37], default=None)
    pressure: Optional[float] = Field(examples=[1024.5], default=None)
    PM25: Optional[float] = Field(examples=[10.5], default=None)
    PM10: Optional[float] = Field(examples=[25.5], default=None)
    longitude: Optional[float] = Field(examples=[2.2772], default=None)
    latitude: Optional[float] = Field(examples=[53.4006], default=None)


class MeasurementCreate(MeasurementModel):
    time: Optional[datetime] = Field(examples=[datetime.now()], default=datetime.now())


class CriteriaModel(BaseModel):
    time: Optional[int]
    scale: Optional[int]
    region: Optional[str]
    device_id: Optional[int]
    family_id: Optional[int]
    


"""
 * get your measurements (also from family)
    - get by time
    - set time scale
    - get from certain region
    - get by device
    - use pandas to rescale for consistent time periods
    - have a flag to disable automatic rescaling
 * get protected measurement, require logged on, blur the gps location
 * get global measurements, user does not have to login
"""