import logging
from datetime import datetime, timezone, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.config import settings
from app.database import get_db
from .auth_cookie import JWTCookie
from .auth_result import Result
from ..cookies import remove_auth_cookie
from app.models.user import UserType, User
from app.repos.user_repo import get_user

logger = logging.getLogger('uvicorn.error')


def make_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    res = {
        "sub": str(user_id),
        "exp": exp.timestamp(),
    }
    token = jwt.encode(res, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token


def decode_token(token: str) -> int:
    content = jwt.decode(token, settings.jwt_secret, algorithms=settings.jwt_algorithm)
    return int(content["sub"])


def get_token(cookie_token: Annotated[Result, Depends(JWTCookie())]) -> tuple[str, bool]:
    if not cookie_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=cookie_token.error)
    else:
        return cookie_token.value, True


def remove_auth_cookie_response(response: Response) -> dict[str, str]:
    response = remove_auth_cookie(response)
    return {"set-cookie": response.headers["set-cookie"]}


async def get_current_user(response: Response, token_data: Annotated[tuple[str, bool], Depends(get_token)],
                           db: AsyncSession = Depends(get_db)):
    token, is_cookie = token_data
    try:
        user_id = decode_token(token)
    except jwt.ExpiredSignatureError:
        headers = remove_auth_cookie_response(response) if is_cookie else None
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Expired token", headers=headers)
    except Exception as e:
        logger.error(e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Something went wrong in authentication")

    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token user not found")
    return user


class RequireUser:
    def __init__(self, user_type: UserType | list[UserType] | None = None):
        if user_type is None:
            self.user_type = None
            return
        if not isinstance(user_type, list):
            user_type = [user_type]
        self.user_type = user_type

    async def __call__(self, request: Request, user: Annotated[User, Depends(get_current_user)],
                       db: AsyncSession = Depends(get_db)) -> User:
        if self.user_type is None:
            return user
        if user.type not in self.user_type:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail=f"Forbidden, to access this resource is required to be {' or '.join(self.user_type)}")
        return user
