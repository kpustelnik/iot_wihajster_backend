from fastapi import APIRouter

from frontend_api.routes import users, devices, healthcheck, families, measurements, control, firmware

router = APIRouter()

router.include_router(users.router)
router.include_router(devices.router)
router.include_router(healthcheck.router)
router.include_router(families.router)
router.include_router(measurements.router)
router.include_router(control.router)
router.include_router(firmware.router)

