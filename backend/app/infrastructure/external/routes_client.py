import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Optional
from urllib import error, request
import logging

from app.infrastructure.external.google_places_client import PlaceCandidate
from app.shared.config import settings


@dataclass
class RouteOption:
    from_name: str
    to_name: str
    travel_mode: str
    transit_subtype: Optional[str] = None
    duration_minutes: Optional[int] = None
    distance_meters: Optional[int] = None
    summary: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class RoutesClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or settings.google_routes_api_key or settings.google_places_api_key
        self.endpoint = endpoint or settings.google_routes_endpoint

    async def compute_route_options(
        self,
        origin: PlaceCandidate,
        destination: PlaceCandidate,
        departure_time: Optional[datetime] = None,
    ) -> list[RouteOption]:
        if not self.api_key:
            raise RuntimeError("Google Routes API key is not configured")
        if origin.latitude is None or origin.longitude is None:
            return []
        if destination.latitude is None or destination.longitude is None:
            return []

        departure = departure_time or datetime.now(timezone.utc)
        requests = [
            ("WALK", None),
            ("TRANSIT", "BUS"),
            ("TRANSIT", "TRAIN"),
        ]
        results = await asyncio.gather(
            *[
                asyncio.to_thread(
                    self._compute_route_sync,
                    origin,
                    destination,
                    departure,
                    travel_mode,
                    transit_subtype,
                )
                for travel_mode, transit_subtype in requests
            ],
            return_exceptions=True,
        )

        route_options: list[RouteOption] = []
        for result in results:
            if isinstance(result, RouteOption):
                route_options.append(result)
        return route_options

    def _compute_route_sync(
        self,
        origin: PlaceCandidate,
        destination: PlaceCandidate,
        departure_time: datetime,
        travel_mode: str,
        transit_subtype: Optional[str],
    ) -> Optional[RouteOption]:
        payload: dict = {
            "origin": {
                "location": {
                    "latLng": {
                        "latitude": origin.latitude,
                        "longitude": origin.longitude,
                    }
                }
            },
            "destination": {
                "location": {
                    "latLng": {
                        "latitude": destination.latitude,
                        "longitude": destination.longitude,
                    }
                }
            },
            "travelMode": travel_mode,
            "languageCode": settings.google_places_language_code,
            "regionCode": settings.google_places_region_code,
            "units": "METRIC",
        }
        if travel_mode == "TRANSIT":
            payload["departureTime"] = departure_time.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
            if transit_subtype == "BUS":
                payload["transitPreferences"] = {
                    "allowedTravelModes": ["BUS"],
                    "routingPreference": "LESS_WALKING",
                }
            elif transit_subtype == "TRAIN":
                payload["transitPreferences"] = {
                    "allowedTravelModes": ["TRAIN", "RAIL", "SUBWAY", "LIGHT_RAIL"],
                    "routingPreference": "FEWER_TRANSFERS",
                }

        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        }
        req = request.Request(self.endpoint, data=body, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
        except error.HTTPError as e:
            error_body: Optional[str]
            try:
                error_body = e.read().decode("utf-8")
            except Exception:
                error_body = None
            logger = logging.getLogger(__name__)
            logger.error(
                "RoutesClient HTTPError when calling routes API: status=%s, reason=%s, body=%s",
                getattr(e, "code", None),
                getattr(e, "reason", None),
                error_body,
            )
            return None
        except error.URLError as e:
            logger = logging.getLogger(__name__)
            logger.error(
                "RoutesClient URLError when calling routes API: reason=%s",
                getattr(e, "reason", None),
            )
            return None

        response = json.loads(raw)
        routes = response.get("routes", []) or []
        if not routes:
            return None
        route = routes[0]
        duration_minutes = self._duration_to_minutes(route.get("duration"))
        distance_meters = route.get("distanceMeters")
        mode_label = self._mode_label(travel_mode, transit_subtype)
        summary = self._build_summary(mode_label, duration_minutes, distance_meters)
        return RouteOption(
            from_name=origin.name,
            to_name=destination.name,
            travel_mode=travel_mode,
            transit_subtype=transit_subtype,
            duration_minutes=duration_minutes,
            distance_meters=distance_meters if isinstance(distance_meters, int) else None,
            summary=summary,
        )

    @staticmethod
    def _duration_to_minutes(value: Optional[str]) -> Optional[int]:
        if not value or not isinstance(value, str) or not value.endswith("s"):
            return None
        try:
            seconds = float(value[:-1])
        except ValueError:
            return None
        return max(1, round(seconds / 60))

    @staticmethod
    def _mode_label(travel_mode: str, transit_subtype: Optional[str]) -> str:
        if travel_mode == "WALK":
            return "徒歩"
        if transit_subtype == "BUS":
            return "バス"
        return "電車"

    @staticmethod
    def _build_summary(mode_label: str, duration_minutes: Optional[int], distance_meters: Optional[int]) -> str:
        parts = [f"{mode_label}で移動"]
        if duration_minutes is not None:
            parts.append(f"約{duration_minutes}分")
        if isinstance(distance_meters, int):
            if distance_meters >= 1000:
                parts.append(f"約{distance_meters / 1000:.1f}km")
            else:
                parts.append(f"約{distance_meters}m")
        return " / ".join(parts)
