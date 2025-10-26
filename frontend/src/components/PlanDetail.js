import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ClipboardList, Users, Activity } from "lucide-react";
import { fetchPlan } from "../services/api";

const PlanDetail = ({ token, doctorId }) => {
  const { planId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const initialPlan = location.state?.plan || null;
  const [plan, setPlan] = useState(initialPlan);
  const [loading, setLoading] = useState(!initialPlan);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadPlan = async () => {
      if (!planId || plan) {
        return;
      }
      setLoading(true);
      setError("");
      try {
        const data = await fetchPlan(planId, token);
        if (!cancelled) {
          setPlan(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load published plan.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPlan();
    return () => {
      cancelled = true;
    };
  }, [planId, plan, token]);

  const crew = useMemo(() => {
    if (!Array.isArray(plan?.crew)) {
      return [];
    }
    return plan.crew.map((member, index) => ({
      id: `${member.name || member.role || index}-${index}`,
      name: member.name || "Team member",
      role: member.role || "Care team",
      email: member.email || null,
    }));
  }, [plan]);

  const tasks = useMemo(() => {
    if (!Array.isArray(plan?.tasks)) {
      return [];
    }
    return plan.tasks;
  }, [plan]);

  const timeline = useMemo(() => {
    if (!Array.isArray(plan?.timeline)) {
      return [];
    }
    return plan.timeline;
  }, [plan]);

  const vitals = plan?.vitals || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-[#3069F0]">
          Plan reference: {plan?.plan_id || planId}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-white/40">
        {loading ? (
          <p className="text-sm text-slate-500">Loading plan details…</p>
        ) : error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Published surgical plan</h1>
              <p className="mt-1 text-sm text-slate-500">
                Published by {doctorId || plan?.doctor_id || "CareSync doctor"} on
                {" "}
                {plan?.timestamp ? new Date(plan.timestamp).toLocaleString() : "recently"}.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                icon={ClipboardList}
                label="Timeline entries"
                value={timeline.length}
                accent="bg-blue-100 text-blue-600"
              />
              <SummaryCard
                icon={Users}
                label="Crew"
                value={crew.length}
                accent="bg-emerald-100 text-emerald-600"
              />
              <SummaryCard
                icon={Activity}
                label="Tasks"
                value={tasks.length}
                accent="bg-amber-100 text-amber-600"
              />
            </div>

            {timeline.length > 0 && (
              <section>
                <SectionHeading title="Timeline" subtitle="Ordered surgical milestones" />
                <div className="mt-3 space-y-3">
                  {timeline.map((step, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{step.title || "Timeline step"}</p>
                        <p className="text-xs text-slate-400">
                          {step.time || "--"} · {step.owner || "Care team"}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                        {step.status || "pending"}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {crew.length > 0 && (
              <section>
                <SectionHeading title="Care team confirmations" subtitle="Team members notified" />
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {crew.map((member, index) => (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
                    >
                      <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                      <p className="text-xs text-slate-400">{member.role}</p>
                      {member.email && (
                        <p className="mt-1 text-xs text-emerald-500">{member.email}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {tasks.length > 0 && (
              <section>
                <SectionHeading title="Task bundles" subtitle="Assignments included in the plan" />
                <div className="mt-3 space-y-3">
                  {tasks.map((bundle, index) => (
                    <motion.div
                      key={`${bundle.owner_name}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-semibold text-slate-900">{bundle.owner_name}</p>
                          <p className="text-xs text-slate-400">{(bundle.owner_role || "team").toUpperCase()} · {bundle.scope}</p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                          {Array.isArray(bundle.tasks) ? bundle.tasks.length : 0} tasks
                        </span>
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {(bundle.tasks || []).map((task, taskIndex) => (
                          <li
                            key={taskIndex}
                            className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2"
                          >
                            <span className="mt-0.5 text-blue-500">•</span>
                            <div>
                              <p className="font-medium text-slate-900">{task.label}</p>
                              <p className="text-xs text-slate-400">
                                {(task.status || "pending").replace("_", " ")}
                                {task.priority ? ` · ${task.priority}` : ""}
                                {task.time ? ` · ${task.time}` : ""}
                              </p>
                              {task.note && (
                                <p className="text-xs text-slate-500">{task.note}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {Object.keys(vitals).length > 0 && (
              <section>
                <SectionHeading title="Vitals snapshot" subtitle="Latest recorded readings" />
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {Object.entries(vitals).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
                    >
                      <p className="text-xs uppercase tracking-wide text-slate-400">{key}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, accent }) => (
  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
    <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full ${accent}`}>
      <Icon className="h-5 w-5" />
    </div>
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
  </div>
);

const SectionHeading = ({ title, subtitle }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
    <p className="text-sm text-slate-500">{subtitle}</p>
  </div>
);

export default PlanDetail;

