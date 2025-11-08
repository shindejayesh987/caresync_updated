from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from datetime import timedelta
from typing import List, Optional, Sequence

from backend.models import (
    AvailabilityRequest,
    AvailabilityResponse,
    OptimizedAvailabilityResponse,
    OptimizationMetrics,
    OptimizationScenario,
    Resource,
    ScenarioFeedbackPayload,
)
from backend.repositories.scheduling_repository import SchedulingRepository
from backend.services.availability import AvailabilityService, TTLCache
from backend.services.audit import AuditService
from backend.services.common import current_timestamp

LOGGER = logging.getLogger(__name__)


def _hash_payload(payload: Sequence[str]) -> str:
    serialized = "::".join(payload)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class AIOptimizationService:
    """Heuristic optimisation engine for availability planning."""

    def __init__(self, repository: SchedulingRepository) -> None:
        self._repository = repository
        self._coverage_weight = 0.7
        self._overtime_weight = 0.3
        self._last_retrained = current_timestamp()

    @staticmethod
    def request_signature(req: AvailabilityRequest) -> str:
        payload = req.model_dump(exclude_none=True, exclude_unset=True)
        normalized = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    async def generate_scenarios(
        self,
        req: AvailabilityRequest,
        availability: AvailabilityResponse,
    ) -> List[OptimizationScenario]:
        primary = self._build_primary_selection(req, availability)
        scenarios = [self._build_scenario("Primary coverage", req, primary)]

        alternate = self._build_alternate_selection(req, availability)
        if alternate:
            scenarios.append(self._build_scenario("Balanced workload", req, alternate))

        return scenarios

    def _build_primary_selection(
        self, req: AvailabilityRequest, availability: AvailabilityResponse
    ) -> dict:
        return {
            "radiologists": availability.radiologists_available[: req.required_radiologists],
            "assistant_doctors": availability.assistant_doctors_available[
                : req.required_assistant_doctors
            ],
            "nurses": availability.nurses_available[: req.required_nurses],
            "equipment": self._filter_equipment(req, availability),
            "operation_rooms": availability.operation_theatres_available[
                : req.required_operation_rooms
            ],
        }

    def _build_alternate_selection(
        self, req: AvailabilityRequest, availability: AvailabilityResponse
    ) -> Optional[dict]:
        if not availability.nurses_available:
            return None

        rotated_nurses = self._rotate_resources(
            availability.nurses_available,
            req.required_nurses,
        )
        rotated_radiologists = self._rotate_resources(
            availability.radiologists_available,
            req.required_radiologists,
        )

        if not rotated_nurses and not rotated_radiologists:
            return None

        return {
            "radiologists": rotated_radiologists
            or availability.radiologists_available[: req.required_radiologists],
            "assistant_doctors": availability.assistant_doctors_available[
                : req.required_assistant_doctors
            ],
            "nurses": rotated_nurses or availability.nurses_available[: req.required_nurses],
            "equipment": self._filter_equipment(req, availability),
            "operation_rooms": availability.operation_theatres_available[
                : req.required_operation_rooms
            ],
        }

    @staticmethod
    def _rotate_resources(resources: Sequence[Resource], required: int) -> List[Resource]:
        if required <= 0 or len(resources) <= required:
            return list(resources[:required])
        tail = list(resources[required : required * 2])
        head = list(resources[: required - len(tail)]) if len(tail) < required else []
        rotated = tail + head
        return rotated[:required]

    def _filter_equipment(
        self, req: AvailabilityRequest, availability: AvailabilityResponse
    ) -> List[Resource]:
        if not req.required_equipment:
            return availability.equipment_available
        return [
            equipment
            for equipment in availability.equipment_available
            if equipment.name and equipment.name.lower() == req.required_equipment.lower()
        ]

    def _build_scenario(
        self, label: str, req: AvailabilityRequest, selection: dict
    ) -> OptimizationScenario:
        metrics = self._calculate_metrics(req, selection)
        fingerprint = _hash_payload(
            [
                label,
                f"{metrics.coverage_score:.4f}",
                ",".join(resource.id for resource in selection["radiologists"]),
                ",".join(resource.id for resource in selection["nurses"]),
            ]
        )
        generated_at = current_timestamp()
        return OptimizationScenario(
            scenario_id=fingerprint,
            label=label,
            radiologists=list(selection["radiologists"]),
            assistant_doctors=list(selection["assistant_doctors"]),
            nurses=list(selection["nurses"]),
            equipment=list(selection["equipment"]),
            operation_rooms=list(selection["operation_rooms"]),
            metrics=metrics,
            generated_at=generated_at,
        )

    def _calculate_metrics(self, req: AvailabilityRequest, selection: dict) -> OptimizationMetrics:
        ratios = []
        ratios.append(self._safe_ratio(selection["radiologists"], req.required_radiologists))
        ratios.append(
            self._safe_ratio(selection["assistant_doctors"], req.required_assistant_doctors)
        )
        ratios.append(self._safe_ratio(selection["nurses"], req.required_nurses))
        ratios.append(self._safe_ratio(selection["operation_rooms"], req.required_operation_rooms))

        coverage_score = min(1.0, sum(ratios) / len(ratios)) if ratios else 0.0
        overtime_penalty = self._estimate_overtime(selection, req)
        confidence = max(0.1, min(0.99, (coverage_score * self._coverage_weight) - (overtime_penalty * 0.01)))

        reasoning: List[str] = []
        reason_codes: List[str] = []
        if coverage_score >= 1.0:
            reasoning.append("All staffing thresholds satisfied")
            reason_codes.append("COVERAGE_OK")
        else:
            reasoning.append("Coverage below target; consider contingency staff")
            reason_codes.append("COVERAGE_LOW")

        if overtime_penalty <= 30:
            reasoning.append("Projected overtime within acceptable limits")
            reason_codes.append("OVERTIME_OK")
        else:
            reasoning.append("Potential overtime hotspot detected")
            reason_codes.append("OVERTIME_HIGH")

        if selection["equipment"]:
            reasoning.append("Required equipment reserved")
            reason_codes.append("EQUIPMENT_OK")
        else:
            reasoning.append("Equipment availability uncertain")
            reason_codes.append("EQUIPMENT_GAP")

        return OptimizationMetrics(
            coverage_score=round(coverage_score, 4),
            predicted_overtime_minutes=overtime_penalty,
            confidence=round(confidence, 4),
            reasoning=reasoning,
            reason_codes=reason_codes,
        )

    @staticmethod
    def _estimate_overtime(selection: dict, req: AvailabilityRequest) -> int:
        nurse_overage = max(0, len(selection["nurses"]) - req.required_nurses)
        doctor_overage = max(0, len(selection["assistant_doctors"]) - req.required_assistant_doctors)
        overtime_minutes = (nurse_overage + doctor_overage) * 15
        return overtime_minutes

    @staticmethod
    def _safe_ratio(resources: Sequence[Resource], required: int) -> float:
        if required <= 0:
            return 1.0
        return len(resources) / required if resources else 0.0

    async def refresh_model(self, lookback_hours: int = 24) -> None:
        since = current_timestamp() - timedelta(hours=lookback_hours)
        feedback = await self._repository.fetch_recent_feedback(since)
        if not feedback:
            return

        accepted = sum(1 for item in feedback if item.get("accepted"))
        ratio = accepted / len(feedback)
        self._coverage_weight = max(0.5, min(0.9, ratio))
        self._overtime_weight = 1.0 - self._coverage_weight
        self._last_retrained = current_timestamp()


class OptimizedAvailabilityService:
    def __init__(
        self,
        availability_service: AvailabilityService,
        ai_service: AIOptimizationService,
        repository: SchedulingRepository,
        audit_service: AuditService,
        *,
        cache_ttl_seconds: int = 300,
    ) -> None:
        self._availability_service = availability_service
        self._ai_service = ai_service
        self._repository = repository
        self._audit = audit_service
        self._cache = TTLCache(ttl_seconds=cache_ttl_seconds)
        self._cache_ttl = cache_ttl_seconds

    async def optimized_availability(self, req: AvailabilityRequest) -> OptimizedAvailabilityResponse:
        key = self._ai_service.request_signature(req)
        cached: Optional[OptimizedAvailabilityResponse] = self._cache.get(key)  # type: ignore[assignment]
        if cached:
            return cached.model_copy(update={"cached": True})

        availability = await self._availability_service.check_availability(req)
        scenarios = await self._ai_service.generate_scenarios(req, availability)

        expires_at = current_timestamp() + timedelta(seconds=self._cache_ttl)
        response = OptimizedAvailabilityResponse(
            request_key=key,
            cached=False,
            cache_expires_at=expires_at,
            baseline=availability,
            scenarios=scenarios,
        )

        self._cache.set(key, response)
        await self._repository.save_optimization_snapshot(
            {
                "request_key": key,
                "request": req.model_dump(exclude_none=True),
                "baseline": availability.model_dump(),
                "scenarios": [scenario.model_dump() for scenario in scenarios],
                "generated_at": current_timestamp(),
            }
        )

        await self._audit.log_activity(
            "optimization.generated",
            performed_by=req.patient_id,
            payload={"request_key": key, "scenario_count": len(scenarios)},
        )

        return response

    async def record_feedback(self, payload: ScenarioFeedbackPayload, performed_by: Optional[str]) -> dict:
        doc = payload.model_dump(exclude_none=True)
        doc.update(
            {
                "submitted_at": current_timestamp(),
                "submitted_by": performed_by,
            }
        )
        await self._repository.save_optimization_feedback(doc)
        await self._audit.log_activity(
            "optimization.feedback",
            performed_by,
            {"request_key": payload.request_key, "scenario_id": payload.scenario_id, "accepted": payload.accepted},
        )
        return {"status": "recorded"}


class OptimizationScheduler:
    def __init__(
        self,
        ai_service: AIOptimizationService,
        *,
        interval_seconds: int = 60 * 60 * 24,
    ) -> None:
        self._ai_service = ai_service
        self._interval = interval_seconds
        self._task: Optional[asyncio.Task] = None
        self._stop_event: Optional[asyncio.Event] = None

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop_event = asyncio.Event()
        loop = asyncio.get_event_loop()
        self._task = loop.create_task(self._run())

    async def stop(self) -> None:
        if not self._task:
            return
        if self._stop_event:
            self._stop_event.set()
        try:
            await self._task
        except Exception as exc:  # pragma: no cover - logged and suppressed
            LOGGER.error("Optimization scheduler terminated with error: %s", exc)
        finally:
            self._task = None
            self._stop_event = None

    async def _run(self) -> None:
        assert self._stop_event is not None
        while not self._stop_event.is_set():
            try:
                await self._ai_service.refresh_model()
            except Exception as exc:  # pragma: no cover - defensive logging
                LOGGER.error("Failed to refresh optimisation model: %s", exc)
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                continue
