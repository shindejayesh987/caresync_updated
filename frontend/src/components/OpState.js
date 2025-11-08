import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Task from "./Task";
import {
    publishPlan,
    fetchTasks,
    fetchCrew,
    updateTasks,
    updateCrew,
    requestOptimizedAvailability,
    submitOptimizationFeedback,
} from "../services/api";
import PublishSuccessEnhanced from "./PublishSuccessEnhanced";

const defaultNurseTaskTemplates = [
  [
    { label: "Check BP every 4 hours", status: "completed", time: "08:00", note: "Stable vitals" },
    { label: "Administer medication", status: "in_progress", time: "09:00", note: "Given half dose" },
  ],
  [
    { label: "Pre-op patient preparation", status: "pending", time: "08:30", note: "To start soon" },
    { label: "Patient education", status: "completed", time: "07:50", note: "Explained procedure" },
  ],
];

const cloneTasks = (tasks = []) => tasks.map((task) => ({ ...task }));

const buildNurseTaskMap = (names, previous = {}) => {
  const map = {};
  names.forEach((name, index) => {
    if (Object.prototype.hasOwnProperty.call(previous, name)) {
      map[name] = cloneTasks(previous[name]);
    } else if (defaultNurseTaskTemplates[index]) {
      map[name] = cloneTasks(defaultNurseTaskTemplates[index]);
    } else {
      map[name] = [];
    }
  });
  return map;
};

const defaultAvailabilityPayload = {
  requested_date: "2025-04-02",
  requested_start: "10:00",
  requested_end: "18:00",
  required_test_type: "MRI",
  required_radiologists: 1,
  required_assistant_doctors: 1,
  required_nurses: 2,
  required_operation_rooms: 1,
  required_equipment: "Anesthesia Machine",
  time_constraint_type: "exact",
};

const initialNurseNames = ["Susan", "Elizabeth"];
const initialNurseTasks = buildNurseTaskMap(initialNurseNames);
const initialSurgeryNurseTasks = {
    Susan: [
        { label: "Monitor vitals", status: "in_progress", time: "11:00", note: "HR stable", priority: "Routine" },
        { label: "Manage IV fluids", status: "completed", time: "10:45", note: "Fluids replaced", priority: "Routine" },
    ],
};

const initialSurgeryDoctorTasks = {
    "Dr. Wong": [
        { label: "Perform procedure", status: "pending", time: "12:00", note: "Scheduled after prep", priority: "High" },
    ],
};

const initialPostOpNurseTasks = {
    Elizabeth: [
        { label: "Pain assessment", status: "pending", time: "14:00", note: "To follow-up", priority: "Routine" },
        { label: "Discharge instructions", status: "in_progress", time: "15:00", note: "Started briefing", priority: "Routine" },
    ],
};
const PRIORITY_OPTIONS = ["Routine", "High", "Critical"];

const wrapResources = (list = [], prefix) =>
    list.map((item, index) => {
        const baseName =
            item.name ||
            item.nurse_name ||
            item.email ||
            item.equipment_name ||
            item.ot_id ||
            `${prefix}-${index + 1}`;
        return {
            ...item,
            id: item.id || `${prefix}-${index}-${baseName}`,
            name: baseName,
        };
    });

const buildScenarioSuggestion = (scenario, baseline = {}) => {
    if (!scenario) return null;
    return {
        nurses: wrapResources(scenario.nurses, "nurse"),
        assistantDoctors: wrapResources(scenario.assistant_doctors, "assistant"),
        radiologists: wrapResources(scenario.radiologists, "radiologist"),
        equipment: wrapResources(scenario.equipment, "equipment"),
        operationTheatres: wrapResources(scenario.operation_rooms, "ot"),
        tests: baseline.latest_test_scores || [],
        meta: {
            date: baseline.date,
            start: baseline.start,
            end: baseline.end,
            matchStatus: baseline.match_status,
            scenarioLabel: scenario.label,
            generatedAt: scenario.generated_at,
        },
        metrics: {
            coverageScore: scenario.metrics?.coverage_score ?? 0,
            predictedOvertimeMinutes: scenario.metrics?.predicted_overtime_minutes ?? 0,
            confidence: scenario.metrics?.confidence ?? 0,
            reasoning: scenario.metrics?.reasoning || [],
            reasonCodes: scenario.metrics?.reason_codes || [],
        },
    };
};

const normalizeOptimizationResponse = (data) => {
    const baseline = data?.baseline || {};
    const scenarios = (data?.scenarios || []).map((scenario) => ({
        scenarioId: scenario.scenario_id,
        label: scenario.label,
        generatedAt: scenario.generated_at,
        metrics: {
            coverageScore: scenario.metrics?.coverage_score ?? 0,
            predictedOvertimeMinutes: scenario.metrics?.predicted_overtime_minutes ?? 0,
            confidence: scenario.metrics?.confidence ?? 0,
            reasoning: scenario.metrics?.reasoning || [],
            reasonCodes: scenario.metrics?.reason_codes || [],
        },
        resources: buildScenarioSuggestion(scenario, baseline),
    }));

    return {
        requestKey: data?.request_key,
        cached: Boolean(data?.cached),
        cacheExpiresAt: data?.cache_expires_at,
        baseline,
        scenarios,
    };
};

const formatPlan = (plan) => {
    if (!plan) return null;
    return {
        summary: plan.surgical_plan_summary,
        urgency: plan.urgency_level,
        tests: plan.suggested_tests || [],
        steps: [
            {
                id: "prep-consent",
                title: "Confirm informed consent",
                detail: "Reconfirm consent and allergies prior to incision.",
                suggestedRole: "Assistant Doctor",
            },
            {
                id: "verify-blood",
                title: "Verify blood products",
                detail: "Ensure cross-matched units are on standby.",
                suggestedRole: "Nurse",
            },
            {
                id: "review-imaging",
                title: "Review surgical imaging",
                detail: "Review most recent CT scans with surgical team.",
                suggestedRole: "Radiologist",
            },
            {
                id: "postop-brief",
                title: "Schedule PACU briefing",
                detail: "Coordinate immediate post-op handoff to PACU lead.",
                suggestedRole: "Assistant Doctor",
            },
        ],
    };
};

const suggestionCategories = [
    { key: "nurses", label: "Nurses", target: "nurse" },
    { key: "assistantDoctors", label: "Assistant Doctors", target: "doctor" },
    { key: "radiologists", label: "Radiologists", target: "doctor" },
    { key: "equipment", label: "Equipment", target: "equipment" },
    { key: "operationTheatres", label: "Operating Rooms", target: "ot" },
];

const deriveMatchStatus = (suggestions) => {
    if (!suggestions) {
        return { message: "Awaiting AI data", success: null, missing: [] };
    }

    const metrics = suggestions.metrics || {};
    const coverageScore = metrics.coverageScore ?? 0;
    const coveragePct = Math.round(coverageScore * 100);
    const success = coverageScore >= 1;
    const missing = [];

    if (!success) {
        missing.push("Staffing coverage");
    }
    if ((metrics.reasonCodes || []).includes("EQUIPMENT_GAP")) {
        missing.push("Equipment availability");
    }
    if ((metrics.predictedOvertimeMinutes || 0) > 30) {
        missing.push("Overtime risk");
    }

    const backendStatus = suggestions.meta?.matchStatus;
    const message = backendStatus
        ? backendStatus
        : success
        ? `Coverage score ${coveragePct}%`
        : `Coverage ${coveragePct}% – verify staffing`;

    return {
        message,
        success: success && !missing.includes("Equipment availability") && !missing.includes("Overtime risk"),
        missing,
    };
};

const OpState = ({
    token,
    patientId,
    user,
    timeline = [],
    crewRoster = { doctors: [], nurses: [] },
    vitalsSnapshot = {},
    doctorId,
}) => {
    const [activeTab, setActiveTab] = useState("preop");
    const [nurseTasks, setNurseTasks] = useState(initialNurseTasks);
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [aiError, setAiError] = useState("");
    const [aiPlan, setAiPlan] = useState(null);
    const [optimizationResult, setOptimizationResult] = useState(null);
    const [activeScenarioId, setActiveScenarioId] = useState(null);
    const [scenarioDecision, setScenarioDecision] = useState("accept");
    const [scenarioFeedback, setScenarioFeedback] = useState("");
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [matchStatus, setMatchStatus] = useState(null);
    const [selectedCrewForSuggestion, setSelectedCrewForSuggestion] = useState({});
    const [selectedPlanTasks, setSelectedPlanTasks] = useState({});
    const [loading, setLoading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [publishedPlan, setPublishedPlan] = useState(null);
    const [publishedRecordId, setPublishedRecordId] = useState("");
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [doctorTasksPreOp, setDoctorTasksPreOp] = useState({
        "Dr. Martinez": [
            { label: "Review lab results", status: "completed", time: "07:30", note: "No concerns" },
            { label: "Obtain informed consent", status: "in_progress", time: "08:10", note: "Halfway done" },
        ],
        "Dr. Wong": [
            { label: "Coordinate with anesthesia team", status: "pending", time: "09:00", note: "Waiting for update" },
        ],
    });
    const [nurseTasksSurgery, setNurseTasksSurgery] = useState(initialSurgeryNurseTasks);
    const [doctorTasksSurgery, setDoctorTasksSurgery] = useState(initialSurgeryDoctorTasks);
    const [nurseTasksPostOp, setNurseTasksPostOp] = useState(initialPostOpNurseTasks);
    const [doctorTasksPostOp, setDoctorTasksPostOp] = useState({});
    const [crewDoctors, setCrewDoctors] = useState([]);
    const [crewNurses, setCrewNurses] = useState([]);
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState("");
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskForm, setTaskForm] = useState({
        staff: "",
        ownerType: "doctor",
        label: "",
        status: "pending",
        time: "",
        note: "",
        priority: "Routine",
    });
    const [taskFormError, setTaskFormError] = useState("");
    const [useCustomStaff, setUseCustomStaff] = useState(false);
    const [customStaffName, setCustomStaffName] = useState("");
    const [showCrewModal, setShowCrewModal] = useState(false);
    const [crewDoctorDraft, setCrewDoctorDraft] = useState([]);
    const [crewNurseDraft, setCrewNurseDraft] = useState([]);
    const [selectedDoctorOption, setSelectedDoctorOption] = useState("");
    const [selectedNurseOption, setSelectedNurseOption] = useState("");
    const [crewError, setCrewError] = useState("");
    const [toast, setToast] = useState(null);
    const [taskModalScope, setTaskModalScope] = useState("preop");
    const toastTimeoutRef = useRef(null);
    const [editingTaskContext, setEditingTaskContext] = useState(null);
    const navigate = useNavigate();

    const performerName = useMemo(() => {
        if (user?.full_name) {
            return user.full_name;
        }
        if (user?.email) {
            return user.email;
        }
        return "CareSync Clinician";
    }, [user]);

    useEffect(() => {
        if (crewRoster?.doctors?.length && crewDoctors.length === 0) {
            const uniqueDoctors = Array.from(
                new Set(
                    crewRoster.doctors
                        .map((name) => (name || "").trim())
                        .filter(Boolean)
                )
            );
            if (uniqueDoctors.length) {
                setCrewDoctors(uniqueDoctors);
            }
        }
        if (crewRoster?.nurses?.length && crewNurses.length === 0) {
            const uniqueNurses = Array.from(
                new Set(
                    crewRoster.nurses
                        .map((name) => (name || "").trim())
                        .filter(Boolean)
                )
            );
            if (uniqueNurses.length) {
                setCrewNurses(uniqueNurses);
            }
            }
        }, [crewRoster, crewDoctors.length, crewNurses.length]);

    useEffect(() => {
        return () => {
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
                toastTimeoutRef.current = null;
            }
        };
    }, []);

    const showToast = useCallback((message, type = "success") => {
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        setToast({ message, type });
        toastTimeoutRef.current = setTimeout(() => {
            setToast(null);
            toastTimeoutRef.current = null;
        }, 3000);
    }, [setToast]);

    const activeScenario = useMemo(() => {
        if (!optimizationResult?.scenarios?.length || !activeScenarioId) {
            return null;
        }
        return (
            optimizationResult.scenarios.find((scenario) => scenario.scenarioId === activeScenarioId) || null
        );
    }, [optimizationResult, activeScenarioId]);

    const applyTaskSnapshot = useCallback((docs = []) => {
        if (!Array.isArray(docs) || docs.length === 0) {
            setDoctorTasksPreOp({});
            setNurseTasks({});
            setDoctorTasksSurgery({});
            setNurseTasksSurgery({});
            setDoctorTasksPostOp({});
            setNurseTasksPostOp({});
            return;
        }

        const bucket = {
            preop: { doctor: {}, nurse: {} },
            surgery: { doctor: {}, nurse: {} },
            postop: { doctor: {}, nurse: {} },
        };

        docs.forEach((entry) => {
            const scope = entry.scope;
            const role = entry.staff_role === "nurse" ? "nurse" : "doctor";
            const staffName = (entry.staff_name || "").trim();
            if (!scope || !bucket[scope] || !staffName) {
                return;
            }
            const cleanedTasks = (entry.tasks || [])
                .filter((task) => task?.label)
                .map((task) => ({
                    label: task.label,
                    status: task.status || "pending",
                    note: task.note || "",
                    time: task.time || "",
                    priority: task.priority || "Routine",
                }));

            if (cleanedTasks.length === 0) {
                return;
            }

            bucket[scope][role][staffName] = cleanedTasks;
        });

        setDoctorTasksPreOp(bucket.preop.doctor);
        setNurseTasks(bucket.preop.nurse);
        setDoctorTasksSurgery(bucket.surgery.doctor);
        setNurseTasksSurgery(bucket.surgery.nurse);
        setDoctorTasksPostOp(bucket.postop.doctor);
        setNurseTasksPostOp(bucket.postop.nurse);
    }, []);

    const syncFromServer = useCallback(async () => {
        if (!patientId || !token) {
            return;
        }
        setSyncing(true);
        setSyncError("");
            try {
            const [tasksResponse, crewResponse] = await Promise.all([
                fetchTasks(patientId, token),
                fetchCrew(patientId, token),
            ]);

            applyTaskSnapshot(tasksResponse?.tasks || []);
            setCrewDoctors((crewResponse?.doctors || []).map((name) => name.trim()).filter(Boolean));
            setCrewNurses((crewResponse?.nurses || []).map((name) => name.trim()).filter(Boolean));
            } catch (err) {
            console.error("Failed to sync surgical state", err);
            setSyncError(err.message || "Unable to sync data from server.");
            } finally {
            setSyncing(false);
            }
        }, [patientId, token, applyTaskSnapshot]);

    useEffect(() => {
        syncFromServer();
    }, [syncFromServer]);

    const doctorNameSuggestions = useMemo(
        () => Array.from(new Set([...(crewDoctors || []), ...Object.keys(doctorTasksPreOp || {})])),
        [crewDoctors, doctorTasksPreOp]
    );
    const nurses = useMemo(
        () => Array.from(new Set([...(crewNurses || []), ...Object.keys(nurseTasks || {})])),
        [crewNurses, nurseTasks]
    );
    const surgeryDoctorNames = useMemo(
        () => Object.keys(doctorTasksSurgery || {}),
        [doctorTasksSurgery]
    );
    const surgeryNurseNames = useMemo(
        () => Object.keys(nurseTasksSurgery || {}),
        [nurseTasksSurgery]
    );
    const postOpNurseNames = useMemo(
        () => Object.keys(nurseTasksPostOp || {}),
        [nurseTasksPostOp]
    );
    const postOpDoctorNames = useMemo(
        () => Object.keys(doctorTasksPostOp || {}),
        [doctorTasksPostOp]
    );
    const availableDoctorOptions = useMemo(() => {
        const aiNames = [
            ...(aiSuggestions?.assistantDoctors || []),
            ...(aiSuggestions?.radiologists || []),
        ]
            .map((entry) => entry?.name?.trim())
            .filter(Boolean);
        const existing = [
            ...(crewDoctors || []),
            ...doctorNameSuggestions,
            ...surgeryDoctorNames,
            ...postOpDoctorNames,
        ];
        const merged = Array.from(new Set([...aiNames, ...existing]));
        return merged;
    }, [aiSuggestions, crewDoctors, doctorNameSuggestions, surgeryDoctorNames, postOpDoctorNames]);

    const availableNurseOptions = useMemo(() => {
        const aiNames = (aiSuggestions?.nurses || [])
            .map((entry) => entry?.name?.trim())
            .filter(Boolean);
        const existing = [
            ...(crewNurses || []),
            ...nurses,
            ...surgeryNurseNames,
            ...postOpNurseNames,
        ];
        const merged = Array.from(new Set([...aiNames, ...existing]));
        return merged;
    }, [aiSuggestions, crewNurses, nurses, surgeryNurseNames, postOpNurseNames]);

    const hasSelectedResources = useMemo(
        () =>
            Object.values(selectedCrewForSuggestion).some(
                (ids) => Array.isArray(ids) && ids.length > 0
            ),
        [selectedCrewForSuggestion]
    );

    const determineOwnerType = useCallback(
        (staffName, scopeHint, fallbackType = "doctor") => {
            if (scopeHint === "postop") {
                if (
                    postOpNurseNames.includes(staffName) ||
                    availableNurseOptions.includes(staffName)
                ) {
                    return "nurse";
                }
                if (
                    postOpDoctorNames.includes(staffName) ||
                    availableDoctorOptions.includes(staffName)
                ) {
                    return "doctor";
                }
                return fallbackType || "nurse";
            }
            if (scopeHint === "surgery") {
                if (
                    surgeryNurseNames.includes(staffName) ||
                    availableNurseOptions.includes(staffName)
                ) {
                    return "nurse";
                }
                if (
                    surgeryDoctorNames.includes(staffName) ||
                    availableDoctorOptions.includes(staffName)
                ) {
                    return "doctor";
                }
            }
            if (
                availableNurseOptions.includes(staffName) ||
                crewNurseDraft.includes(staffName) ||
                Object.prototype.hasOwnProperty.call(nurseTasksSurgery, staffName) ||
                Object.prototype.hasOwnProperty.call(nurseTasksPostOp, staffName)
            ) {
                return "nurse";
            }
            if (
                doctorNameSuggestions.includes(staffName) ||
                crewDoctorDraft.includes(staffName) ||
                Object.prototype.hasOwnProperty.call(doctorTasksSurgery, staffName)
            ) {
                return "doctor";
            }
            if (scopeHint === "surgery" && fallbackType) {
                return fallbackType;
            }
            if (scopeHint === "postop") {
                return "nurse";
            }
            return fallbackType || "doctor";
        },
        [
            availableDoctorOptions,
            availableNurseOptions,
            crewDoctorDraft,
            crewNurseDraft,
            doctorNameSuggestions,
            doctorTasksSurgery,
            nurseTasksPostOp,
            nurseTasksSurgery,
            postOpDoctorNames,
            postOpNurseNames,
            surgeryDoctorNames,
            surgeryNurseNames,
        ]
    );

    const getTaskState = (scope, role) => {
        if (scope === "surgery") {
            if (role === "nurse") return [nurseTasksSurgery, setNurseTasksSurgery];
            if (role === "doctor") return [doctorTasksSurgery, setDoctorTasksSurgery];
        } else if (scope === "postop") {
            if (role === "nurse") return [nurseTasksPostOp, setNurseTasksPostOp];
            if (role === "doctor") return [doctorTasksPostOp, setDoctorTasksPostOp];
        } else {
            if (role === "nurse") return [nurseTasks, setNurseTasks];
            if (role === "doctor") return [doctorTasksPreOp, setDoctorTasksPreOp];
        }
        return null;
    };

    const persistTaskList = useCallback(
        async (scope, role, staffName, tasksList) => {
            if (!patientId || !token || !staffName) {
                return;
            }
                try {
                await updateTasks(
                    {
                        patient_id: patientId,
                        scope,
                        staff_name: staffName,
                        staff_role: role,
                        tasks: (tasksList || []).map((task) => ({
                            label: task.label,
                            status: task.status,
                            note: task.note || undefined,
                            time: task.time || undefined,
                            priority: task.priority || undefined,
                        })),
                        performed_by: performerName,
                    },
                    token
                );
            } catch (err) {
                console.error("Failed to persist task list", err);
                showToast(err.message || "Unable to save task changes.", "error");
                syncFromServer();
            }
        },
        [patientId, performerName, showToast, syncFromServer, token]
    );

    const mutateTaskList = (scope, role, staffName, mutator, { persist = true } = {}) => {
        const stateTuple = getTaskState(scope, role);
        if (!stateTuple) return;
        const [, setter] = stateTuple;
        let nextList = [];
        setter((prev) => {
            const next = { ...prev };
            const list = [...(next[staffName] || [])];
            mutator(list);
            if (list.length) {
                next[staffName] = list;
                nextList = list;
            } else {
                delete next[staffName];
                nextList = [];
            }
            return next;
        });
        if (persist) {
            persistTaskList(scope, role, staffName, nextList);
        }
    };

    const setSuggestions = (nextOrUpdater) => {
        setAiSuggestions((prev) => {
            const next = typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
            setMatchStatus(deriveMatchStatus(next));
            return next;
        });
    };

    const handleFetchAISuggestions = async () => {
        setLoading(true);
        setAiError("");
        try {
            const payload = {
                ...defaultAvailabilityPayload,
                patient_id: patientId || undefined,
            };
            const data = await requestOptimizedAvailability(payload, token);
            const normalized = normalizeOptimizationResponse(data);
            setOptimizationResult(normalized);

            const firstScenario = normalized.scenarios?.[0];
            if (firstScenario) {
                setActiveScenarioId(firstScenario.scenarioId);
                setSuggestions(firstScenario.resources);
            } else {
                setActiveScenarioId(null);
                setSuggestions(null);
            }

            const llmRes = await fetch("/files/ai.json");
            if (llmRes.ok) {
                const llmJson = await llmRes.json();
                setAiPlan(formatPlan(llmJson));
            } else {
                setAiPlan(null);
            }

            setScenarioDecision("accept");
            setScenarioFeedback("");
            setSelectedCrewForSuggestion({});
            setSelectedPlanTasks({});
        } catch (err) {
            console.error("AI Suggestion fetch failed:", err);
            setOptimizationResult(null);
            setActiveScenarioId(null);
            setSuggestions(null);
            setAiPlan(null);
            setAiError(err.message || "Failed to load suggestions.");
        } finally {
            setLoading(false);
        }
    };

    const handleScenarioSelect = useCallback(
        (scenarioId) => {
            setActiveScenarioId(scenarioId);
            const scenario = optimizationResult?.scenarios?.find(
                (item) => item.scenarioId === scenarioId
            );
            if (scenario?.resources) {
                setSuggestions(scenario.resources);
            } else {
                setSuggestions(null);
            }
            setScenarioDecision("accept");
            setScenarioFeedback("");
            setSelectedCrewForSuggestion({});
        },
        [optimizationResult, setSelectedCrewForSuggestion]
    );

    const handleSubmitScenarioFeedback = useCallback(async () => {
        if (!optimizationResult?.requestKey || !activeScenarioId) {
            showToast("Fetch AI recommendations before logging a decision.", "error");
            return;
        }
        setSubmittingFeedback(true);
        try {
            await submitOptimizationFeedback(
                {
                    request_key: optimizationResult.requestKey,
                    scenario_id: activeScenarioId,
                    accepted: scenarioDecision !== "override",
                    feedback_notes: scenarioFeedback || undefined,
                    override_summary:
                        scenarioDecision === "override"
                            ? scenarioFeedback || "Override recorded without additional detail"
                            : undefined,
                },
                token
            );
            showToast("Decision logged for optimisation scenario.");
        } catch (err) {
            console.error("Failed to submit optimisation feedback", err);
            showToast(err.message || "Unable to record decision.", "error");
        } finally {
            setSubmittingFeedback(false);
        }
    }, [
        activeScenarioId,
        optimizationResult,
        scenarioDecision,
        scenarioFeedback,
        showToast,
        submitOptimizationFeedback,
        token,
    ]);

    const toggleResourceSelection = (category, id) => {
        setSelectedCrewForSuggestion((prev) => {
            const current = new Set(prev[category] || []);
            current.has(id) ? current.delete(id) : current.add(id);
            return { ...prev, [category]: Array.from(current) };
        });
    };

    const handleResourceEdit = (category, resource) => {
        const nextName = window.prompt("Update name", resource.name);
        const trimmed = nextName?.trim();
        if (!trimmed) {
            return;
        }
        setSuggestions((prev) => {
            if (!prev) return prev;
            const updatedCategory = prev[category]?.map((item) =>
                item.id === resource.id ? { ...item, name: trimmed } : item
            );
            return { ...prev, [category]: updatedCategory };
        });
    };

    const handleResourceRemove = (category, id) => {
        setSuggestions((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                [category]: prev[category]?.filter((item) => item.id !== id),
            };
        });
        setSelectedCrewForSuggestion((prev) => {
            if (!prev[category]) return prev;
            const filtered = prev[category].filter((itemId) => itemId !== id);
            return { ...prev, [category]: filtered };
        });
    };

    const assignTaskToOwner = (scope, ownerName, task, typeHint) => {
        if (!ownerName) return;
        const normalizedType = typeHint === "nurse" ? "nurse" : "doctor";
        mutateTaskList(scope, normalizedType, ownerName, (list) => {
            list.push(task);
        });
    };

    const handleApplySelectedResources = () => {
        if (!aiSuggestions) return;
        let applied = 0;
        const scope = activeTab || "preop";

        suggestionCategories.forEach(({ key, label, target }) => {
            const selectedIds = selectedCrewForSuggestion[key] || [];
            if (!selectedIds.length) return;
            selectedIds.forEach((id) => {
                const resource = aiSuggestions[key]?.find((item) => item.id === id);
                if (!resource) return;
                const ownerName =
                    target === "nurse"
                        ? resource.name
                        : target === "doctor"
                        ? resource.name
                        : "Logistics Coordinator";
                const task = {
                    label: `Coordinate ${label.toLowerCase()} – ${resource.name}`,
                    status: "pending",
                    note: target === "nurse" ? "Assigned via AI suggestion" : undefined,
                    priority: "Routine",
                };
                assignTaskToOwner(
                    scope,
                    ownerName,
                    task,
                    target === "nurse" ? "nurse" : "doctor"
                );
                applied += 1;
            });
        });

        if (applied > 0) {
            showToast(`Added ${applied} task${applied > 1 ? "s" : ""} from AI suggestions.`, "success");
            setSelectedCrewForSuggestion({});
        } else {
            showToast("Select team members to add tasks.", "error");
        }
    };

    const handlePlanTaskSelection = (stepId, assignee) => {
        setSelectedPlanTasks((prev) => ({ ...prev, [stepId]: assignee }));
    };

    const crewList = useMemo(() => {
        const doctorSource = crewDoctors.length
            ? crewDoctors
            : Array.isArray(crewRoster?.doctors)
            ? crewRoster.doctors
            : [];
        const nurseSource = crewNurses.length
            ? crewNurses
            : Array.isArray(crewRoster?.nurses)
            ? crewRoster.nurses
            : [];

        const entries = [];
        const append = (role, name) => {
            const trimmed = (name || "").trim();
            if (!trimmed) return;
            const key = `${role}-${trimmed.toLowerCase()}`;
            if (entries.some((item) => item.key === key)) {
                return;
            }
            const slug = trimmed
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ".")
                .replace(/^[.]+|[.]+$/g, "");
            entries.push({
                key,
                role,
                name: trimmed,
                email: `${slug || role.toLowerCase()}@caresync.team`,
            });
        };

        doctorSource.forEach((name) => append("Doctor", name));
        nurseSource.forEach((name) => append("Nurse", name));

        return entries.map(({ key, ...rest }) => rest);
    }, [crewDoctors, crewNurses, crewRoster]);

    const compileTasksPayload = useCallback(() => {
        const groups = [];
        const pushGroup = (scope, role, map) => {
            Object.entries(map || {}).forEach(([staffName, taskList]) => {
                if (!Array.isArray(taskList) || !taskList.length) {
                    return;
                }
                groups.push({
                    scope,
                    owner_role: role,
                    owner_name: staffName,
                    tasks: taskList,
                });
            });
        };

        pushGroup("preop", "doctor", doctorTasksPreOp);
        pushGroup("preop", "nurse", nurseTasks);
        pushGroup("surgery", "doctor", doctorTasksSurgery);
        pushGroup("surgery", "nurse", nurseTasksSurgery);
        pushGroup("postop", "doctor", doctorTasksPostOp);
        pushGroup("postop", "nurse", nurseTasksPostOp);

        return groups;
    }, [
        doctorTasksPostOp,
        doctorTasksPreOp,
        doctorTasksSurgery,
        nurseTasks,
        nurseTasksPostOp,
        nurseTasksSurgery,
    ]);

    const handleApplyPlanSteps = () => {
        if (!aiPlan?.steps?.length) return;
        let applied = 0;
        const scope = activeTab || "preop";
        aiPlan.steps.forEach((step) => {
            const assignee = selectedPlanTasks[step.id];
            if (!assignee) return;
            const task = {
                label: step.title,
                status: "pending",
                note: step.detail,
                priority: "High",
            };
            const ownerType = determineOwnerType(assignee, scope, "doctor");
            assignTaskToOwner(scope, assignee, task, ownerType);
            applied += 1;
        });

        if (applied > 0) {
            showToast(`Added ${applied} plan step${applied > 1 ? "s" : ""} to tasks.`, "success");
            setSelectedPlanTasks({});
        } else {
            showToast("Select and assign plan steps before adding.", "error");
        }
    };


    const handlePublish = useCallback(
        async (originTab) => {
            const tabLabel = originTab || activeTab || "preop";
            if (!crewList.length) {
                showToast("Add at least one crew member before publishing.", "error");
                return;
            }

            const planBusinessId =
                typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `plan-${Date.now()}`;

            const payload = {
                plan_id: planBusinessId,
                doctor_id: doctorId || user?.id || user?._id || "unknown-doctor",
                timeline: Array.isArray(timeline) ? timeline : [],
                crew: crewList,
                tasks: compileTasksPayload(),
                vitals: vitalsSnapshot || {},
                timestamp: new Date().toISOString(),
                tab: tabLabel,
            };

            if (optimizationResult?.requestKey && activeScenario) {
                payload.optimization_insights = {
                    request_key: optimizationResult.requestKey,
                    scenario_id: activeScenario.scenarioId,
                    coverage_score: activeScenario.metrics?.coverageScore ?? null,
                    confidence: activeScenario.metrics?.confidence ?? null,
                    reason_codes: activeScenario.metrics?.reasonCodes || [],
                    decision: scenarioDecision,
                    feedback_notes: scenarioFeedback || undefined,
                };
            }

            setPublishing(true);
            try {
                const response = await publishPlan(payload, token);
                const planData = response?.plan || payload;
                setPublishedPlan(planData);
                setPublishedRecordId(response?.plan_id || "");
                setShowPublishModal(true);
                showToast("Plan published to care team.", "success");
            } catch (err) {
                console.error("❌ Publish failed:", err);
                showToast(err.message || "Failed to publish plan.", "error");
            } finally {
                setPublishing(false);
            }
        }, [
            activeTab,
            compileTasksPayload,
            crewList,
            doctorId,
        showToast,
        timeline,
        token,
        user,
        vitalsSnapshot,
    ]);

    const handleClosePublishModal = useCallback(() => {
        setShowPublishModal(false);
        setPublishedPlan(null);
        setPublishedRecordId("");
    }, []);

    const handleViewPublishedPlan = useCallback(() => {
        if (!publishedRecordId) {
            return;
        }
        navigate(`/plans/${publishedRecordId}`, { state: { plan: publishedPlan } });
        handleClosePublishModal();
    }, [navigate, publishedRecordId, publishedPlan, handleClosePublishModal]);
    const preopAssigneeOptions = useMemo(
        () => Array.from(new Set([...doctorNameSuggestions, ...nurses].filter(Boolean))),
        [doctorNameSuggestions, nurses]
    );
    const surgeryAssigneeOptions = useMemo(
        () => Array.from(new Set([...surgeryDoctorNames, ...surgeryNurseNames].filter(Boolean))),
        [surgeryDoctorNames, surgeryNurseNames]
    );
    const postopAssigneeOptions = useMemo(
        () => Array.from(new Set([...postOpDoctorNames, ...postOpNurseNames].filter(Boolean))),
        [postOpDoctorNames, postOpNurseNames]
    );
    const globalAssigneeOptions = useMemo(
        () =>
            Array.from(
                new Set([
                    ...preopAssigneeOptions,
                    ...surgeryAssigneeOptions,
                    ...postopAssigneeOptions,
                ])
            ),
        [postopAssigneeOptions, preopAssigneeOptions, surgeryAssigneeOptions]
    );
    const getAssigneeOptionsForScope = useCallback(
        (scope) => {
            if (scope === "surgery") {
                return surgeryAssigneeOptions.length
                    ? surgeryAssigneeOptions
                    : preopAssigneeOptions;
            }
            if (scope === "postop") {
                return postopAssigneeOptions.length
                    ? postopAssigneeOptions
                    : preopAssigneeOptions;
            }
            return preopAssigneeOptions;
        },
        [postopAssigneeOptions, preopAssigneeOptions, surgeryAssigneeOptions]
    );
    const currentModalScope = editingTaskContext?.scope || taskModalScope || activeTab || "preop";
    const scopedAssigneeOptions = useMemo(() => {
        const base = getAssigneeOptionsForScope(currentModalScope);
        const seed = base.length ? base : globalAssigneeOptions;
        if (editingTaskContext?.staffName && !seed.includes(editingTaskContext.staffName)) {
            return [...seed, editingTaskContext.staffName];
        }
        return seed;
    }, [currentModalScope, editingTaskContext, getAssigneeOptionsForScope, globalAssigneeOptions]);

    const openCrewModal = () => {
        setCrewDoctorDraft([...(crewDoctors || [])]);
        setCrewNurseDraft([...(crewNurses || [])]);
        const doctorFallback =
            availableDoctorOptions.find((name) => !(crewDoctors || []).includes(name)) || "";
        const nurseFallback =
            availableNurseOptions.find((name) => !(crewNurses || []).includes(name)) || "";
        setSelectedDoctorOption(doctorFallback);
        setSelectedNurseOption(nurseFallback);
        setCrewError("");
        setShowCrewModal(true);
    };

    const closeCrewModal = () => {
        setShowCrewModal(false);
        setCrewError("");
        setSelectedDoctorOption("");
        setSelectedNurseOption("");
    };

    const addDoctorDraft = () => {
        const trimmed = selectedDoctorOption.trim();
        if (!trimmed) {
            return;
        }
        setCrewDoctorDraft((prev) => {
            if (prev.includes(trimmed)) {
                return prev;
            }
            const updated = [...prev, trimmed];
            const remaining = availableDoctorOptions.find((name) => !updated.includes(name));
            setSelectedDoctorOption(remaining || "");
            setCrewError("");
            return updated;
        });
    };

    const addNurseDraft = () => {
        const trimmed = selectedNurseOption.trim();
        if (!trimmed) {
            return;
        }
        setCrewNurseDraft((prev) => {
            if (prev.includes(trimmed)) {
                return prev;
            }
            const updated = [...prev, trimmed];
            const remaining = availableNurseOptions.find((name) => !updated.includes(name));
            setSelectedNurseOption(remaining || "");
            setCrewError("");
            return updated;
        });
    };

    const removeDoctorDraft = (name) => {
        setCrewDoctorDraft((prev) => {
            const updated = prev.filter((doc) => doc !== name);
            const fallback = availableDoctorOptions.find((option) => !updated.includes(option)) || "";
            setSelectedDoctorOption(fallback);
            return updated;
        });
    };

    const removeNurseDraft = (name) => {
        setCrewNurseDraft((prev) => {
            const updated = prev.filter((nurse) => nurse !== name);
            const fallback = availableNurseOptions.find((option) => !updated.includes(option)) || "";
            setSelectedNurseOption(fallback);
            return updated;
        });
    };

    const handleCrewSave = async () => {
        const cleanedDoctors = crewDoctorDraft.map((name) => name.trim()).filter(Boolean);
        const cleanedNurses = crewNurseDraft.map((name) => name.trim()).filter(Boolean);

        if (cleanedDoctors.length === 0 && cleanedNurses.length === 0) {
            setCrewError("Please keep at least one team member on the roster.");
            return;
        }

            try {
            if (patientId && token) {
                await updateCrew(
                    {
                        patient_id: patientId,
                        doctors: cleanedDoctors,
                        nurses: cleanedNurses,
                        performed_by: performerName,
                    },
                    token
                );
            }

            setCrewDoctors(cleanedDoctors);
            setCrewNurses(cleanedNurses);

            setDoctorTasksPreOp((prev) => {
                const updated = {};
                cleanedDoctors.forEach((name) => {
                    updated[name] = prev[name] ? cloneTasks(prev[name]) : [];
                });
                return updated;
            });

            setNurseTasks((prev) => buildNurseTaskMap(cleanedNurses, prev));

            setTaskForm((prev) => {
                const combined = [...cleanedDoctors, ...cleanedNurses];
                const fallback = combined[0] || "";
                const nextStaff = combined.includes(prev.staff) ? prev.staff : fallback;
                return {
                    ...prev,
                    staff: nextStaff,
                };
            });

            closeCrewModal();
            showToast("Team roster updated.", "success");
            setCrewError("");
        } catch (err) {
            console.error("Failed to update crew roster", err);
            setCrewError(err.message || "Unable to update team roster. Please try again.");
        }
    };

    const openTaskModal = (scope) => {
        const effectiveScope = scope || activeTab || "preop";
        const scopeOptions = getAssigneeOptionsForScope(effectiveScope);
        const availableOptions = scopeOptions.length ? scopeOptions : globalAssigneeOptions;
        const defaultStaff = availableOptions[0] || "";
        const defaultOwnerType = defaultStaff
            ? determineOwnerType(defaultStaff, effectiveScope, "doctor")
            : "doctor";
        setTaskForm({
            staff: defaultStaff,
            ownerType: defaultOwnerType,
            label: "",
            status: "pending",
            time: "",
            note: "",
            priority: "Routine",
        });
        setTaskFormError("");
        setUseCustomStaff(false);
        setCustomStaffName("");
        setTaskModalScope(effectiveScope);
        setEditingTaskContext(null);
        setShowTaskModal(true);
    };

    const closeTaskModal = () => {
        setShowTaskModal(false);
        setTaskFormError("");
        setUseCustomStaff(false);
        setCustomStaffName("");
        setTaskForm({
            staff: preopAssigneeOptions[0] || globalAssigneeOptions[0] || "",
            ownerType: "doctor",
            label: "",
            status: "pending",
            time: "",
            note: "",
            priority: "Routine",
        });
        setEditingTaskContext(null);
    };

    const handleTaskFieldChange = (field, value) => {
        setTaskForm((prev) => {
            const next = { ...prev, [field]: value };
            if (field === "staff" && value && !useCustomStaff) {
                const scopeForInference = editingTaskContext?.scope || taskModalScope || activeTab || "preop";
                next.ownerType = determineOwnerType(value, scopeForInference, prev.ownerType);
            }
            return next;
        });
    };

    const openTaskEditModal = (staffName, task, type, index, scope) => {
        setTaskForm({
            staff: staffName,
            ownerType: type || "doctor",
            label: task.label || "",
            status: task.status || "pending",
            time: task.time || "",
            note: task.note || "",
            priority: task.priority || "Routine",
        });
        setUseCustomStaff(false);
        setCustomStaffName("");
        setTaskFormError("");
        setEditingTaskContext({ type, staffName, index, scope });
        setTaskModalScope(scope);
        setShowTaskModal(true);
    };

    const handleTaskSubmit = (event) => {
        event.preventDefault();
        setTaskFormError("");

        const staff = (useCustomStaff ? customStaffName : taskForm.staff).trim();
        const label = taskForm.label.trim();
        const status = taskForm.status;
        const time = taskForm.time;
        const note = taskForm.note.trim();
        const priority = taskForm.priority || "Routine";
        const normalizedOwnerType = taskForm.ownerType === "nurse" ? "nurse" : taskForm.ownerType === "doctor" ? "doctor" : "";

        if (!staff) {
            setTaskFormError("Please specify who should own this task.");
            return;
        }

        if (!label) {
            setTaskFormError("Please describe the task.");
            return;
        }

        if (!["pending", "in_progress", "completed"].includes(status)) {
            setTaskFormError("Please choose a valid status.");
            return;
        }

        if (!normalizedOwnerType) {
            setTaskFormError("Please choose a valid role for this task.");
            return;
        }

        const taskPayload = { label, status, priority };
        if (time) {
            taskPayload.time = time;
        }
        if (note) {
            taskPayload.note = note;
        }

        const baseScope = editingTaskContext?.scope || taskModalScope || activeTab || "preop";
        let ownerType = normalizedOwnerType;
        if (!getTaskState(baseScope, ownerType)) {
            ownerType = determineOwnerType(staff, baseScope, normalizedOwnerType);
        }
        if (!getTaskState(baseScope, ownerType)) {
            ownerType = editingTaskContext?.type || ownerType;
        }

        if (editingTaskContext) {
            const { type: oldType, staffName: oldStaff, index, scope: oldScope } = editingTaskContext;
            if (
                oldScope === baseScope &&
                oldType === ownerType &&
                oldStaff === staff
            ) {
                mutateTaskList(oldScope, ownerType, staff, (list) => {
                    if (index >= 0 && index < list.length) {
                        list[index] = taskPayload;
                    } else {
                        list.push(taskPayload);
                    }
                });
            } else {
                mutateTaskList(oldScope, oldType, oldStaff, (list) => {
                    if (index >= 0 && index < list.length) {
                        list.splice(index, 1);
                    }
                });
                mutateTaskList(baseScope, ownerType, staff, (list) => {
                    list.push(taskPayload);
                });
            }
        } else {
            mutateTaskList(baseScope, ownerType, staff, (list) => {
                list.push(taskPayload);
            });
        }

        const successMessage = editingTaskContext
            ? "Task updated."
            : `Task assigned to ${ownerType === "nurse" ? "Nurse" : "Doctor"} ${staff}.`;

        closeTaskModal();
        showToast(successMessage, "success");
    };

    const renderTabs = () => {
        const tabs = ["preop", "surgery", "postop"];
        return (
            <div className="flex w-full justify-center mb-8">
                <div className="flex items-center justify-center gap-10">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative flex min-w-[5.5rem] flex-col items-center rounded-2xl px-5 py-2 text-sm font-semibold transition-all duration-200 ease-out backdrop-blur-md ${
                                    isActive
                                        ? "scale-105 border border-blue-400 bg-white/70 text-blue-700 shadow-lg shadow-blue-200/80"
                                        : "border border-white/30 bg-white/30 text-slate-600 shadow-sm opacity-80 hover:opacity-100 hover:shadow-md hover:shadow-blue-100/60"
                                }`}
                            >
                                <span className="uppercase tracking-wide text-xs">
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </span>
                                <span
                                    className={`mt-1 h-[2px] w-3/4 rounded-full transition-all ${
                                        isActive ? "bg-blue-500" : "bg-transparent"
                                    }`}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };



    const renderAiPanel = () => {
        const metrics = activeScenario?.metrics || {};
        const coveragePct = Math.round((metrics.coverageScore || 0) * 100);
        const confidencePct = Math.round((metrics.confidence || 0) * 100);
        const overtimeMinutes = metrics.predictedOvertimeMinutes || 0;
        const reasonCodes = metrics.reasonCodes || [];
        const reasoning = metrics.reasoning || [];
        const cacheExpiryLabel = optimizationResult?.cacheExpiresAt
            ? new Date(optimizationResult.cacheExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : null;

        return (
            <div className="col-span-1 bg-gray-50 rounded-xl border border-gray-200 flex flex-col max-h-[calc(100vh-140px)]">
                <div className="overflow-y-auto px-4 pt-4 pb-2 space-y-4 text-sm text-gray-800">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">AI Suggestions</h3>

                    {loading && <p className="text-sm text-gray-500 mb-6">Loading...</p>}

                    {!aiPlan && !aiSuggestions && !loading && (
                        <p className="text-sm text-gray-500 mb-6">Suggestions will appear here...</p>
                    )}

                    {aiPlan && (
                        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900">AI Surgical Plan</h4>
                                    <p className="text-xs text-slate-400">Urgency: {aiPlan.urgency}</p>
                                </div>
                                {aiPlan.tests?.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {aiPlan.tests.map((test) => (
                                            <span
                                                key={test}
                                                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500"
                                            >
                                                {test}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="mt-3 text-sm text-slate-600">{aiPlan.summary}</p>
                            <div className="mt-4 space-y-3">
                                {aiPlan.steps.map((step) => (
                                    <div key={step.id} className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{step.title}</p>
                                                <p className="text-xs text-slate-400">Suggested: {step.suggestedRole}</p>
                                            </div>
                                            <select
                                                value={selectedPlanTasks[step.id] || ""}
                                                onChange={(e) => handlePlanTaskSelection(step.id, e.target.value)}
                                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                            >
                                                <option value="">Assign</option>
                                                {globalAssigneeOptions.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="text-xs text-slate-500">{step.detail}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleApplyPlanSteps}
                                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500"
                                >
                                    Add selected steps
                                </button>
                            </div>
                        </div>
                    )}

                    {optimizationResult?.scenarios?.length > 0 && (
                        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Recommendation Scenarios
                                </h4>
                                <span className="text-[10px] uppercase tracking-wider text-slate-300">
                                    {optimizationResult.scenarios.length} option{optimizationResult.scenarios.length > 1 ? "s" : ""}
                                </span>
                            </div>
                            <div className="mt-3 space-y-2">
                                {optimizationResult.scenarios.map((scenario) => {
                                    const isActive = scenario.scenarioId === activeScenarioId;
                                    return (
                                        <button
                                            key={scenario.scenarioId}
                                            type="button"
                                            onClick={() => handleScenarioSelect(scenario.scenarioId)}
                                            className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                                                isActive
                                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm"
                                                    : "border-slate-200 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold">{scenario.label}</span>
                                                <span className="text-xs text-slate-400">
                                                    {scenario.generatedAt &&
                                                        new Date(scenario.generatedAt).toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            {optimizationResult.cached && (
                                <p className="mt-3 text-xs text-slate-400">
                                    Cached recommendation{cacheExpiryLabel ? ` · refresh after ${cacheExpiryLabel}` : ""}.
                                </p>
                            )}
                        </div>
                    )}

                    {activeScenario && (
                        <div className="space-y-4">
                            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Scenario Metrics
                                    </h4>
                                    <span className="text-[10px] uppercase tracking-wider text-slate-300">
                                        {activeScenario.label}
                                    </span>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                                    <div className="rounded-2xl bg-emerald-50 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-wide text-emerald-500">Coverage</p>
                                        <p className="text-sm font-semibold text-emerald-700">{coveragePct}%</p>
                                    </div>
                                    <div className="rounded-2xl bg-blue-50 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-wide text-blue-500">Confidence</p>
                                        <p className="text-sm font-semibold text-blue-700">{confidencePct}%</p>
                                    </div>
                                    <div className="rounded-2xl bg-amber-50 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-wide text-amber-500">Pred. OT</p>
                                        <p className="text-sm font-semibold text-amber-700">{overtimeMinutes}m</p>
                                    </div>
                                </div>
                                {reasonCodes.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {reasonCodes.map((code) => (
                                            <span
                                                key={code}
                                                className="rounded-full bg-slate-100 px-3 py-1 text-[10px] uppercase tracking-wide text-slate-500"
                                            >
                                                {code.replace(/_/g, " ")}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {reasoning.length > 0 && (
                                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
                                        {reasoning.map((item, index) => (
                                            <li key={index}>{item}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Clinician Decision
                                </h4>
                                <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="scenario-decision"
                                            value="accept"
                                            checked={scenarioDecision !== "override"}
                                            onChange={() => setScenarioDecision("accept")}
                                        />
                                        Accept recommendation
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="scenario-decision"
                                            value="override"
                                            checked={scenarioDecision === "override"}
                                            onChange={() => setScenarioDecision("override")}
                                        />
                                        Override with manual plan
                                    </label>
                                </div>
                                <textarea
                                    value={scenarioFeedback}
                                    onChange={(e) => setScenarioFeedback(e.target.value)}
                                    rows={scenarioDecision === "override" ? 4 : 3}
                                    className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    placeholder={
                                        scenarioDecision === "override"
                                            ? "Describe your override or concerns..."
                                            : "Optional notes about this recommendation"
                                    }
                                />
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSubmitScenarioFeedback}
                                        disabled={submittingFeedback}
                                        className={`rounded-full px-4 py-2 text-xs font-semibold text-white shadow ${
                                            submittingFeedback
                                                ? "bg-slate-400"
                                                : "bg-emerald-600 hover:bg-emerald-500"
                                        }`}
                                    >
                                        {submittingFeedback ? "Saving..." : "Log decision"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {aiSuggestions && !aiError && (
                        <div className="space-y-4">
                            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="font-semibold text-xs uppercase tracking-wide text-slate-400">
                                    Window
                                </div>
                                <div className="mt-2 text-sm text-slate-600">
                                    <p>📅 {aiSuggestions.meta?.date}</p>
                                    <p>⏰ {aiSuggestions.meta?.start} – {aiSuggestions.meta?.end}</p>
                                </div>
                            </div>

                            {suggestionCategories.map(({ key, label }) => {
                                const list = aiSuggestions[key] || [];
                                if (!list.length) return null;
                                const selectedIds = new Set(selectedCrewForSuggestion[key] || []);
                                return (
                                    <div key={key} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                {label}
                                            </h4>
                                            <span className="text-[10px] uppercase tracking-wider text-slate-300">
                                                {list.length} option{list.length > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            {list.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={`flex items-start justify-between gap-3 rounded-2xl border px-3 py-2 transition ${
                                                        selectedIds.has(item.id)
                                                            ? "border-emerald-300 bg-emerald-50 shadow-sm"
                                                            : "border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 hover:bg-opacity-50"
                                                    }`}
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                                                        {item.email && <p className="text-xs text-slate-400">{item.email}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleResourceSelection(key, item.id)}
                                                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                                selectedIds.has(item.id)
                                                                    ? "border-emerald-400 bg-emerald-500 text-white"
                                                                    : "border-slate-200 text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
                                                            }`}
                                                        >
                                                            {selectedIds.has(item.id) ? "Added" : "Add"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleResourceEdit(key, item)}
                                                            className="text-slate-400 hover:text-emerald-500 text-xs"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleResourceRemove(key, item.id)}
                                                            className="text-red-500 hover:text-red-400"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {aiSuggestions.tests?.length > 0 && (
                                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Latest MRI Tests</p>
                                    <div className="mt-3 space-y-2 text-xs text-slate-500">
                                        {aiSuggestions.tests.map((test, index) => (
                                            <div key={index} className="flex justify-between">
                                                <span className="font-medium text-slate-700">{test.patient_id}</span>
                                                <span>{test.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {matchStatus && (
                                <div
                                    className={`rounded-3xl border px-4 py-3 text-center text-sm font-semibold shadow-sm ${
                                        matchStatus.success === null
                                            ? "border-slate-200 bg-slate-50 text-slate-500"
                                            : matchStatus.success
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-red-200 bg-red-50 text-red-600"
                                    }`}
                                >
                                    <p className="font-semibold">
                                        {matchStatus.success === null
                                            ? matchStatus.message
                                            : matchStatus.success
                                            ? "Requirements matched"
                                            : "Requirements not met"}
                                    </p>
                                    {!matchStatus.success && matchStatus.missing?.length > 0 && (
                                        <p className="mt-1 text-xs font-normal text-slate-500">
                                            Needs: {matchStatus.missing.join(", ")}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {aiError && <p className="text-sm text-red-500">{aiError}</p>}
                </div>

                <div className="flex justify-center gap-3 p-4 border-t bg-white">
                    <button
                        onClick={handleFetchAISuggestions}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow"
                    >
                        AI Suggestion
                    </button>
                    <button
                        onClick={handleApplySelectedResources}
                        disabled={!hasSelectedResources}
                        className={`text-white text-sm font-medium py-2 px-4 rounded-full shadow transition ${
                            hasSelectedResources ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
                        }`}
                    >
                        Add to Task
                    </button>
                </div>
            </div>
        );
    };

    const renderTasksColumn = () => {
        const scope = activeTab || "preop";

        const renderScopeActions = (scopeKey) => {
            const label = scopeKey === "surgery" ? "Surgery Day Tasks" : "Post-Op Tasks";
            return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <p className="text-sm text-gray-600">{label}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={openCrewModal}
                            className="border border-gray-300 text-gray-700 px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-50"
                        >
                            Edit Crew
                        </button>
                        <button
                            onClick={() => openTaskModal(scopeKey)}
                            className="px-6 py-2 rounded-full text-sm font-semibold shadow transition bg-blue-600 text-white hover:bg-blue-700"
                        >
                            + Add Task
                        </button>
                    </div>
                </div>
            );
        };

        return (
            <>
                {renderTabs()}
                {syncError && (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                        {syncError}
                    </div>
                )}
                {syncing && !syncError && (
                    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                        Syncing latest data&hellip;
                    </div>
                )}
                {scope === "preop" ? (
                    <>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                            <p className="text-sm text-gray-600">Pre-Op Tasks</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={openCrewModal}
                                    className="border border-gray-300 text-gray-700 px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-50"
                                >
                                    Edit Crew
                                </button>
                                <button
                                    onClick={openTaskModal}
                                    disabled={preopAssigneeOptions.length === 0}
                                    className={`px-6 py-2 rounded-full text-sm font-semibold shadow transition ${
                                        preopAssigneeOptions.length === 0
                                            ? "bg-blue-300 text-white cursor-not-allowed"
                                            : "bg-blue-600 text-white hover:bg-blue-700"
                                    }`}
                                >
                                    + Generate Tasks
                                </button>
                            </div>
                        </div>
                        <Task
                            category="Nurses"
                            data={nurseTasks}
                            onTaskEdit={(staffName, task, index) => openTaskEditModal(staffName, task, "nurse", index, "preop")}
                        />
                        <Task
                            category="Assistant Doctors"
                            data={doctorTasksPreOp}
                            onTaskEdit={(staffName, task, index) => openTaskEditModal(staffName, task, "doctor", index, "preop")}
                        />
                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => handlePublish("preop")}
                                disabled={publishing}
                                className={`rounded-full py-3 px-8 text-sm font-semibold text-white shadow-md transition ${
                                    publishing
                                        ? "bg-green-300 cursor-not-allowed"
                                        : "bg-green-600 hover:bg-green-700"
                                }`}
                            >
                                {publishing ? "Publishing…" : "Publish"}
                            </button>
                        </div>
                    </>
                ) : scope === "surgery" ? (
                    <>
                        {renderScopeActions("surgery")}
                        <Task
                            category="Nurses"
                            data={nurseTasksSurgery}
                            onTaskEdit={(staffName, task, index) => openTaskEditModal(staffName, task, "nurse", index, "surgery")}
                        />
                        <Task
                            category="Doctors"
                            data={doctorTasksSurgery}
                            onTaskEdit={(staffName, task, index) => openTaskEditModal(staffName, task, "doctor", index, "surgery")}
                        />
                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => handlePublish("surgery")}
                                disabled={publishing}
                                className={`rounded-full py-3 px-8 text-sm font-semibold text-white shadow-md transition ${
                                    publishing
                                        ? "bg-green-300 cursor-not-allowed"
                                        : "bg-green-600 hover:bg-green-700"
                                }`}
                            >
                                {publishing ? "Publishing…" : "Publish"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {renderScopeActions("postop")}
                        <Task
                            category="Nurses"
                            data={nurseTasksPostOp}
                            onTaskEdit={(staffName, task, index) => openTaskEditModal(staffName, task, "nurse", index, "postop")}
                        />
                        <Task
                            category="Doctors"
                            data={doctorTasksPostOp}
                            onTaskEdit={(staffName, task, index) => openTaskEditModal(staffName, task, "doctor", index, "postop")}
                        />
                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => handlePublish("postop")}
                                disabled={publishing}
                                className={`rounded-full py-3 px-8 text-sm font-semibold text-white shadow-md transition ${
                                    publishing
                                        ? "bg-green-300 cursor-not-allowed"
                                        : "bg-green-600 hover:bg-green-700"
                                }`}
                            >
                                {publishing ? "Publishing…" : "Publish"}
                            </button>
                        </div>
                    </>
                )}
            </>
        );
    };

    return (
        <> 
            {toast && (
                <div className="fixed top-6 right-6 z-50">
                    <div
                        className={`rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${
                            toast.type === "success" ? "bg-green-600" : "bg-red-600"
                        }`}
                    >
                        {toast.message}
                    </div>
                </div>
            )}
            <div className="mt-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {renderAiPanel()}
                    <div className="col-span-2">
                        {renderTasksColumn()}
                    </div>
                </div>
            </div>

            {showTaskModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
                    <form
                        onSubmit={handleTaskSubmit}
                        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4"
                    >
                        <h2 className="text-lg font-semibold text-gray-800">
                            {editingTaskContext ? "Edit Task" : "Add Task"}
                        </h2>

                        <p className="text-sm text-gray-500">
                            Capture a new action item for the surgical team. You can pick an existing doctor or assign a new one.
                        </p>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Assigned Team Member
                            </label>
                            <div className="flex flex-col gap-2">
                                <select
                                    value={useCustomStaff ? "__custom__" : taskForm.staff}
                                    onChange={(e) => {
                                        if (e.target.value === "__custom__") {
                                            setUseCustomStaff(true);
                                            handleTaskFieldChange("staff", "");
                                        } else {
                                            setUseCustomStaff(false);
                                            handleTaskFieldChange("staff", e.target.value);
                                        }
                                    }}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                    {scopedAssigneeOptions.length === 0 && (
                                        <option value="">Select team member</option>
                                    )}
                                    {scopedAssigneeOptions.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                    <option value="__custom__">Assign someone else…</option>
                                </select>

                                {useCustomStaff && (
                                    <input
                                        value={customStaffName}
                                        onChange={(e) => setCustomStaffName(e.target.value)}
                                        placeholder="Enter name (e.g. Dr. Patel)"
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    />
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Role
                            </label>
                            <select
                                value={taskForm.ownerType}
                                onChange={(e) => handleTaskFieldChange("ownerType", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                                <option value="doctor">Doctor</option>
                                <option value="nurse">Nurse</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Task Details
                            </label>
                            <input
                                value={taskForm.label}
                                onChange={(e) => handleTaskFieldChange("label", e.target.value)}
                                placeholder="e.g. Review chest CT with radiology"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select
                                    value={taskForm.status}
                                    onChange={(e) => handleTaskFieldChange("status", e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Time (optional)
                                </label>
                                <input
                                    type="time"
                                    value={taskForm.time}
                                    onChange={(e) => handleTaskFieldChange("time", e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Priority
                                </label>
                                <select
                                    value={taskForm.priority}
                                    onChange={(e) => handleTaskFieldChange("priority", e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                    {PRIORITY_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes (optional)
                            </label>
                            <textarea
                                rows={3}
                                value={taskForm.note}
                                onChange={(e) => handleTaskFieldChange("note", e.target.value)}
                                placeholder="Any extra context the team should know..."
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>

                        {taskFormError && (
                            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                                {taskFormError}
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={closeTaskModal}
                                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                            >
                                Add Task
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showPublishModal && (
                <PublishSuccessEnhanced
                    plan={publishedPlan}
                    planRecordId={publishedRecordId}
                    recipients={
                        Array.isArray(publishedPlan?.crew) && publishedPlan.crew.length
                            ? publishedPlan.crew
                            : crewList
                    }
                    doctorName={performerName}
                    onClose={handleClosePublishModal}
                    onViewPlan={handleViewPublishedPlan}
                />
            )}

            {showCrewModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
                    <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl space-y-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800">Edit Care Team</h2>
                                <p className="text-sm text-gray-500">
                                    Add or remove doctors and nurses for this case. New members start with an empty checklist.
                                </p>
                            </div>
                            <button
                                onClick={closeCrewModal}
                                className="text-gray-400 hover:text-gray-600"
                                aria-label="Close crew editor"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="rounded-xl border border-gray-200 p-4">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                    Doctors
                                </h3>
                                <ul className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
                                    {crewDoctorDraft.map((name) => (
                                        <li
                                            key={name}
                                            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                                        >
                                            <span>{name}</span>
                                            <button
                                                type="button"
                                                className="text-xs text-red-500 hover:text-red-600"
                                                onClick={() => removeDoctorDraft(name)}
                                            >
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                    {crewDoctorDraft.length === 0 && (
                                        <li className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                                            No doctors assigned yet.
                                        </li>
                                    )}
                                </ul>
                                <div className="mt-3 flex gap-2">
                                    <select
                                        value={selectedDoctorOption}
                                        onChange={(e) => setSelectedDoctorOption(e.target.value)}
                                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    >
                                        <option value="">Select available doctor</option>
                                        {availableDoctorOptions.map((name) => (
                                            <option key={name} value={name} disabled={crewDoctorDraft.includes(name)}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={addDoctorDraft}
                                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                        disabled={!selectedDoctorOption}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-xl border border-gray-200 p-4">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                    Nurses
                                </h3>
                                <ul className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
                                    {crewNurseDraft.map((name) => (
                                        <li
                                            key={name}
                                            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                                        >
                                            <span>{name}</span>
                                            <button
                                                type="button"
                                                className="text-xs text-red-500 hover:text-red-600"
                                                onClick={() => removeNurseDraft(name)}
                                            >
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                    {crewNurseDraft.length === 0 && (
                                        <li className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                                            No nurses assigned yet.
                                        </li>
                                    )}
                                </ul>
                                <div className="mt-3 flex gap-2">
                                    <select
                                        value={selectedNurseOption}
                                        onChange={(e) => setSelectedNurseOption(e.target.value)}
                                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    >
                                        <option value="">Select available nurse</option>
                                        {availableNurseOptions.map((name) => (
                                            <option key={name} value={name} disabled={crewNurseDraft.includes(name)}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={addNurseDraft}
                                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                        disabled={!selectedNurseOption}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>

                        {crewError && (
                            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                                {crewError}
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeCrewModal}
                                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCrewSave}
                                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                            >
                                Save crew
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

};

export default OpState;
