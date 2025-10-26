
import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  FileText,
  HeartPulse,
  Mic,
  Stethoscope,
} from "lucide-react";
import OpState from "./OpState";
import {
  fetchCrew,
  fetchTimeline,
  fetchLatestVitals,
  recordVitals,
} from "../services/api";

const CASE_SUMMARY = {
  patient: "Jacob Williams",
  age: 42,
  gender: "Male",
  height: "5'11\" (180 cm)",
  weight: "175 lbs (79 kg)",
  bloodType: "O Positive",
  surgeryType: "Left Upper Lobectomy",
  status: "In Progress",
  surgeon: "Dr. Martinez",
  scheduledAt: "09:30 AM",
  caseNumber: "#2176",
};

const DOCUMENTS = [
  {
    name: "Surgical Checklist",
    href: "/files/Medical_History_Report_jacob_williams.pdf",
    subtitle: "Signed today",
  },
  {
    name: "Chest CT",
    href: "/files/Dummy_Postoperative_Chest_Xray_Report_with_Image.pdf",
    subtitle: "Reviewed yesterday",
  },
  {
    name: "Lab Panel",
    href: "/files/Blood_Work_Report_Dummy.pdf",
    subtitle: "CBC within range",
  },
];

const VITAL_KEYFRAMES = `
@keyframes heartbeatShift {
  0% { background-position: 0% 50%, 0% 0%; opacity: 0.92; }
  50% { background-position: 100% 50%, 50% 50%; opacity: 1; }
  100% { background-position: 0% 50%, 100% 100%; opacity: 0.92; }
}
@keyframes pressureFlow {
  0% { background-position: 0% 0%, 0% 100%; }
  50% { background-position: 100% 50%, 50% 0%; }
  100% { background-position: 0% 0%, 100% 100%; }
}
@keyframes spoWave {
  0% { background-position: 0% 0%; }
  50% { background-position: 50% 50%; }
  100% { background-position: 100% 100%; }
}
`;

const VITAL_THEMES = {
  heartRate: {
    backgroundImage:
      "linear-gradient(135deg, rgba(244,114,182,0.22), rgba(244,114,182,0.05)), repeating-linear-gradient(120deg, rgba(244,114,182,0.2) 0px, rgba(244,114,182,0.08) 40px, rgba(244,114,182,0.02) 80px)",
    backgroundSize: "160% 160%, 220% 220%",
    animation: "heartbeatShift 6s ease-in-out infinite",
    shadow: "0 12px 28px rgba(244,114,182,0.18)",
  },
  bloodPressure: {
    backgroundImage:
      "linear-gradient(140deg, rgba(59,130,246,0.24), rgba(99,102,241,0.12)), radial-gradient(circle at 20% 20%, rgba(59,130,246,0.18), transparent 60%)",
    backgroundSize: "200% 200%, 180% 180%",
    animation: "pressureFlow 10s ease infinite",
    shadow: "0 12px 26px rgba(99,102,241,0.16)",
  },
  spo2: {
    backgroundImage:
      "linear-gradient(145deg, rgba(56,189,248,0.22), rgba(37,99,235,0.08)), repeating-linear-gradient(0deg, rgba(56,189,248,0.12) 0px, rgba(56,189,248,0.04) 30px, rgba(37,99,235,0.06) 60px)",
    backgroundSize: "180% 180%, 140% 220%",
    animation: "spoWave 12s ease-in-out infinite",
    shadow: "0 10px 24px rgba(59,130,246,0.15)",
  },
  default: {
    backgroundImage: "linear-gradient(135deg, rgba(148,163,184,0.14), rgba(148,163,184,0.05))",
    backgroundSize: "150% 150%",
    animation: "none",
    shadow: "0 6px 18px rgba(148,163,184,0.12)",
  },
};

const DEFAULT_TIMELINE = [
  { id: "prep", title: "Pre-Op Assessment", time: "08:45", owner: "Riley Evans", status: "done" },
  { id: "induction", title: "Anesthesia Induction", time: "09:10", owner: "Dr. Chen", status: "done" },
  { id: "incision", title: "Incision", time: "09:32", owner: "Dr. Martinez", status: "active" },
  { id: "closure", title: "Closure", time: "10:45", owner: "Dr. Martinez", status: "upcoming" },
  { id: "handoff", title: "PACU Handoff", time: "11:00", owner: "Dr. Chen", status: "upcoming" },
];

const generateVitals = () => ({
  heartRate: `${Math.floor(68 + Math.random() * 6)} bpm`,
  bloodPressure: `${Math.floor(110 + Math.random() * 10)}/${Math.floor(
    68 + Math.random() * 6
  )} mmHg`,
  oxygen: `${Math.floor(96 + Math.random() * 3)}%`,
});

const CaseDetail = ({ onBackClick, token, patientId, user }) => {
  const [vitals, setVitals] = useState(generateVitals());
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [careTeamOpen, setCareTeamOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [crew, setCrew] = useState({ doctors: [], nurses: [] });
  const [timeline, setTimeline] = useState(DEFAULT_TIMELINE);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");

  const currentUserName = useMemo(() => {
    if (!user) return undefined;
    return user.full_name || user.email;
  }, [user]);

  useEffect(() => {
    if (!token || !patientId) {
      return;
    }

    let isMounted = true;

    const loadCrew = async () => {
      try {
        const data = await fetchCrew(patientId, token);
        if (isMounted) {
          setCrew({
            doctors: data?.doctors ?? [],
            nurses: data?.nurses ?? [],
          });
        }
      } catch (err) {
        console.warn("Failed to load crew", err);
      }
    };

    const loadTimeline = async () => {
      setTimelineLoading(true);
      setTimelineError("");
      try {
        const data = await fetchTimeline(patientId, token);
        const steps = data?.steps?.length ? data.steps : DEFAULT_TIMELINE;
        if (isMounted) {
          setTimeline(steps);
        }
      } catch (err) {
        console.warn("Failed to load timeline", err);
        if (isMounted) {
          setTimelineError(err.message || "Unable to load timeline.");
        }
      } finally {
        if (isMounted) {
          setTimelineLoading(false);
        }
      }
    };

    const loadVitals = async () => {
      try {
        const latest = await fetchLatestVitals(patientId, token);
        if (latest && (latest.heart_rate || latest.blood_pressure || latest.spo2)) {
          if (isMounted) {
            setVitals({
              heartRate: latest.heart_rate || "--",
              bloodPressure: latest.blood_pressure || "--",
              oxygen: latest.spo2 || "--",
            });
          }
        }
      } catch (err) {
        console.warn("Failed to load vitals", err);
      }
    };

    loadCrew();
    loadTimeline();
    loadVitals();

    const interval = setInterval(async () => {
      const next = generateVitals();
      setVitals(next);
      try {
        await recordVitals(
          {
            patient_id: patientId,
            heart_rate: next.heartRate,
            blood_pressure: next.bloodPressure,
            spo2: next.oxygen,
            performed_by: currentUserName,
          },
          token
        );
      } catch (err) {
        console.warn("Failed to record vitals", err);
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, patientId, currentUserName]);

  const statusTone = useMemo(() => {
    switch (CASE_SUMMARY.status) {
      case "In Progress":
        return "bg-blue-50 text-blue-600 ring-blue-200";
      case "Pre-Op":
        return "bg-emerald-50 text-emerald-600 ring-emerald-200";
      default:
        return "bg-slate-100 text-slate-600 ring-slate-200";
    }
  }, []);

  const careTeamMembers = useMemo(() => {
    const toInitials = (name) =>
      (name || "")
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase())
        .join("")
        .slice(0, 2) || "?";

    if ((!crew.doctors || crew.doctors.length === 0) && (!crew.nurses || crew.nurses.length === 0)) {
      return [
        { initials: "DM", role: "Lead Surgeon", name: "Dr. Martinez" },
        { initials: "AC", role: "Anesthesiologist", name: "Dr. Chen" },
        { initials: "RE", role: "Circulator", name: "Riley Evans" },
        { initials: "JB", role: "Scrub Tech", name: "Jordan Banks" },
      ];
    }

    const doctorMembers = (crew.doctors || []).map((name) => ({
      initials: toInitials(name),
      role: "Doctor",
      name,
    }));
    const nurseMembers = (crew.nurses || []).map((name) => ({
      initials: toInitials(name),
      role: "Nurse",
      name,
    }));
    return [...doctorMembers, ...nurseMembers];
  }, [crew]);

  const visibleTimeline = useMemo(() => {
    if (!timeline || timeline.length === 0) {
      return [];
    }
    if (timelineOpen) {
      return timeline;
    }
    const current = timeline.filter((step) => step.status === "active");
    if (current.length > 0) {
      return current;
    }
    return timeline.slice(0, 1);
  }, [timeline, timelineOpen]);

  return (
    <div className="min-h-screen bg-[#EEF1F4] px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <style>{VITAL_KEYFRAMES}</style>
        <header className="flex items-center gap-3">
          <button
            onClick={onBackClick}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            aria-label="Back to dashboard"
          >
            <ChevronLeft className="h-6 w-6 text-slate-500" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Surgery Case</p>
            <h1 className="text-lg font-semibold text-slate-900">
              {CASE_SUMMARY.patient}
            </h1>
            <p className="text-sm text-slate-500">{CASE_SUMMARY.surgeryType}</p>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-white/40 lg:col-span-3">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${statusTone}`}
              >
                {CASE_SUMMARY.status}
              </span>
              <span className="flex items-center gap-2 text-sm text-slate-400">
                <Mic className="h-4 w-4" />
                Lead {CASE_SUMMARY.surgeon}
              </span>
              <span className="flex items-center gap-2 text-sm text-slate-400">
                <Stethoscope className="h-4 w-4" />
                OR {CASE_SUMMARY.caseNumber}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm text-slate-600 sm:grid-cols-3">
              {["age", "gender", "height", "weight", "bloodType"].map((key) => (
                <div key={key}>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {key === "bloodType" ? "Blood" : key}
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {CASE_SUMMARY[key]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-white/40 lg:col-span-2"
            key={`${vitals.heartRate}-${vitals.bloodPressure}-${vitals.oxygen}`}
            initial={{ opacity: 0.8, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
              <HeartPulse className="h-4 w-4 text-emerald-500" />
              Live vitals
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <VitalTile label="Heart Rate" value={vitals.heartRate} variant="heartRate" />
              <VitalTile label="Blood Pressure" value={vitals.bloodPressure} variant="bloodPressure" />
              <VitalTile label="SpO₂" value={vitals.oxygen} variant="spo2" />
            </div>
            <p className="mt-3 text-xs text-slate-400">Auto-refreshing every ~5 seconds</p>
          </motion.div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-white/40">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDocumentsOpen((prev) => !prev)}
                className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400"
              >
                <motion.span
                  animate={{ rotate: documentsOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex h-4 w-4 items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </motion.span>
                Documents
              </button>
              <span className="text-xs text-slate-400">Synced from EHR</span>
            </div>
            <AnimatePresence initial={false}>
              {documentsOpen && (
                <motion.div
                  key="documents-list"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-4">
                    {DOCUMENTS.map((document) => (
                      <a
                        key={document.name}
                        href={document.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 transition hover:border-emerald-200 hover:bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-500">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{document.name}</p>
                            <p className="text-xs text-slate-400">{document.subtitle}</p>
                          </div>
                        </div>
                        <span className="text-xs text-emerald-500">Open</span>
                      </a>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-white/40">
            <button
              type="button"
              onClick={() => setCareTeamOpen((prev) => !prev)}
              className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400"
            >
              <motion.span
                animate={{ rotate: careTeamOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="inline-flex h-4 w-4 items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </motion.span>
              Care team
            </button>

            <AnimatePresence initial={false}>
              {careTeamOpen && (
                <motion.ul
                  key="care-team"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden pt-4 space-y-3 text-sm"
                >
                  {careTeamMembers.map((member) => (
                    <li key={`${member.name}-${member.role}`} className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-600">
                        {member.initials}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-400">{member.role}</p>
                      </div>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-white/40">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-400">Timeline</p>
            <button
              type="button"
              onClick={() => setTimelineOpen((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-medium text-emerald-600 hover:text-emerald-500"
            >
              {timelineOpen ? "Hide" : "Show All"}
              <motion.span
                animate={{ rotate: timelineOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="inline-flex h-4 w-4 items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </motion.span>
            </button>
          </div>
          {timelineError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {timelineError}
            </div>
          )}
          {timelineLoading && !timelineError && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Loading timeline…
            </div>
          )}
          <AnimatePresence initial={false}>
            <motion.ol
              key={timelineOpen ? "timeline-expanded" : "timeline-collapsed"}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="mt-4 space-y-4 overflow-hidden"
            >
              {visibleTimeline.length === 0 ? (
                <li className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Timeline updates will appear here once the care team logs progress.
                </li>
              ) : (
                visibleTimeline.map((step) => (
                  <li key={step.id} className="flex items-start gap-3">
                    <span
                      className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${
                        step.status === "done"
                          ? "bg-emerald-500"
                          : step.status === "active"
                          ? "bg-blue-500"
                          : "bg-slate-300"
                      }`}
                    >
                      {step.status === "done" ? "✓" : step.status === "active" ? "•" : ""}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                      <p className="text-xs text-slate-400">
                        {step.time} • {step.owner}
                      </p>
                    </div>
                  </li>
                ))
              )}
            </motion.ol>
          </AnimatePresence>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-white/40">
          <OpState
            token={token}
            patientId={patientId}
            user={user}
            timeline={timeline}
            crewRoster={crew}
            vitalsSnapshot={vitals}
            doctorId={user?.id || user?._id}
          />
        </section>
      </div>
    </div>
  );
};

const VitalTile = ({ label, value, variant = "default" }) => {
  const theme = VITAL_THEMES[variant] || VITAL_THEMES.default;

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-3 py-3 text-left shadow-sm ring-1 ring-white/40 transition duration-300 hover:brightness-110"
      style={{
        backgroundImage: theme.backgroundImage,
        backgroundSize: theme.backgroundSize,
        animation: theme.animation,
        boxShadow: theme.shadow,
      }}
    >
      {variant === "heartRate" && (
        <div className="absolute inset-0 opacity-40">
          <svg
            className="h-full w-full"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="hrGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(244,114,182,0)" />
                <stop offset="50%" stopColor="rgba(244,114,182,0.7)" />
                <stop offset="100%" stopColor="rgba(244,114,182,0)" />
              </linearGradient>
            </defs>
            <path
              d="M0 120 L50 120 L60 80 L70 120 L110 120 L130 160 L150 40 L170 160 L190 120 L240 120 L260 140 L280 60 L300 140 L320 120 L360 120 L370 90 L380 120 L400 120"
              fill="none"
              stroke="url(#hrGradient)"
              strokeWidth="6"
              strokeLinecap="round"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-400"
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.2;0.6;0.2"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        </div>
      )}

      {variant === "bloodPressure" && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent" />
          <motion.div
            className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20"
            initial={{ scale: 0.9, opacity: 0.3 }}
            animate={{ scale: [0.9, 1.05, 0.9], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      {variant === "spo2" && (
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 translate-x-[-50%]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(191,219,254,0.18), transparent 55%)",
              backgroundSize: "120% 120%",
              animation: "spoWave 12s ease-in-out infinite",
            }}
          />
          <div className="absolute inset-0 flex justify-center opacity-20">
            <div className="relative h-full w-[140%] overflow-hidden">
              <motion.div
                className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-r from-white/40 via-white/10 to-white/40"
                animate={{ x: ["-40%", "40%", "-40%"], opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
        <p className="mt-2 text-base font-semibold text-slate-900">{value}</p>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-white/10 mix-blend-soft-light" />
    </div>
  );
};

export default CaseDetail;
