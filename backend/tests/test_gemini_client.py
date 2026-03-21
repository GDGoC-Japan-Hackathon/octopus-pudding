import json
import os
from pathlib import Path
import sys

import pytest

os.environ["DEBUG"] = "false"
os.environ["debug"] = "false"
os.environ["FIREBASE_PROJECT_ID"] = "test-project"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.infrastructure.external.gemini_client import GeminiClient
from app.infrastructure.external import gemini_client as gemini_client_module


class _DummyResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self) -> bytes:
        payload = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({"ok": True}, ensure_ascii=False),
                            }
                        ]
                    }
                }
            ]
        }
        return json.dumps(payload).encode("utf-8")


def test_generate_json_uses_configured_timeout(monkeypatch):
    captured: dict[str, float] = {}

    def fake_urlopen(req, timeout):  # noqa: ANN001
        captured["timeout"] = timeout
        return _DummyResponse()

    monkeypatch.setattr(gemini_client_module.request, "urlopen", fake_urlopen)

    client = GeminiClient(api_key="test-key")
    client.connect_timeout_seconds = 30
    client.read_timeout_seconds = 90

    result = client._generate_json_once(prompt="test", temperature=0.1)

    assert result == {"ok": True}
    assert captured["timeout"] == 90


def test_generate_json_timeout_error_contains_timeout_values(monkeypatch):
    def fake_urlopen(req, timeout):  # noqa: ANN001
        raise TimeoutError("timed out")

    monkeypatch.setattr(gemini_client_module.request, "urlopen", fake_urlopen)

    client = GeminiClient(api_key="test-key")
    client.connect_timeout_seconds = 20
    client.read_timeout_seconds = 80

    with pytest.raises(RuntimeError, match="Gemini timeout error: connect=20s read=80s"):
        client._generate_json_once(prompt="test", temperature=0.1)
