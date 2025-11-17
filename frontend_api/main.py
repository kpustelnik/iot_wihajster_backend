import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import RedirectResponse
from starlette.staticfiles import StaticFiles

from app_common.lifespan import lifespan
from app_common.config import settings
from frontend_api.routes import router
from frontend_api.docs import tags_metadata

from app_common.utils.certs.ca import CertificateAuthority
ca = CertificateAuthority(True) # Initialize the CA
awsRegistrationCode = os.getenv("AWS_CA_REGISTRATION_CODE", None)
if awsRegistrationCode is not None and not os.path.exists(f"/certs/servers/AWS_{awsRegistrationCode}_cert.crt") :
    aws_cert = ca.issue_server_certificate(awsRegistrationCode)
    dir = '/certs/servers'
    os.makedirs(dir, exist_ok=True)
    aws_cert.cert_chain_pems[0].write_to_path(f"{dir}/AWS_{awsRegistrationCode}_cert.crt")
    aws_cert.private_key_pem.write_to_path(f"{dir}/AWS_{awsRegistrationCode}_key.key")
if not os.path.exists("/certs/mqtt_server.crt"):
    mqtt_cert = ca.issue_server_certificate("MQTT_Server")
    dir = '/certs'
    os.makedirs(dir, exist_ok=True)
    mqtt_cert.cert_chain_pems[0].write_to_path(f"{dir}/mqtt_server.crt")
    mqtt_cert.private_key_pem.write_to_path(f"{dir}/mqtt_server.key")

description = f'''
**Build from:** {os.getenv('BUILD_TIME', "unknown")} rev. {os.getenv("CI_COMMIT_SHORT_SHA", "unknown")}.
'''
app = FastAPI(lifespan=lifespan, title="IoT Frontend API", openapi_tags=tags_metadata, description=description)

origins = ["http://localhost:3000", "https://wihajster-front.ivk.pl", "https://kpustelnik.github.io"] # TODO: Clean

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
async def root():
    response = RedirectResponse(url="/docs")
    return response


# For development
if settings.debug:
    app.mount("/", StaticFiles(directory="static"), name="static")
