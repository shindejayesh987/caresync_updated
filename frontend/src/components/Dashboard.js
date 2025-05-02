import React from "react";

const Dashboard = ({ onCaseClick }) => {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6">Welcome Dr. JD</h1>
      <div
        onClick={onCaseClick}
        className="bg-white rounded-xl shadow-md hover:shadow-lg transition cursor-pointer p-6 border-l-4 border-blue-500"
      >
        <h2 className="text-xl font-semibold">Jacob – Lung Surgery</h2>
        <p className="text-sm text-gray-600 mt-2">Scheduled: Today</p>
        <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
          Pre-Op
        </span>
      </div>
    </div>
  );
};

export default Dashboard;
