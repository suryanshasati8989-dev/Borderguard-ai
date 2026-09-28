import { useEffect, useState } from "react";
import api, { openSse } from "../services/api.js";

export function useOpsData() {
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [c, a, an] = await Promise.all([
      api.get("/cameras"),
      api.get("/alerts"),
      api.get("/analytics"),
    ]);
    setCameras(c.data.cameras);
    setAlerts(a.data.alerts);
    setAnalytics(an.data);
  };

  useEffect(() => {
    refresh().catch((e) => setError(e.response?.data?.error || e.message));
    const es = openSse((name, payload) => {
      if (name === "alert") {
        setAlerts((prev) => {
          const rest = prev.filter((x) => x.id !== payload.id);
          return [payload, ...rest].slice(0, 300);
        });
      }
      if (name === "camera") {
        setCameras((prev) => prev.map((c) => (c.id === payload.id ? { ...c, ...payload } : c)));
      }
      if (name === "detection" || name === "system") {
        api.get("/analytics").then((r) => setAnalytics(r.data)).catch(() => {});
        api.get("/cameras").then((r) => setCameras(r.data.cameras)).catch(() => {});
      }
    });
    const t = setInterval(() => {
      api.get("/analytics").then((r) => setAnalytics(r.data)).catch(() => {});
    }, 8000);
    return () => {
      es.close();
      clearInterval(t);
    };
  }, []);

  return { cameras, alerts, analytics, error, refresh, setAlerts };
}
