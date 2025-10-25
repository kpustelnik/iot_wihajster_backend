import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app_common.config import settings
from app_common.database import sessionmanager

logger = logging.getLogger('uvicorn.error')


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await sessionmanager.init_db()
    if settings.debug:
        from tests.database.csv_to_db import entries
        session = sessionmanager.session()
        session.add_all(entries)
        await session.close()
        logger.critical("DEBUG MODE IS ON")
        logger.critical("Make sure to not use it on production.")
    yield
    if sessionmanager.engine is not None:
        await sessionmanager.close()
