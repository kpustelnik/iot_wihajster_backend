from fastapi import APIRouter, Depends
from starlette import status

from app_common.database import get_db
from frontend_api.docs import Tags
from frontend_api.repos import device_repo
from app_common.schemas.device import DeviceSettings
from schemas.device import DeviceData

router = APIRouter(
    prefix="/devices",
    tags=[Tags.Device],
    responses={}
)

# TODO change settings, require access
# TODO delete yourself from the device, require access
