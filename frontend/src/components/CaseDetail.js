
import React from "react";
import OpState from "./OpState";

const CaseDetail = ({ onBackClick }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md text-lg">
      {/* Back Button & Heading */}
      <div className="mb-4">
        <button
          onClick={onBackClick}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold mt-2 text-gray-800">
          Jacob – Lung Surgery
        </h1>
      </div>

      {/* Patient Info + Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 items-start">
        {/* 1. Enlarged Profile Image */}
        <div className="flex justify-center lg:justify-start">
          <img
            src="https://randomuser.me/api/portraits/men/75.jpg"
            alt="Patient"
            className="w-48 h-60 rounded-xl object-cover"
          />
        </div>

        {/* 2. Patient Info */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm pl-2">
          {[
            { label: "Name", value: "Jacob Williams" },
            { label: "Age", value: "42 years" },
            { label: "Gender", value: "Male" },
            { label: "Height", value: "5'11\" (180 cm)" },
            { label: "Weight", value: "175 lbs (79 kg)" },
            { label: "Blood Type", value: "O Positive" },
          ].map((item, idx) => (
            <div key={idx}>
              <p className="text-gray-500 text-sm mb-1">{item.label}</p>
              <p className="font-medium text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>

        {/* 3. Documents & Reports */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            Documents & Reports
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Pulled via EHR API (e.g. Epic)
          </p>
          <div className="flex flex-wrap gap-4 justify-start">
            {/* Chest X-Ray */}
            <a
              href="/files/Dummy_Postoperative_Chest_Xray_Report_with_Image.pdf"
              download
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200 flex items-start gap-3 w-[220px] hover:shadow-md transition"
            >
              <div className="text-2xl text-blue-600">📄</div>
              <div>
                <p className="font-medium text-sm text-gray-800">Chest X-Ray</p>
                <p className="text-xs text-gray-500">Last week</p>
              </div>
            </a>

            {/* Blood Work */}
            <a
              href="/files/Blood_Work_Report_Dummy.pdf"
              download
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200 flex items-start gap-3 w-[220px] hover:shadow-md transition"
            >
              <div className="text-2xl text-green-600">🧪</div>
              <div>
                <p className="font-medium text-sm text-gray-800">Blood Work</p>
                <p className="text-xs text-gray-500">Yesterday</p>
              </div>
            </a>

            {/* Medical History */}
            <a
              href="/files/Medical_History_Report_jacob_williams.pdf"
              download
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200 flex items-start gap-3 w-[220px] hover:shadow-md transition"
            >
              <div className="text-2xl text-purple-600">📁</div>
              <div>
                <p className="font-medium text-sm text-gray-800">Medical History</p>
                <p className="text-xs text-gray-500">Complete file</p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Tabs & Tasks */}
      <OpState />
    </div>
  );
};

export default CaseDetail;
