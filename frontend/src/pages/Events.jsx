import { useEffect, useState } from "react";
import api, { evidenceUrl } from "../services/api.js";
import { formatDateTime, severityClass } from "../utils/format.js";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({ camera: "", date: "", event_type: "", severity: "", object_type: "" });
  const [meta, setMeta] = useState({ event_types: [], severities: [] });
  const [selected, setSelected] = useState(null);

  const load = async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const { data } = await api.get("/events", { params });
    setEvents(data.events);
    setMeta(data.filters);
  };

  useEffect(() => {
    load();
  }, [filters]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] tracking-[0.35em] text-phosphor-400">LEDGER</div>
        <h1 className="text-2xl mt-1">Event history</h1>
      </div>
      <div className="grid md:grid-cols-5 gap-2">
        <input
          className="bg-night-800 border border-stone-700 px-2 py-2 text-sm"
          placeholder="Camera code"
          value={filters.camera}
          onChange={(e) => setFilters({ ...filters, camera: e.target.value })}
        />
        <input
          type="date"
          className="bg-night-800 border border-stone-700 px-2 py-2 text-sm"
          value={filters.date}
          onChange={(e) => setFilters({ ...filters, date: e.target.value })}
        />
        <select
          className="bg-night-800 border border-stone-700 px-2 py-2 text-sm"
          value={filters.event_type}
          onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
        >
          <option value="">Event type</option>
          {meta.event_types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          className="bg-night-800 border border-stone-700 px-2 py-2 text-sm"
          value={filters.severity}
          onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
        >
          <option value="">Severity</option>
          {meta.severities.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          className="bg-night-800 border border-stone-700 px-2 py-2 text-sm"
          placeholder="Object type"
          value={filters.object_type}
          onChange={(e) => setFilters({ ...filters, object_type: e.target.value })}
        />
      </div>
      <div className="overflow-x-auto border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-night-800 text-[11px] text-stone-500">
            <tr>
              {["Event ID", "Type", "Camera", "Object", "Track", "Conf", "Time", "Severity", "Status"].map((h) => (
                <th key={h} className="text-left px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr
                key={e.id}
                className="border-t border-white/5 cursor-pointer hover:bg-white/5"
                onClick={async () => {
                  const { data } = await api.get(`/events/${e.id}`);
                  setSelected(data.event);
                }}
              >
                <td className="px-3 py-2 font-mono text-xs">{e.event_id}</td>
                <td className="px-3 py-2">{e.event_type}</td>
                <td className="px-3 py-2">{e.camera}</td>
                <td className="px-3 py-2">{e.object_type}</td>
                <td className="px-3 py-2 font-mono">{e.tracking_id}</td>
                <td className="px-3 py-2">{e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{formatDateTime(e.timestamp)}</td>
                <td className={`px-3 py-2 ${severityClass(e.severity)}`}>{e.severity}</td>
                <td className="px-3 py-2">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="border border-phosphor-500/20 p-4 bg-night-800/70 grid md:grid-cols-2 gap-4">
          <div className="text-sm space-y-1">
            <div className="tracking-widest text-xs text-stone-500">EVENT DETAIL</div>
            <div>{selected.event_id}</div>
            <div>{selected.event_type}</div>
            <div>Camera {selected.camera_name} ({selected.camera})</div>
            <div>Object {selected.object_type} · track {selected.tracking_id}</div>
            <div>Confidence {selected.confidence != null ? `${Math.round(selected.confidence * 100)}%` : "—"}</div>
            <div className="text-stone-500 text-xs">{JSON.stringify(selected.extra)}</div>
            <button className="mt-2 text-xs text-stone-400" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          {selected.evidence_path && (
            <img src={evidenceUrl(selected.id)} alt="evidence" className="w-full border border-white/10" />
          )}
        </div>
      )}
    </div>
  );
}
