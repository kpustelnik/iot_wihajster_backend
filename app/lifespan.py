import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.config import settings
from app.database import sessionmanager

logger = logging.getLogger('uvicorn.error')


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await sessionmanager.init_db()
    if settings.debug:
        logger.critical("DEBUG MODE IS ON")
        logger.critical("Make sure to not use it on production.")
    yield
    if sessionmanager.engine is not None:
        await sessionmanager.close()
