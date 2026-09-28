import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownUp, ShieldAlert } from "lucide-react";
import { formatTime } from "../utils/format.js";

const HIGH = ["human", "person", "intruder", "weapon", "armed individual"];
const MEDIUM = ["vehicle", "car", "truck", "drone", "machinery", "motorcycle", "bus", "unidentified machinery"];
const LOW = ["animal", "wildlife", "bird", "environmental motion"];

export function threatLevel(item) {
  const value = `${item?.object_type || ""} ${item?.event_type || ""}`.toLowerCase();
  if (HIGH.some((term) => value.includes(term))) return 1;
  if (MEDIUM.some((term) => value.includes(term))) return 2;
  return 3;
}

const levels = {
  1: { label: "LEVEL 1 — HIGH THREAT", color: "text-alert-flash", panel: "border-alert-flash/40 bg-alert-flash/10", dot: "bg-alert-flash animate-pulse" },
  2: { label: "LEVEL 2 — MEDIUM THREAT", color: "text-amber-signal", panel: "border-amber-signal/35 bg-amber-signal/10", dot: "bg-amber-signal" },
  3: { label: "LEVEL 3 — LOW THREAT", color: "text-phosphor-400", panel: "border-phosphor-500/25 bg-phosphor-500/5", dot: "bg-phosphor-400" },
};

export default function ThreatPriorityQueue({ alerts = [], compact = false }) {
  const [priorityFirst, setPriorityFirst] = useState(true);
  const sorted = useMemo(() => {
    const rows = [...alerts];
    return rows.sort((a, b) => {
      if (priorityFirst && threatLevel(a) !== threatLevel(b)) return threatLevel(a) - threatLevel(b);
      return new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0);
    });
  }, [alerts, priorityFirst]);

  return (
    <section className="glass-panel p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="hud-label">LIVE PRIORITY QUEUE</div>
          {!compact && <p className="text-xs text-slate-500 mt-1">Priority is a review queue, never an automated risk verdict.</p>}
        </div>
        <button
          onClick={() => setPriorityFirst((value) => !value)}
          className="icon-button w-auto px-2.5 text-[11px]"
          title="Toggle priority sorting"
        >
          <ArrowDownUp size={14} /> {priorityFirst ? "HIGH → LOW" : "NEWEST"}
        </button>
      </div>
      <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
        {sorted.length === 0 && <div className="border border-dashed border-slate-700 p-5 text-sm text-slate-500">No live detections yet.</div>}
        {sorted.map((item) => {
          const level = levels[threatLevel(item)];
          return (
            <div key={`${item.id}-${item.timestamp || item.created_at}`} className={`border p-3 ${level.panel}`}>
              <div className="flex items-start gap-2">
                {threatLevel(item) === 1 ? <ShieldAlert size={16} className={level.color} /> : <AlertTriangle size={16} className={level.color} />}
                <div className="min-w-0 flex-1">
                  <div className={`text-[10px] tracking-[0.16em] ${level.color}`}>{level.label}</div>
                  <div className="mt-1 text-sm truncate">{item.message || item.event_type || "Detection"}</div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400">
                    {item.camera || "SYSTEM"} · {(item.object_type || "unclassified").toUpperCase()} · {formatTime(item.timestamp || item.created_at)}
                  </div>
                </div>
                <span className={`mt-1 h-2 w-2 rounded-full ${level.dot}`} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
