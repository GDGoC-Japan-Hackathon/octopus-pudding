import asyncio
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Optional
from urllib import error, request
import logging

from app.infrastructure.external.google_places_client import PlaceCandidate
from app.shared.config import settings

logger = logging.getLogger(__name__)


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


class RoutesClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or settings.google_routes_api_key
        self.endpoint = endpoint or settings.google_routes_endpoint
        if not self.api_key and settings.google_places_api_key:
            logger.warning(
                "RoutesClient: GOOGLE_ROUTES_API_KEY is empty. GOOGLE_PLACES_API_KEY is set but will not be used for routes."
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

    async def compute_route_steps(
        self,
        origin: PlaceCandidate,
        destination: PlaceCandidate,
        departure_time: Optional[datetime] = None,
    ) -> list[RouteStep]:
        if not self.api_key:
            raise RuntimeError("Google Routes API key is not configured")
        if origin.latitude is None or origin.longitude is None:
            return []
        if destination.latitude is None or destination.longitude is None:
            return []
        departure = departure_time or datetime.now(timezone.utc)
        primary_steps = await asyncio.to_thread(
            self._compute_route_steps_sync,
            origin,
            destination,
            departure,
            None,
        )
        if primary_steps:
            return primary_steps

        bus_steps, train_steps = await asyncio.gather(
            asyncio.to_thread(
                self._compute_route_steps_sync,
                origin,
                destination,
                departure,
                "BUS",
            ),
            asyncio.to_thread(
                self._compute_route_steps_sync,
                origin,
                destination,
                departure,
                "TRAIN",
            ),
        )
        candidates = [steps for steps in (bus_steps, train_steps) if steps]
        if not candidates:
            return []
        return min(candidates, key=self._total_step_minutes)

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
            "X-Goog-FieldMask": (
                "routes.duration,"
                "routes.distanceMeters,"
                "routes.legs.steps.travelMode,"
                "routes.legs.steps.navigationInstruction.instructions,"
                "routes.legs.steps.transitDetails.stopDetails.departureTime,"
                "routes.legs.steps.transitDetails.stopDetails.arrivalTime,"
                "routes.legs.steps.transitDetails.transitLine.name,"
                "routes.legs.steps.transitDetails.transitLine.nameShort,"
                "routes.legs.steps.transitDetails.transitLine.vehicle.name.text,"
                "routes.legs.steps.transitDetails.transitLine.vehicle.type"
            ),
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
            "departureTime": departure_time.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
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
            "X-Goog-FieldMask": (
                "routes.duration,"
                "routes.distanceMeters,"
                "routes.legs.steps.distanceMeters,"
                "routes.legs.steps.staticDuration,"
                "routes.legs.steps.travelMode,"
                "routes.legs.steps.navigationInstruction.instructions,"
                "routes.legs.steps.transitDetails.stopDetails.departureTime,"
                "routes.legs.steps.transitDetails.stopDetails.arrivalTime,"
                "routes.legs.steps.transitDetails.stopDetails.departureStop.name,"
                "routes.legs.steps.transitDetails.stopDetails.arrivalStop.name,"
                "routes.legs.steps.transitDetails.transitLine.name,"
                "routes.legs.steps.transitDetails.transitLine.nameShort,"
                "routes.legs.steps.transitDetails.transitLine.vehicle.name.text,"
                "routes.legs.steps.transitDetails.transitLine.vehicle.type"
            ),
        }
        logger.info(
            "RoutesClient transit request: origin=%s destination=%s departure_time=%s subtype=%s field_mask=%s",
            origin.name,
            destination.name,
            payload["departureTime"],
            transit_subtype or "ANY",
            headers["X-Goog-FieldMask"],
        )
        req = request.Request(self.endpoint, data=body, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
                logger.debug(
                    "RoutesClient transit raw response: origin=%s destination=%s subtype=%s body=%s",
                    origin.name,
                    destination.name,
                    transit_subtype or "ANY",
                    raw[:500],
                )
        except Exception:
            logger.exception(
                "RoutesClient transit request failed: origin=%s destination=%s subtype=%s",
                origin.name,
                destination.name,
                transit_subtype or "ANY",
            )
            return []

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
        if not routes:
            logger.warning(
                "RoutesClient transit response empty: origin=%s destination=%s subtype=%s",
                origin.name,
                destination.name,
                transit_subtype or "ANY",
            )
            return []
        route = routes[0]
        logger.info(
            "RoutesClient transit response summary: origin=%s destination=%s subtype=%s transit_steps=%s total_steps=%s",
            origin.name,
            destination.name,
            transit_subtype or "ANY",
            self._count_transit_steps(route),
            self._count_total_steps(route),
        )
        return self._extract_route_steps(route, origin.name, destination.name)

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
        lowered = (vehicle_type or "").lower()
        if "bus" in lowered:
            return "TRANSIT", "BUS"
        if any(keyword in lowered for keyword in ("train", "rail", "subway", "metro", "tram", "light_rail")):
            return "TRANSIT", "TRAIN"
        if travel_mode == "TRANSIT":
            return "TRANSIT", "TRAIN"
        return "TRANSIT", "TRAIN"

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
