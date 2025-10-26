import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ExternalLink } from "lucide-react";

const confettiPieces = Array.from({ length: 18 }).map((_, index) => ({
  id: index,
  delay: (index % 6) * 0.15,
  duration: 3 + (index % 4) * 0.5,
  left: `${(index * 7) % 100}%`,
  color:
    index % 3 === 0
      ? "#3069F0"
      : index % 3 === 1
      ? "#22c55e"
      : "#fbbf24",
}));

const PublishSuccessEnhanced = ({
  plan,
  recipients = [],
  onClose,
  onViewPlan,
  planRecordId,
  doctorName,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const timeout = setTimeout(() => setProgress(20), 150);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const increment = prev >= 80 ? 5 : 15;
        return Math.min(prev + increment, 100);
      });
    }, 320);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [planRecordId]);

  const formattedRecipients = useMemo(() => {
    if (!recipients?.length) {
      return [];
    }
    return recipients.map((member, index) => ({
      id: `${member.name}-${index}`,
      name: member.name || "Team Member",
      role: member.role || "Care Team",
      contact: member.email || member.phone || "Confirmation sent",
    }));
  }, [recipients]);

  const planMetaItems = useMemo(() => {
    if (!plan) {
      return [];
    }
    return [
      {
        label: "Plan ID",
        value: plan.plan_id || planRecordId || "—",
      },
      {
        label: "Doctor",
        value: doctorName || plan.doctor_id || "—",
      },
      {
        label: "Tab",
        value: (plan.tab || "preop").toUpperCase(),
      },
      {
        label: "Tasks",
        value: Array.isArray(plan.tasks) ? plan.tasks.length : 0,
      },
      {
        label: "Crew members",
        value: Array.isArray(plan.crew) ? plan.crew.length : 0,
      },
    ];
  }, [plan, planRecordId, doctorName]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="absolute inset-0 pointer-events-none">
          {confettiPieces.map((piece) => (
            <motion.span
              key={piece.id}
              initial={{ y: -120, opacity: 0 }}
              animate={{ y: 420, opacity: [0, 1, 0.2], rotate: [0, 180] }}
              transition={{
                repeat: Infinity,
                delay: piece.delay,
                duration: piece.duration,
                ease: "easeInOut",
              }}
              className="absolute h-2 w-4 rounded-full"
              style={{ left: piece.left, backgroundColor: piece.color }}
            />
          ))}
        </div>

        <div className="relative space-y-7 px-8 pb-10 pt-9">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-inner">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Surgical plan successfully published
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                We’ve dispatched confirmation updates to the entire care team.
                They’ll receive the most recent timeline, crew assignments, and vital sign summary.
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>Sending confirmations…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <motion.div
                className="h-full bg-[#3069F0]"
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut", duration: 0.4 }}
              />
            </div>
            {progress >= 100 && (
              <p className="mt-2 text-xs font-medium text-emerald-600">
                All confirmations delivered! ✅
              </p>
            )}
          </div>

          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
            {planMetaItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/70 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {formattedRecipients.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Confirmation summary
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {formattedRecipients.map((recipient) => (
                  <motion.div
                    key={recipient.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-slate-900">{recipient.name}</p>
                    <p className="text-xs text-slate-400">{recipient.role}</p>
                    <p className="mt-1 text-xs text-emerald-500">{recipient.contact}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
            >
              Close
            </button>
            <button
              onClick={onViewPlan}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#3069F0] px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-600"
            >
              View Plan
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PublishSuccessEnhanced;

