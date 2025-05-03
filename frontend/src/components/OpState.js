import React, { useState } from "react";
import Task from "./Task";

const OpState = () => {
    const [activeTab, setActiveTab] = useState("preop");
    const [nurses, setNurses] = useState(["Susan", "Elizabeth"]);
    const [showModal, setShowModal] = useState(false);
    const [selectedNurses, setSelectedNurses] = useState([...nurses]);
    const [aiData, setAiData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [llmData, setLlmData] = useState(null);
    const [publishResponse, setPublishResponse] = useState(null);
    const [showPublishModal, setShowPublishModal] = useState(false);


    // const handleFetchAISuggestions = async () => {
    //     setLoading(true);
    //     try {
    //         const payload = {
    //             requested_date: "2024-05-03",
    //             requested_start: "10:00",
    //             requested_end: "12:00",
    //             required_test_type: "MRI",
    //             required_nurses: 2,
    //             required_operation_rooms: 1,
    //             time_constraint_type: "exact"
    //         };

    //         console.log("📤 Sending request body:", payload);

    //         const res = await fetch("http://localhost:8000/check-availability/", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             body: JSON.stringify(payload)
    //         });

    //         const data = await res.json();
    //         console.log("✅ Response received:", data);
    //         setAiData(data);
    //     } catch (err) {
    //         console.error("AI Suggestion fetch failed:", err);
    //         setAiData({ error: "Failed to load suggestions." });
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // const handleFetchAISuggestions = async () => {
    //     setLoading(true);
    //     try {
    //         const payload = {
    //             requested_date: "2024-05-03",
    //             requested_start: "10:00",
    //             requested_end: "12:00",
    //             required_test_type: "MRI",
    //             required_nurses: 2,
    //             required_operation_rooms: 1,
    //             time_constraint_type: "exact"
    //         };

    //         const res = await fetch("http://localhost:8000/availability", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             body: JSON.stringify(payload)
    //         });

    //         const data = await res.json();
    //         setAiData(data);

    //         // 🔹 ALSO fetch ai.json from public folder
    //         const llmRes = await fetch("/files/ai.json");
    //         const llmJson = await llmRes.json();
    //         setLlmData(llmJson);
    //     } catch (err) {
    //         console.error("AI Suggestion fetch failed:", err);
    //         setAiData({ error: "Failed to load suggestions." });
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // const handlePublish = async () => {
    //     try {
    //         const res = await fetch("http://localhost:8000/publish", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             body: JSON.stringify({ section: "preop", patient_id: "123" })
    //         });

    //         const data = await res.json();
    //         setPublishResponse(data);
    //         setShowPublishModal(true);
    //     } catch (err) {
    //         console.error("❌ Publish failed:", err);
    //         alert("Failed to publish. Check console.");
    //     }
    // };

    // const handleFetchAISuggestions = async () => {
    //     setLoading(true);
    //     try {
    //         await new Promise(resolve => setTimeout(resolve, 2000));
    //         const payload = {
    //             requested_date: "2025-04-02",
    //             requested_start: "10:00",
    //             requested_end: "18:00",
    //             required_test_type: "MRI",
    //             required_nurses: 2,
    //             required_radiologists: 1,           // ✅ ADD THIS
    //             required_assistant_doctors: 2,       // ✅ ADD THIS
    //             required_operation_rooms: 1,
    //             required_equipment: "Anesthesia Machine", // ✅ if filtering, optional
    //             time_constraint_type: "exact"
    //         };

    //         const res = await fetch("http://localhost:8000/availability", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             body: JSON.stringify(payload)
    //         });

    //         const data = await res.json();
    //         console.log("✅ Availability response:", data);
    //         setAiData(data);

    //         const llmRes = await fetch("/files/ai.json");
    //         const llmJson = await llmRes.json();
    //         setLlmData(llmJson);
    //     } catch (err) {
    //         console.error("AI Suggestion fetch failed:", err);
    //         setAiData({ error: "Failed to load suggestions." });
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    const handleFetchAISuggestions = async (payload) => {
        setLoading(true);
        try {
          await new Promise(resolve => setTimeout(resolve, 2000)); // ⏳ Delay
      
          const res = await fetch("http://localhost:8000/availability/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
      
          const data = await res.json();
          console.log("✅ Availability response:", data);
          setAiData(data);
      
          const llmRes = await fetch("/files/ai.json");
          const llmJson = await llmRes.json();
          setLlmData(llmJson);
        } catch (err) {
          console.error("AI Suggestion fetch failed:", err);
          setAiData({ error: "Failed to load suggestions." });
        } finally {
          setLoading(false);
        }
      };
      


    const handlePublish = async () => {
        try {
            const payload = {
                patient_id: "123",
                ot_id: "OT-21",
                contacts: [
                    {
                        name: "Dr. Smith",
                        role: "surgeon",
                        email: "drsmith@example.com"
                    },
                    {
                        name: "Nurse Joy",
                        role: "nurse",
                        email: "nurse@example.com"
                    }
                ]
            };

            const res = await fetch("http://localhost:8000/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            console.log("✅ Published:", data);
            setPublishResponse(data);
            setShowPublishModal(true);
        } catch (err) {
            console.error("❌ Publish failed:", err);
            alert("Failed to publish. Check console.");
        }
    };


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
                    { label: "Check BP every 4 hours", status: "completed", time: "08:00", note: "Stable vitals" },
                    { label: "Administer medication", status: "in_progress", time: "09:00", note: "Given half dose" },
                ]
                : [
                    { label: "Pre-op patient preparation", status: "pending", time: "08:30", note: "To start soon" },
                    { label: "Patient education", status: "completed", time: "07:50", note: "Explained procedure" },
                ]
        ])
    );

    const doctorTasksPreOp = {
        "Dr. Martinez": [
            { label: "Review lab results", status: "completed", time: "07:30", note: "No concerns" },
            { label: "Obtain informed consent", status: "in_progress", time: "08:10", note: "Halfway done" },
        ],
        "Dr. Wong": [
            { label: "Coordinate with anesthesia team", status: "pending", time: "09:00", note: "Waiting for update" },
        ],
    };

    const nurseTasksSurgery = {
        Susan: [
            { label: "Monitor vitals", status: "in_progress", time: "11:00", note: "HR stable" },
            { label: "Manage IV fluids", status: "completed", time: "10:45", note: "Fluids replaced" },
        ],
    };

    const doctorTasksSurgery = {
        "Dr. Wong": [
            { label: "Perform procedure", status: "pending", time: "12:00", note: "Scheduled after prep" },
        ],
    };

    const nurseTasksPostOp = {
        Elizabeth: [
            { label: "Pain assessment", status: "pending", time: "14:00", note: "To follow-up" },
            { label: "Discharge instructions", status: "in_progress", time: "15:00", note: "Started briefing" },
        ],
    };

    const renderTabs = () => (
        <div className="flex space-x-6 border-b mb-6">
            {["preop", "surgery", "postop"].map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 font-medium ${activeTab === tab
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>
    );


    const renderPreOpLayout = () => (

        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* AI Suggestions Panel */}
                <div className="col-span-1 bg-gray-50 rounded-xl border border-gray-200 flex flex-col max-h-[calc(100vh-140px)]">
                    <div className="overflow-y-auto px-4 pt-4 pb-2 space-y-4 text-sm text-gray-800">
                        <h3 className="text-md font-semibold text-gray-800 mb-3">AI Suggestions</h3>

                        {loading && <p className="text-sm text-gray-500 mb-6">Loading...</p>}

                        {!aiData && !llmData && !loading && (
                            <p className="text-sm text-gray-500 mb-6">Suggestions will appear here...</p>
                        )}

                        {llmData && (
                            <div className="bg-indigo-50 p-4 rounded-lg border space-y-2">
                                <h4 className="font-semibold text-indigo-700 text-sm mb-1">🤖 AI Surgical Plan</h4>
                                <p className="text-sm"><strong>Summary:</strong> {llmData.surgical_plan_summary}</p>
                                <p className="text-sm"><strong>Urgency Level:</strong> {llmData.urgency_level}</p>
                                <div>
                                    <strong className="text-sm">Suggested Tests:</strong>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {llmData.suggested_tests.map((test, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-1 bg-white border border-indigo-100 text-gray-700 text-xs rounded-full shadow-sm"
                                            >
                                                {test}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {aiData && !aiData.error && (
                            <div className="space-y-4">
                                <div className="bg-white rounded-lg border shadow-sm p-4">
                                    <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Date & Time</div>
                                    <div className="flex flex-col gap-1 text-sm text-gray-700">
                                        <div className="flex items-center gap-2">📅 {aiData.date}</div>
                                        <div className="flex items-center gap-2">⏰ {aiData.start} – {aiData.end}</div>
                                    </div>
                                </div>

                                {[
                                    { title: "Nurses", list: aiData.nurses_available },
                                    { title: "Assistant Doctors", list: aiData.assistant_doctors_available },
                                    { title: "Radiologists", list: aiData.radiologists_available },
                                    { title: "Equipment", list: aiData.equipment_available },
                                    { title: "Operation Theatres", list: aiData.operation_theatres_available },
                                ].map(({ title, list }, index) => (
                                    <div key={index} className="bg-white rounded-lg border shadow-sm p-4">
                                        <div className="font-semibold text-xs text-gray-500 uppercase mb-2">{title}</div>
                                        <div className="grid grid-cols-1 gap-1 text-gray-700 text-sm">
                                            {list.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between py-2 px-2 bg-gray-50 rounded-md border border-gray-100">
                                                    <div className="flex items-center gap-2">
                                                        <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600" />
                                                        <div>
                                                            <div className="font-medium">{item.name}</div>
                                                            {item.email && <div className="text-xs text-gray-500">{item.email}</div>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-blue-600 font-medium cursor-pointer">
                                                        <span>Edit</span>
                                                        <span>Remove</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                    </div>
                                ))}

                                <div className="bg-white rounded-lg border shadow-sm p-4">
                                    <div className="font-semibold text-xs text-gray-500 uppercase mb-2">
                                        Latest MRI Test Scores
                                    </div>
                                    <div className="space-y-1 text-gray-700 text-sm">
                                        {aiData.latest_test_scores.map((s, i) => (
                                            <div key={i} className="flex justify-between">
                                                <span className="font-medium">{s.patient_id}</span>
                                                <span>{s.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div
                                    className={`text-center font-semibold text-sm px-3 py-2 rounded-md border shadow-sm ${aiData.match_status === "Requirements matched"
                                            ? "bg-green-50 text-green-700 border-green-200"
                                            : "bg-red-50 text-red-600 border-red-200"
                                        }`}
                                >
                                    {aiData.match_status === "Requirements matched" ? "✅" : "❌"} {aiData.match_status}
                                </div>

                            </div>
                        )}

                        {aiData?.error && (
                            <p className="text-sm text-red-500">{aiData.error}</p>
                        )}
                    </div>

                    {/* Buttons fixed at bottom */}
                    <div className="flex justify-center gap-3 p-4 border-t bg-white">
                        <button
                            onClick={handleFetchAISuggestions}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow"
                        >
                            AI Suggestion
                        </button>
                        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow">
                            Add to Task
                        </button>
                    </div>
                </div>

                {/* Tasks Panel */}
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

                    {/* ✅ Publish Button */}
                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={handlePublish}
                            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-3 px-8 rounded-full shadow-md"
                        >
                            Publish
                        </button>
                    </div>
                </div>
            </div>

            {/* ✅ Publish Modal */}
            {showPublishModal && publishResponse && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white w-[90%] max-w-md rounded-xl shadow-lg p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-gray-800">✅ Published Successfully</h2>

                        <div className="text-sm text-gray-700 space-y-2">
                            <p><strong>Status:</strong> {publishResponse.status}</p>
                            <p><strong>Patient ID:</strong> {publishResponse.patient_id}</p>

                            <div>
                                <strong className="block mb-1">Confirmations:</strong>
                                <div className="space-y-2">
                                    {Array.isArray(publishResponse.confirmations) &&
                                        publishResponse.confirmations.map((msg, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700"
                                            >
                                                <span className="text-blue-500 mt-0.5">✉️</span>
                                                <span>{msg}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>


                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <strong className="text-sm">OT Booked:</strong>
                                    <span className={publishResponse.ot_booked ? "text-green-600 font-medium" : "text-red-600"}>
                                        {publishResponse.ot_booked ? "Yes" : "No"}
                                    </span>
                                </div>

                                {publishResponse.ot_id && (
                                    <div className="flex items-center gap-2">
                                        <strong className="text-sm">OT ID:</strong>
                                        <span className="text-gray-800">{publishResponse.ot_id}</span>
                                    </div>
                                )}
                            </div>

                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowPublishModal(false)}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    // const renderPreOpLayout = () => (
    //     <>
    //       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    //         {/* AI Suggestions Panel */}
    //         <div className="col-span-1 bg-gray-50 rounded-xl border border-gray-200 flex flex-col max-h-[calc(100vh-140px)]">
    //           <div className="overflow-y-auto px-4 pt-4 pb-2 space-y-4 text-sm text-gray-800">
    //             <h3 className="text-md font-semibold text-gray-800 mb-3">AI Suggestions</h3>

    //             {loading && <p className="text-sm text-gray-500 mb-6">Loading...</p>}
    //             {!aiData && !llmData && !loading && (
    //               <p className="text-sm text-gray-500 mb-6">Suggestions will appear here...</p>
    //             )}

    //             {llmData && (
    //               <div className="bg-indigo-50 p-4 rounded-lg border space-y-2">
    //                 <h4 className="font-semibold text-indigo-700 text-sm mb-1">🤖 AI Surgical Plan</h4>
    //                 <p className="text-sm"><strong>Summary:</strong> {llmData.surgical_plan_summary}</p>
    //                 <p className="text-sm"><strong>Urgency Level:</strong> {llmData.urgency_level}</p>
    //                 <div>
    //                   <strong className="text-sm">Suggested Tests:</strong>
    //                   <div className="flex flex-wrap gap-2 mt-1">
    //                     {llmData.suggested_tests.map((test, i) => (
    //                       <span
    //                         key={i}
    //                         className="px-2 py-1 bg-white border border-indigo-100 text-gray-700 text-xs rounded-full shadow-sm"
    //                       >
    //                         {test}
    //                       </span>
    //                     ))}
    //                   </div>
    //                 </div>
    //               </div>
    //             )}

    //             {aiData && !aiData.error && (
    //               <div className="space-y-4">
    //                 {/* Date & Time */}
    //                 <div className="bg-white rounded-lg border shadow-sm p-4">
    //                   <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Date & Time</div>
    //                   <div className="flex flex-col gap-1 text-sm text-gray-700">
    //                     <div className="flex items-center gap-2">📅 {aiData.date}</div>
    //                     <div className="flex items-center gap-2">⏰ {aiData.start} – {aiData.end}</div>
    //                   </div>
    //                 </div>

    //                 {/* Dynamic Sections (including empty) */}
    //                 {[
    //                   { title: "Nurses", list: aiData.nurses_available },
    //                   { title: "Assistant Doctors", list: aiData.assistant_doctors_available },
    //                   { title: "Radiologists", list: aiData.radiologists_available },
    //                   { title: "Equipment", list: aiData.equipment_available },
    //                   { title: "Operation Theatres", list: aiData.operation_theatres_available },
    //                 ].map(({ title, list }, index) => (
    //                   <div key={index} className="bg-white rounded-lg border shadow-sm p-4">
    //                     <div className="flex items-center justify-between mb-2">
    //                       <div className="font-semibold text-xs text-gray-500 uppercase">{title}</div>
    //                       <button className="text-xs text-blue-500 hover:underline">Edit</button>
    //                     </div>
    //                     <div className="space-y-1">
    //                       {(list.length > 0 ? list : [{ id: "", name: "No entries", email: "" }]).map((item, i) => (
    //                         <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border text-sm text-gray-700">
    //                           <div className="flex items-center gap-2">
    //                             <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600" />
    //                             <div>
    //                               <div className="font-medium">{item.name}</div>
    //                               {item.email && (
    //                                 <div className="text-xs text-gray-500">{item.email}</div>
    //                               )}
    //                             </div>
    //                           </div>
    //                           <span className="text-gray-400 cursor-pointer hover:text-gray-600 text-xs">✏️</span>
    //                         </div>
    //                       ))}
    //                     </div>
    //                   </div>
    //                 ))}

    //                 {/* MRI Test Scores */}
    //                 <div className="bg-white rounded-lg border shadow-sm p-4">
    //                   <div className="font-semibold text-xs text-gray-500 uppercase mb-2">
    //                     Latest MRI Test Scores
    //                   </div>
    //                   <div className="space-y-1 text-gray-700 text-sm">
    //                     {aiData.latest_test_scores.length === 0 ? (
    //                       <p className="text-xs text-gray-400">No scores available.</p>
    //                     ) : (
    //                       aiData.latest_test_scores.map((s, i) => (
    //                         <div key={i} className="flex justify-between">
    //                           <span className="font-medium">{s.patient_id}</span>
    //                           <span>{s.score}</span>
    //                         </div>
    //                       ))
    //                     )}
    //                   </div>
    //                 </div>

    //                 {/* Match Status */}
    //                 <div className="text-center bg-green-50 text-green-700 font-semibold text-sm px-3 py-2 rounded-md border border-green-200 shadow-sm">
    //                   ✅ {aiData.match_status}
    //                 </div>
    //               </div>
    //             )}

    //             {aiData?.error && (
    //               <p className="text-sm text-red-500">{aiData.error}</p>
    //             )}
    //           </div>

    //           {/* Buttons fixed at bottom */}
    //           <div className="flex justify-center gap-3 p-4 border-t bg-white">
    //             <button
    //               onClick={handleFetchAISuggestions}
    //               className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow"
    //             >
    //               AI Suggestion
    //             </button>
    //             <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-full shadow">
    //               Add to Task
    //             </button>
    //           </div>
    //         </div>
    //       </div>
    //     </>
    //   );



    const renderTabContent = () => {
        if (activeTab === "preop") return renderPreOpLayout();

        return (
            <>
                {renderTabs()}
                <p className="text-sm text-gray-600 mb-4">
                    {activeTab === "surgery" ? "Surgery Day Tasks" : "Post-Op Tasks"}
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


