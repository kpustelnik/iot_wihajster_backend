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


def test_delete_family_success(client: TestClient, cookies: Cookies):
    create_resp = client.post("/families", json={"name": "to_delete"}, cookies=cookies["client"])
    assert create_resp.status_code == 201
    family_id = create_resp.json()["id"]

    delete_resp = client.delete(f"/families/{family_id}", cookies=cookies["client"])
    assert delete_resp.status_code == 200
    data = delete_resp.json()
    assert data["deleted"] == 1
    assert data["detail"] == "Deleted family."


def test_delete_family_unauthorized(client: TestClient, cookies: Cookies):
    create_resp = client.post("/families", json={"name": "private"}, cookies=cookies["client"])
    assert create_resp.status_code == 201
    family_id = create_resp.json()["id"]

    other_cookie_key = next((k for k in cookies.keys() if k != "client"), None)
    if other_cookie_key is None:
        return 

    delete_resp = client.delete(f"/families/{family_id}", cookies=cookies[other_cookie_key])
    assert delete_resp.status_code == 401
    assert delete_resp.json()["detail"] == "You cant delete this family fucker"


def test_leave_family_success(client: TestClient, cookies: Cookies):
    create_resp = client.post("/families", json={"name": "club"}, cookies=cookies["client"])
    assert create_resp.status_code == 201
    family_id = create_resp.json()["id"]

    other_cookie_key = next((k for k in cookies.keys() if k != "client"), None)
    if other_cookie_key is None:
        return  

    other_user_resp = client.get("/users/current", cookies=cookies[other_cookie_key])
    assert other_user_resp.status_code == 200
    other_user_id = other_user_resp.json()["id"]

    add_resp = client.post(f"/families/{family_id}/members/{other_user_id}", cookies=cookies["client"])
    assert add_resp.status_code == 200

    leave_resp = client.delete(f"/families/{family_id}/members/", cookies=cookies[other_cookie_key])
    assert leave_resp.status_code == 200
    data = leave_resp.json()
    assert data["deleted"] == 1
    assert data["detail"] == "Left family."


def test_add_device_success(client: TestClient, cookies: Cookies):

    family_id = 1

    me_resp = client.get("/users/current", cookies=cookies["client"])
    assert me_resp.status_code == 200
    # me_id = me_resp.json()["id"] -> me_id = 2
    
    add_device_resp = client.post(f"/families/{family_id}/devices/{3}", cookies=cookies["client"])
    assert add_device_resp.status_code == 200
    data = add_device_resp.json()
    assert data["family_id"] == family_id
    assert data["device_id"] == 3  
