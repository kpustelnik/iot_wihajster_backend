import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app_common.config import settings
from app_common.database import sessionmanager

import asyncio
from app_common.utils.mqtt_handler import mqtt_runner
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger('uvicorn.error')


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await sessionmanager.init_db()
    _mqtt_task = asyncio.create_task(mqtt_runner())
    if settings.debug:
        from tests.database.csv_to_db import entries_sorted
        session = sessionmanager.session()
        try:
            logger.info(f"Entries count: {len(entries_sorted)}")
            for entry in entries_sorted:
                session.add_all(entry)
                logger.info(f"Added {entry}")
                await session.flush()
            await session.commit()
            logger.info("Entries added to database")
        except IntegrityError as e:
            logger.warning("IntegrityError while adding entries to database")
            logger.warning(f"Database error: {str(e)}")
            await session.rollback()
        finally:
            await session.close()
        logger.critical("DEBUG MODE IS ON")
        logger.critical("Make sure to not use it on production.")

    try:
        yield
    finally:
        if sessionmanager.engine is not None:
            await sessionmanager.close()
        if _mqtt_task and not _mqtt_task.done():
            _mqtt_task.cancel()
            try:
                await asyncio.wait_for(_mqtt_task, timeout=5.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass