import { API_BASE_URL } from "../config";

const defaultHeaders = {
  "Content-Type": "application/json",
};

const buildHeaders = (token) => {
  if (!token) {
    return defaultHeaders;
  }
  return {
    ...defaultHeaders,
    Authorization: `Bearer ${token}`,
  };
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse JSON response", err);
    return {};
  }
};

const request = async (path, { method = "GET", body, token } = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await parseJson(response);
  if (!response.ok) {
    const detail = data?.detail || data?.error || data?.message || "Request failed";
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return data;
};

export const signup = (payload) => request("/auth/signup", { method: "POST", body: payload });

export const login = (payload) => request("/auth/login", { method: "POST", body: payload });

export const logout = (payload, token) =>
  request("/auth/logout", { method: "POST", body: payload, token });

export const changePassword = (payload, token) =>
  request("/auth/change-password", { method: "POST", body: payload, token });

export const requestAvailability = (payload, token) =>
  request("/availability", { method: "POST", body: payload, token });

export const requestOptimizedAvailability = (payload, token) =>
  request("/availability/optimized", { method: "POST", body: payload, token });

export const submitOptimizationFeedback = (payload, token) =>
  request("/availability/optimized/feedback", { method: "POST", body: payload, token });

export const publishPlan = (payload, token) =>
  request("/publish", { method: "POST", body: payload, token });

export const fetchPublishedPlans = (patientId, token) =>
  request(`/published/${patientId}`, { token });

export const updateTasks = (payload, token) =>
  request("/tasks/update", { method: "POST", body: payload, token });

export const fetchTasks = (patientId, token) =>
  request(`/tasks/${patientId}`, { token });

export const updateCrew = (payload, token) =>
  request("/crew/update", { method: "POST", body: payload, token });

export const fetchCrew = (patientId, token) =>
  request(`/crew/${patientId}`, { token });

export const updateTimeline = (payload, token) =>
  request("/timeline/update", { method: "POST", body: payload, token });

export const fetchTimeline = (patientId, token) =>
  request(`/timeline/${patientId}`, { token });

export const recordVitals = (payload, token) =>
  request("/vitals/update", { method: "POST", body: payload, token });

export const fetchLatestVitals = (patientId, token) =>
  request(`/vitals/${patientId}/latest`, { token });

export const fetchSurgeries = (doctorId, token) =>
  request(`/surgeries/${doctorId}`, { token });

export const updateSurgery = (surgeryId, payload, token) =>
  request(`/surgeries/update/${surgeryId}`, { method: "PUT", body: payload, token });

export const fetchPlan = (planId, token) =>
  request(`/publish/${planId}`, { token });
