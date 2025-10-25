import { API_BASE_URL } from "../config";

const jsonHeaders = { "Content-Type": "application/json" };

const buildHeaders = (token) => {
  if (!token) {
    return { ...jsonHeaders };
  }

  return {
    ...jsonHeaders,
    Authorization: `Bearer ${token}`,
  };
};

const parseJsonSafe = async (response) => {
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

  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const detail = data?.detail || data?.message || "Request failed";
    throw new Error(detail);
  }

  return data;
};

export const signup = (payload) =>
  request("/auth/signup", { method: "POST", body: payload });

export const login = (payload) =>
  request("/auth/login", { method: "POST", body: payload });

export const requestAvailability = (payload, token) =>
  request("/availability", { method: "POST", body: payload, token });

export const publishPlan = (payload, token) =>
  request("/publish", { method: "POST", body: payload, token });
