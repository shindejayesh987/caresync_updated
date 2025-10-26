import { useState } from "react";

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

const priorityStyles = {
  Critical: {
    bg: "bg-red-100",
    text: "text-red-700",
  },
  High: {
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  Routine: {
    bg: "bg-slate-200",
    text: "text-slate-600",
  },
};

const Task = ({ category, data = {}, onEdit, onTaskEdit }) => {
  const [selectedTask, setSelectedTask] = useState(null);

  const handleTaskClick = (task) => {
    setSelectedTask(task);
  };

  const closeTaskDialog = () => setSelectedTask(null);

  const staffEntries = Object.entries(data || {});
  const hasVisibleTasks = staffEntries.some(
    ([, tasks]) => Array.isArray(tasks) && tasks.length > 0
  );

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

      {!hasVisibleTasks && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          No tasks assigned yet.
        </div>
      )}

      {staffEntries.map(([staff, tasks]) => {
        if (!Array.isArray(tasks) || tasks.length === 0) {
          return null;
        }
        return (
          <div key={staff} className="mb-6">
            <p className="text-sm font-semibold text-blue-700 mb-2">{staff}</p>
            <div className="flex flex-col gap-2">
              {tasks.map((task, tIdx) => {
                const style = statusStyles[task.status] || statusStyles.pending;
                const priorityTone =
                  priorityStyles[task.priority] || priorityStyles.Routine;
                return (
                  <div
                    key={`${staff}-${tIdx}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 hover:bg-gray-100 transition"
                  >
                    <button
                      type="button"
                      onClick={() => onTaskEdit?.(staff, task, tIdx)}
                      className="text-xs text-emerald-600 hover:text-emerald-500"
                    >
                      Edit
                    </button>
                    <div
                      className="flex flex-1 flex-col gap-1 cursor-pointer"
                      onClick={() => handleTaskClick(task)}
                    >
                      <p className="text-sm text-gray-800">{task.label}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        {task.time && <span>{task.time}</span>}
                        {task.note && (
                          <span className="text-gray-400">{task.note}</span>
                        )}
                        {task.priority && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityTone.bg} ${priorityTone.text}`}
                          >
                            {task.priority}
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
        );
      })}

      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-96 space-y-4">
            <h3 className="text-lg font-semibold">Task Details</h3>
            <p>
              <strong>Task:</strong> {selectedTask.label}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              {(statusStyles[selectedTask.status] || statusStyles.pending).label}
            </p>
            {selectedTask.time && (
              <p>
                <strong>Time:</strong> {selectedTask.time}
              </p>
            )}
            {selectedTask.note && (
              <p>
                <strong>Note:</strong> {selectedTask.note}
              </p>
            )}
            {selectedTask.priority && (
              <p>
                <strong>Priority:</strong> {selectedTask.priority}
              </p>
            )}
            <div className="flex justify-end pt-2">
              <button
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={closeTaskDialog}
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
