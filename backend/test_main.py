from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_get_leituras_returns_list():
    response = client.get("/api/leituras")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_upload_rejects_invalid_extension():
    response = client.post(
        "/api/upload",
        files={"file": ("readings.txt", b"not a spreadsheet", "text/plain")},
    )
    assert response.status_code == 400
