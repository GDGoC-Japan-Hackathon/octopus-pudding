import asyncio
import json
import logging
import socket
from dataclasses import asdict, dataclass
from datetime import datetime
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

    def to_dict(self) -> dict:
        return asdict(self)


class RoutesClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or settings.google_routes_api_key
        self.directions_endpoint = endpoint or settings.google_directions_endpoint
        self.connect_timeout_seconds = settings.google_routes_connect_timeout_seconds
        self.read_timeout_seconds = settings.google_routes_read_timeout_seconds

    def fetch_directions(
        self,
        *,
        origin: str,
        destination: str,
        mode: DirectionsMode,
    ) -> dict:
        response = self._request_directions(origin=origin, destination=destination, mode=mode)
        return self._extract_summary(response)

    async def compute_route_options(
        self,
        origin: str,
        destination: str,
        departure_time: Optional[datetime] = None,
    ) -> list[RouteOption]:
        _ = departure_time
        route_options: list[RouteOption] = []
        for mode in ("walking", "transit"):
            try:
                response = await asyncio.to_thread(
                    self._request_directions,
                    origin,
                    destination,
                    mode,
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
                    duration_minutes=self._extract_duration_minutes(response),
                    distance_meters=self._extract_distance_meters(response),
                    summary=f"{summary['duration']} / {summary['distance']}",
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
        _ = departure_time

        diagnostics = RouteDiagnostics()
        diagnostics.transit_attempted_pairs += 1

        try:
            transit_response = await asyncio.to_thread(
                self._request_directions,
                origin,
                destination,
                "transit",
            )
            diagnostics.transit_succeeded_pairs += 1
            return [
                self._summary_response_to_step(transit_response, origin, destination, "transit")
            ], diagnostics.to_dict()
        except DirectionsAPIError as exc:
            normalized = exc.status.upper()
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
            logger.exception("RoutesClient transit exception: origin=%s destination=%s", origin, destination)

        for mode in ("walking", "driving"):
            try:
                response = await asyncio.to_thread(
                    self._request_directions,
                    origin,
                    destination,
                    mode,
                )
                if mode == "walking":
                    diagnostics.walk_fallback_pairs += 1
                else:
                    diagnostics.drive_fallback_pairs += 1
                return [self._summary_response_to_step(response, origin, destination, mode)], diagnostics.to_dict()
            except Exception:
                logger.exception(
                    "RoutesClient %s fallback failed: origin=%s destination=%s",
                    mode,
                    origin,
                    destination,
                )

        return [], diagnostics.to_dict()

    def _request_directions(self, origin: str, destination: str, mode: DirectionsMode) -> dict:
        self._validate_inputs(origin=origin, destination=destination, mode=mode)

        params = {
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "language": "ja",
            "key": self.api_key,
        }
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

    def _summary_response_to_step(
        self, response: dict, origin: str, destination: str, mode: DirectionsMode
    ) -> RouteStep:
        return RouteStep(
            travel_mode=self._map_mode_for_step(mode),
            transit_subtype="TRAIN" if mode == "transit" else None,
            duration_minutes=self._extract_duration_minutes(response),
            distance_meters=self._extract_distance_meters(response),
            from_name=origin,
            to_name=destination,
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
