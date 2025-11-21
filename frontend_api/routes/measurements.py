
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


from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app_common.database import get_db
from app_common.models.user import User, UserType
from app_common.schemas.default import (
    Delete,
    Forbidden,
    LimitedResponse,
    NotFound,
    Unauthorized,
)
from app_common.schemas.device import DeviceModel
from app_common.schemas.family import FamilyCreate, FamilyDeviceModel, FamilyModel, FamilyMemberModel
from app_common.schemas.measurement import CriteriaModel, MeasurementModel
from app_common.schemas.user import UserModel
from frontend_api.docs import Tags
from frontend_api.repos import family_repo, measurement_repo
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
        critiria: CriteriaModel,
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=100, ge=0, le=500),
        user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
        db=Depends(get_db),
):
    """
    Get measurements.
    """
    return await measurement_repo.get_measurements(db, critiria, user, offset, limit)



