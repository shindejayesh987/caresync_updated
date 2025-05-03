// import React, { useState } from "react";
// import Dashboard from "./components/Dashboard";
// import CaseDetail from "./components/CaseDetail";

// function App() {
//   const [view, setView] = useState("dashboard");

//   return (
//     <div className="min-h-screen bg-beige-50 p-6">
//       {view === "dashboard" ? (
//         <Dashboard onCaseClick={() => setView("caseDetail")} />
//       ) : (
//         <CaseDetail onBackClick={() => setView("dashboard")} />
//       )}
//     </div>
//   );
// }

// export default App;

import React, { useState } from "react";
import Dashboard from "./components/Dashboard";
import CaseDetail from "./components/CaseDetail";

function App() {
  const [view, setView] = useState("dashboard");

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "#CED2D6" }}>
      {view === "dashboard" ? (
        <Dashboard onCaseClick={() => setView("caseDetail")} />
      ) : (
        <CaseDetail onBackClick={() => setView("dashboard")} />
      )}
    </div>
  );
}

export default App;

