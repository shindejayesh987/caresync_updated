import React from "react";

const CaseDetail = ({ onBackClick }) => {
  return (
    <div className="p-4">
      <button
        onClick={onBackClick}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← Back to Dashboard
      </button>
      <h2 className="text-2xl font-bold">Case Details for Jacob</h2>
      <p className="mt-2 text-gray-600">More info coming soon...</p>
    </div>
  );
};

export default CaseDetail;
