from fastapi import APIRouter

from frontend_api.docs import Tags

router = APIRouter(
    prefix="/devices",
    tags=[Tags.Device],
    responses={}
)

# TODO change settings, require access
# TODO delete yourself from the device, require access
