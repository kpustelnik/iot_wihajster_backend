from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.database import get_db
from app.docs import Tags
from app.models.user import UserType, User
from app.repos import user_repo, auth_repo
from app.schemas.user import UserModel
from app.utils.auth.auth import RequireUser

router = APIRouter(
    prefix="/users",
    tags=[Tags.Users],
    responses={}
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
        login: str,
        password: str,
        db: AsyncSession = Depends(get_db),
):
    # TODO it's so stupid, add a model or something
    """
    Login user.
    """
    return await auth_repo.login(db, login, password)


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
             response_model=None,
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

# TODO get users and search
# TODO add email verification
# TODO delete user
