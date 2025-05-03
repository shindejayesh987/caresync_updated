// import React, { useState } from "react";
// import Task from "./Task";

// const OpState = () => {
//   const [activeTab, setActiveTab] = useState("preop");

//   const renderTabContent = () => {
//     switch (activeTab) {
//       case "preop":
//         return (
//           <>
//             <p className="text-sm text-gray-600 mb-4">Pre-Op Tasks</p>
//             <div className="text-center mt-4">
//               <button className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow hover:bg-blue-700">
//                 + Generate Tasks
//               </button>
//             </div>
//             <Task category="Nurses" data={nurseTasksPreOp} />
//             <Task category="Assistant Doctors" data={doctorTasksPreOp} />
//           </>
//         );
//       case "surgery":
//         return (
//           <>
//             <p className="text-sm text-gray-600 mb-4">Surgery Day Tasks</p>
//             <Task category="Nurses" data={nurseTasksSurgery} />
//             <Task category="Doctors" data={doctorTasksSurgery} />
//           </>
//         );
//       case "postop":
//         return (
//           <>
//             <p className="text-sm text-gray-600 mb-4">Post-Op Tasks</p>
//             <Task category="Nurses" data={nurseTasksPostOp} />
//           </>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="mt-10">
//       {/* Tabs */}
//       <div className="flex space-x-6 border-b mb-6">
//         {[
//           { key: "preop", label: "Pre-Op" },
//           { key: "surgery", label: "Surgery Day" },
//           { key: "postop", label: "Post-Op" },
//         ].map((tab) => (
//           <button
//             key={tab.key}
//             onClick={() => setActiveTab(tab.key)}
//             className={`pb-2 font-medium ${
//               activeTab === tab.key
//                 ? "text-blue-600 border-b-2 border-blue-600"
//                 : "text-gray-500 hover:text-gray-700"
//             }`}
//           >
//             {tab.label}
//           </button>
//         ))}
//       </div>

//       {/* Tab content */}
//       {renderTabContent()}
//     </div>
//   );
// };

// export default OpState;

// // Sample mock task data
// const nurseTasksPreOp = {
//   Susan: [
//     { label: "Check BP every 4 hours", status: "completed" },
//     { label: "Administer medication", status: "in_progress" },
//   ],
//   Elizabeth: [
//     { label: "Pre-op patient preparation", status: "pending" },
//     { label: "Patient education", status: "completed" },
//   ],
// };

// const doctorTasksPreOp = {
//   "Dr. Martinez": [
//     { label: "Review lab results", status: "completed" },
//     { label: "Obtain informed consent", status: "in_progress" },
//   ],
//   "Dr. Wong": [{ label: "Coordinate with anesthesia team", status: "pending" }],
// };

// const nurseTasksSurgery = {
//   Susan: [
//     { label: "Monitor vitals", status: "in_progress" },
//     { label: "Manage IV fluids", status: "completed" },
//   ],
// };

// const doctorTasksSurgery = {
//   "Dr. Wong": [{ label: "Perform procedure", status: "pending" }],
// };

// const nurseTasksPostOp = {
//   Elizabeth: [
//     { label: "Pain assessment", status: "pending" },
//     { label: "Discharge instructions", status: "in_progress" },
//   ],
// };
// import React, { useState } from "react";
// import Task from "./Task";

// const OpState = () => {
//     const [activeTab, setActiveTab] = useState("preop");

//     const renderTabs = () => (
//         <div className="flex space-x-6 border-b mb-6">
//             {[
//                 { key: "preop", label: "Pre-Op" },
//                 { key: "surgery", label: "Surgery Day" },
//                 { key: "postop", label: "Post-Op" },
//             ].map((tab) => (
//                 <button
//                     key={tab.key}
//                     onClick={() => setActiveTab(tab.key)}
//                     className={`pb-2 font-medium ${activeTab === tab.key
//                         ? "text-blue-600 border-b-2 border-blue-600"
//                         : "text-gray-500 hover:text-gray-700"
//                         }`}
//                 >
//                     {tab.label}
//                 </button>
//             ))}
//         </div>
//     );

//     const renderPreOpLayout = () => (
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//             {/* AI Suggestions Left Panel */}
//             <div className="col-span-1 bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
//                 <div>
//                     <h3 className="text-md font-semibold text-gray-800 mb-3">AI Suggestions</h3>
//                     <p className="text-sm text-gray-500 mb-6">
//                         Suggestions will appear here...
//                     </p>
//                 </div>

//                 {/* Button Row */}
//                 <div className="flex gap-3 mt-auto">
//                     <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow">
//                         AI Suggestion
//                     </button>
//                     <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow">
//                         Add to Task
//                     </button>
//                 </div>
//             </div>



//             {/* Tabs + Tasks Right Panel */}
//             <div className="col-span-2">
//                 {renderTabs()}
//                 <p className="text-sm text-gray-600 mb-4">Pre-Op Tasks</p>
//                 <div className="text-right mb-4">
//                     <button className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow hover:bg-blue-700">
//                         + Generate Tasks
//                     </button>
//                 </div>
//                 <Task category="Nurses" data={nurseTasksPreOp} />
//                 <Task category="Assistant Doctors" data={doctorTasksPreOp} />
//             </div>
//         </div>
//     );

//     const renderTabContent = () => {
//         if (activeTab === "preop") return renderPreOpLayout();

//         return (
//             <>
//                 {renderTabs()}
//                 <p className="text-sm text-gray-600 mb-4">
//                     {activeTab === "surgery" ? "Surgery Day Tasks" : "Post-Op Tasks"}
//                 </p>
//                 {activeTab === "surgery" && (
//                     <>
//                         <Task category="Nurses" data={nurseTasksSurgery} />
//                         <Task category="Doctors" data={doctorTasksSurgery} />
//                     </>
//                 )}
//                 {activeTab === "postop" && (
//                     <>
//                         <Task category="Nurses" data={nurseTasksPostOp} />
//                     </>
//                 )}
//             </>
//         );
//     };

//     return <div className="mt-10">{renderTabContent()}</div>;
// };

// export default OpState;

// // Mock data for tasks
// const nurseTasksPreOp = {
//     Susan: [
//         { label: "Check BP every 4 hours", status: "completed" },
//         { label: "Administer medication", status: "in_progress" },
//     ],
//     Elizabeth: [
//         { label: "Pre-op patient preparation", status: "pending" },
//         { label: "Patient education", status: "completed" },
//     ],
// };

// const doctorTasksPreOp = {
//     "Dr. Martinez": [
//         { label: "Review lab results", status: "completed" },
//         { label: "Obtain informed consent", status: "in_progress" },
//     ],
//     "Dr. Wong": [{ label: "Coordinate with anesthesia team", status: "pending" }],
// };

// const nurseTasksSurgery = {
//     Susan: [
//         { label: "Monitor vitals", status: "in_progress" },
//         { label: "Manage IV fluids", status: "completed" },
//     ],
// };

// const doctorTasksSurgery = {
//     "Dr. Wong": [{ label: "Perform procedure", status: "pending" }],
// };

// const nurseTasksPostOp = {
//     Elizabeth: [
//         { label: "Pain assessment", status: "pending" },
//         { label: "Discharge instructions", status: "in_progress" },
//     ],
// };

//-------------------
// import React, { useState } from "react";
// import Task from "./Task";

// const OpState = () => {
//   const [activeTab, setActiveTab] = useState("preop");
//   const [nurses, setNurses] = useState(["Susan", "Elizabeth"]);
//   const [showModal, setShowModal] = useState(false);
//   const [selectedNurses, setSelectedNurses] = useState([...nurses]);

//   const handleSave = () => {
//     setNurses(selectedNurses);
//     setShowModal(false);
//   };

//   const handleNurseChange = (index, newName) => {
//     const updated = [...selectedNurses];
//     updated[index] = newName;
//     setSelectedNurses(updated);
//   };

//   const nurseTasksPreOp = Object.fromEntries(
//     selectedNurses.map((name, i) => [
//       name,
//       i === 0
//         ? [
//             { label: "Check BP every 4 hours", status: "completed" },
//             { label: "Administer medication", status: "in_progress" },
//           ]
//         : [
//             { label: "Pre-op patient preparation", status: "pending" },
//             { label: "Patient education", status: "completed" },
//           ],
//     ])
//   );

//   const renderTabs = () => (
//     <div className="flex space-x-6 border-b mb-6">
//       {["preop", "surgery", "postop"].map((tab) => (
//         <button
//           key={tab}
//           onClick={() => setActiveTab(tab)}
//           className={`pb-2 font-medium ${
//             activeTab === tab
//               ? "text-blue-600 border-b-2 border-blue-600"
//               : "text-gray-500 hover:text-gray-700"
//           }`}
//         >
//           {tab.charAt(0).toUpperCase() + tab.slice(1).replace("-", " ")}
//         </button>
//       ))}
//     </div>
//   );

//   const renderPreOpLayout = () => (
//     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//       {/* Left Panel */}
//       <div className="col-span-1 bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
//         <div>
//           <h3 className="text-md font-semibold text-gray-800 mb-3">
//             AI Suggestions
//           </h3>
//           <p className="text-sm text-gray-500 mb-6">
//             Suggestions will appear here...
//           </p>
//         </div>
//         <div className="flex gap-3 mt-auto">
//           <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow">
//             AI Suggestion
//           </button>
//           <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow">
//             Add to Task
//           </button>
//         </div>
//       </div>

//       {/* Right Panel */}
//       <div className="col-span-2">
//         {renderTabs()}
//         <p className="text-sm text-gray-600 mb-4">Pre-Op Tasks</p>
//         <div className="text-right mb-4">
//           <button className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow hover:bg-blue-700">
//             + Generate Tasks
//           </button>
//         </div>
//         <Task
//           category="Nurses"
//           data={nurseTasksPreOp}
//           onEdit={() => setShowModal(true)}
//         />
//       </div>

//       {/* Edit Staff Modal */}
//       {showModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
//           <div className="bg-white p-6 rounded-xl shadow-lg w-96 space-y-4">
//             <h3 className="text-lg font-semibold">Edit Nurses</h3>
//             {selectedNurses.map((name, i) => (
//               <select
//                 key={i}
//                 value={name}
//                 onChange={(e) => handleNurseChange(i, e.target.value)}
//                 className="w-full border border-gray-300 rounded px-3 py-2"
//               >
//                 {["Susan", "Elizabeth", "Jacob", "Sophia"].map((option) => (
//                   <option key={option} value={option}>
//                     {option}
//                   </option>
//                 ))}
//               </select>
//             ))}
//             <div className="flex justify-end gap-2 pt-2">
//               <button
//                 className="px-4 py-2 text-sm border border-gray-300 rounded"
//                 onClick={() => setShowModal(false)}
//               >
//                 Cancel
//               </button>
//               <button
//                 className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
//                 onClick={handleSave}
//               >
//                 Save
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );

//   const renderTabContent = () => {
//     if (activeTab === "preop") return renderPreOpLayout();
//     return (
//       <>
//         {renderTabs()}
//         <p className="text-sm text-gray-600 mb-4">
//           {activeTab === "surgery"
//             ? "Surgery Day Tasks"
//             : "Post-Op Tasks"}
//         </p>
//       </>
//     );
//   };

//   return <div className="mt-10">{renderTabContent()}</div>;
// };

// export default OpState;




import React, { useState } from "react";
import Task from "./Task";

const OpState = () => {
  const [activeTab, setActiveTab] = useState("preop");
  const [nurses, setNurses] = useState(["Susan", "Elizabeth"]);
  const [showModal, setShowModal] = useState(false);
  const [selectedNurses, setSelectedNurses] = useState([...nurses]);

  const handleSave = () => {
    setNurses(selectedNurses);
    setShowModal(false);
  };

  const handleNurseChange = (index, newName) => {
    const updated = [...selectedNurses];
    updated[index] = newName;
    setSelectedNurses(updated);
  };

  const nurseTasksPreOp = Object.fromEntries(
    selectedNurses.map((name, i) => [
      name,
      i === 0
        ? [
            { label: "Check BP every 4 hours", status: "completed" },
            { label: "Administer medication", status: "in_progress" },
          ]
        : [
            { label: "Pre-op patient preparation", status: "pending" },
            { label: "Patient education", status: "completed" },
          ],
    ])
  );

  const doctorTasksPreOp = {
    "Dr. Martinez": [
      { label: "Review lab results", status: "completed" },
      { label: "Obtain informed consent", status: "in_progress" },
    ],
    "Dr. Wong": [
      { label: "Coordinate with anesthesia team", status: "pending" },
    ],
  };

  const nurseTasksSurgery = {
    Susan: [
      { label: "Monitor vitals", status: "in_progress" },
      { label: "Manage IV fluids", status: "completed" },
    ],
  };

  const doctorTasksSurgery = {
    "Dr. Wong": [
      { label: "Perform procedure", status: "pending" },
    ],
  };

  const nurseTasksPostOp = {
    Elizabeth: [
      { label: "Pain assessment", status: "pending" },
      { label: "Discharge instructions", status: "in_progress" },
    ],
  };

  const renderTabs = () => (
    <div className="flex space-x-6 border-b mb-6">
      {["preop", "surgery", "postop"].map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`pb-2 font-medium ${
            activeTab === tab
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1).replace("-", " ")}
        </button>
      ))}
    </div>
  );

  const renderPreOpLayout = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel */}
      <div className="col-span-1 bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
        <div>
          <h3 className="text-md font-semibold text-gray-800 mb-3">
            AI Suggestions
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Suggestions will appear here...
          </p>
        </div>
        <div className="flex gap-3 mt-auto">
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow">
            AI Suggestion
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow">
            Add to Task
          </button>
        </div>
      </div>

      {/* Right Panel */}
      <div className="col-span-2">
        {renderTabs()}
        <p className="text-sm text-gray-600 mb-4">Pre-Op Tasks</p>
        <div className="text-right mb-4">
          <button className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow hover:bg-blue-700">
            + Generate Tasks
          </button>
        </div>
        <Task
          category="Nurses"
          data={nurseTasksPreOp}
          onEdit={() => setShowModal(true)}
        />
        <Task category="Assistant Doctors" data={doctorTasksPreOp} />
      </div>

      {/* Edit Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-96 space-y-4">
            <h3 className="text-lg font-semibold">Edit Nurses</h3>
            {selectedNurses.map((name, i) => (
              <select
                key={i}
                value={name}
                onChange={(e) => handleNurseChange(i, e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                {["Susan", "Elizabeth", "Jacob", "Sophia"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-4 py-2 text-sm border border-gray-300 rounded"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    if (activeTab === "preop") return renderPreOpLayout();

    return (
      <>
        {renderTabs()}
        <p className="text-sm text-gray-600 mb-4">
          {activeTab === "surgery"
            ? "Surgery Day Tasks"
            : "Post-Op Tasks"}
        </p>
        {activeTab === "surgery" && (
          <>
            <Task category="Nurses" data={nurseTasksSurgery} />
            <Task category="Doctors" data={doctorTasksSurgery} />
          </>
        )}
        {activeTab === "postop" && (
          <>
            <Task category="Nurses" data={nurseTasksPostOp} />
          </>
        )}
      </>
    );
  };

  return <div className="mt-10">{renderTabContent()}</div>;
};

export default OpState;

