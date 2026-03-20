import asyncio
import json
import logging
import re
import socket
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html import unescape
from time import perf_counter
from typing import Literal, Optional
from urllib import error, parse, request

from app.shared.config import settings

logger = logging.getLogger(__name__)

DirectionsMode = Literal["driving", "walking", "transit"]


class DirectionsAPIError(RuntimeError):
    def __init__(self, status: str, error_message: Optional[str] = None):
        self.status = status
        self.error_message = error_message
        super().__init__(f"Google Directions API error: status={status}, error_message={error_message}")


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
    last_error_status: Optional[str] = None
    last_error_message: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class RoutesClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or settings.google_directions_api_key or settings.google_routes_api_key
        self.directions_endpoint = endpoint or settings.google_directions_endpoint
        self.connect_timeout_seconds = settings.google_routes_connect_timeout_seconds
        self.read_timeout_seconds = settings.google_routes_read_timeout_seconds

    def fetch_directions(
        self,
        *,
        origin: str,
        destination: str,
        mode: DirectionsMode,
        departure_time: Optional[datetime] = None,
    ) -> dict:
        response = self._request_directions(
            origin=origin,
            destination=destination,
            mode=mode,
            departure_time=departure_time,
        )
        return self._extract_summary(response)

    async def compute_route_options(
        self,
        origin: str,
        destination: str,
        departure_time: Optional[datetime] = None,
    ) -> list[RouteOption]:
        route_options: list[RouteOption] = []
        for mode in ("walking", "transit"):
            try:
                response = await asyncio.to_thread(
                    self._request_directions,
                    origin,
                    destination,
                    mode,
                    departure_time,
                )
            except DirectionsAPIError as exc:
                logger.warning(
                    "RoutesClient option request failed: origin=%s destination=%s mode=%s status=%s error=%s",
                    origin,
                    destination,
                    mode,
                    exc.status,
                    exc.error_message,
                )
                continue
            except Exception:
                logger.exception(
                    "RoutesClient option request exception: origin=%s destination=%s mode=%s",
                    origin,
                    destination,
                    mode,
                )
                continue

            summary = self._extract_summary(response)
            route_options.append(
                RouteOption(
                    from_name=origin,
                    to_name=destination,
                    travel_mode=self._map_mode_for_option(mode),
                    transit_subtype=self._extract_primary_transit_subtype(response),
                    duration_minutes=self._extract_duration_minutes(response),
                    distance_meters=self._extract_distance_meters(response),
                    summary=f"{summary['duration']} / {summary['distance']}",
                    line_name=self._extract_primary_transit_line_name(response),
                    vehicle_type=self._extract_primary_transit_vehicle_type(response),
                )
            )

        return route_options

    async def compute_route_steps(
        self,
        origin: str,
        destination: str,
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
        origin: str,
        destination: str,
        departure_time: Optional[datetime] = None,
    ) -> tuple[list[RouteStep], dict]:
        diagnostics = RouteDiagnostics()
        diagnostics.transit_attempted_pairs += 1

        try:
            transit_response = await asyncio.to_thread(
                self._request_directions,
                origin,
                destination,
                "transit",
                departure_time,
            )
            diagnostics.transit_succeeded_pairs += 1
            route_steps = self._response_to_steps(transit_response, origin, destination, "transit")
            if route_steps:
                return route_steps, diagnostics.to_dict()
            diagnostics.transit_fallback_info_pairs += 1
            return [self._summary_response_to_step(transit_response, origin, destination, "transit")], diagnostics.to_dict()
        except DirectionsAPIError as exc:
            normalized = exc.status.upper()
            diagnostics.last_error_status = exc.status
            diagnostics.last_error_message = exc.error_message
            if normalized in {"ZERO_RESULTS", "NOT_FOUND"}:
                diagnostics.transit_empty_pairs += 1
            elif normalized == "TIMEOUT":
                diagnostics.transit_timeout_pairs += 1
            else:
                diagnostics.transit_exception_pairs += 1
            logger.warning(
                "RoutesClient transit failed: origin=%s destination=%s status=%s error=%s",
                origin,
                destination,
                exc.status,
                exc.error_message,
            )
        except Exception:
            diagnostics.transit_exception_pairs += 1
            diagnostics.last_error_status = "TRANSIT_EXCEPTION"
            logger.exception("RoutesClient transit exception: origin=%s destination=%s", origin, destination)

        for mode in ("walking", "driving"):
            try:
                response = await asyncio.to_thread(
                    self._request_directions,
                    origin,
                    destination,
                    mode,
                    departure_time,
                )
                if mode == "walking":
                    diagnostics.walk_fallback_pairs += 1
                else:
                    diagnostics.drive_fallback_pairs += 1
                route_steps = self._response_to_steps(response, origin, destination, mode)
                if route_steps:
                    return route_steps, diagnostics.to_dict()
                return [self._summary_response_to_step(response, origin, destination, mode)], diagnostics.to_dict()
            except DirectionsAPIError as exc:
                diagnostics.last_error_status = f"{mode.upper()}_{exc.status}"
                diagnostics.last_error_message = exc.error_message
                logger.warning(
                    "RoutesClient %s fallback failed: origin=%s destination=%s status=%s error=%s",
                    mode,
                    origin,
                    destination,
                    exc.status,
                    exc.error_message,
                )
            except Exception:
                diagnostics.last_error_status = f"{mode.upper()}_EXCEPTION"
                logger.exception(
                    "RoutesClient %s fallback failed: origin=%s destination=%s",
                    mode,
                    origin,
                    destination,
                )

        return [], diagnostics.to_dict()

    def _request_directions(
        self,
        origin: str,
        destination: str,
        mode: DirectionsMode,
        departure_time: Optional[datetime] = None,
    ) -> dict:
        self._validate_inputs(origin=origin, destination=destination, mode=mode)

        params = {
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "language": "ja",
            "key": self.api_key,
        }
        if departure_time is not None and mode in {"transit", "driving"}:
            params["departure_time"] = str(int(departure_time.timestamp()))
        url = f"{self.directions_endpoint}?{parse.urlencode(params)}"

        logger.info(
            "RoutesClient directions request: origin=%s destination=%s mode=%s",
            origin,
            destination,
            mode,
        )

        req = request.Request(url, method="GET")
        started = perf_counter()
        try:
            with request.urlopen(req, timeout=self._effective_timeout_seconds) as resp:
                raw = resp.read().decode("utf-8")
        except error.HTTPError as exc:
            body = None
            try:
                body = exc.read().decode("utf-8")
            except Exception:
                body = None
            logger.error(
                "RoutesClient directions HTTPError: origin=%s destination=%s mode=%s status=%s reason=%s body=%s",
                origin,
                destination,
                mode,
                getattr(exc, "code", None),
                getattr(exc, "reason", None),
                body,
            )
            raise DirectionsAPIError(status="HTTP_ERROR", error_message=body)
        except error.URLError as exc:
            if self._is_timeout_exception(exc):
                logger.error(
                    "RoutesClient directions timeout: origin=%s destination=%s mode=%s reason=%s",
                    origin,
                    destination,
                    mode,
                    getattr(exc, "reason", None),
                )
                raise DirectionsAPIError(status="TIMEOUT", error_message=str(getattr(exc, "reason", "timeout")))
            logger.error(
                "RoutesClient directions URLError: origin=%s destination=%s mode=%s reason=%s",
                origin,
                destination,
                mode,
                getattr(exc, "reason", None),
            )
            raise DirectionsAPIError(
                status="NETWORK_ERROR", error_message=str(getattr(exc, "reason", "network error"))
            )
        except Exception as exc:
            if self._is_timeout_exception(exc):
                logger.error(
                    "RoutesClient directions timeout exception: origin=%s destination=%s mode=%s",
                    origin,
                    destination,
                    mode,
                )
                raise DirectionsAPIError(status="TIMEOUT", error_message=str(exc))
            logger.exception(
                "RoutesClient directions request failed: origin=%s destination=%s mode=%s", origin, destination, mode
            )
            raise DirectionsAPIError(status="REQUEST_FAILED", error_message=str(exc))
        finally:
            elapsed_ms = (perf_counter() - started) * 1000
            logger.info(
                "RoutesClient directions elapsed: origin=%s destination=%s mode=%s elapsed_ms=%.1f",
                origin,
                destination,
                mode,
                elapsed_ms,
            )

        try:
            response = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.error(
                "RoutesClient directions json decode failed: origin=%s destination=%s mode=%s",
                origin,
                destination,
                mode,
            )
            raise DirectionsAPIError(status="INVALID_JSON", error_message=str(exc))

        api_status = str(response.get("status") or "")
        if api_status != "OK":
            message = response.get("error_message")
            logger.warning(
                "RoutesClient directions non-ok status: origin=%s destination=%s mode=%s status=%s error_message=%s",
                origin,
                destination,
                mode,
                api_status,
                message,
            )
            raise DirectionsAPIError(status=api_status or "UNKNOWN", error_message=message)

        return response

    @staticmethod
    def _extract_summary(response: dict) -> dict:
        routes = response.get("routes") or []
        if not routes:
            logger.error("RoutesClient directions parse failed: routes missing")
            raise DirectionsAPIError(status="PARSE_ERROR", error_message="routes is empty")

        route = routes[0]
        legs = route.get("legs") or []
        if not legs:
            logger.error("RoutesClient directions parse failed: legs missing")
            raise DirectionsAPIError(status="PARSE_ERROR", error_message="legs is empty")

        leg = legs[0]
        distance = (leg.get("distance") or {}).get("text")
        duration = (leg.get("duration") or {}).get("text")
        polyline = (route.get("overview_polyline") or {}).get("points")

        if not isinstance(distance, str) or not distance.strip():
            raise DirectionsAPIError(status="PARSE_ERROR", error_message="distance.text is missing")
        if not isinstance(duration, str) or not duration.strip():
            raise DirectionsAPIError(status="PARSE_ERROR", error_message="duration.text is missing")
        if not isinstance(polyline, str) or not polyline.strip():
            raise DirectionsAPIError(status="PARSE_ERROR", error_message="overview_polyline.points is missing")

        return {
            "distance": distance,
            "duration": duration,
            "polyline": polyline,
        }

    @staticmethod
    def _extract_duration_minutes(response: dict) -> Optional[int]:
        routes = response.get("routes") or []
        if not routes:
            return None
        legs = routes[0].get("legs") or []
        if not legs:
            return None
        seconds = (legs[0].get("duration") or {}).get("value")
        if not isinstance(seconds, (int, float)):
            return None
        return max(1, round(float(seconds) / 60))

    @staticmethod
    def _extract_distance_meters(response: dict) -> Optional[int]:
        routes = response.get("routes") or []
        if not routes:
            return None
        legs = routes[0].get("legs") or []
        if not legs:
            return None
        value = (legs[0].get("distance") or {}).get("value")
        if not isinstance(value, int):
            return None
        return value

    def _response_to_steps(
        self,
        response: dict,
        origin: str,
        destination: str,
        mode: DirectionsMode,
    ) -> list[RouteStep]:
        routes = response.get("routes") or []
        if not routes:
            return []
        legs = routes[0].get("legs") or []
        if not legs:
            return []
        leg = legs[0]
        raw_steps = leg.get("steps") or []
        if not isinstance(raw_steps, list) or not raw_steps:
            return []

        parsed_steps: list[RouteStep] = []
        for raw_step in raw_steps:
            step = self._parse_leg_step(raw_step, origin=origin, destination=destination, fallback_mode=mode)
            if step is not None:
                parsed_steps.append(step)
        return parsed_steps

    def _parse_leg_step(
        self,
        raw_step: dict,
        *,
        origin: str,
        destination: str,
        fallback_mode: DirectionsMode,
    ) -> Optional[RouteStep]:
        raw_mode = str(raw_step.get("travel_mode") or "").upper()
        duration_minutes = self._extract_step_duration_minutes(raw_step)
        distance_meters = self._extract_step_distance_meters(raw_step)
        html_instructions = self._normalize_instruction(raw_step.get("html_instructions"))

        if raw_mode == "TRANSIT":
            transit_details = raw_step.get("transit_details") or {}
            line = transit_details.get("line") or {}
            vehicle = line.get("vehicle") or {}
            vehicle_type = str(vehicle.get("type") or "").upper() or None
            line_name = line.get("short_name") or line.get("name")
            departure_stop_name = (transit_details.get("departure_stop") or {}).get("name")
            arrival_stop_name = (transit_details.get("arrival_stop") or {}).get("name")
            headsign = transit_details.get("headsign")
            notes_parts = [part for part in (html_instructions, headsign) if isinstance(part, str) and part.strip()]
            return RouteStep(
                travel_mode="TRANSIT",
                transit_subtype=self._map_vehicle_type_to_transit_subtype(vehicle_type),
                duration_minutes=duration_minutes,
                distance_meters=distance_meters,
                from_name=departure_stop_name or origin,
                to_name=arrival_stop_name or destination,
                departure_time=self._extract_transit_datetime(transit_details.get("departure_time")),
                arrival_time=self._extract_transit_datetime(transit_details.get("arrival_time")),
                line_name=line_name,
                vehicle_type=vehicle_type,
                notes=" / ".join(notes_parts) if notes_parts else None,
                departure_stop_name=departure_stop_name,
                arrival_stop_name=arrival_stop_name,
            )

        if raw_mode == "WALKING":
            return RouteStep(
                travel_mode="WALK",
                duration_minutes=duration_minutes,
                distance_meters=distance_meters,
                notes=html_instructions or "徒歩で移動",
            )

        if raw_mode == "DRIVING":
            return RouteStep(
                travel_mode="DRIVE",
                duration_minutes=duration_minutes,
                distance_meters=distance_meters,
                from_name=origin,
                to_name=destination,
                notes=html_instructions or "車で移動",
            )

        if fallback_mode == "walking":
            return RouteStep(
                travel_mode="WALK",
                duration_minutes=duration_minutes,
                distance_meters=distance_meters,
                notes=html_instructions or "徒歩で移動",
            )
        if fallback_mode == "driving":
            return RouteStep(
                travel_mode="DRIVE",
                duration_minutes=duration_minutes,
                distance_meters=distance_meters,
                from_name=origin,
                to_name=destination,
                notes=html_instructions or "車で移動",
            )
        return None

    @staticmethod
    def _extract_step_duration_minutes(raw_step: dict) -> Optional[int]:
        seconds = (raw_step.get("duration") or {}).get("value")
        if not isinstance(seconds, (int, float)):
            return None
        return max(1, round(float(seconds) / 60))

    @staticmethod
    def _extract_step_distance_meters(raw_step: dict) -> Optional[int]:
        value = (raw_step.get("distance") or {}).get("value")
        if not isinstance(value, int):
            return None
        return value

    @staticmethod
    def _normalize_instruction(raw_instruction: object) -> Optional[str]:
        if not isinstance(raw_instruction, str) or not raw_instruction.strip():
            return None
        without_tags = re.sub(r"<[^>]+>", " ", raw_instruction)
        normalized = " ".join(unescape(without_tags).split())
        return normalized or None

    @staticmethod
    def _extract_transit_datetime(raw_value: object) -> Optional[datetime]:
        if not isinstance(raw_value, dict):
            return None
        unix_value = raw_value.get("value")
        if isinstance(unix_value, (int, float)):
            return datetime.fromtimestamp(float(unix_value), tz=timezone.utc)
        return None

    def _extract_primary_transit_subtype(self, response: dict) -> Optional[str]:
        transit_step = self._find_primary_transit_step(response)
        if transit_step is None:
            return None
        vehicle_type = (
            str(((transit_step.get("transit_details") or {}).get("line") or {}).get("vehicle", {}).get("type") or "").upper()
            or None
        )
        return self._map_vehicle_type_to_transit_subtype(vehicle_type)

    def _extract_primary_transit_line_name(self, response: dict) -> Optional[str]:
        transit_step = self._find_primary_transit_step(response)
        if transit_step is None:
            return None
        line = ((transit_step.get("transit_details") or {}).get("line") or {})
        line_name = line.get("short_name") or line.get("name")
        return line_name if isinstance(line_name, str) and line_name.strip() else None

    def _extract_primary_transit_vehicle_type(self, response: dict) -> Optional[str]:
        transit_step = self._find_primary_transit_step(response)
        if transit_step is None:
            return None
        vehicle_type = str(((transit_step.get("transit_details") or {}).get("line") or {}).get("vehicle", {}).get("type") or "").upper()
        return vehicle_type or None

    @staticmethod
    def _find_primary_transit_step(response: dict) -> Optional[dict]:
        routes = response.get("routes") or []
        if not routes:
            return None
        legs = routes[0].get("legs") or []
        if not legs:
            return None
        steps = legs[0].get("steps") or []
        for step in steps:
            if str(step.get("travel_mode") or "").upper() == "TRANSIT":
                return step
        return None

    @staticmethod
    def _map_vehicle_type_to_transit_subtype(vehicle_type: Optional[str]) -> Optional[str]:
        if not vehicle_type:
            return None
        if vehicle_type == "BUS":
            return "BUS"
        return "TRAIN"

    def _summary_response_to_step(
        self, response: dict, origin: str, destination: str, mode: DirectionsMode
    ) -> RouteStep:
        return RouteStep(
            travel_mode=self._map_mode_for_step(mode),
            transit_subtype=self._extract_primary_transit_subtype(response) if mode == "transit" else None,
            duration_minutes=self._extract_duration_minutes(response),
            distance_meters=self._extract_distance_meters(response),
            from_name=origin,
            to_name=destination,
            line_name=self._extract_primary_transit_line_name(response) if mode == "transit" else None,
            vehicle_type=self._extract_primary_transit_vehicle_type(response) if mode == "transit" else None,
            notes="Google Directions API",
        )

    @staticmethod
    def _map_mode_for_option(mode: DirectionsMode) -> str:
        if mode == "walking":
            return "WALK"
        if mode == "transit":
            return "TRANSIT"
        return "DRIVE"

    @staticmethod
    def _map_mode_for_step(mode: DirectionsMode) -> str:
        if mode == "walking":
            return "WALK"
        if mode == "transit":
            return "TRANSIT"
        return "DRIVE"

    def _validate_inputs(self, *, origin: str, destination: str, mode: DirectionsMode) -> None:
        if not self.api_key:
            raise ValueError("Google Directions API key is not configured")

        if not isinstance(origin, str) or not origin.strip():
            raise ValueError("origin must be a non-empty string")
        if not isinstance(destination, str) or not destination.strip():
            raise ValueError("destination must be a non-empty string")
        if mode not in {"driving", "walking", "transit"}:
            raise ValueError("mode must be one of ['driving', 'walking', 'transit']")

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
