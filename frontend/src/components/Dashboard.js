// import React from "react";

// const Dashboard = ({ onCaseClick }) => {
//   return (
//     <div className="p-4">
//       <h1 className="text-3xl font-bold mb-6">Welcome Dr. JD</h1>
//       <div
//         onClick={onCaseClick}
//         className="bg-white rounded-xl shadow-md hover:shadow-lg transition cursor-pointer p-6 border-l-4 border-blue-500"
//       >
//         <h2 className="text-xl font-semibold">Jacob – Lung Surgery</h2>
//         <p className="text-sm text-gray-600 mt-2">Scheduled: Today</p>
//         <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
//           Pre-Op
//         </span>
//       </div>
//     </div>
//   );
// };

// export default Dashboard;
import React from "react";

const Dashboard = ({ onCaseClick }) => {
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
    <div id="doctorDashboard">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Welcome Dr. JD</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {patients.map((patient, index) => (
          <div
            key={index}
            onClick={onCaseClick}
            className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer p-6 border-l-4 ${
              patient.statusColor === "yellow"
                ? "border-yellow-500"
                : patient.statusColor === "blue"
                ? "border-blue-500"
                : "border-green-500"
            } transform hover:-translate-y-1`}
          >
            <h2 className="text-xl font-semibold mb-3">
              {patient.name} – {patient.case}
            </h2>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Scheduled: {patient.date}
              </span>
              <span
                className={`px-2 py-1 ${
                  patient.statusColor === "yellow"
                    ? "bg-yellow-100 text-yellow-800"
                    : patient.statusColor === "blue"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-green-100 text-green-800"
                } rounded-full text-xs font-medium`}
              >
                {patient.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
