import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bg_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export function authToken() {
  return localStorage.getItem("bg_token") || "";
}

export function streamUrl(cameraId) {
  return `/api/cameras/${cameraId}/mjpeg?token=${encodeURIComponent(authToken())}`;
}

export function evidenceUrl(eventId) {
  return `/api/events/${eventId}/evidence?token=${encodeURIComponent(authToken())}`;
}

export function openSse(onMessage) {
  const token = authToken();
  const es = new EventSource(`/api/stream/events?token=${encodeURIComponent(token)}`);
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
