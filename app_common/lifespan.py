import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app_common.config import settings
from app_common.database import sessionmanager

import asyncio
from app_common.utils.mqtt_handler import mqtt_runner
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

logger = logging.getLogger('uvicorn.error')


async def fix_postgres_sequences(session):
    """
    Fix PostgreSQL sequences after inserting data with explicit IDs.
    This ensures auto-increment IDs continue from the correct value.
    """
    # List of tables with sequences that need fixing
    # Table names must match actual PostgreSQL table names (usually plural)
    tables_with_sequences = [
        ('users', 'users_id_seq'),
        ('devices', 'devices_id_seq'),
        ('families', 'families_id_seq'),
        ('family_members', 'family_members_id_seq'),
        ('family_devices', 'family_devices_id_seq'),
        ('measurements', 'measurements_id_seq'),
    ]
    
    for table_name, seq_name in tables_with_sequences:
        try:
            # Check if table exists and has data
            result = await session.execute(
                text(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table_name}")
            )
            next_val = result.scalar()
            
            # Update sequence
            await session.execute(
                text(f"SELECT setval('{seq_name}', {next_val}, false)")
            )
            logger.info(f"Fixed sequence {seq_name} to start at {next_val}")
        except Exception as e:
            logger.warning(f"Could not fix sequence {seq_name}: {e}")
    
    await session.commit()


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
            
            # Fix PostgreSQL sequences after loading test data
            await fix_postgres_sequences(session)
            
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