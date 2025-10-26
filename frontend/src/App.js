import React, { useMemo, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import CaseDetail from "./components/CaseDetail";
import { logout as logoutRequest } from "./services/api";
import ChangePasswordModal from "./components/ChangePasswordModal";
import PlanDetail from "./components/PlanDetail";

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
  const navigate = useNavigate();
  const [session, setSession] = useState(loadSession);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleAuthSuccess = (data) => {
    const normalized = {
      access_token: data.access_token,
      token_type: data.token_type,
      user: data.user,
    };

    setSession(normalized);
    localStorage.setItem("careSyncSession", JSON.stringify(normalized));
    navigate("/");
  };

  const handleLogout = async () => {
    if (session?.access_token && session?.user?.id) {
      try {
        await logoutRequest(
          { user_id: session.user.id, email: session.user.email },
          session.access_token
        );
      } catch (err) {
        console.warn("Logout request failed", err);
      }
    }

    setSession(null);
    localStorage.removeItem("careSyncSession");
    navigate("/");
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChangePassword(true)}
              className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              Change password
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              onCaseClick={() => navigate("/case")}
              user={session.user}
              token={session.access_token}
            />
          }
        />
        <Route
          path="/case"
          element={
            <CaseDetail
              onBackClick={() => navigate("/")}
              token={session.access_token}
              patientId="patient-123"
              user={session.user}
            />
          }
        />
        <Route
          path="/plans/:planId"
          element={
            <PlanDetail
              token={session.access_token}
              doctorId={session.user?.id || session.user?._id}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showChangePassword && (
        <ChangePasswordModal
          token={session.access_token}
          defaultEmail={session.user?.email}
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </div>
  );
}

export default App;
