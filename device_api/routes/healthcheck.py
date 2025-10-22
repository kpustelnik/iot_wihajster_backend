import datetime
import logging

from fastapi import APIRouter


class HealthcheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.getMessage().find("/healthcheck") == -1 or not record.getMessage().endswith("200")


logging.getLogger("uvicorn.access").addFilter(HealthcheckFilter())

router = APIRouter()


@router.get("/healthcheck")
async def healthcheck():
    return {"now": datetime.datetime.now().astimezone().isoformat()}
