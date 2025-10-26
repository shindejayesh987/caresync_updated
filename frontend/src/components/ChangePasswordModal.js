import React, { useState } from "react";
import { changePassword } from "../services/api";

const initialState = {
  email: "",
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const ChangePasswordModal = ({ token, defaultEmail, onClose }) => {
  const [form, setForm] = useState({
    ...initialState,
    email: defaultEmail || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(
        {
          email: form.email.trim().toLowerCase(),
          old_password: form.oldPassword,
          new_password: form.newPassword,
        },
        token
      );
      setSuccess("Password updated successfully.");
      setForm({ ...initialState, email: defaultEmail || "" });
    } catch (err) {
      setError(err.message || "Unable to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Change password</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="cp-email">
              Email
            </label>
            <input
              id="cp-email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="cp-old">
              Current password
            </label>
            <input
              id="cp-old"
              name="oldPassword"
              type="password"
              value={form.oldPassword}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="cp-new">
              New password
            </label>
            <input
              id="cp-new"
              name="newPassword"
              type="password"
              value={form.newPassword}
              onChange={handleChange}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="cp-confirm">
              Confirm new password
            </label>
            <input
              id="cp-confirm"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
