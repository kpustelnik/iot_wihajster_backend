import json
import typing
from typing import TypedDict, Literal, Any, Type

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app_common.database import get_db, Base
from frontend_api.main import app
from tests.database.csv_to_db import entries
from app_common.config import settings
from frontend_api.utils.auth.auth import make_token  # TODO seperate device and frontend tests


@pytest_asyncio.fixture(name="session", scope="session", autouse=True)
async def session_fixture():
    engine = create_async_engine("sqlite+aiosqlite:///database/testing.db")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as session:
        session.add_all(entries)
        await session.commit()

        yield session

    await engine.dispose()


@pytest_asyncio.fixture(name="client", scope="function", autouse=True)
async def client_fixture(session: AsyncSession):
    session.commit = session.flush  # quick hack to make session reset-able

    def get_session_override():
        return session

    app.dependency_overrides[get_db] = get_session_override

    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
    await session.reset()  # reset database after every test


class Cookies(TypedDict):
    admin: dict[str, str]
    client: dict[str, str]


@pytest.fixture(name="cookies", scope="session", autouse=True)
def cookies_fixture():
    cookies: Cookies = {
        "admin": {settings.jwt_cookie_name: make_token(1)},
        "client": {settings.jwt_cookie_name: make_token(2)},
    }

    return cookies


def get_example(model: Type[BaseModel], **kwargs) -> dict[str, Any]:
    """
    Every Field in BaseModel in schemas has na example assigned to it.
    This function returns dict of field, and it's example value.
    It's very useful for testing.
    :param model: BaseModel, from which example is taken
    :param kwargs: Fields that should be different from the example
    :return: Dictionary of field to example value
    """
    example: dict[str, Any] = dict()
    for name, field_info in model.model_fields.items():
        if name in kwargs.keys():
            example[name] = kwargs[name]
        elif (t := typing.get_args(field_info.annotation)) and issubclass(t[0],
                                                                          BaseModel):  # compound type of base model, it assumes a list, maybe change later if needed
            example[name] = [get_example(t[0])]
        elif not typing.get_args(field_info.annotation) and issubclass(field_info.annotation,
                                                                       BaseModel):  # simple base model
            example[name] = get_example(field_info.annotation)
        else:
            example[name] = field_info.examples[0]

    return json.loads(model.model_validate(example).model_dump_json())
