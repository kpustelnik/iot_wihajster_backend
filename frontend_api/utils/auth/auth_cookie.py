from fastapi.security import APIKeyCookie
from fastapi import Request

from app_common.config import settings
from .auth_result import Result


class JWTCookie(APIKeyCookie):
    def __init__(self):
        super().__init__(name=settings.jwt_cookie_name, auto_error=False)

    async def __call__(self, request: Request) -> Result:
        token: str = await super().__call__(request)
        if not token:
            return Result.err("Invalid authorization code.")
        return Result.ok(token)
