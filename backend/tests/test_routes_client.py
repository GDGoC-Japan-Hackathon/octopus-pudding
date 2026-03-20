import json
import os
from pathlib import Path
import sys
from urllib import parse

import pytest

os.environ["DEBUG"] = "false"
os.environ["debug"] = "false"
os.environ["FIREBASE_PROJECT_ID"] = "test-project"
os.environ["GOOGLE_ROUTES_API_KEY"] = "test-key"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.infrastructure.external.routes_client import DirectionsAPIError, RoutesClient


class _DummyResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def _ok_payload() -> dict:
    return {
        "status": "OK",
        "routes": [
            {
                "overview_polyline": {"points": "abc123"},
                "legs": [
                    {
                        "distance": {"text": "6.2 km", "value": 6200},
                        "duration": {"text": "21 mins", "value": 1260},
                    }
                ],
            }
        ],
    }


def test_fetch_directions_success(monkeypatch):
    client = RoutesClient(api_key="test-key")

    def _fake_urlopen(req, timeout):
        assert timeout > 0
        return _DummyResponse(_ok_payload())

    monkeypatch.setattr("app.infrastructure.external.routes_client.request.urlopen", _fake_urlopen)

    result = client.fetch_directions(origin="東京駅", destination="渋谷駅", mode="transit")

    assert result == {
        "distance": "6.2 km",
        "duration": "21 mins",
        "polyline": "abc123",
    }


def test_fetch_directions_encodes_origin_destination(monkeypatch):
    client = RoutesClient(api_key="test-key")
    captured = {"url": None}

    def _fake_urlopen(req, timeout):
        _ = timeout
        captured["url"] = req.full_url
        return _DummyResponse(_ok_payload())

    monkeypatch.setattr("app.infrastructure.external.routes_client.request.urlopen", _fake_urlopen)

    client.fetch_directions(origin="東京駅 八重洲口", destination="渋谷駅 ハチ公口", mode="walking")

    parsed = parse.urlparse(captured["url"])
    query = parse.parse_qs(parsed.query)
    assert query["origin"] == ["東京駅 八重洲口"]
    assert query["destination"] == ["渋谷駅 ハチ公口"]
    assert query["mode"] == ["walking"]
    assert query["language"] == ["ja"]
    assert query["key"] == ["test-key"]


@pytest.mark.parametrize("mode", ["bike", "", "WALKING"])
def test_fetch_directions_rejects_invalid_mode(mode):
    client = RoutesClient(api_key="test-key")
    with pytest.raises(ValueError):
        client.fetch_directions(origin="東京駅", destination="渋谷駅", mode=mode)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "origin,destination",
    [
        ("", "渋谷駅"),
        ("東京駅", ""),
        ("   ", "渋谷駅"),
        ("東京駅", "   "),
    ],
)
def test_fetch_directions_rejects_empty_locations(origin, destination):
    client = RoutesClient(api_key="test-key")
    with pytest.raises(ValueError):
        client.fetch_directions(origin=origin, destination=destination, mode="driving")


def test_fetch_directions_raises_on_non_ok_status(monkeypatch):
    client = RoutesClient(api_key="test-key")

    def _fake_urlopen(req, timeout):
        _ = (req, timeout)
        return _DummyResponse({"status": "ZERO_RESULTS", "error_message": "no route"})

    monkeypatch.setattr("app.infrastructure.external.routes_client.request.urlopen", _fake_urlopen)

    with pytest.raises(DirectionsAPIError) as exc_info:
        client.fetch_directions(origin="東京駅", destination="渋谷駅", mode="transit")
    assert exc_info.value.status == "ZERO_RESULTS"


def test_fetch_directions_raises_when_routes_missing(monkeypatch):
    client = RoutesClient(api_key="test-key")

    def _fake_urlopen(req, timeout):
        _ = (req, timeout)
        return _DummyResponse({"status": "OK", "routes": []})

    monkeypatch.setattr("app.infrastructure.external.routes_client.request.urlopen", _fake_urlopen)

    with pytest.raises(DirectionsAPIError) as exc_info:
        client.fetch_directions(origin="東京駅", destination="渋谷駅", mode="driving")
    assert exc_info.value.status == "PARSE_ERROR"
