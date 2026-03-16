import json
import time
from functools import lru_cache
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen

from jose import jwt
from jose.exceptions import JWTError

from app.shared.config import settings

GOOGLE_X509_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)


class FirebaseTokenError(Exception):
    """Raised when Firebase ID token verification fails."""


_cert_cache: dict[str, Any] = {"expires_at": 0.0, "certs": {}}


def _fetch_google_x509_certs() -> tuple[dict[str, str], int]:
    req = urlopen(GOOGLE_X509_CERTS_URL, timeout=5)
    body = req.read().decode("utf-8")
    certs = json.loads(body)

    max_age = 300
    cache_control = req.headers.get("Cache-Control", "")
    for part in cache_control.split(","):
        part = part.strip()
        if part.startswith("max-age="):
            value = part.split("=", 1)[1]
            if value.isdigit():
                max_age = int(value)
            break

    return certs, max_age


@lru_cache(maxsize=1)
def _expected_issuer() -> str:
    return f"https://securetoken.google.com/{settings.firebase_project_id}"


def _get_google_public_key(kid: str) -> str:
    now = time.time()
    certs: dict[str, str] = _cert_cache["certs"]
    expires_at: float = _cert_cache["expires_at"]

    if now >= expires_at or kid not in certs:
        try:
            certs, max_age = _fetch_google_x509_certs()
        except (TimeoutError, URLError, json.JSONDecodeError) as exc:
            raise FirebaseTokenError(f"failed to fetch Google certs: {exc}") from exc

        _cert_cache["certs"] = certs
        _cert_cache["expires_at"] = now + max_age

    key = _cert_cache["certs"].get(kid)
    if not key:
        raise FirebaseTokenError("public key for token 'kid' was not found")
    return key


def verify_firebase_id_token(id_token: str) -> dict:
    """Verify Firebase ID token using Google public certificates."""
    try:
        header = jwt.get_unverified_header(id_token)
    except JWTError as exc:
        raise FirebaseTokenError(f"invalid token header: {exc}") from exc

    kid = header.get("kid")
    if not kid:
        raise FirebaseTokenError("token header missing 'kid'")

    key = _get_google_public_key(kid)
    try:
        claims = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=settings.firebase_project_id,
            issuer=_expected_issuer(),
            options={"verify_at_hash": False},
        )
    except JWTError as exc:
        raise FirebaseTokenError(f"token verification failed: {exc}") from exc

    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub.strip():
        raise FirebaseTokenError("token claim 'sub' is missing or empty")

    claims["uid"] = claims.get("user_id") or sub
    return claims
