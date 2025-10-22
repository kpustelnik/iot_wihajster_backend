from fastapi import APIRouter, Depends
from starlette import status

from app_common.database import get_db
from app_common.schemas.device import DeviceSettings

from device_api.docs import Tags
from device_api.repos import device_repo
from device_api.schemas.device import DeviceData

router = APIRouter(
    prefix="/devices",
    tags=[Tags.Device],
    responses={}
)


@router.post("/measurement",
             dependencies=None,  # TODO require device
             tags=None,
             response_model=DeviceSettings,
             responses=None,
             status_code=status.HTTP_200_OK,
             summary="create a data point",
             response_description="Successful Response")
async def create_measurement(
        device_data: DeviceData,
        db=Depends(get_db)
):
    """
    Get current user.
    """
    return device_repo.create_measurement(db, device_data)

# TODO change settings
