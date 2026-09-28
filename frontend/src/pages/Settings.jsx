import { useEffect, useState } from "react";
import api from "../services/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { formatDateTime } from "../utils/format.js";

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const s = await api.get("/settings");
    setSettings(s.data);
    if (isAdmin) {
      const a = await api.get("/settings/audit");
      setLogs(a.data.logs);
    }
  };

  useEffect(() => {
    load();
  }, [isAdmin]);

  const save = async (e) => {
    e.preventDefault();
    await api.put("/settings", {
      retention_days: Number(settings.retention_days),
      detection_mode: settings.detection_mode,
    });
    setMsg("Settings saved.");
    await load();
  };

  const purge = async () => {
    const { data } = await api.post("/settings/retention/purge");
    setMsg(`Purged ${data.removed} old records.`);
  };

  if (!settings) return <div className="text-stone-500">Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="text-[10px] tracking-[0.35em] text-phosphor-400">STATION</div>
        <h1 className="text-2xl mt-1">Settings</h1>
      </div>
      <div className="border border-white/10 p-4 text-sm space-y-1">
        <div>Signed in as <span className="text-phosphor-400">{user?.username}</span></div>
        <div>Role: {user?.role}</div>
      </div>
      <p className="text-sm text-stone-400">{settings.disclaimer}</p>
      {isAdmin ? (
        <form onSubmit={save} className="space-y-3 border border-white/10 p-4">
          <label className="block text-sm">
            Data retention (days)
            <input
              type="number"
              min={1}
              max={365}
              className="mt-1 w-full bg-night-800 border border-stone-700 px-3 py-2"
              value={settings.retention_days}
              onChange={(e) => setSettings({ ...settings, retention_days: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Detection mode
            <select
              className="mt-1 w-full bg-night-800 border border-stone-700 px-3 py-2"
              value={settings.detection_mode}
              onChange={(e) => setSettings({ ...settings, detection_mode: e.target.value })}
            >
              <option value="auto">auto (YOLO if installed, else OpenCV / simulation)</option>
              <option value="yolo">yolo</option>
              <option value="opencv">opencv</option>
              <option value="simulation">simulation (clearly labeled)</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-phosphor-500 text-night-950 text-sm font-semibold">Save</button>
            <button type="button" className="px-4 py-2 border border-stone-600 text-sm" onClick={purge}>
              Purge expired records
            </button>
          </div>
        </form>
      ) : (
        <div className="text-sm text-stone-500">Operator role is view-only for station settings.</div>
      )}
      {msg && <div className="text-phosphor-400 text-sm">{msg}</div>}
      {isAdmin && (
        <div>
          <h2 className="text-xs tracking-widest text-stone-500 mb-2">AUDIT LOG</h2>
          <div className="max-h-80 overflow-auto border border-white/5 text-xs font-mono">
            {logs.map((l) => (
              <div key={l.id} className="px-3 py-1 border-b border-white/5">
                {formatDateTime(l.created_at)} · {l.username} · {l.action} · {l.details}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
