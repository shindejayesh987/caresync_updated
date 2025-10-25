import React from "react";
import PatientCard from "./PatientCard";

const Dashboard = ({ onCaseClick, user }) => {
  const displayName =
    (user?.full_name && `Dr. ${user.full_name}`) ||
    (user?.email && `Dr. ${user.email.split("@")[0]}`) ||
    "Care Team";

  const patients = [
    {
      name: "Jacob",
      case: "Lung Surgery",
      date: "Today",
      status: "Pre-Op",
      statusColor: "yellow",
    },
    {
      name: "Emily",
      case: "Knee Replacement",
      date: "Tomorrow",
      status: "Pending",
      statusColor: "blue",
    },
    {
      name: "Carlos",
      case: "Heart Valve",
      date: "Next Week",
      status: "Scheduled",
      statusColor: "green",
    },
  ];

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-gray-800">
        Welcome {displayName}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {patients.map((patient, idx) => (
          <PatientCard key={idx} patient={patient} onClick={onCaseClick} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
