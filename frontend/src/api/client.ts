/**
 * Central API client.
 *
 * Configures an axios instance pointing at the FastAPI backend, with a
 * request interceptor that automatically attaches the JWT access token
 * (stored in localStorage by AuthContext) to every request.
 *
 * Set VITE_API_BASE_URL in a .env file to point at a different backend
 * (e.g. a deployed server). Defaults to the local dev server.
 */
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
