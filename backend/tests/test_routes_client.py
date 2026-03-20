import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone
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


def _transit_steps_payload() -> dict:
    return {
        "status": "OK",
        "routes": [
            {
                "overview_polyline": {"points": "abc123"},
                "legs": [
                    {
                        "distance": {"text": "6.2 km", "value": 6200},
                        "duration": {"text": "21 mins", "value": 1260},
                        "steps": [
                            {
                                "travel_mode": "WALKING",
                                "html_instructions": "駅まで歩く",
                                "distance": {"text": "200 m", "value": 200},
                                "duration": {"text": "3 mins", "value": 180},
                            },
                            {
                                "travel_mode": "TRANSIT",
                                "html_instructions": "JR山手線に乗車",
                                "distance": {"text": "5.0 km", "value": 5000},
                                "duration": {"text": "12 mins", "value": 720},
                                "transit_details": {
                                    "departure_stop": {"name": "東京駅"},
                                    "arrival_stop": {"name": "渋谷駅"},
                                    "departure_time": {"value": 1711267200},
                                    "arrival_time": {"value": 1711267920},
                                    "headsign": "外回り",
                                    "line": {
                                        "short_name": "JR山手線",
                                        "vehicle": {"type": "HEAVY_RAIL"},
                                    },
                                },
                            },
                        ],
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


def test_fetch_directions_encodes_departure_time(monkeypatch):
    client = RoutesClient(api_key="test-key")
    captured = {"url": None}

    def _fake_urlopen(req, timeout):
        _ = timeout
        captured["url"] = req.full_url
        return _DummyResponse(_ok_payload())

    monkeypatch.setattr("app.infrastructure.external.routes_client.request.urlopen", _fake_urlopen)

    client.fetch_directions(
        origin="東京駅",
        destination="渋谷駅",
        mode="transit",
        departure_time=datetime(2024, 3, 24, 9, 0, tzinfo=timezone.utc),
    )

    parsed = parse.urlparse(captured["url"])
    query = parse.parse_qs(parsed.query)
    assert query["departure_time"] == ["1711270800"]


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


@pytest.mark.asyncio
async def test_compute_route_steps_with_diagnostics_parses_transit_steps(monkeypatch):
    client = RoutesClient(api_key="test-key")

    def _fake_request_directions(origin, destination, mode, departure_time=None):
        assert origin == "東京駅"
        assert destination == "渋谷駅"
        assert mode == "transit"
        assert departure_time is not None
        return _transit_steps_payload()

    monkeypatch.setattr(client, "_request_directions", _fake_request_directions)

    steps, diagnostics = await client.compute_route_steps_with_diagnostics(
        origin="東京駅",
        destination="渋谷駅",
        departure_time=datetime(2024, 3, 24, 9, 0, tzinfo=timezone.utc),
    )

    assert len(steps) == 2
    assert diagnostics["transit_succeeded_pairs"] == 1
    assert steps[0].travel_mode == "WALK"
    assert steps[0].notes == "駅まで歩く"
    assert steps[1].travel_mode == "TRANSIT"
    assert steps[1].transit_subtype == "TRAIN"
    assert steps[1].line_name == "JR山手線"
    assert steps[1].departure_stop_name == "東京駅"
    assert steps[1].arrival_stop_name == "渋谷駅"
