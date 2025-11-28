
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


from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from starlette import status

from app_common.database import get_db
from app_common.models.user import User, UserType
from app_common.schemas.default import (
    Forbidden,
    LimitedResponse,
    Unauthorized,
)
from app_common.schemas.measurement import  MeasurementModel
from frontend_api.docs import Tags
from frontend_api.repos import measurement_repo
from frontend_api.utils.auth.auth import RequireUser

router = APIRouter(
    prefix="/measurements",
    tags=[Tags.Measurements],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": Unauthorized},
        status.HTTP_403_FORBIDDEN: {"model": Forbidden},
    },
)


@router.get(
    "",
    dependencies=[],
    tags=None,
    response_model=LimitedResponse[MeasurementModel],
    responses=None,
    status_code=status.HTTP_200_OK,
    summary="get measurements",
    response_description="Successful Response",
)
async def get_measurements(
        device_id: Optional[int] = Query(default=None, ge=0),
        family_id: Optional[int] = Query(default=None, ge=0),
        time_from: Optional[datetime] = Query(default=None),
        time_to: Optional[datetime] = Query(default=None),
        lat: Optional[float] = Query(default=None),
        lon: Optional[float] = Query(default=None),
        radius_km: Optional[float] = Query(default=None),
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=100, ge=0, le=500),
        user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
        db=Depends(get_db),
):
    """
    Get measurements.
    """
    return await measurement_repo.get_measurements(db, device_id, family_id, time_from, time_to, lat, lon, radius_km, user, offset, limit)

