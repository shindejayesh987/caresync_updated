// import React, { useState } from "react";

// const StaffEditableCard = ({ title, staffList, onUpdate }) => {
//   const [editingIndex, setEditingIndex] = useState(null);
//   const [editedList, setEditedList] = useState([...staffList]);

//   const handleFieldChange = (index, field, value) => {
//     const updated = [...editedList];
//     updated[index][field] = value;
//     setEditedList(updated);
//   };

//   const handleSave = () => {
//     setEditingIndex(null);
//     onUpdate(editedList);
//   };

//   return (
//     <div className="bg-white rounded-lg border shadow-sm p-4">
//       <div className="font-semibold text-xs text-gray-500 uppercase mb-2">{title}</div>
//       <div className="flex flex-col gap-2">
//         {editedList.map((staff, index) => (
//           <div
//             key={index}
//             className="flex items-center gap-2 border border-gray-100 rounded-md px-3 py-2 bg-gray-50"
//           >
//             <input type="checkbox" className="mr-2" />
//             {editingIndex === index ? (
//               <div className="flex-1 space-y-1">
//                 <input
//                   type="text"
//                   value={staff.name}
//                   onChange={(e) => handleFieldChange(index, "name", e.target.value)}
//                   className="w-full border px-2 py-1 rounded text-sm"
//                 />
//                 {staff.email !== undefined && (
//                   <input
//                     type="email"
//                     value={staff.email}
//                     onChange={(e) => handleFieldChange(index, "email", e.target.value)}
//                     className="w-full border px-2 py-1 rounded text-xs text-gray-600"
//                   />
//                 )}
//               </div>
//             ) : (
//               <div className="flex-1">
//                 <p className="font-medium text-sm">{staff.name}</p>
//                 {staff.email && <p className="text-xs text-gray-500">{staff.email}</p>}
//               </div>
//             )}

//             <div className="flex-shrink-0 space-x-1">
//               {editingIndex === index ? (
//                 <button
//                   onClick={handleSave}
//                   className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
//                 >
//                   Save
//                 </button>
//               ) : (
//                 <button
//                   onClick={() => setEditingIndex(index)}
//                   className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
//                 >
//                   Edit
//                 </button>
//               )}
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// };

// export default StaffEditableCard;





import React, { useState } from "react";

const StaffEditableCard = ({ title, staffList, onUpdate }) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedList, setEditedList] = useState([...staffList]);

  const handleFieldChange = (index, field, value) => {
    const updated = [...editedList];
    updated[index][field] = value;
    setEditedList(updated);
  };

  const handleSave = () => {
    setEditingIndex(null);
    onUpdate(editedList);
  };

  const handleRemove = (index) => {
    const updated = editedList.filter((_, i) => i !== index);
    setEditedList(updated);
    onUpdate(updated);
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="font-semibold text-xs text-gray-500 uppercase mb-2">{title}</div>
      <div className="flex flex-col gap-2">
        {editedList.map((staff, index) => (
          <div
            key={index}
            className="flex items-center gap-2 border border-gray-100 rounded-md px-3 py-2 bg-gray-50"
          >
            <input type="checkbox" className="mr-2" />
            {editingIndex === index ? (
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={staff.name}
                  onChange={(e) => handleFieldChange(index, "name", e.target.value)}
                  className="w-full border px-2 py-1 rounded text-sm"
                />
                {staff.email !== undefined && (
                  <input
                    type="email"
                    value={staff.email}
                    onChange={(e) => handleFieldChange(index, "email", e.target.value)}
                    className="w-full border px-2 py-1 rounded text-xs text-gray-600"
                  />
                )}
              </div>
            ) : (
              <div className="flex-1">
                <p className="font-medium text-sm">{staff.name}</p>
                {staff.email && <p className="text-xs text-gray-500">{staff.email}</p>}
              </div>
            )}

            <div className="flex-shrink-0 space-x-1">
              {editingIndex === index ? (
                <button
                  onClick={handleSave}
                  className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                >
                  Save
                </button>
              ) : (
                <button
                  onClick={() => setEditingIndex(index)}
                  className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => handleRemove(index)}
                className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StaffEditableCard;
