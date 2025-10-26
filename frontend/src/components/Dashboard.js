import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PatientCard from "./PatientCard";
import { fetchSurgeries, updateSurgery } from "../services/api";

const DEFAULT_STATUS_OPTIONS = [
  "Pre-Op",
  "In Progress",
  "Completed",
  "Scheduled",
  "Pending",
  "Cancelled",
];

const determineStatusColor = (status) => {
  const value = (status || "").toLowerCase();
  if (value.includes("complete") || value.includes("post")) {
    return "green";
  }
  if (value.includes("progress")) {
    return "blue";
  }
  if (value.includes("pre") || value.includes("prep")) {
    return "yellow";
  }
  if (value.includes("pending")) {
    return "blue";
  }
  if (value.includes("sched")) {
    return "green";
  }
  if (value.includes("cancel")) {
    return "blue";
  }
  return "blue";
};

const Dashboard = ({ onCaseClick, user, token }) => {
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const doctorId = user?.id || user?.doctor_id || user?._id || null;
  const performerName = useMemo(
    () => user?.full_name || user?.email || "CareSync Clinician",
    [user]
  );

  const displayName = useMemo(() => {
    if (user?.full_name) {
      return `Dr. ${user.full_name}`;
    }
    if (user?.email) {
      return `Dr. ${user.email.split("@")[0]}`;
    }
    return "Care Team";
  }, [user]);

  const statusOptions = useMemo(() => {
    const extras = surgeries
      .map((item) => item?.status)
      .filter(
        (status) =>
          status &&
          !DEFAULT_STATUS_OPTIONS.some(
            (defaultStatus) =>
              defaultStatus.toLowerCase() === status.toLowerCase()
          )
      );
    const merged = [...DEFAULT_STATUS_OPTIONS, ...new Set(extras)];
    return merged;
  }, [surgeries]);

  const transformSurgery = useCallback((doc) => {
    if (!doc) {
      return null;
    }
    const status = doc.status || "Scheduled";
    return {
      id: doc._id || doc.id,
      name: doc.patient_name || "Unnamed Patient",
      case: doc.procedure || "Procedure TBD",
      date: doc.date || "TBD",
      status,
      statusColor: determineStatusColor(status),
      raw: doc,
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
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, []);

  const loadSurgeries = useCallback(async () => {
    if (!doctorId || !token) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchSurgeries(doctorId, token);
      setSurgeries(data?.surgeries || []);
    } catch (err) {
      console.error("Failed to fetch surgeries", err);
      setError(err.message || "Unable to load surgeries.");
      setSurgeries([]);
    } finally {
      setLoading(false);
    }
  }, [doctorId, token]);

  useEffect(() => {
    if (!doctorId || !token) {
      return;
    }
    loadSurgeries();
  }, [doctorId, token, loadSurgeries]);

  const handleStatusChange = useCallback(
    async (surgeryId, nextStatus) => {
      if (!surgeryId || !nextStatus || !token) {
        return;
      }
      setUpdatingId(surgeryId);

      const previousSnapshot = surgeries.map((doc) => ({ ...doc }));
      const nextColor = determineStatusColor(nextStatus);
      setSurgeries((prev) =>
        prev.map((item) => {
          if ((item._id || item.id) !== surgeryId) {
            return item;
          }
          return {
            ...item,
            status: nextStatus,
            statusColor: nextColor,
            updated_at: new Date().toISOString(),
          };
        })
      );

      try {
        const updated = await updateSurgery(
          surgeryId,
          { status: nextStatus, performed_by: performerName },
          token
        );
        setSurgeries((prev) =>
          prev.map((item) =>
            (item._id || item.id) === surgeryId ? updated : item
          )
        );
        showToast("Status updated successfully.", "success");
        setError("");
      } catch (err) {
        console.error("Failed to update surgery status", err);
        const detail = err.message || "Unable to update surgery.";
        showToast(detail, "error");
        setSurgeries(previousSnapshot);
      } finally {
        setUpdatingId(null);
      }
    },
    [performerName, showToast, token, surgeries]
  );

  const patientCards = useMemo(() => {
    return surgeries
      .map(transformSurgery)
      .filter(Boolean)
      .map((surgery) => ({
        ...surgery,
        isUpdating: updatingId === surgery.id,
      }));
  }, [surgeries, transformSurgery, updatingId]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-blue-100 bg-white px-6 py-5 text-blue-600 shadow-sm">
          Fetching surgeries…
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-red-100 bg-white px-6 py-5 text-sm text-red-600 shadow-sm">
          <p className="font-medium">Unable to load surgeries.</p>
          <p className="mt-1 text-xs text-red-400">{error}</p>
          <button
            onClick={loadSurgeries}
            className="mt-3 inline-flex items-center rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500"
          >
            Retry
          </button>
        </div>
      );
    }

    if (patientCards.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-5 text-sm text-slate-500 shadow-sm">
          No surgeries scheduled yet. Once cases are assigned to you, they will
          appear here.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {patientCards.map((patient) => (
          <PatientCard
            key={patient.id}
            patient={patient}
            onClick={onCaseClick}
            onStatusChange={(nextStatus) =>
              handleStatusChange(patient.id, nextStatus)
            }
            statusOptions={statusOptions}
            isUpdating={patient.isUpdating}
          />
        ))}
      </div>
    );
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-6 right-6 z-40">
          <div
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg ${
              toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      <h1 className="mb-8 text-3xl font-bold text-gray-800">
        Welcome {displayName}
      </h1>
      {renderContent()}
    </div>
  );
};

export default Dashboard;
