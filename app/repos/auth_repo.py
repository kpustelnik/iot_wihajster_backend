from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status
from starlette.responses import JSONResponse

from app.models import User
from app.repos.user_repo import get_user_by_login
from app.utils.auth.auth import make_token
from app.utils.cookies import add_auth_cookie, remove_auth_cookie


async def login(
        db: AsyncSession,
        login: str,
        password: str
):
    user = await get_user_by_login(db, login)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.password != password:  # it's stupid, but perfect
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Incorrect password")
    token = make_token(user.id)
    response = JSONResponse({"token": token, "user_id": user.id})
    response = add_auth_cookie(response, token)
    return response


async def logout():
    response = JSONResponse({"message": "Logged out"})
    response = remove_auth_cookie(response)
    return response


async def recover(
        db: AsyncSession,
        login: str
) -> dict[str, str]:
    query = select(User).where(User.login == login)
    return {"password": (await db.scalar(query)).password}