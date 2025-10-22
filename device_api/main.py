import os

from fastapi import FastAPI
from starlette.responses import RedirectResponse

from app_common.lifespan import lifespan
from device_api.routes import router
from device_api.docs import tags_metadata

description = f'''
**Build from:** {os.getenv('BUILD_TIME', "unknown")} rev. {os.getenv("CI_COMMIT_SHORT_SHA", "unknown")}.
'''
app = FastAPI(lifespan=lifespan, title="IoT Device API", openapi_tags=tags_metadata, description=description)

app.include_router(router)


@app.get("/")
async def root():
    response = RedirectResponse(url="/docs")
    return response


# For development
# FIXME why?
# if settings.debug:
#     app.mount("/", StaticFiles(directory="static"), name="static")
