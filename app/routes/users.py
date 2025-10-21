from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.database import get_db
from app.docs import Tags

router = APIRouter(
    prefix="/users",
    tags=None,
    responses={}
)


@router.get("",
            dependencies=[],
            tags=[Tags.Users.Admin],
            response_model=None,
            responses=None,
            status_code=status.HTTP_200_OK,
            summary="Get users",
            response_description="Successful Response")
async def get_users(
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=100, ge=0, le=500),
        db: AsyncSession = Depends(get_db),
):
    """
    Get users. Users can be searched by filling the query param. \\
    User type can be added for additional filtering. \\
    Search terms are split by space. They can be: index_number, mail, name, surname or second_name. \\
    Checks if max search terms have not been exceeded, otherwise raises 422 Unprocessable.
    """
    return ...
