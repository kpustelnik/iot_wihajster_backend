from fastapi import APIRouter

from app.routes import users, devices

router = APIRouter()

router.include_router(users.router)
