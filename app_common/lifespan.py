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
        from tests.database.csv_to_db import postgres_entries
        session = sessionmanager.session()
        for f in ["user", "device", "family", "measurement"]:  # FIXME it's stupid
            try:
                session.add_all(postgres_entries[f])
                await session.commit()
            except:
                await session.rollback()
        await session.close()
        logger.critical("DEBUG MODE IS ON")
        logger.critical("Make sure to not use it on production.")
    yield
    if sessionmanager.engine is not None:
        await sessionmanager.close()
