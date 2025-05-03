// // import React from "react";

// // // Map task status to styles
// // const statusStyles = {
// //   completed: {
// //     bg: "bg-green-100",
// //     text: "text-green-800",
// //     label: "Completed",
// //     icon: "✅",
// //   },
// //   in_progress: {
// //     bg: "bg-yellow-100",
// //     text: "text-yellow-800",
// //     label: "In Progress",
// //     icon: "🕐",
// //   },
// //   pending: {
// //     bg: "bg-red-100",
// //     text: "text-red-800",
// //     label: "Pending",
// //     icon: "🔴",
// //   },
// // };

// // const Task = ({ category, data }) => {
// //   return (
// //     <div className="mb-10">
// //       <div className="flex items-center justify-between mb-4">
// //         <h3 className="text-md font-semibold text-gray-800">{category}</h3>
// //         <button className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-full px-3 py-1">
// //           Edit Staff
// //         </button>
// //       </div>

// //       {/* Each staff member */}
// //       {Object.entries(data).map(([staff, tasks], idx) => (
// //         <div key={idx} className="mb-6">
// //           <p className="text-sm font-semibold text-blue-700 mb-2">{staff}</p>
// //           <div className="flex flex-col gap-2">
// //             {tasks.map((task, tIdx) => {
// //               const style = statusStyles[task.status] || statusStyles.pending;
// //               return (
// //                 <div
// //                   key={tIdx}
// //                   className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2"
// //                 >
// //                   <span className="text-sm text-gray-800">{task.label}</span>
// //                   <span
// //                     className={`text-xs font-medium px-2 py-1 rounded-full inline-flex items-center gap-1 ${style.bg} ${style.text}`}
// //                   >
// //                     <span>{style.icon}</span>
// //                     {style.label}
// //                   </span>
// //                 </div>
// //               );
// //             })}
// //           </div>
// //         </div>
// //       ))}
// //     </div>
// //   );
// // };

// // export default Task;


// import React from "react";

// const statusStyles = {
//   completed: {
//     bg: "bg-green-100",
//     text: "text-green-800",
//     label: "Completed",
//     icon: "✅",
//   },
//   in_progress: {
//     bg: "bg-yellow-100",
//     text: "text-yellow-800",
//     label: "In Progress",
//     icon: "🕐",
//   },
//   pending: {
//     bg: "bg-red-100",
//     text: "text-red-800",
//     label: "Pending",
//     icon: "🔴",
//   },
// };

// const Task = ({ category, data, onEdit }) => {
//   return (
//     <div className="mb-10">
//       <div className="flex items-center justify-between mb-4">
//         <h3 className="text-md font-semibold text-gray-800">{category}</h3>
//         <button
//           onClick={onEdit}
//           className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-full px-3 py-1"
//         >
//           Edit Staff
//         </button>
//       </div>

//       {Object.entries(data).map(([staff, tasks], idx) => (
//         <div key={idx} className="mb-6">
//           <p className="text-sm font-semibold text-blue-700 mb-2">{staff}</p>
//           <div className="flex flex-col gap-2">
//             {tasks.map((task, tIdx) => {
//               const style = statusStyles[task.status] || statusStyles.pending;
//               return (
//                 <div
//                   key={tIdx}
//                   className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2"
//                 >
//                   <span className="text-sm text-gray-800">{task.label}</span>
//                   <span
//                     className={`text-xs font-medium px-2 py-1 rounded-full inline-flex items-center gap-1 ${style.bg} ${style.text}`}
//                   >
//                     <span>{style.icon}</span>
//                     {style.label}
//                   </span>
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// };

// export default Task;




import React, { useState } from "react";

const statusStyles = {
  completed: {
    bg: "bg-green-100",
    text: "text-green-800",
    label: "Completed",
    icon: "✅",
  },
  in_progress: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    label: "In Progress",
    icon: "🕐",
  },
  pending: {
    bg: "bg-red-100",
    text: "text-red-800",
    label: "Pending",
    icon: "🔴",
  },
};

const Task = ({ category, data, onEdit }) => {
  const [selectedTask, setSelectedTask] = useState(null);

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-semibold text-gray-800">{category}</h3>
        <button
          onClick={onEdit}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-full px-3 py-1"
        >
          Edit Staff
        </button>
      </div>

      {Object.entries(data).map(([staff, tasks], idx) => (
        <div key={idx} className="mb-6">
          <p className="text-sm font-semibold text-blue-700 mb-2">{staff}</p>
          <div className="flex flex-col gap-2">
            {tasks.map((task, tIdx) => {
              const style = statusStyles[task.status] || statusStyles.pending;
              return (
                <div
                  key={tIdx}
                  onClick={() => setSelectedTask(task)}
                  className="cursor-pointer flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-100 transition"
                >
                  <div>
                    <p className="text-sm text-gray-800">{task.label}</p>
                    {task.time && (
                      <p className="text-xs text-gray-500">{task.time}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full inline-flex items-center gap-1 ${style.bg} ${style.text}`}
                  >
                    <span>{style.icon}</span>
                    {style.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Modal for note & time */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-96 space-y-4">
            <h3 className="text-lg font-semibold">Task Details</h3>
            <p><strong>Task:</strong> {selectedTask.label}</p>
            <p><strong>Status:</strong> {statusStyles[selectedTask.status].label}</p>
            {selectedTask.time && (
              <p><strong>Time:</strong> {selectedTask.time}</p>
            )}
            {selectedTask.note && (
              <p><strong>Note:</strong> {selectedTask.note}</p>
            )}
            <div className="flex justify-end pt-2">
              <button
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setSelectedTask(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Task;
