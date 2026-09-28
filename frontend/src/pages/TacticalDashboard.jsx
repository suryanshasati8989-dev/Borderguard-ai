import { useNavigate } from "react-router-dom";
import { useOpsData } from "../hooks/useOpsData.js";
import { formatTime, statusDot } from "../utils/format.js";
import { streamUrl } from "../services/api.js";
import ThreatPriorityQueue from "../components/ThreatPriorityQueue.jsx";

function Kpi({ label, value, accent }) {
  return (
    <div className="corner-frame bg-night-800/80 border border-white/5 p-4">
      <div className="text-[10px] tracking-[0.2em] text-stone-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold font-mono ${accent || "text-stone-100"}`}>{value ?? "—"}</div>
    </div>
  );
}

export default function TacticalDashboard() {
  const { cameras, alerts, analytics, error } = useOpsData();
  const navigate = useNavigate();
  const k = analytics?.kpis || {};
  const openAlerts = alerts.filter((a) => a.status === "OPEN").slice(0, 8);
  const source = analytics?.detection_source;

  return (
    <div className="space-y-6" id="live">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-[0.35em] text-phosphor-400">SECTOR OVERVIEW</div>
          <h1 className="text-2xl mt-1">Operations dashboard</h1>
        </div>
        <div className="text-[11px] font-mono text-stone-500">
          Detection source: <span className="text-ice">{source || "IDLE"}</span>
          {source === "SIMULATION" && " · labeled demo (no YOLO model loaded)"}
        </div>
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <Kpi label="TOTAL CAMERAS" value={k.total_cameras} />
        <Kpi label="ONLINE" value={k.online_cameras} accent="text-phosphor-400" />
        <Kpi label="OFFLINE" value={k.offline_cameras} accent="text-red-400" />
        <Kpi label="ACTIVE ALERTS" value={k.active_alerts} accent="text-orange-400" />
        <Kpi label="EVENTS TODAY" value={k.events_today} />
        <Kpi label="PERSONS DETECTED" value={k.persons_detected} />
        <Kpi label="VEHICLES DETECTED" value={k.vehicles_detected} />
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <div className="text-[10px] tracking-[0.25em] text-stone-500 mb-3">CAMERA GRID · LIVE / DEMO</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cameras.map((cam) => (
              <button
                key={cam.id}
                onClick={() => navigate(`/cameras/${cam.id}`)}
                className="text-left glass-panel hover:border-phosphor-500/60 overflow-hidden transition"
              >
                <div className="relative aspect-video bg-black scanlines hud-reticle">
                  {cam.status === "ONLINE" ? (
                    <img src={streamUrl(cam.id)} alt={cam.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-stone-600 text-xs font-mono">NO SIGNAL</div>
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-2 text-[10px] font-mono">
                    <span className={`h-2 w-2 rounded-full ${statusDot(cam.status)}`} />
                    {cam.status === "ONLINE" ? "LIVE" : cam.status}
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-mono text-phosphor-400">{cam.code}</span>
                    <span className="text-stone-500">{cam.detection_count} det.</span>
                  </div>
                  <div className="text-stone-200">{cam.name}</div>
                  <div className="text-[11px] text-stone-500">{cam.location}</div>
                  <div className="text-[11px] font-mono text-stone-600 mt-1">Last event {formatTime(cam.last_event_at)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <ThreatPriorityQueue alerts={openAlerts} compact />
      </div>
    </div>
  );
}
