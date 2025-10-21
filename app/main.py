import os

from fastapi import FastAPI
from starlette.responses import RedirectResponse
from starlette.staticfiles import StaticFiles

from app.config import settings
from app.lifespan import lifespan
from app.routes import router
from app.docs import tags_metadata

description = f'''
**Build from:** {os.getenv('BUILD_TIME', "unknown")} rev. {os.getenv("CI_COMMIT_SHORT_SHA", "unknown")}.
'''
app = FastAPI(lifespan=lifespan, title="Obieraczka backend", openapi_tags=tags_metadata, description=description)

app.include_router(router)


@app.get("/")
async def root():
    response = RedirectResponse(url="/docs")
    return response


# For development
if settings.debug:
    app.mount("/", StaticFiles(directory="static"), name="static")
