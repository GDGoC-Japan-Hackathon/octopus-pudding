import asyncio
import json
import re
import time
from typing import Any, Optional
from urllib import error, parse, request

from app.shared.config import settings


class GeminiClient:
    """Simple Gemini generateContent API client."""

    MAX_RETRIES = 2
    RETRY_BUFFER_SECONDS = 1.0

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or settings.gemini_api_key
        self.model = model or settings.gemini_model
        self.base_url = (base_url or settings.gemini_api_base_url).rstrip("/")

    async def generate_json(
        self,
        prompt: str,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("Gemini API key is not configured")
        return await asyncio.to_thread(
            self._generate_json_sync,
            prompt=prompt,
            temperature=temperature,
        )

    def _generate_json_sync(
        self,
        prompt: str,
        temperature: float,
    ) -> dict[str, Any]:
        last_error: RuntimeError | None = None
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                return self._generate_json_once(prompt=prompt, temperature=temperature)
            except RuntimeError as exc:
                last_error = exc
                retry_after_seconds = self._extract_retry_after_seconds(str(exc))
                if retry_after_seconds is None or attempt >= self.MAX_RETRIES:
                    raise
                time.sleep(retry_after_seconds + self.RETRY_BUFFER_SECONDS)

        raise last_error or RuntimeError("Gemini API request failed")

    def _generate_json_once(
        self,
        prompt: str,
        temperature: float,
    ) -> dict[str, Any]:
        url = (
            f"{self.base_url}/models/{self.model}:generateContent?"
            f"{parse.urlencode({'key': self.api_key})}"
        )
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
            },
        }
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        req = request.Request(url, data=body, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=45) as resp:
                raw = resp.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Gemini API error: {exc.code} {detail}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Gemini connection error: {exc.reason}") from exc

        response = json.loads(raw)
        candidates = response.get("candidates", []) or []
        if not candidates:
            raise RuntimeError("Gemini returned no candidates")
        parts = ((candidates[0].get("content") or {}).get("parts") or [])
        if not parts:
            raise RuntimeError("Gemini returned empty content")
        text = parts[0].get("text")
        if not text:
            raise RuntimeError("Gemini returned no text content")

        clean = text.strip()
        if clean.startswith("```"):
            clean = clean.strip("`")
            if clean.startswith("json"):
                clean = clean[4:].strip()
        try:
            parsed = json.loads(clean)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Gemini JSON parse error") from exc
        if not isinstance(parsed, dict):
            raise RuntimeError("Gemini response JSON must be an object")
        return parsed

    def _extract_retry_after_seconds(self, error_message: str) -> Optional[float]:
        if "Gemini API error: 429" not in error_message:
            return None
        match = re.search(r"retry in\s+(\d+(?:\.\d+)?)s", error_message, flags=re.IGNORECASE)
        if not match:
            return None
        try:
            return float(match.group(1))
        except ValueError:
            return None
