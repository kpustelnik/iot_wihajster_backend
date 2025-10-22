from starlette.responses import Response

from app_common.config import settings


def add_auth_cookie(res: Response, token: str) -> Response:
    res.set_cookie(key=settings.jwt_cookie_name, value=token, httponly=True, secure=True, samesite='none')
    return res


def remove_auth_cookie(res: Response) -> Response:
    res.delete_cookie(key=settings.jwt_cookie_name, httponly=True, secure=True, samesite='none')
    return res
