from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db import get_db
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "saxophone-api"}


def test_unknown_route_has_structured_error():
    response = client.get("/missing")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "http_404"


def test_readiness_reports_database_failure():
    class BrokenDB:
        def execute(self, statement):
            raise OperationalError("SELECT 1", {}, Exception("offline"))

    # Имитируем отказ БД внутри теста, чтобы не останавливать настоящий PostgreSQL.
    app.dependency_overrides[get_db] = lambda: BrokenDB()
    try:
        response = client.get("/ready")
        assert response.status_code == 503
        assert response.json() == {"status": "unavailable"}
    finally:
        app.dependency_overrides.clear()
