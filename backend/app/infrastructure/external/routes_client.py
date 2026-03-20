import asyncio
import json
import socket
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Optional
from urllib import error, request
import logging

from app.infrastructure.external.google_places_client import GooglePlacesClient, PlaceCandidate
from app.shared.config import settings

logger = logging.getLogger(__name__)

ROUTES_BASE_FIELD_MASK = ",".join(
    [
        "routes.duration",
        "routes.distanceMeters",
        "routes.polyline.encodedPolyline",
        "routes.legs.distanceMeters",
        "routes.legs.duration",
        "routes.legs.steps.distanceMeters",
        "routes.legs.steps.staticDuration",
        "routes.legs.steps.travelMode",
        "routes.legs.steps.navigationInstruction.instructions",
        "routes.legs.steps.polyline.encodedPolyline",
    ]
)

ROUTES_TRANSIT_FIELD_MASK = ",".join(
    [
        ROUTES_BASE_FIELD_MASK,
        "routes.legs.steps.transitDetails.stopDetails.departureTime",
        "routes.legs.steps.transitDetails.stopDetails.arrivalTime",
        "routes.legs.steps.transitDetails.stopDetails.departureStop.name",
        "routes.legs.steps.transitDetails.stopDetails.arrivalStop.name",
        "routes.legs.steps.transitDetails.transitLine.name",
        "routes.legs.steps.transitDetails.transitLine.nameShort",
        "routes.legs.steps.transitDetails.transitLine.vehicle.name.text",
        "routes.legs.steps.transitDetails.transitLine.vehicle.type",
        "routes.legs.steps.transitDetails.stopCount",
    ]
)


@dataclass
class RouteStep:
    travel_mode: str
    transit_subtype: Optional[str] = None
    duration_minutes: Optional[int] = None
    distance_meters: Optional[int] = None
    from_name: Optional[str] = None
    to_name: Optional[str] = None
    departure_time: Optional[datetime] = None
    arrival_time: Optional[datetime] = None
    line_name: Optional[str] = None
    vehicle_type: Optional[str] = None
    notes: Optional[str] = None
    departure_stop_name: Optional[str] = None
    arrival_stop_name: Optional[str] = None

    def to_dict(self) -> dict:
        data = asdict(self)
        if self.departure_time is not None:
            data["departure_time"] = self.departure_time.isoformat()
        if self.arrival_time is not None:
            data["arrival_time"] = self.arrival_time.isoformat()
        return data


@dataclass
class RouteOption:
    from_name: str
    to_name: str
    travel_mode: str
    transit_subtype: Optional[str] = None
    duration_minutes: Optional[int] = None
    distance_meters: Optional[int] = None
    summary: Optional[str] = None
    departure_time: Optional[datetime] = None
    arrival_time: Optional[datetime] = None
    line_name: Optional[str] = None
    vehicle_type: Optional[str] = None

    def to_dict(self) -> dict:
        data = asdict(self)
        if self.departure_time is not None:
            data["departure_time"] = self.departure_time.isoformat()
        if self.arrival_time is not None:
            data["arrival_time"] = self.arrival_time.isoformat()
        return data


@dataclass
class RouteDiagnostics:
    transit_attempted_pairs: int = 0
    transit_succeeded_pairs: int = 0
    transit_empty_pairs: int = 0
    transit_timeout_pairs: int = 0
    transit_exception_pairs: int = 0
    transit_fallback_info_pairs: int = 0
    walk_fallback_pairs: int = 0
    drive_fallback_pairs: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


class RoutesClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or settings.google_routes_api_key
        self.endpoint = endpoint or settings.google_routes_endpoint
        self.connect_timeout_seconds = settings.google_routes_connect_timeout_seconds
        self.read_timeout_seconds = settings.google_routes_read_timeout_seconds
        if not self.api_key and settings.google_places_api_key:
            logger.warning(
                "RoutesClient: GOOGLE_ROUTES_API_KEY is empty. GOOGLE_PLACES_API_KEY is set but will not be used for routes."
            )
        logger.info(
            "RoutesClient timeout settings: connect_timeout=%ss read_timeout=%ss (urllib uses effective=%ss)",
            self.connect_timeout_seconds,
            self.read_timeout_seconds,
            self._effective_timeout_seconds,
        )

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
            ("TRANSIT", None),
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

    async def compute_route_steps(
        self,
        origin: PlaceCandidate,
        destination: PlaceCandidate,
        departure_time: Optional[datetime] = None,
    ) -> list[RouteStep]:
        route_steps, _ = await self.compute_route_steps_with_diagnostics(
            origin=origin,
            destination=destination,
            departure_time=departure_time,
        )
        return route_steps

    async def compute_route_steps_with_diagnostics(
        self,
        origin: PlaceCandidate,
        destination: PlaceCandidate,
        departure_time: Optional[datetime] = None,
    ) -> tuple[list[RouteStep], dict]:
        if not self.api_key:
            raise RuntimeError("Google Routes API key is not configured")
        if origin.latitude is None or origin.longitude is None:
            return [], RouteDiagnostics().to_dict()
        if destination.latitude is None or destination.longitude is None:
            return [], RouteDiagnostics().to_dict()
        departure = departure_time or datetime.now(timezone.utc)
        diagnostics = RouteDiagnostics()
        primary_steps, primary_status, primary_fallback_info = await asyncio.to_thread(
            self._compute_route_steps_sync_with_meta,
            origin,
            destination,
            departure,
            None,
        )
        self._update_diagnostics(
            diagnostics=diagnostics,
            status=primary_status,
            has_fallback_info=primary_fallback_info,
            is_walk_fallback=False,
            is_drive_fallback=False,
        )
        if primary_steps:
            return primary_steps, diagnostics.to_dict()

        anchored_steps, anchored_status, anchored_fallback_info = await self._compute_route_steps_via_transit_hubs(
            origin=origin,
            destination=destination,
            departure_time=departure,
        )
        self._update_diagnostics(
            diagnostics=diagnostics,
            status=anchored_status,
            has_fallback_info=anchored_fallback_info,
            is_walk_fallback=False,
            is_drive_fallback=False,
        )
        if anchored_steps:
            return anchored_steps, diagnostics.to_dict()

        walk_steps = await asyncio.to_thread(
            self._compute_route_walk_sync,
            origin,
            destination,
        )
        if walk_steps:
            diagnostics.walk_fallback_pairs += 1
            return walk_steps, diagnostics.to_dict()

        drive_steps = await asyncio.to_thread(
            self._compute_route_drive_sync,
            origin,
            destination,
        )
        if drive_steps:
            diagnostics.drive_fallback_pairs += 1
        return drive_steps, diagnostics.to_dict()

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
            normalized_departure_time = self._normalize_transit_departure_time(departure_time)
            payload["departureTime"] = normalized_departure_time.isoformat().replace("+00:00", "Z")
            if transit_subtype == "BUS":
                payload["transitPreferences"] = {
                    "allowedTravelModes": ["BUS"],
                }
            elif transit_subtype == "TRAIN":
                payload["transitPreferences"] = {
                    "allowedTravelModes": ["TRAIN", "RAIL", "SUBWAY", "LIGHT_RAIL"],
                }
            logger.info(
                "RoutesClient transit option request: origin=%s(%.6f,%.6f) destination=%s(%.6f,%.6f) departure_time=%s subtype=%s approx_distance_meters=%.0f",
                origin.name,
                origin.latitude,
                origin.longitude,
                destination.name,
                destination.latitude,
                destination.longitude,
                payload["departureTime"],
                transit_subtype or "ANY",
                self._coordinate_distance_meters(
                    float(origin.latitude),
                    float(origin.longitude),
                    float(destination.latitude),
                    float(destination.longitude),
                ),
            )

        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": ROUTES_TRANSIT_FIELD_MASK,
        }
        req = request.Request(self.endpoint, data=body, headers=headers, method="POST")
        started = perf_counter()
        try:
            with request.urlopen(req, timeout=self._effective_timeout_seconds) as resp:
                raw = resp.read().decode("utf-8")
        except error.HTTPError as e:
            error_body: Optional[str]
            try:
                error_body = e.read().decode("utf-8")
            except Exception:
                error_body = None
            logger.error(
                "RoutesClient HTTPError when calling routes API: status=%s, reason=%s, body=%s",
                getattr(e, "code", None),
                getattr(e, "reason", None),
                error_body,
            )
            return None
        except error.URLError as e:
            logger.error(
                "RoutesClient URLError when calling routes API: reason=%s",
                getattr(e, "reason", None),
            )
            return None
        finally:
            elapsed_ms = (perf_counter() - started) * 1000
            logger.info(
                "RoutesClient route option elapsed: mode=%s subtype=%s origin=%s destination=%s elapsed_ms=%.1f",
                travel_mode,
                transit_subtype or "ANY",
                origin.name,
                destination.name,
                elapsed_ms,
            )

        response = json.loads(raw)
        routes = response.get("routes", []) or []
        if not routes:
            return None
        route = routes[0]
        duration_minutes = self._duration_to_minutes(route.get("duration"))
        distance_meters = route.get("distanceMeters")
        departure_time, arrival_time, line_name, vehicle_type = self._extract_transit_metadata(route)
        mode_label = self._mode_label(travel_mode, transit_subtype)
        summary = self._build_summary(mode_label, duration_minutes, distance_meters, line_name)
        return RouteOption(
            from_name=origin.name,
            to_name=destination.name,
            travel_mode=travel_mode,
            transit_subtype=transit_subtype,
            duration_minutes=duration_minutes,
            distance_meters=distance_meters if isinstance(distance_meters, int) else None,
            summary=summary,
            departure_time=departure_time,
            arrival_time=arrival_time,
            line_name=line_name,
            vehicle_type=vehicle_type,
        )

    def _compute_route_steps_sync(
        self,
        origin: PlaceCandidate,
        destination: PlaceCandidate,
        departure_time: datetime,
        transit_subtype: Optional[str] = None,
    ) -> list[RouteStep]:
        steps, _, _ = self._compute_route_steps_sync_with_meta(
            origin=origin,
            destination=destination,
            departure_time=departure_time,
            transit_subtype=transit_subtype,
        )
        return steps

    def _compute_route_steps_sync_with_meta(
        self,
        origin: PlaceCandidate,
        destination: PlaceCandidate,
        departure_time: datetime,
        transit_subtype: Optional[str] = None,
    ) -> tuple[list[RouteStep], str, bool]:
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
            "travelMode": "TRANSIT",
            "languageCode": settings.google_places_language_code,
            "regionCode": settings.google_places_region_code,
            "units": "METRIC",
            "departureTime": self._normalize_transit_departure_time(departure_time).isoformat().replace(
                "+00:00", "Z"
            ),
        }
        if transit_subtype == "BUS":
            payload["transitPreferences"] = {
                "allowedTravelModes": ["BUS"],
            }
        elif transit_subtype == "TRAIN":
            payload["transitPreferences"] = {
                "allowedTravelModes": ["TRAIN", "RAIL", "SUBWAY", "LIGHT_RAIL"],
            }

        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": ROUTES_TRANSIT_FIELD_MASK,
        }
        logger.info(
            "RoutesClient transit request: origin=%s(%.6f,%.6f) destination=%s(%.6f,%.6f) departure_time=%s subtype=%s approx_distance_meters=%.0f has_intermediates=%s timeout=%ss field_mask=%s",
            origin.name,
            origin.latitude,
            origin.longitude,
            destination.name,
            destination.latitude,
            destination.longitude,
            payload["departureTime"],
            transit_subtype or "ANY",
            self._coordinate_distance_meters(
                float(origin.latitude),
                float(origin.longitude),
                float(destination.latitude),
                float(destination.longitude),
            ),
            bool(payload.get("intermediates")),
            self._effective_timeout_seconds,
            headers["X-Goog-FieldMask"],
        )
        req = request.Request(self.endpoint, data=body, headers=headers, method="POST")
        started = perf_counter()
        try:
            with request.urlopen(req, timeout=self._effective_timeout_seconds) as resp:
                raw = resp.read().decode("utf-8")
                logger.debug(
                    "RoutesClient transit raw response: origin=%s destination=%s subtype=%s body=%s",
                    origin.name,
                    destination.name,
                    transit_subtype or "ANY",
                    raw[:500],
                )
        except Exception as exc:
            status = "timeout" if self._is_timeout_exception(exc) else "exception"
            logger.exception(
                "RoutesClient transit request failed: origin=%s destination=%s subtype=%s status=%s",
                origin.name,
                destination.name,
                transit_subtype or "ANY",
                status,
            )
            return [], status, False
        finally:
            elapsed_ms = (perf_counter() - started) * 1000
            logger.info(
                "RoutesClient transit elapsed: origin=%s destination=%s subtype=%s elapsed_ms=%.1f",
                origin.name,
                destination.name,
                transit_subtype or "ANY",
                elapsed_ms,
            )

        try:
            response = json.loads(raw)
        except Exception:
            logger.exception(
                "RoutesClient transit response JSON decode failed: origin=%s destination=%s subtype=%s",
                origin.name,
                destination.name,
                transit_subtype or "ANY",
            )
            return []
        routes = response.get("routes", []) or []
        has_fallback_info = bool(response.get("fallbackInfo"))
        if not routes:
            logger.warning(
                "RoutesClient transit response empty: origin=%s destination=%s subtype=%s fallbackInfo=%s",
                origin.name,
                destination.name,
                transit_subtype or "ANY",
                response.get("fallbackInfo"),
            )
            return [], "empty", has_fallback_info
        route = routes[0]
        logger.info(
            "RoutesClient transit response summary: origin=%s destination=%s subtype=%s transit_steps=%s total_steps=%s",
            origin.name,
            destination.name,
            transit_subtype or "ANY",
            self._count_transit_steps(route),
            self._count_total_steps(route),
        )
        return self._extract_route_steps(route, origin.name, destination.name), "success", has_fallback_info

    async def _compute_route_steps_via_transit_hubs(
        self,
        origin: PlaceCandidate,
        destination: PlaceCandidate,
        departure_time: datetime,
    ) -> tuple[list[RouteStep], str, bool]:
        origin_hub, destination_hub = await asyncio.gather(
            self._search_transit_hub_near(origin),
            self._search_transit_hub_near(destination),
        )
        if origin_hub is None or destination_hub is None:
            logger.info(
                "RoutesClient transit hub fallback skipped: origin=%s destination=%s origin_hub=%s destination_hub=%s",
                origin.name,
                destination.name,
                bool(origin_hub),
                bool(destination_hub),
            )
            return [], "skipped", False

        hub_steps, hub_status, hub_fallback_info = await asyncio.to_thread(
            self._compute_route_steps_sync_with_meta,
            origin_hub,
            destination_hub,
            departure_time,
            None,
        )
        if not hub_steps:
            return [], hub_status, hub_fallback_info

        prefix = await asyncio.to_thread(
            self._compute_route_drive_sync,
            origin,
            origin_hub,
        )
        suffix = await asyncio.to_thread(
            self._compute_route_drive_sync,
            destination_hub,
            destination,
        )
        logger.info(
            "RoutesClient transit hub fallback used: origin=%s destination=%s origin_hub=%s destination_hub=%s steps=%s",
            origin.name,
            destination.name,
            origin_hub.name,
            destination_hub.name,
            len(hub_steps),
        )
        return prefix + hub_steps + suffix, hub_status, hub_fallback_info

    async def _search_transit_hub_near(self, place: PlaceCandidate) -> Optional[PlaceCandidate]:
        if place.latitude is None or place.longitude is None:
            return None
        places_client = GooglePlacesClient()
        queries = self._build_transit_hub_queries(place)
        nearest: Optional[PlaceCandidate] = None
        nearest_distance = float("inf")
        for query in queries:
            try:
                candidates = await places_client.search_text(query=query, max_results=3)
            except Exception:
                continue
            for candidate in candidates:
                if candidate.latitude is None or candidate.longitude is None:
                    continue
                distance = self._coordinate_distance_meters(
                    place.latitude,
                    place.longitude,
                    candidate.latitude,
                    candidate.longitude,
                )
                if distance < nearest_distance:
                    nearest = candidate
                    nearest_distance = distance
        if nearest is None:
            return None
        if nearest_distance > 40_000:
            return None
        return nearest

    @staticmethod
    def _build_transit_hub_queries(place: PlaceCandidate) -> list[str]:
        queries: list[str] = []
        place_name = (place.name or "").strip()
        place_address = (place.address or "").strip()
        if place_name:
            queries.append(f"{place_name} 最寄り駅")
            queries.append(f"{place_name} 最寄り バス停")
            queries.append(f"{place_name} 駅")
            queries.append(f"{place_name} バス停")
        if place_address:
            queries.append(f"{place_address} 最寄り駅")
            queries.append(f"{place_address} 最寄り バス停")
            queries.append(f"{place_address} 駅")
            queries.append(f"{place_address} バス停")
        queries.append(f"{place.latitude:.5f},{place.longitude:.5f} 駅")
        queries.append(f"{place.latitude:.5f},{place.longitude:.5f} バス停")

        deduped: list[str] = []
        seen: set[str] = set()
        for query in queries:
            if not query or query in seen:
                continue
            seen.add(query)
            deduped.append(query)
        return deduped

    def _compute_route_drive_sync(
        self,
        origin: PlaceCandidate,
        destination: PlaceCandidate,
    ) -> list[RouteStep]:
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
            "travelMode": "DRIVE",
            "languageCode": settings.google_places_language_code,
            "regionCode": settings.google_places_region_code,
            "units": "METRIC",
        }
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": ROUTES_BASE_FIELD_MASK,
        }
        req = request.Request(self.endpoint, data=body, headers=headers, method="POST")
        started = perf_counter()
        try:
            with request.urlopen(req, timeout=self._effective_timeout_seconds) as resp:
                raw = resp.read().decode("utf-8")
        except Exception:
            logger.exception(
                "RoutesClient drive request failed: origin=%s destination=%s",
                origin.name,
                destination.name,
            )
            return []
        finally:
            elapsed_ms = (perf_counter() - started) * 1000
            logger.info(
                "RoutesClient drive elapsed: origin=%s destination=%s elapsed_ms=%.1f",
                origin.name,
                destination.name,
                elapsed_ms,
            )

        response = json.loads(raw)
        routes = response.get("routes", []) or []
        if not routes:
            logger.warning(
                "RoutesClient drive response empty: origin=%s destination=%s",
                origin.name,
                destination.name,
            )
            return []
        route = routes[0]
        step = RouteStep(
            travel_mode="DRIVE",
            transit_subtype=None,
            duration_minutes=self._duration_to_minutes(route.get("duration")),
            distance_meters=route.get("distanceMeters") if isinstance(route.get("distanceMeters"), int) else None,
            from_name=origin.name,
            to_name=destination.name,
            notes="公共交通機関が取得できませんでした。車で移動",
        )
        logger.info(
            "RoutesClient drive fallback used: origin=%s destination=%s duration=%s distance=%s",
            origin.name,
            destination.name,
            step.duration_minutes,
            step.distance_meters,
        )
        return [step]

    def _compute_route_walk_sync(
        self,
        origin: PlaceCandidate,
        destination: PlaceCandidate,
    ) -> list[RouteStep]:
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
            "travelMode": "WALK",
            "languageCode": settings.google_places_language_code,
            "regionCode": settings.google_places_region_code,
            "units": "METRIC",
        }
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": ROUTES_BASE_FIELD_MASK,
        }
        req = request.Request(self.endpoint, data=body, headers=headers, method="POST")
        started = perf_counter()
        try:
            with request.urlopen(req, timeout=self._effective_timeout_seconds) as resp:
                raw = resp.read().decode("utf-8")
        except Exception:
            logger.exception(
                "RoutesClient walk request failed: origin=%s destination=%s",
                origin.name,
                destination.name,
            )
            return []
        finally:
            elapsed_ms = (perf_counter() - started) * 1000
            logger.info(
                "RoutesClient walk elapsed: origin=%s destination=%s elapsed_ms=%.1f",
                origin.name,
                destination.name,
                elapsed_ms,
            )

        response = json.loads(raw)
        routes = response.get("routes", []) or []
        if not routes:
            logger.warning(
                "RoutesClient walk response empty: origin=%s destination=%s",
                origin.name,
                destination.name,
            )
            return []
        route = routes[0]
        distance_meters = route.get("distanceMeters")
        if isinstance(distance_meters, int) and distance_meters > 3000:
            return []
        step = RouteStep(
            travel_mode="WALK",
            transit_subtype=None,
            duration_minutes=self._duration_to_minutes(route.get("duration")),
            distance_meters=distance_meters if isinstance(distance_meters, int) else None,
            from_name=origin.name,
            to_name=destination.name,
            notes="公共交通機関が取得できませんでした。徒歩で移動",
        )
        logger.info(
            "RoutesClient walk fallback used: origin=%s destination=%s duration=%s distance=%s",
            origin.name,
            destination.name,
            step.duration_minutes,
            step.distance_meters,
        )
        return [step]

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
    def _build_summary(
        mode_label: str,
        duration_minutes: Optional[int],
        distance_meters: Optional[int],
        line_name: Optional[str],
    ) -> str:
        parts = [f"{mode_label}で移動"]
        if line_name:
            parts.append(line_name)
        if duration_minutes is not None:
            parts.append(f"約{duration_minutes}分")
        if isinstance(distance_meters, int):
            if distance_meters >= 1000:
                parts.append(f"約{distance_meters / 1000:.1f}km")
            else:
                parts.append(f"約{distance_meters}m")
        return " / ".join(parts)

    def _extract_transit_metadata(
        self,
        route: dict,
    ) -> tuple[Optional[datetime], Optional[datetime], Optional[str], Optional[str]]:
        for leg in route.get("legs", []) or []:
            for step in leg.get("steps", []) or []:
                transit_details = step.get("transitDetails") or {}
                if not transit_details:
                    continue
                stop_details = transit_details.get("stopDetails") or {}
                departure_time = self._parse_datetime(stop_details.get("departureTime"))
                arrival_time = self._parse_datetime(stop_details.get("arrivalTime"))
                transit_line = transit_details.get("transitLine") or {}
                line_name = None
                name_short = transit_line.get("nameShort")
                if isinstance(name_short, str) and name_short.strip():
                    line_name = name_short.strip()
                elif isinstance(transit_line.get("name"), dict):
                    text = transit_line["name"].get("text")
                    if isinstance(text, str) and text.strip():
                        line_name = text.strip()
                vehicle_type = None
                vehicle = transit_line.get("vehicle")
                if isinstance(vehicle, dict):
                    if isinstance(vehicle.get("name"), dict):
                        text = vehicle["name"].get("text")
                        if isinstance(text, str) and text.strip():
                            vehicle_type = text.strip()
                    if not vehicle_type:
                        type_value = vehicle.get("type")
                        if isinstance(type_value, str) and type_value.strip():
                            vehicle_type = type_value.strip()
                return departure_time, arrival_time, line_name, vehicle_type
        return None, None, None, None

    def _extract_route_steps(
        self,
        route: dict,
        origin_name: str,
        destination_name: str,
    ) -> list[RouteStep]:
        extracted: list[RouteStep] = []
        for leg in route.get("legs", []) or []:
            for step in leg.get("steps", []) or []:
                travel_mode = step.get("travelMode")
                duration_minutes = self._duration_to_minutes(step.get("staticDuration") or step.get("duration"))
                distance_meters = step.get("distanceMeters")
                transit_details = step.get("transitDetails") or {}
                stop_details = transit_details.get("stopDetails") or {}
                departure_stop_name = self._extract_stop_name(stop_details.get("departureStop"))
                arrival_stop_name = self._extract_stop_name(stop_details.get("arrivalStop"))
                departure_time = self._parse_datetime(stop_details.get("departureTime"))
                arrival_time = self._parse_datetime(stop_details.get("arrivalTime"))
                line_name, vehicle_type = self._extract_line_metadata(transit_details.get("transitLine") or {})
                mapped_mode, transit_subtype = self._map_step_mode(travel_mode, vehicle_type)
                notes = step.get("navigationInstruction", {}).get("instructions")
                stop_count = transit_details.get("stopCount")
                if (
                    mapped_mode == "TRANSIT"
                    and isinstance(stop_count, int)
                    and stop_count > 0
                    and isinstance(notes, str)
                    and notes.strip()
                ):
                    notes = f"{notes} / {stop_count}駅・停留所"
                elif mapped_mode == "TRANSIT" and isinstance(stop_count, int) and stop_count > 0:
                    notes = f"{stop_count}駅・停留所"
                extracted.append(
                    RouteStep(
                        travel_mode=mapped_mode,
                        transit_subtype=transit_subtype,
                        duration_minutes=duration_minutes,
                        distance_meters=distance_meters if isinstance(distance_meters, int) else None,
                        from_name=departure_stop_name or origin_name,
                        to_name=arrival_stop_name or destination_name,
                        departure_time=departure_time,
                        arrival_time=arrival_time,
                        line_name=line_name,
                        vehicle_type=vehicle_type,
                        notes=notes if isinstance(notes, str) and notes.strip() else None,
                        departure_stop_name=departure_stop_name,
                        arrival_stop_name=arrival_stop_name,
                    )
                )
        logger.info(
            "RoutesClient extracted route steps: origin=%s destination=%s steps=%s transit_with_line=%s",
            origin_name,
            destination_name,
            len(extracted),
            sum(1 for step in extracted if step.line_name),
        )
        return extracted

    @staticmethod
    def _count_total_steps(route: dict) -> int:
        count = 0
        for leg in route.get("legs", []) or []:
            count += len(leg.get("steps", []) or [])
        return count

    @staticmethod
    def _count_transit_steps(route: dict) -> int:
        count = 0
        for leg in route.get("legs", []) or []:
            for step in leg.get("steps", []) or []:
                if step.get("transitDetails"):
                    count += 1
        return count

    @staticmethod
    def _extract_stop_name(value: Optional[dict]) -> Optional[str]:
        if not isinstance(value, dict):
            return None
        name = value.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
        return None

    @staticmethod
    def _extract_line_metadata(transit_line: dict) -> tuple[Optional[str], Optional[str]]:
        line_name = None
        name_short = transit_line.get("nameShort")
        if isinstance(name_short, str) and name_short.strip():
            line_name = name_short.strip()
        elif isinstance(transit_line.get("name"), dict):
            text = transit_line["name"].get("text")
            if isinstance(text, str) and text.strip():
                line_name = text.strip()
        vehicle_type = None
        vehicle = transit_line.get("vehicle")
        if isinstance(vehicle, dict):
            if isinstance(vehicle.get("name"), dict):
                text = vehicle["name"].get("text")
                if isinstance(text, str) and text.strip():
                    vehicle_type = text.strip()
            if not vehicle_type:
                type_value = vehicle.get("type")
                if isinstance(type_value, str) and type_value.strip():
                    vehicle_type = type_value.strip()
        return line_name, vehicle_type

    @staticmethod
    def _map_step_mode(travel_mode: Optional[str], vehicle_type: Optional[str]) -> tuple[str, Optional[str]]:
        if travel_mode == "WALK":
            return "WALK", None
        if travel_mode == "DRIVE":
            return "DRIVE", None
        lowered = (vehicle_type or "").lower()
        if "bus" in lowered:
            return "TRANSIT", "BUS"
        if any(keyword in lowered for keyword in ("train", "rail", "subway", "metro", "tram", "light_rail")):
            return "TRANSIT", "TRAIN"
        if travel_mode == "TRANSIT":
            return "TRANSIT", "TRAIN"
        return "TRANSIT", "TRAIN"

    @staticmethod
    def _normalize_transit_departure_time(departure_time: datetime) -> datetime:
        if departure_time.tzinfo is None:
            parsed = departure_time.replace(tzinfo=timezone.utc)
        else:
            parsed = departure_time.astimezone(timezone.utc)
        min_future = datetime.now(timezone.utc) + timedelta(minutes=5)
        if parsed < min_future:
            parsed = min_future
        return parsed.replace(microsecond=0)

    @staticmethod
    def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
        if not value or not isinstance(value, str):
            return None
        try:
            normalized = value.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None

    @staticmethod
    def _total_step_minutes(steps: list[RouteStep]) -> int:
        total = 0
        for step in steps:
            total += step.duration_minutes or 0
        return total

    @property
    def _effective_timeout_seconds(self) -> float:
        return float(max(self.connect_timeout_seconds, self.read_timeout_seconds))

    @staticmethod
    def _is_timeout_exception(exc: Exception) -> bool:
        if isinstance(exc, (socket.timeout, TimeoutError)):
            return True
        if isinstance(exc, error.URLError):
            reason = getattr(exc, "reason", None)
            if isinstance(reason, (socket.timeout, TimeoutError)):
                return True
            if isinstance(reason, str) and "timed out" in reason.lower():
                return True
        return "timed out" in str(exc).lower()

    @staticmethod
    def _update_diagnostics(
        diagnostics: RouteDiagnostics,
        *,
        status: str,
        has_fallback_info: bool,
        is_walk_fallback: bool,
        is_drive_fallback: bool,
    ) -> None:
        if status in {"success", "empty", "timeout", "exception"}:
            diagnostics.transit_attempted_pairs += 1
        if status == "success":
            diagnostics.transit_succeeded_pairs += 1
        elif status == "empty":
            diagnostics.transit_empty_pairs += 1
        elif status == "timeout":
            diagnostics.transit_timeout_pairs += 1
        elif status == "exception":
            diagnostics.transit_exception_pairs += 1
        if has_fallback_info:
            diagnostics.transit_fallback_info_pairs += 1
        if is_walk_fallback:
            diagnostics.walk_fallback_pairs += 1
        if is_drive_fallback:
            diagnostics.drive_fallback_pairs += 1

    @staticmethod
    def _coordinate_distance_meters(
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float,
    ) -> float:
        lat_scale = 111_000
        lon_scale = 91_000
        lat_delta = (lat1 - lat2) * lat_scale
        lon_delta = (lon1 - lon2) * lon_scale
        return (lat_delta**2 + lon_delta**2) ** 0.5
