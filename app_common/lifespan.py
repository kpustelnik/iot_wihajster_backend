import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app_common.config import settings
from app_common.database import sessionmanager

import asyncio
from app_common.utils.mqtt_handler import mqtt_runner

logger = logging.getLogger('uvicorn.error')


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await sessionmanager.init_db()
    _mqtt_task = asyncio.create_task(mqtt_runner())
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

    try:
        yield
    finally:
        if _mqtt_task and not _mqtt_task.done():
            _mqtt_task.cancel()
            try:
                await _mqtt_task
            except asyncio.CancelledError:
                pass