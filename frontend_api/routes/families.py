from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app_common.database import get_db
from app_common.models.user import User, UserType
from app_common.schemas.default import (
    Forbidden,
    Unauthorized,
)
from app_common.schemas.family import FamilyCreate, FamilyModel
from frontend_api.docs import Tags
from frontend_api.repos import family_repo
from frontend_api.utils.auth.auth import RequireUser

router = APIRouter(
    prefix="/families",
    tags=[Tags.Users],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": Unauthorized},
        status.HTTP_403_FORBIDDEN: {"model": Forbidden},
    },
)


@router.post(
    "",
    dependencies=[Depends(RequireUser([UserType.ADMIN, UserType.CLIENT]))],
    tags=[],
    response_model=FamilyModel,
    responses=None,
    status_code=status.HTTP_201_CREATED,
    summary="Create family",
    response_description="Successful Response",
)
async def create_family(
    family: FamilyCreate,
    current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
    db: AsyncSession = Depends(get_db),
):
    """
    Crete new user.
    """
    return await family_repo.create_family(db, family, current_user)


@router.post(
    "/{family_id}/members",
    dependencies=[Depends(RequireUser([UserType.ADMIN, UserType.CLIENT]))],
    tags=[],
    response_model=None,
    responses=None,
    status_code=status.HTTP_200_OK,
    summary="Add member",
    response_description="Successful Response",
)
async def add_member(family_id: int, user_id: int, db: AsyncSession = Depends(get_db)):
    """
    Add member to familys.
    """
    return await family_repo.add_member(db, family_id, user_id)


"""
 * create family
 * add user to family
 * add your device to family, check if it's your device
 * remove user from family
 * remove device from family, check if it's your device
 * accept / decline family request
 * remove yourself from family
 * delete family
 * change family name, only the main user
 * change the head of the family, (change main user of the family to someone else, but keep yourself as the member of the family)
"""
