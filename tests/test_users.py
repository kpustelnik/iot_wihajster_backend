import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app_common.schemas.user import UserCreate
from tests.database.fixture_client import Cookies, get_example


# @pytest.mark.asyncio
# async def test_login(client: TestClient, cookies: Cookies, session: AsyncSession):
#     response = client.post(
#         "/users/login", params={"login": "admin", "password": "admin"}
#     )
#     data = response.json()
#     assert response.status_code == 200, f"data: {data}"
#     await session.commit()  # example
#     from .database.csv_to_db import filenames

#     print(filenames)


def test_logout(client: TestClient, cookies: Cookies):
    response = client.post("/users/logout", cookies=cookies["client"])
    data = response.json()
    assert response.status_code == 200, f"data: {data}"


def test_create_user(client: TestClient, cookies: Cookies):
    valid_user = get_example(UserCreate)

    response = client.post("/users", json=valid_user)
    data = response.json()
    assert response.status_code == 201, f"data: {data}"
    assert data.pop("id") is not None
    assert data.pop("type") == "client"
    assert data == valid_user

    response = client.post("/users", json=valid_user)
    assert response.status_code == 422, "Not unique email"
