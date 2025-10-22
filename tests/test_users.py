import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.database.fixture_client import Cookies


@pytest.mark.asyncio
async def test_login(client: TestClient, cookies: Cookies, session: AsyncSession):
    response = client.post("/users/login",
                           params={"login": "admin", "password": "admin"})
    data = response.json()
    assert response.status_code == 200, f"data: {data}"
    await session.commit()  # example
    from .database.csv_to_db import filenames
    print(filenames)


def test_logout(client: TestClient, cookies: Cookies):
    response = client.post("/users/logout",
                           cookies=cookies['client'])
    data = response.json()
    assert response.status_code == 200, f"data: {data}"
