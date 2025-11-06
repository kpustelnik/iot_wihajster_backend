from fastapi.testclient import TestClient

from app_common.schemas.family import FamilyCreate
from tests.database.fixture_client import Cookies, get_example


def test_create_family(client: TestClient, cookies: Cookies):
    current_user_response = client.get("/users/current", cookies=cookies["client"])
    assert current_user_response.status_code == 200
    current_user = current_user_response.json()
    expected_user_id = current_user["id"]

    valid_family = get_example(FamilyCreate)

    response = client.post("/families",
                           json=valid_family,
                           cookies=cookies["client"])
    data = response.json()

    assert response.status_code == 201, f"data: {data}"
    assert data.pop("id") is not None
    assert data.pop("user_id") == expected_user_id
    assert data == valid_family

def test_add_member(client: TestClient, cookies: Cookies):
    family_data = {"name": "test_family"}
    family_response = client.post("/families", 
                                  json=family_data, 
                                  cookies=cookies["client"]  
    )
    assert family_response.status_code == 201
    family = family_response.json()
    family_id = family["id"]

    response = client.post(
        f"/families/{family_id}/members/3",
        cookies=cookies["client"],
    )

    assert response.status_code == 200

def test_delete_member(client: TestClient, cookies: Cookies):
    delete_response = client.delete(
            f"/families/{1}/members/{4}",
            cookies=cookies["client"],
    )
    
    assert delete_response.status_code == 200
    data = delete_response.json()
    assert data["deleted"] == 1
    assert data["detail"] == "Deleted family member."
