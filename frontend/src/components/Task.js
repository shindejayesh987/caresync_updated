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
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    label: "Completed",
  },
  in_progress: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    label: "In progress",
  },
  pending: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    label: "Pending",
  },
};

const Task = ({ category, data, onEdit, onStaffEdit, onTaskEdit }) => {
  const [selectedTask, setSelectedTask] = useState(null);

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-semibold text-gray-800">{category}</h3>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-full px-3 py-1"
          >
            Edit Staff
          </button>
        )}
      </div>

      {Object.entries(data).map(([staff, tasks], idx) => (
        <div key={staff || idx} className="mb-6">
          <p className="text-sm font-semibold text-blue-700 mb-2">{staff}</p>
          <div className="flex flex-col gap-2">
            {tasks.map((task, tIdx) => {
              const style = statusStyles[task.status] || statusStyles.pending;
              return (
                <div
                  key={tIdx}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 hover:bg-gray-100 transition"
                >
                  <button
                    type="button"
                    onClick={() => onTaskEdit?.(staff, task)}
                    className="text-xs text-emerald-600 hover:text-emerald-500"
                  >
                    Edit
                  </button>
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="text-sm text-gray-800">{task.label}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {task.time && <span>{task.time}</span>}
                      {task.note && <span className="text-gray-400">{task.note}</span>}
                      {task.priority && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          Priority: {task.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full ${style.bg} ${style.text}`}
                  >
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
