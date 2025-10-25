import React, { useEffect, useMemo, useRef, useState } from "react";
import Task from "./Task";
import { requestAvailability, publishPlan } from "../services/api";

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

const publishPayloadTemplate = {
  patient_id: "123",
  ot_id: "OT-21",
  contacts: [
    {
      name: "Dr. Smith",
      role: "surgeon",
      email: "drsmith@example.com",
    },
    {
      name: "Nurse Joy",
      role: "nurse",
      email: "nurse@example.com",
    },
  ],
};

const initialNurseNames = ["Susan", "Elizabeth"];
const initialNurseTasks = buildNurseTaskMap(initialNurseNames);
const PRIORITY_OPTIONS = ["Routine", "High", "Critical"];

const normalizeSuggestions = (data) => {
    const wrap = (list = [], prefix) =>
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

    return {
        nurses: wrap(data?.nurses_available, "nurse"),
        assistantDoctors: wrap(data?.assistant_doctors_available, "assistant"),
        radiologists: wrap(data?.radiologists_available, "radiologist"),
        equipment: wrap(data?.equipment_available, "equipment"),
        operationTheatres: wrap(data?.operation_theatres_available, "ot"),
        tests: data?.latest_test_scores || [],
        meta: {
            date: data?.date,
            start: data?.start,
            end: data?.end,
            matchStatus: data?.match_status,
        },
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

    const backendStatus = suggestions.meta?.matchStatus;
    if (backendStatus) {
        const normalized = backendStatus.toLowerCase();
        return {
            message: backendStatus,
            success: normalized.includes("matched"),
            missing: [],
        };
    }

    const requirements = defaultAvailabilityPayload;
    const missing = [];

    if ((suggestions.nurses || []).length < requirements.required_nurses) {
        missing.push("Nurses");
    }
    if ((suggestions.assistantDoctors || []).length < requirements.required_assistant_doctors) {
        missing.push("Assistant doctors");
    }
    if ((suggestions.radiologists || []).length < requirements.required_radiologists) {
        missing.push("Radiologists");
    }
    if ((suggestions.operationTheatres || []).length < requirements.required_operation_rooms) {
        missing.push("Operating rooms");
    }
    if (
        requirements.required_equipment &&
        !(suggestions.equipment || []).some(
            (item) => item.name?.toLowerCase() === requirements.required_equipment.toLowerCase()
        )
    ) {
        missing.push(`Equipment: ${requirements.required_equipment}`);
    }

    return {
        message: missing.length ? "Requirements not met" : "Requirements matched",
        success: missing.length === 0,
        missing,
    };
};

const OpState = ({ token }) => {
    const [activeTab, setActiveTab] = useState("preop");
    const [nurseTasks, setNurseTasks] = useState(initialNurseTasks);
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [aiError, setAiError] = useState("");
    const [aiPlan, setAiPlan] = useState(null);
    const [matchStatus, setMatchStatus] = useState(null);
    const [selectedCrewForSuggestion, setSelectedCrewForSuggestion] = useState({});
    const [selectedPlanTasks, setSelectedPlanTasks] = useState({});
    const [loading, setLoading] = useState(false);
    const [publishResponse, setPublishResponse] = useState(null);
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
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskForm, setTaskForm] = useState({
        staff: "",
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
    const toastTimeoutRef = useRef(null);
    const [editingTaskContext, setEditingTaskContext] = useState(null);

    useEffect(() => {
        return () => {
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
                toastTimeoutRef.current = null;
            }
        };
    }, []);

    const showToast = (message, type = "success") => {
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        setToast({ message, type });
        toastTimeoutRef.current = setTimeout(() => {
            setToast(null);
            toastTimeoutRef.current = null;
        }, 3000);
    };

    const doctorNameSuggestions = useMemo(
        () => Object.keys(doctorTasksPreOp),
        [doctorTasksPreOp]
    );
    const nurses = useMemo(() => Object.keys(nurseTasks), [nurseTasks]);
    const availableDoctorOptions = useMemo(() => {
        const aiNames = [
            ...(aiSuggestions?.assistantDoctors || []),
            ...(aiSuggestions?.radiologists || []),
        ]
            .map((entry) => entry?.name?.trim())
            .filter(Boolean);
        const merged = Array.from(new Set([...aiNames, ...doctorNameSuggestions]));
        return merged;
    }, [aiSuggestions, doctorNameSuggestions]);

    const availableNurseOptions = useMemo(() => {
        const aiNames = (aiSuggestions?.nurses || [])
            .map((entry) => entry?.name?.trim())
            .filter(Boolean);
        const merged = Array.from(new Set([...aiNames, ...nurses]));
        return merged;
    }, [aiSuggestions, nurses]);

    const hasSelectedResources = useMemo(
        () =>
            Object.values(selectedCrewForSuggestion).some(
                (ids) => Array.isArray(ids) && ids.length > 0
            ),
        [selectedCrewForSuggestion]
    );

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
            const data = await requestAvailability(defaultAvailabilityPayload, token);
            const normalized = normalizeSuggestions(data);
            setSuggestions(normalized);

            const llmRes = await fetch("/files/ai.json");
            if (llmRes.ok) {
                const llmJson = await llmRes.json();
                setAiPlan(formatPlan(llmJson));
            } else {
                setAiPlan(null);
            }

            setSelectedCrewForSuggestion({});
            setSelectedPlanTasks({});
        } catch (err) {
            console.error("AI Suggestion fetch failed:", err);
            setSuggestions(null);
            setAiPlan(null);
            setAiError(err.message || "Failed to load suggestions.");
        } finally {
            setLoading(false);
        }
    };

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

    const assignTaskToOwner = (ownerName, task, type) => {
        if (!ownerName) return;
        if (type === "nurse") {
            setNurseTasks((prev) => {
                const updated = { ...prev };
                if (!updated[ownerName]) {
                    updated[ownerName] = [];
                }
                updated[ownerName] = [...updated[ownerName], task];
                return updated;
            });
        } else {
            setDoctorTasksPreOp((prev) => {
                const updated = { ...prev };
                if (!updated[ownerName]) {
                    updated[ownerName] = [];
                }
                updated[ownerName] = [...updated[ownerName], task];
                return updated;
            });
        }
    };

    const handleApplySelectedResources = () => {
        if (!aiSuggestions) return;
        let applied = 0;

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
                assignTaskToOwner(ownerName, task, target === "nurse" ? "nurse" : "doctor");
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

    const handleApplyPlanSteps = () => {
        if (!aiPlan?.steps?.length) return;
        let applied = 0;
        aiPlan.steps.forEach((step) => {
            const assignee = selectedPlanTasks[step.id];
            if (!assignee) return;
            const task = {
                label: step.title,
                status: "pending",
                note: step.detail,
                priority: "High",
            };
            const isNurse = Object.prototype.hasOwnProperty.call(nurseTasks, assignee);
            assignTaskToOwner(assignee, task, isNurse ? "nurse" : "doctor");
            applied += 1;
        });

        if (applied > 0) {
            showToast(`Added ${applied} plan step${applied > 1 ? "s" : ""} to tasks.`, "success");
            setSelectedPlanTasks({});
        } else {
            showToast("Select and assign plan steps before adding.", "error");
        }
    };


    const handlePublish = async () => {
        try {
            const data = await publishPlan(publishPayloadTemplate, token);
            setPublishResponse(data);
            setShowPublishModal(true);
        } catch (err) {
            console.error("❌ Publish failed:", err);
            alert(err.message || "Failed to publish. Check console.");
        }
    };
    const assigneeOptions = useMemo(() => {
        const combined = [...doctorNameSuggestions, ...nurses];
        return Array.from(new Set(combined.filter(Boolean)));
    }, [doctorNameSuggestions, nurses]);

    const openCrewModal = () => {
        setCrewDoctorDraft([...doctorNameSuggestions]);
        setCrewNurseDraft([...nurses]);
        const doctorFallback = availableDoctorOptions.find((name) => !doctorNameSuggestions.includes(name)) || "";
        const nurseFallback = availableNurseOptions.find((name) => !nurses.includes(name)) || "";
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

    const handleCrewSave = () => {
        const cleanedDoctors = crewDoctorDraft.map((name) => name.trim()).filter(Boolean);
        const cleanedNurses = crewNurseDraft.map((name) => name.trim()).filter(Boolean);

        if (cleanedDoctors.length === 0 && cleanedNurses.length === 0) {
            setCrewError("Please keep at least one team member on the roster.");
            return;
        }

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
    };

    const openTaskModal = () => {
        const defaultStaff = assigneeOptions[0] || "";
        setTaskForm({
            staff: defaultStaff,
            label: "",
            status: "pending",
            time: "",
            note: "",
            priority: "Routine",
        });
        setTaskFormError("");
        setUseCustomStaff(false);
        setCustomStaffName("");
        setShowTaskModal(true);
    };

    const closeTaskModal = () => {
        setShowTaskModal(false);
        setTaskFormError("");
        setUseCustomStaff(false);
        setCustomStaffName("");
        setTaskForm({
            staff: assigneeOptions[0] || "",
            label: "",
            status: "pending",
            time: "",
            note: "",
            priority: "Routine",
        });
    };

    const handleTaskFieldChange = (field, value) => {
        setTaskForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const openTaskModalForStaff = (staffName, type) => {
        setTaskForm({
            staff: staffName,
            label: "",
            status: "pending",
            time: "",
            note: "",
            priority: "Routine",
        });
        setUseCustomStaff(false);
        setCustomStaffName("");
        setTaskFormError("");
        setShowTaskModal(true);
    };

    const openTaskEditModal = (staffName, task, type) => {
        setTaskForm({
            staff: staffName,
            label: task.label || "",
            status: task.status || "pending",
            time: task.time || "",
            note: task.note || "",
            priority: task.priority || "Routine",
        });
        setUseCustomStaff(false);
        setCustomStaffName("");
        setTaskFormError("");
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

        const newTask = {
            label,
            status,
            priority,
        };

        if (time) {
            newTask.time = time;
        }
        if (note) {
            newTask.note = note;
        }

        const isNurse = nurses.includes(staff);

        if (isNurse) {
            setNurseTasks((prev) => {
                const updated = { ...prev };
                const existing = updated[staff] ? cloneTasks(updated[staff]) : [];
                updated[staff] = [...existing, newTask];
                return updated;
            });
        } else {
            setDoctorTasksPreOp((prev) => {
                const updated = { ...prev };
                const existing = updated[staff] ? cloneTasks(updated[staff]) : [];
                updated[staff] = [...existing, newTask];
                return updated;
            });
        }

        const assignmentOwner = `${isNurse ? "Nurse" : "Doctor"} ${staff}`;
        closeTaskModal();
        showToast(`Task assigned to ${assignmentOwner}.`, "success");
    };

    const nurseTasksSurgery = {
        Susan: [
            { label: "Monitor vitals", status: "in_progress", time: "11:00", note: "HR stable" },
            { label: "Manage IV fluids", status: "completed", time: "10:45", note: "Fluids replaced" },
        ],
    };

    const doctorTasksSurgery = {
        "Dr. Wong": [
            { label: "Perform procedure", status: "pending", time: "12:00", note: "Scheduled after prep" },
        ],
    };

    const nurseTasksPostOp = {
        Elizabeth: [
            { label: "Pain assessment", status: "pending", time: "14:00", note: "To follow-up" },
            { label: "Discharge instructions", status: "in_progress", time: "15:00", note: "Started briefing" },
        ],
    };

    const renderTabs = () => (
        <div className="flex space-x-6 border-b mb-6">
            {["preop", "surgery", "postop"].map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 font-medium ${activeTab === tab
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>
    );


    const renderPreOpLayout = () => (

        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* AI Suggestions Panel */}
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
                                                    {assigneeOptions.map((option) => (
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
                                                <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                                                {selectedIds.size > 0 && (
                                                    <span className="text-xs text-emerald-600">{selectedIds.size} selected</span>
                                                )}
                                            </div>
                                            <div className="mt-3 space-y-2">
                                                {list.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                                                    >
                                                        <label className="flex flex-1 items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.has(item.id)}
                                                                onChange={() => toggleResourceSelection(key, item.id)}
                                                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                            />
                                                            <div>
                                                                <p className="font-medium text-slate-900">{item.name}</p>
                                                                {item.email && (
                                                                    <p className="text-xs text-slate-400">{item.email}</p>
                                                                )}
                                                            </div>
                                                        </label>
                                                        <div className="flex items-center gap-3 text-xs">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleResourceEdit(key, item)}
                                                                className="text-emerald-600 hover:text-emerald-500"
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
                                                : `${matchStatus.success ? "✅" : "❌"} ${matchStatus.message}`}
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

                        {aiError && (
                            <p className="text-sm text-red-500">{aiError}</p>
                        )}
                    </div>

                    {/* Buttons fixed at bottom */}
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
                            className={`text-white text-sm font-medium py-2 px-4 rounded-full shadow transition ${hasSelectedResources ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"}`}
                        >
                            Add to Task
                        </button>
                    </div>
                </div>

                {/* Tasks Panel */}
                <div className="col-span-2">
                    {renderTabs()}
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
                                disabled={assigneeOptions.length === 0}
                                className={`px-6 py-2 rounded-full text-sm font-semibold shadow transition ${assigneeOptions.length === 0
                                    ? "bg-blue-300 text-white cursor-not-allowed"
                                    : "bg-blue-600 text-white hover:bg-blue-700"}`}
                            >
                                + Generate Tasks
                            </button>
                        </div>
                    </div>
                    <Task
                        category="Nurses"
                        data={nurseTasks}
                        onStaffEdit={(staffName) => openTaskModalForStaff(staffName, "nurse")}
                        onTaskEdit={(staffName, task) => openTaskEditModal(staffName, task, "nurse")}
                    />
                    <Task
                        category="Assistant Doctors"
                        data={doctorTasksPreOp}
                        onTaskEdit={(staffName, task) => openTaskEditModal(staffName, task, "doctor")}
                    />

                    {/* ✅ Publish Button */}
                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={handlePublish}
                            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-3 px-8 rounded-full shadow-md"
                        >
                            Publish
                        </button>
                    </div>
                </div>
            </div>

            {/* Doctor Task Modal */}
            {showTaskModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
                    <form
                        onSubmit={handleTaskSubmit}
                        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4"
                    >
                        <h2 className="text-lg font-semibold text-gray-800">Generate Doctor Task</h2>

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
                                    {assigneeOptions.length === 0 && (
                                        <option value="">Select team member</option>
                                    )}
                                    {assigneeOptions.map((name) => (
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
                                Task Details
                            </label>
                            <input
                                value={taskForm.label}
                                onChange={(e) => handleTaskFieldChange("label", e.target.value)}
                                placeholder="e.g. Review chest CT with radiology"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* ✅ Publish Modal */}
            {showPublishModal && publishResponse && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white w-[90%] max-w-md rounded-xl shadow-lg p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-gray-800">✅ Published Successfully</h2>

                        <div className="text-sm text-gray-700 space-y-2">
                            <p><strong>Status:</strong> {publishResponse.status}</p>
                            <p><strong>Patient ID:</strong> {publishResponse.patient_id}</p>

                            <div>
                                <strong className="block mb-1">Confirmations:</strong>
                                <div className="space-y-2">
                                    {Array.isArray(publishResponse.confirmations) &&
                                        publishResponse.confirmations.map((msg, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700"
                                            >
                                                <span className="text-blue-500 mt-0.5">✉️</span>
                                                <span>{msg}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>


                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <strong className="text-sm">OT Booked:</strong>
                                    <span className={publishResponse.ot_booked ? "text-green-600 font-medium" : "text-red-600"}>
                                        {publishResponse.ot_booked ? "Yes" : "No"}
                                    </span>
                                </div>

                                {publishResponse.ot_id && (
                                    <div className="flex items-center gap-2">
                                        <strong className="text-sm">OT ID:</strong>
                                        <span className="text-gray-800">{publishResponse.ot_id}</span>
                                    </div>
                                )}
                            </div>

                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowPublishModal(false)}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Crew Management Modal */}
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

    //                     </div>
    //                     <div className="space-y-1">
    //                       {(list.length > 0 ? list : [{ id: "", name: "No entries", email: "" }]).map((item, i) => (
    //                         <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border text-sm text-gray-700">
    //                           <div className="flex items-center gap-2">
    //                             <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600" />
    //                             <div>
    //                               <div className="font-medium">{item.name}</div>
    //                               {item.email && (
    //                                 <div className="text-xs text-gray-500">{item.email}</div>
    //                               )}
    //                             </div>
    //                           </div>
    //                           <span className="text-gray-400 cursor-pointer hover:text-gray-600 text-xs">✏️</span>
    //                         </div>
    //                       ))}
    //                     </div>
    //                   </div>
    //                 ))}

    //                 {/* MRI Test Scores */}
    //                 <div className="bg-white rounded-lg border shadow-sm p-4">
    //                   <div className="font-semibold text-xs text-gray-500 uppercase mb-2">
    //                     Latest MRI Test Scores
    //                   </div>
    //                   <div className="space-y-1 text-gray-700 text-sm">
    //                     {aiData.latest_test_scores.length === 0 ? (
    //                       <p className="text-xs text-gray-400">No scores available.</p>
    //                     ) : (
    //                       aiData.latest_test_scores.map((s, i) => (
    //                         <div key={i} className="flex justify-between">
    //                           <span className="font-medium">{s.patient_id}</span>
    //                           <span>{s.score}</span>
    //                         </div>
    //                       ))
    //                     )}
    //                   </div>
    //                 </div>

    //                 {/* Match Status */}
    //                 <div className="text-center bg-green-50 text-green-700 font-semibold text-sm px-3 py-2 rounded-md border border-green-200 shadow-sm">
    //                   ✅ {aiData.match_status}
    //                 </div>
    //               </div>
    //             )}

    //             {aiData?.error && (
    //               <p className="text-sm text-red-500">{aiData.error}</p>
    //             )}
    //           </div>

    //           {/* Buttons fixed at bottom */}
    //           <div className="flex justify-center gap-3 p-4 border-t bg-white">
    //             <button
    //               onClick={handleFetchAISuggestions}
    //               className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow"
    //             >
    //               AI Suggestion
    //             </button>
    //             <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow">
    //               Add to Task
    //             </button>
    //           </div>
    //         </div>
    //       </div>
    //     </>
    //   );



    const renderTabContent = () => {
        if (activeTab === "preop") return renderPreOpLayout();

        return (
            <>
                {renderTabs()}
                <p className="text-sm text-gray-600 mb-4">
                    {activeTab === "surgery" ? "Surgery Day Tasks" : "Post-Op Tasks"}
                </p>
                {activeTab === "surgery" && (
                    <>
                        <Task category="Nurses" data={nurseTasksSurgery} />
                        <Task category="Doctors" data={doctorTasksSurgery} />
                    </>
                )}
                {activeTab === "postop" && (
                    <>
                        <Task category="Nurses" data={nurseTasksPostOp} />
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
            <div className="mt-10">{renderTabContent()}</div>
        </>
    );

};

export default OpState;
