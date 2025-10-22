from fastapi import APIRouter

from device_api.routes import devices, healthcheck

router = APIRouter()

router.include_router(devices.router)
router.include_router(healthcheck.router)
