from pydantic.v1 import BaseSettings


class Settings(BaseSettings):
    debug: bool = False
    database_url: str = 'sqlite+aiosqlite:///test.db'
    jwt_secret: str = 'CHANGE_IN_PRODUCTION'
    jwt_algorithm: str = 'HS256'
    jwt_access_token_expire_minutes: int = 180
    jwt_cookie_name: str = 'Authorization'

    class Config:
        env_file = ".env"


settings = Settings()
