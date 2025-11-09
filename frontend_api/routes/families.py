from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app_common.database import get_db
from app_common.models.user import User, UserType
from app_common.schemas.default import (
    Delete,
    Forbidden,
    LimitedResponse,
    NotFound,
    Unauthorized,
)
from app_common.schemas.device import DeviceModel
from app_common.schemas.family import FamilyCreate, FamilyDeviceModel, FamilyModel, FamilyMemberModel
from app_common.schemas.user import UserModel
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
    dependencies=[],
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
    Create new family.
    """
    return await family_repo.create_family(db, family, current_user)


@router.post(
    "/{family_id}/members/{user_id}",
    dependencies=[Depends(RequireUser([UserType.ADMIN, UserType.CLIENT]))],
    tags=[],
    response_model=FamilyMemberModel, 
    responses=None,
    status_code=status.HTTP_200_OK,
    summary="Add member",
    response_description="Successful Response",
)
async def add_member(
        family_id: int,
        user_id: int,
        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
        db: AsyncSession = Depends(get_db)
):
    """
    Add member to families.
    """
    return await family_repo.add_member(db, family_id, user_id, current_user)


@router.delete(
    "/{family_id}/members/{user_id}",
    dependencies=[],
    tags=[],
    response_model=Delete, 
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFound}},
    status_code=status.HTTP_200_OK,
    summary="Delete member",
    response_description="Successful Response",
)
async def delete_member(
        family_id: int,
        user_id: int,
        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
        db: AsyncSession = Depends(get_db)
):
    """
    Add member to families.
    """
    return await family_repo.delete_member(db, family_id, user_id, current_user)


@router.delete(
    "/{family_id}",
    dependencies=[],
    tags=[],
    response_model=Delete,
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFound}},
    status_code=status.HTTP_200_OK,
    summary="delete family",
    response_description="Successful Response",
)
async def delete_family(
        family_id: int,
        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
        db: AsyncSession = Depends(get_db),
):
    """
    Delete new family.
    """
    return await family_repo.delete_family(db, family_id, current_user)


@router.delete(
    "/{family_id}/members/",
    dependencies=[],
    tags=[],
    response_model=Delete, 
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFound}},
    status_code=status.HTTP_200_OK,
    summary="Delete yourself",
    response_description="Successful Response",
)
async def leave_family(
        family_id: int,
        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
        db: AsyncSession = Depends(get_db)
):
    """
    Leave family.
    """
    return await family_repo.leave_family(db, family_id, current_user)


@router.post(
    "/{family_id}/devices/{device_id}",
    dependencies=[],
    tags=[],
    response_model=FamilyDeviceModel, 
    responses=None,
    status_code=status.HTTP_200_OK,
    summary="Add device",
    response_description="Successful Response",
)
async def add_device(
        family_id: int,
        device_id: int,
        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
        db: AsyncSession = Depends(get_db)
):
    """
    Add device to family.
    """
    return await family_repo.add_device(db, family_id, device_id, current_user)


@router.get(
    "/{family_id}/devices",
    dependencies=[],
    tags=None,
    response_model=LimitedResponse[DeviceModel],
    responses=None,
    status_code=status.HTTP_200_OK,
    summary="get devices in family",
    response_description="Successful Response",
)
async def get_devices(
        family_id: int,
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=100, ge=0, le=500),
        user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
        db=Depends(get_db),
):
    """
    Get devices in selected family.
    """
    return await family_repo.get_devices(db, family_id, user, offset, limit)


@router.get(
    "/{family_id}/members",
    dependencies=[],
    tags=None,
    response_model=LimitedResponse[UserModel],
    responses=None,
    status_code=status.HTTP_200_OK,
    summary="get members of family",
    response_description="Successful Response",
)
async def get_members(
        family_id: int,
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=100, ge=0, le=500),
        user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
        db=Depends(get_db),
):
    """
    Get members in selected family.
    """
    return await family_repo.get_members(db, family_id, user, offset, limit)


@router.delete(
    "/{family_id}/devices/{device_id}",
    dependencies=[],
    tags=[],
    response_model=Delete, 
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFound}},
    status_code=status.HTTP_200_OK,
    summary="Delete device from family",
    response_description="Successful Response",
)
async def delete_family_device(
        family_id: int,
        device_id: int,
        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
        db: AsyncSession = Depends(get_db)
):
    """
    Delete device from family.
    """
    return await family_repo.delete_family_device(db, family_id, device_id, current_user)


@router.patch(
    "/{family_id}/members/{user_id}/accept",
    dependencies=[],
    tags=[],
    response_model=FamilyMemberModel, 
    responses=None,
    status_code=status.HTTP_200_OK,
    summary="Accept invite",
    response_description="Successful Response",
)
async def accept_invite(
        family_id: int,
        user_id: int,
        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
        db: AsyncSession = Depends(get_db)
):
    """
    Accept invite to family.
    """
    return await family_repo.accept_invite(db, family_id, user_id, current_user)


@router.delete(
    "/{family_id}/members/{user_id}/decline",
    dependencies=[],
    tags=[],
    response_model=Delete, 
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFound}},
    status_code=status.HTTP_200_OK,
    summary="Decline invite",
    response_description="Successful Response",
)
async def decline_invite(
        family_id: int,
        user_id: int,
        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
        db: AsyncSession = Depends(get_db)
):
    """
    Decline invite to family.
    """
    return await family_repo.decline_invite(db, family_id, user_id, current_user)


"""
 * create family
 * add user to family
 * remove user from family
 * add your device to family, check if it's your device
 * remove device from family, check if it's your device
 * accept / decline family request
 * remove yourself from family
 * delete family
 useless:
 * change family name, only the main user
 * change the head of the family, (change main user of the family to someone else, but keep yourself as the member of the family)
"""
