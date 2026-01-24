from pydantic.v1 import BaseSettings


class Settings(BaseSettings):
    debug: bool = True
    database_url: str = f"postgresql+psycopg://admin:admin@postgres:5432/iot"  # TODO passwords are static
    jwt_secret: str = 'CHANGE_IN_PRODUCTION'
    jwt_algorithm: str = 'HS256'
    jwt_access_token_expire_minutes: int = 180
    jwt_cookie_name: str = 'Authorization'

    # Cloudflare R2 configuration
    r2_endpoint: str = ''  # S3_BUCKET_ENDPOINT from .env
    r2_access_key_id: str = ''  # S3_ACCESS_KEY_ID from .env
    r2_secret_access_key: str = ''  # S3_SECRET_ACCESS_KEY from .env
    r2_bucket_name: str = 'firmware'
    r2_public_url: str = ''  # Public URL for R2 bucket (optional, for public access)

    class Config:
        env_file = ".env"
        fields = {
            'r2_endpoint': {'env': 'S3_BUCKET_ENDPOINT'},
            'r2_access_key_id': {'env': 'S3_ACCESS_KEY_ID'},
            'r2_secret_access_key': {'env': 'S3_SECRET_ACCESS_KEY'},
            'r2_bucket_name': {'env': 'R2_BUCKET_NAME'},
            'r2_public_url': {'env': 'R2_PUBLIC_URL'},
        }


settings = Settings()
