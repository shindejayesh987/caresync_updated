import React, { useMemo, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import CaseDetail from "./components/CaseDetail";

const loadSession = () => {
  const stored = localStorage.getItem("careSyncSession");
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch (err) {
    console.error("Failed to parse stored session", err);
    return null;
  }
};

function App() {
  const [session, setSession] = useState(loadSession);
  const [view, setView] = useState(session ? "dashboard" : "login");

  const handleAuthSuccess = (data) => {
    const normalized = {
      access_token: data.access_token,
      token_type: data.token_type,
      user: data.user,
    };

    setSession(normalized);
    localStorage.setItem("careSyncSession", JSON.stringify(normalized));
    setView("dashboard");
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem("careSyncSession");
    setView("login");
  };

  const userDisplayName = useMemo(() => {
    if (!session?.user) {
      return "CareSync User";
    }
    return session.user.full_name || session.user.email;
  }, [session]);

  if (!session) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "#CED2D6" }}>
      <header className="mb-6 rounded-2xl bg-white p-5 shadow-md">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Logged in as
            </p>
            <h1 className="text-2xl font-semibold text-gray-800">
              {userDisplayName}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </header>

      {view === "dashboard" ? (
        <Dashboard
          onCaseClick={() => setView("caseDetail")}
          user={session.user}
        />
      ) : (
        <CaseDetail
          onBackClick={() => setView("dashboard")}
          token={session.access_token}
        />
      )}
    </div>
  );
}

export default App;
