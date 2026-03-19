import asyncio
import json
from dataclasses import asdict, dataclass
from typing import Optional
from urllib.parse import urlencode
from urllib import error, request

from app.shared.config import settings


@dataclass
class PlaceCandidate:
    name: str
    place_resource_name: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    price_level: Optional[str] = None
    photo_name: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class GooglePlacesClient:
    """Simple Google Places Text Search API client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or settings.google_places_api_key
        self.endpoint = endpoint or settings.google_places_endpoint

    async def search_text(
        self,
        query: str,
        max_results: int = 10,
        language_code: Optional[str] = None,
        region_code: Optional[str] = None,
    ) -> list[PlaceCandidate]:
        if not self.api_key:
            raise RuntimeError("Google Places API key is not configured")
        return await asyncio.to_thread(
            self._search_text_sync,
            query=query,
            max_results=max_results,
            language_code=language_code or settings.google_places_language_code,
            region_code=region_code or settings.google_places_region_code,
        )

    async def get_photo_media(
        self,
        photo_name: str,
        *,
        max_width_px: int = 1200,
        max_height_px: int = 900,
    ) -> Optional[str]:
        if not self.api_key:
            raise RuntimeError("Google Places API key is not configured")
        if not photo_name:
            return None
        return await asyncio.to_thread(
            self._get_photo_media_sync,
            photo_name=photo_name,
            max_width_px=max_width_px,
            max_height_px=max_height_px,
        )

    def _search_text_sync(
        self,
        query: str,
        max_results: int,
        language_code: str,
        region_code: str,
    ) -> list[PlaceCandidate]:
        payload = {
            "textQuery": query,
            "pageSize": max(1, min(max_results, 20)),
            "languageCode": language_code,
            "regionCode": region_code,
        }
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": (
                "places.name,places.displayName,places.primaryType,places.formattedAddress,"
                "places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos"
            ),
        }
        req = request.Request(self.endpoint, data=body, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Google Places API error: {exc.code} {detail}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Google Places connection error: {exc.reason}") from exc

        response = json.loads(raw)
        places = response.get("places", []) or []
        candidates: list[PlaceCandidate] = []
        for place in places:
            location = place.get("location") or {}
            photos = place.get("photos") or []
            first_photo = photos[0] if photos else {}
            candidates.append(
                PlaceCandidate(
                    name=(place.get("displayName") or {}).get("text", ""),
                    place_resource_name=place.get("name"),
                    category=place.get("primaryType"),
                    address=place.get("formattedAddress"),
                    latitude=location.get("latitude"),
                    longitude=location.get("longitude"),
                    rating=place.get("rating"),
                    user_ratings_total=place.get("userRatingCount"),
                    price_level=place.get("priceLevel"),
                    photo_name=first_photo.get("name"),
                )
            )
        return [c for c in candidates if c.name]

    def _get_photo_media_sync(
        self,
        *,
        photo_name: str,
        max_width_px: int,
        max_height_px: int,
    ) -> Optional[str]:
        query = urlencode(
            {
                "key": self.api_key,
                "maxWidthPx": max(1, min(max_width_px, 4800)),
                "maxHeightPx": max(1, min(max_height_px, 4800)),
                "skipHttpRedirect": "true",
            }
        )
        media_url = f"https://places.googleapis.com/v1/{photo_name}/media?{query}"
        req = request.Request(media_url, method="GET")
        try:
            with request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Google Places Photo API error: {exc.code} {detail}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Google Places Photo API connection error: {exc.reason}") from exc

        response = json.loads(raw)
        photo_uri = response.get("photoUri")
        return str(photo_uri) if photo_uri else None
