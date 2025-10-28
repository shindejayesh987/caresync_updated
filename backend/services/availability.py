from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from datetime import date, datetime
from typing import Awaitable, Callable, Dict, List, Optional

from fastapi import HTTPException, status

from backend.models import AvailabilityRequest, AvailabilityResponse, Resource
from backend.repositories.scheduling_repository import SchedulingRepository


@dataclass
class CacheEntry:
    value: object
    expires_at: float


class TTLCache:
    def __init__(self, ttl_seconds: float = 60.0) -> None:
        self._ttl = ttl_seconds
        self._store: Dict[str, CacheEntry] = {}

    def get(self, key: str) -> Optional[object]:
        entry = self._store.get(key)
        if not entry:
            return None
        if entry.expires_at < time.monotonic():
            self._store.pop(key, None)
            return None
        return entry.value

    def set(self, key: str, value: object) -> None:
        self._store[key] = CacheEntry(value=value, expires_at=time.monotonic() + self._ttl)


class AvailabilityService:
    def __init__(
        self,
        repository: SchedulingRepository,
        cache: Optional[TTLCache] = None,
        *,
        max_attempts: int = 3,
        base_delay: float = 0.05,
    ) -> None:
        self._repository = repository
        self._cache = cache or TTLCache()
        self._max_attempts = max_attempts
        self._base_delay = base_delay

    async def check_availability(self, req: AvailabilityRequest) -> AvailabilityResponse:
        try:
            requested_date = datetime.strptime(req.requested_date, "%Y-%m-%d").date()
            datetime.strptime(req.requested_start, "%H:%M")
            datetime.strptime(req.requested_end, "%H:%M")
            constraint = req.time_constraint_type
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid date/time format: {exc}") from exc

        try:
            rad_raw, asst_raw, nurse_raw, equip_raw, ot_raw, scores = await asyncio.gather(
                self._fetch_staff("radiologist", requested_date, req.requested_start, req.requested_end, constraint),
                self._fetch_staff("assistant_doctor", requested_date, req.requested_start, req.requested_end, constraint),
                self._fetch_generic(
                    "nurse_availability",
                    requested_date,
                    req.requested_start,
                    req.requested_end,
                    constraint,
                    "nurse_id",
                    "nurse_name",
                    "nurse_email",
                ),
                self._fetch_generic(
                    "equipment_availability",
                    requested_date,
                    req.requested_start,
                    req.requested_end,
                    constraint,
                    "equipment_name",
                    "equipment_name",
                ),
                self._fetch_generic(
                    "ot_availability",
                    requested_date,
                    req.requested_start,
                    req.requested_end,
                    constraint,
                    "ot_id",
                    "ot_id",
                ),
                self._retry(lambda: self._repository.get_latest_test_scores(req.required_test_type)),
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Availability lookup failed") from exc

        radiologists = rad_raw[: req.required_radiologists]
        assistants = asst_raw[: req.required_assistant_doctors]
        nurses = nurse_raw[: req.required_nurses]
        theatres = ot_raw[: req.required_operation_rooms]

        if req.required_equipment:
            equipment = [resource for resource in equip_raw if resource.name == req.required_equipment]
        else:
            equipment = equip_raw

        match = self._requirements_met(req, rad_raw, asst_raw, nurse_raw, ot_raw, equipment)

        return AvailabilityResponse(
            date=req.requested_date,
            start=req.requested_start,
            end=req.requested_end,
            radiologists_available=radiologists,
            assistant_doctors_available=assistants,
            nurses_available=nurses,
            equipment_available=equipment,
            operation_theatres_available=theatres,
            latest_test_scores=scores,
            match_status="Requirements matched" if match else "Requirements not met",
        )

    async def _fetch_staff(
        self,
        role: str,
        target_date: date,
        start: str,
        end: str,
        constraint: str,
    ) -> List[Resource]:
        cache_key = f"staff:{role}:{target_date.isoformat()}:{start}:{end}:{constraint}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached  # type: ignore[return-value]

        async def operation() -> List[Resource]:
            documents = await self._repository.find_staff(role, target_date, start, end)
            resources: List[Resource] = []
            for doc in documents:
                for wh in doc.get("working_hours", []):
                    if wh.get("day_of_week") == target_date.weekday() and self._time_window_match(
                        wh.get("start"), wh.get("end"), start, end, constraint
                    ):
                        resources.append(Resource(id=str(doc.get("_id")), name=doc.get("name"), email=doc.get("email")))
                        break
            return resources

        resources = await self._retry(operation)
        self._cache.set(cache_key, resources)
        return resources

    async def _fetch_generic(
        self,
        collection: str,
        target_date: date,
        start: str,
        end: str,
        constraint: str,
        identifier: str,
        name_field: str,
        email_field: Optional[str] = None,
    ) -> List[Resource]:
        cache_key = f"generic:{collection}:{target_date.isoformat()}:{start}:{end}:{constraint}:{identifier}:{name_field}:{email_field or '-'}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached  # type: ignore[return-value]

        async def operation() -> List[Resource]:
            documents = await self._repository.find_generic_availability(collection, target_date, start, end, constraint)
            resources: List[Resource] = []
            for doc in documents:
                doc_start = str(doc.get("start"))
                doc_end = str(doc.get("end"))
                if not doc_start or not doc_end:
                    continue
                if self._time_window_match(doc_start, doc_end, start, end, constraint):
                    identifier_value = doc.get(identifier) or doc.get("_id")
                    if identifier_value is None:
                        continue
                    resource_email = doc.get(email_field) if email_field else doc.get("email")
                    resource_name = doc.get(name_field) or str(identifier_value)
                    resources.append(Resource(id=str(identifier_value), name=resource_name, email=resource_email))
            return resources

        resources = await self._retry(operation)
        self._cache.set(cache_key, resources)
        return resources

    @staticmethod
    def _requirements_met(
        req: AvailabilityRequest,
        radiologists: List[Resource],
        assistants: List[Resource],
        nurses: List[Resource],
        theatres: List[Resource],
        equipment: List[Resource],
    ) -> bool:
        return (
            len(radiologists) >= req.required_radiologists
            and len(assistants) >= req.required_assistant_doctors
            and len(nurses) >= req.required_nurses
            and len(theatres) >= req.required_operation_rooms
            and (not req.required_equipment or bool(equipment))
        )

    @staticmethod
    def _time_window_match(start1: str, end1: str, start2: str, end2: str, constraint: str) -> bool:
        fmt = "%H:%M"
        s1 = datetime.strptime(start1, fmt).time()
        e1 = datetime.strptime(end1, fmt).time()
        s2 = datetime.strptime(start2, fmt).time()
        e2 = datetime.strptime(end2, fmt).time()
        if constraint == "exact":
            return s1 <= s2 and e1 >= e2
        return not (e1 < s2 or s1 > e2)

    async def _retry(self, operation: Callable[[], Awaitable[object]]) -> object:
        attempt = 0
        while True:
            attempt += 1
            try:
                return await operation()
            except Exception:
                if attempt >= self._max_attempts:
                    raise
                await asyncio.sleep(self._base_delay * (2 ** (attempt - 1)))
