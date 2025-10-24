from fastapi import APIRouter

from frontend_api.docs import Tags

router = APIRouter(
    prefix="/devices",
    tags=[Tags.Device],
    responses={}
)

"""
 * change device settings only it's owner
 * delete yourself from the device, require access
 Device Status:
    * private: only you and your family
    * protected: mangle the gps data
    * public: everybody has access to every data point
"""