import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { evidenceUrl } from "../services/api.js";
import { formatDateTime, severityClass } from "../utils/format.js";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState("");
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    const { data } = await api.get("/alerts", { params: status ? { status } : {} });
    setAlerts(data.alerts);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [status]);

  const setAlertStatus = async (id, next) => {
    try {
      await api.put(`/alerts/${id}`, { status: next });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Update failed");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] tracking-[0.35em] text-phosphor-400">WATCHFLOOR</div>
        <h1 className="text-2xl mt-1">Alerts</h1>
        <p className="text-sm text-stone-500">Acknowledge or resolve after a human has reviewed the feed. The system does not decide threats.</p>
      </div>
      <select className="bg-night-800 border border-stone-700 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All</option>
        <option>OPEN</option>
        <option>ACKNOWLEDGED</option>
        <option>RESOLVED</option>
      </select>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="grid md:grid-cols-2 gap-3">
        {alerts.map((a) => (
          <div key={a.id} className="border border-white/10 p-4 bg-night-800/60">
            <div className={`text-xs tracking-widest ${severityClass(a.severity)}`}>{a.severity} · {a.event_type}</div>
            <div className="mt-2 text-sm">{a.message}</div>
            <div className="mt-2 text-[11px] font-mono text-stone-500">
              {a.camera} · {formatDateTime(a.created_at)} · {a.status}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="text-xs px-2 py-1 border border-stone-600" onClick={() => setPicked(a)}>
                View
              </button>
              {a.camera_id && (
                <Link className="text-xs px-2 py-1 border border-stone-600" to={`/cameras/${a.camera_id}`}>
                  Camera
                </Link>
              )}
              {a.status === "OPEN" && (
                <button className="text-xs px-2 py-1 bg-amber-signal/20 text-amber-signal" onClick={() => setAlertStatus(a.id, "ACKNOWLEDGED")}>
                  Acknowledge
                </button>
              )}
              {a.status !== "RESOLVED" && (
                <button className="text-xs px-2 py-1 bg-phosphor-500/20 text-phosphor-400" onClick={() => setAlertStatus(a.id, "RESOLVED")}>
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {picked && (
        <div className="border border-phosphor-500/20 p-4">
          <div className="text-sm">{picked.description}</div>
          {picked.event_id && picked.evidence_path && (
            <img className="mt-3 max-w-xl border border-white/10" src={evidenceUrl(picked.event_id)} alt="evidence" />
          )}
          <button className="mt-2 text-xs text-stone-400" onClick={() => setPicked(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
