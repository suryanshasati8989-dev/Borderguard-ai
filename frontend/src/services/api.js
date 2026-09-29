import axios from "axios";

// Creating Axios instance with a fallback relative path for Vercel multi-service deployment
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bg_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Handle Unauthenticated (401) Errors
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("bg_token");
      localStorage.removeItem("bg_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// Helper: Get Stored Auth Token
export function authToken() {
  return localStorage.getItem("bg_token") || "";
}

// Helper: Get Base URL for external links (SSE/Streams)
function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  // Strip trailing slash if present
  return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
}

// Helper: MJPEG Video Stream URL
export function streamUrl(cameraId) {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/cameras/${cameraId}/mjpeg?token=${encodeURIComponent(authToken())}`;
}

// Helper: Evidence Media URL
export function evidenceUrl(eventId) {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/events/${eventId}/evidence?token=${encodeURIComponent(authToken())}`;
}

// Helper: Open Server-Sent Events (SSE) Stream
export function openSse(onMessage) {
  const token = authToken();
  const baseUrl = getApiBaseUrl();
  const es = new EventSource(`${baseUrl}/stream/events?token=${encodeURIComponent(token)}`);
  
  ["detection", "alert", "camera", "system", "ready"].forEach((name) => {
    es.addEventListener(name, (ev) => {
      try {
        onMessage(name, JSON.parse(ev.data));
      } catch {
        onMessage(name, ev.data);
      }
    });
  });
  
  return es;
}