import React from "react";

const statusColors = {
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-500",
  blue: "bg-blue-100 text-blue-800 border-blue-500",
  green: "bg-green-100 text-green-800 border-green-500",
};

const PatientCard = ({ patient, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-md hover:shadow-lg transition cursor-pointer p-6 border-l-4 ${
        statusColors[patient.statusColor]
      } transform hover:-translate-y-1`}
    >
      <h2 className="text-xl font-semibold mb-2">
        {patient.name} – {patient.case}
      </h2>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">Scheduled: {patient.date}</span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[patient.statusColor]}`}>
          {patient.status}
        </span>
      </div>
    </div>
  );
};

export default PatientCard;
