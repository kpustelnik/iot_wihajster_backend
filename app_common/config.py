from pydantic.v1 import BaseSettings


class Settings(BaseSettings):
    debug: bool = True
    database_url: str = f"postgresql+psycopg://admin:admin@postgres:5432/iot"  # TODO passwords are static
    jwt_secret: str = 'CHANGE_IN_PRODUCTION'
    jwt_algorithm: str = 'HS256'
    jwt_access_token_expire_minutes: int = 180
    jwt_cookie_name: str = 'Authorization'

    # Discord OAuth2 configuration
    discord_client_id: str = ''
    discord_client_secret: str = ''
    discord_redirect_uri: str = 'http://localhost:8000/api/auth/discord/callback'

    # Cloudflare R2 configuration
    r2_endpoint: str = ''
    r2_access_key_id: str = ''
    r2_secret_access_key: str = ''
    r2_bucket_name: str = 'firmware'
    r2_public_url: str = ''

    class Config:
        env_file = ".env"
        fields = {
            'discord_client_id': {'env': 'DISCORD_CLIENT_ID'},
            'discord_client_secret': {'env': 'DISCORD_CLIENT_SECRET'},
            'discord_redirect_uri': {'env': 'DISCORD_REDIRECT_URI'},
            'r2_endpoint': {'env': 'S3_BUCKET_ENDPOINT'},
            'r2_access_key_id': {'env': 'S3_ACCESS_KEY_ID'},
            'r2_secret_access_key': {'env': 'S3_SECRET_ACCESS_KEY'},
            'r2_bucket_name': {'env': 'R2_BUCKET_NAME'},
            'r2_public_url': {'env': 'R2_PUBLIC_URL'},
        }


settings = Settings()
