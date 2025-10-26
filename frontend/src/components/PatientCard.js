import React from "react";

const statusColors = {
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-500",
  blue: "bg-blue-100 text-blue-800 border-blue-500",
  green: "bg-green-100 text-green-800 border-green-500",
  default: "bg-slate-100 text-slate-700 border-slate-400",
};

const PatientCard = ({
  patient,
  onClick,
  onStatusChange,
  statusOptions = [],
  isUpdating = false,
}) => {
  const tone = statusColors[patient.statusColor] || statusColors.default;

  const handleStatusChange = (event) => {
    event.stopPropagation();
    onStatusChange?.(event.target.value);
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-md hover:shadow-lg transition cursor-pointer p-6 border-l-4 ${
        tone
      } transform hover:-translate-y-1`}
    >
      <h2 className="text-xl font-semibold mb-2">
        {patient.name} – {patient.case}
      </h2>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span className="text-sm text-gray-600">Scheduled: {patient.date}</span>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${tone}`}>
            {patient.status}
          </span>
          {onStatusChange && statusOptions.length > 0 && (
            <select
              value={patient.status}
              onChange={handleStatusChange}
              disabled={isUpdating}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {isUpdating && (
        <p className="mt-3 text-xs text-gray-400">Saving latest changes…</p>
      )}
    </div>
  );
};

export default PatientCard;
