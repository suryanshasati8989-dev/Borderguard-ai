import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, ShieldAlert, Volume2, VolumeX, X, Zap } from "lucide-react";
import api, { evidenceUrl, openSse } from "../services/api.js";
import { formatTime } from "../utils/format.js";
import { threatLevel } from "./ThreatPriorityQueue.jsx";

function chime() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.22);
  gain.gain.setValueAtTime(0.06, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.3);
}

export default function TacticalAlertBell() {
  const [alerts, setAlerts] = useState([]);
  const [toast, setToast] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [notice, setNotice] = useState("");
  const seen = useRef(new Set());

  useEffect(() => {
    api.get("/alerts").then(({ data }) => {
      setAlerts(data.alerts || []);
      (data.alerts || []).forEach((alert) => seen.current.add(alert.id));
    }).catch(() => {});
    const stream = openSse((name, payload) => {
      if (name !== "alert" || !payload?.id) return;
      setAlerts((current) => [payload, ...current.filter((item) => item.id !== payload.id)]);
      if (!seen.current.has(payload.id)) {
        seen.current.add(payload.id);
        if (threatLevel(payload) === 1) {
          setToast(payload);
          if (audioEnabled) chime();
        }
      }
    });
    return () => stream.close();
  }, [audioEnabled]);

  const acknowledge = async (alert) => {
    const { data } = await api.put(`/alerts/${alert.id}`, { status: "ACKNOWLEDGED" });
    setAlerts((current) => [data.alert, ...current.filter((item) => item.id !== alert.id)]);
    setToast(null);
  };
  const unread = alerts.filter((alert) => alert.status === "OPEN").length;

  return (
    <div className="relative flex items-center gap-1">
      <button className={`icon-button relative ${unread ? "text-red-300" : ""}`} title="Open alerts" onClick={() => (window.location.href = "/alerts")}>
        {unread ? <BellRing size={17} /> : <Bell size={17} />}
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 h-4 grid place-items-center rounded-full bg-red-500 text-[9px] text-white ring-2 ring-night-900">{Math.min(unread, 99)}</span>}
        {unread > 0 && <span className="absolute inset-0 rounded-full bg-red-400/30 animate-ping -z-10" />}
      </button>
      <button className="icon-button" title={audioEnabled ? "Disable alert chime" : "Enable alert chime"} onClick={() => setAudioEnabled((value) => !value)}>
        {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
      {toast && (
        <aside className="fixed right-4 top-16 z-50 w-[min(24rem,calc(100vw-2rem))] border border-red-400/70 bg-slate-950/95 p-3 shadow-[0_0_32px_rgba(239,68,68,.22)] backdrop-blur-md">
          <div className="flex gap-3">
            {toast.event_id && toast.evidence_path ? <img src={evidenceUrl(toast.event_id)} className="h-16 w-24 object-cover border border-red-400/40" alt="Alert evidence" /> : <div className="h-16 w-24 grid place-items-center bg-red-500/10 border border-red-400/40"><ShieldAlert className="text-red-300" /></div>}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] tracking-[0.18em] text-red-300">LEVEL 1 · OPERATOR REVIEW</div>
              <div className="mt-1 text-sm">{toast.message}</div>
              <div className="mt-1 text-[11px] font-mono text-slate-400">{toast.camera || "SYSTEM"} · {formatTime(toast.timestamp || toast.created_at)}</div>
            </div>
            <button className="text-slate-400 hover:text-white self-start" title="Dismiss notification" onClick={() => setToast(null)}><X size={16} /></button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => acknowledge(toast)} className="tactical-button text-[11px]"><Check size={13} /> ACKNOWLEDGE</button>
            <button onClick={() => setToast(null)} className="icon-button w-auto px-2.5 text-[11px]">DISMISS</button>
            <button onClick={() => setNotice("Alarm request was not sent: follow the approved human operator procedure. No external device was activated.")} className="icon-button w-auto px-2.5 text-[11px] text-amber-300"><Zap size={13} /> REQUEST ALARM</button>
          </div>
          {notice && <p className="mt-2 text-[11px] text-amber-200">{notice}</p>}
        </aside>
      )}
    </div>
  );
}
