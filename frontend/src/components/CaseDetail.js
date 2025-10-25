
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  FileText,
  HeartPulse,
  Mic,
  Stethoscope,
} from "lucide-react";
import OpState from "./OpState";

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

const CLINICAL_TEAM = [
  { initials: "DM", role: "Lead Surgeon", name: "Dr. Martinez" },
  { initials: "AC", role: "Anesthesiologist", name: "Dr. Chen" },
  { initials: "RE", role: "Circulator", name: "Riley Evans" },
  { initials: "JB", role: "Scrub Tech", name: "Jordan Banks" },
];

const TIMELINE = [
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

const CaseDetail = ({ onBackClick, token }) => {
  const [vitals, setVitals] = useState(generateVitals());

  useEffect(() => {
    const interval = setInterval(() => setVitals(generateVitals()), 5000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="min-h-screen bg-[#EEF1F4] px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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
              <VitalTile label="Heart Rate" value={vitals.heartRate} />
              <VitalTile label="Blood Pressure" value={vitals.bloodPressure} />
              <VitalTile label="SpO₂" value={vitals.oxygen} />
            </div>
            <p className="mt-3 text-xs text-slate-400">Auto-refreshing every ~5 seconds</p>
          </motion.div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-white/40">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">Documents</p>
              <span className="text-xs text-slate-400">Synced from EHR</span>
            </div>
            <div className="mt-4 space-y-3">
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
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-white/40">
            <p className="text-xs uppercase tracking-wide text-slate-400">Care team</p>
            <ul className="mt-4 space-y-3 text-sm">
              {CLINICAL_TEAM.map((member) => (
                <li key={member.role} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-600">
                    {member.initials}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-400">{member.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-white/40">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-400">Timeline</p>
            <button className="text-xs font-medium text-emerald-600 hover:text-emerald-500">
              Export report
            </button>
          </div>
          <ol className="mt-4 space-y-4">
            {TIMELINE.map((step) => (
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
                  <p className="text-sm font-medium text-slate-900">{step.title}</p>
                  <p className="text-xs text-slate-400">
                    {step.time} • {step.owner}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-white/40">
          <OpState token={token} />
        </section>
      </div>
    </div>
  );
};

const VitalTile = ({ label, value }) => (
  <div className="rounded-2xl bg-slate-50 px-3 py-3 text-left">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="mt-2 text-base font-semibold text-slate-900">{value}</p>
  </div>
);

export default CaseDetail;
