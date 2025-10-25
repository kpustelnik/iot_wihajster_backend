from fastapi.testclient import TestClient

from tests.database.fixture_client import Cookies


def test_create_family(client: TestClient, cookies: Cookies):
    
    # klient
    current_user_response = client.get("/users/current", cookies=cookies["client"])
    assert current_user_response.status_code == 200
    current_user = current_user_response.json()
    expected_user_id = current_user["id"]


    valid_family = {"name": "family1"}

    response = client.post("/families", json=valid_family, cookies=cookies["client"])
    data = response.json()

    assert response.status_code == 201, f"data: {data}"
    assert data["name"] == valid_family["name"]
    assert "user_id" in data
    assert data["user_id"] == expected_user_id     
