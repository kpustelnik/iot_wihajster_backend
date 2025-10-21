from fastapi import APIRouter

from app.routes import users

router = APIRouter()

router.include_router(users.router)
