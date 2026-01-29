from fastapi import APIRouter

from frontend_api.routes import users, devices, healthcheck, families, measurements, control, firmware, discord_auth, settings, test_endpoints

router = APIRouter()

router.include_router(users.router)
router.include_router(devices.router)
router.include_router(healthcheck.router)
router.include_router(families.router)
router.include_router(measurements.router)
router.include_router(control.router)
router.include_router(firmware.router)
router.include_router(discord_auth.router)
router.include_router(settings.router)
router.include_router(test_endpoints.router)

