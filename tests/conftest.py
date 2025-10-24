from app_common.config import settings

pytest_plugins = [
    "tests.database.fixture_client"
]

settings.debug = False
settings.jwt_secret = "test"
settings.jwt_access_token_expire_minutes = 90000
