from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app_common.database import get_db
from frontend_api.docs import Tags
from app_common.models.user import UserType, User
from frontend_api.repos import user_repo, auth_repo
from app_common.schemas.default import Unauthorized, Forbidden, LimitedResponse, NotFound
from app_common.schemas.user import UserModel
from frontend_api.utils.auth.auth import RequireUser
from frontend_api.schemas.auth import LoginModel, PasswordRecoverModel

router = APIRouter(
    prefix="/users",
    tags=[Tags.Users],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": Unauthorized},
        status.HTTP_403_FORBIDDEN: {"model": Forbidden},
    }
)


@router.post("/login",
             dependencies=None,
             tags=None,
             response_model=None,
             responses=None,
             status_code=status.HTTP_200_OK,
             summary="login",
             response_description="Successful Response")
async def login(
        login: LoginModel,
        db: AsyncSession = Depends(get_db),
):
    """
    Login user.
    """
    return await auth_repo.login(db, login)


@router.post("/logout",
             dependencies=None,
             tags=None,
             response_model=None,
             responses=None,
             status_code=status.HTTP_200_OK,
             summary="logout",
             response_description="Successful Response")
async def logout():
    """
    Logout.
    """
    return await auth_repo.logout()


@router.post("/recover",
             dependencies=None,
             tags=None,
             response_model=PasswordRecoverModel,
             responses=None,
             status_code=status.HTTP_200_OK,
             summary="recover password",
             response_description="Successful Response")
async def recover(
        login: str,
        db: AsyncSession = Depends(get_db),
):
    """
    Recover password.
    """
    return await auth_repo.recover(db, login)


@router.get("/current",
            dependencies=None,
            tags=None,
            response_model=UserModel,
            responses=None,
            status_code=status.HTTP_200_OK,
            summary="get current user",
            response_description="Successful Response")
async def current(
        user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """
    Get current user.
    """
    return user


@router.get("",
            dependencies=[],
            tags=None,
            response_model=LimitedResponse[UserModel],
            responses=None,
            status_code=status.HTTP_200_OK,
            summary="get users",
            response_description="Successful Response")
async def get_users(
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=100, ge=0, le=500),
        user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
        db=Depends(get_db)
):
    """
    Get users.
    """
    return await user_repo.get_users(db, user, offset, limit)


@router.delete("",
               dependencies=[Depends(RequireUser(UserType.ADMIN))],
               tags=None,
               response_model=LimitedResponse[UserModel],
               responses={status.HTTP_404_NOT_FOUND: {"model": NotFound}},
               status_code=status.HTTP_200_OK,
               summary="get users",
               response_description="Successful Response")
async def delete_user(
        user_id: int,
        db=Depends(get_db)
):
    """
    Delete user - admin.
    """
    return await user_repo.delete_user(db, user_id)

# TODO add email verification
# TODO add google login
