import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { streamUrl } from "../services/api.js";
import { formatDateTime, statusDot } from "../utils/format.js";
import { useAuth } from "../hooks/useAuth.jsx";
import PhoneStreamModal from "../components/PhoneStreamModal.jsx";

export default function CameraDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [cam, setCam] = useState(null);
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState("");
  const [streamMode, setStreamMode] = useState("rgb");
  const [showQr, setShowQr] = useState(false);

  const load = async () => {
    const { data } = await api.get("/cameras");
    const found = data.cameras.find((c) => String(c.id) === String(id));
    setCam(found);
    if (found) {
      const ev = await api.get("/events", { params: { camera: found.code } });
      setEvents(ev.data.events.slice(0, 20));
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  if (!cam) return <div className="text-stone-500">Loading camera…</div>;

  const start = async () => {
    await api.post("/analytics/start", { demo: false, camera_id: cam.id });
    setMsg("Analytics started for this camera.");
    await load();
  };
  const stop = async () => {
    await api.post("/analytics/stop", { camera_id: cam.id });
    setMsg("Analytics stopped.");
    await load();
  };

  return (
    <div className="space-y-5">
      <Link to="/cameras" className="text-xs text-ice">
        ← Cameras
      </Link>
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <div className="font-mono text-phosphor-400">{cam.code}</div>
          <h1 className="text-2xl">{cam.name}</h1>
          <div className="text-sm text-stone-500">{cam.location}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDot(cam.status)}`} />
          <span className="text-xs mr-2">{cam.status}</span>
          
          <div className="flex gap-1 border border-night-700 bg-night-900/50 p-1 rounded-sm">
            <button title="Start Analytics" onClick={start} className="p-1.5 text-stone-400 hover:text-phosphor-400 transition" disabled={cam.status === 'ONLINE'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            <button title="Kill Stream" onClick={stop} className="p-1.5 text-stone-400 hover:text-alert-flash transition" disabled={cam.status !== 'ONLINE' && cam.status !== 'CONNECTING'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
            </button>
            <button title="Analytics Diagnostics" className="p-1.5 text-stone-400 hover:text-ice transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            </button>
            {(cam.camera_type === 'mobile_browser' || cam.camera_type === 'mobile_stream') && (
              <button title="Connect Mobile Phone" onClick={() => setShowQr(true)} className="p-1.5 text-stone-400 hover:text-amber-signal transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
              </button>
            )}
          </div>
        </div>
      </div>
      {msg && <div className="text-xs text-phosphor-400">{msg}</div>}
      
      {showQr && <PhoneStreamModal camera={cam} onClose={() => setShowQr(false)} />}
      
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-black border border-night-700 aspect-video relative scanlines group">
          <img src={streamUrl(cam.id)} alt="live" className={`w-full h-full object-contain ${streamMode === 'thermal' ? 'sepia hue-rotate-90 saturate-200' : streamMode === 'nvg' ? 'brightness-150 contrast-125 sepia hue-rotate-90' : ''}`} />
          
          {/* HUD Overlays */}
          <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-phosphor-400/50"></div>
          <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-phosphor-400/50"></div>
          <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-phosphor-400/50"></div>
          <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-phosphor-400/50"></div>
          
          <div className="absolute top-3 right-4 flex gap-2">
            <span className="text-[10px] font-mono text-phosphor-400 bg-black/60 px-1.5 py-0.5 border border-phosphor-400/30">FPS: 15</span>
            <span className="text-[10px] font-mono text-phosphor-400 bg-black/60 px-1.5 py-0.5 border border-phosphor-400/30">960x540</span>
          </div>

          <div className="absolute bottom-3 right-3 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-night-900/80 p-1 border border-night-700 rounded-sm">
            <div className="text-[9px] tracking-widest text-stone-500 mb-1 px-1">STREAM MODE</div>
            <button onClick={() => setStreamMode('rgb')} className={`text-[10px] px-2 py-1 text-left ${streamMode === 'rgb' ? 'text-phosphor-400 bg-phosphor-400/10' : 'text-stone-400 hover:text-stone-200'}`}>NORMAL RGB</button>
            <button onClick={() => setStreamMode('thermal')} className={`text-[10px] px-2 py-1 text-left ${streamMode === 'thermal' ? 'text-amber-signal bg-amber-signal/10' : 'text-stone-400 hover:text-stone-200'}`}>THERMAL OVERLAY</button>
            <button onClick={() => setStreamMode('nvg')} className={`text-[10px] px-2 py-1 text-left ${streamMode === 'nvg' ? 'text-ice bg-ice/10' : 'text-stone-400 hover:text-stone-200'}`}>NIGHT-VISION</button>
          </div>
        </div>
        <div className="space-y-2 text-sm border border-white/5 p-4 bg-night-800/50">
          <Row k="Type" v={cam.camera_type} />
          <Row k="Enabled" v={cam.enabled ? "Yes" : "No"} />
          <Row k="Detections" v={cam.detection_count} />
          <Row k="Created" v={formatDateTime(cam.created_at)} />
          <Row k="Last active" v={formatDateTime(cam.last_active_at)} />
          <Row k="Stream" v={cam.stream_url_redacted || "demo / synthetic"} />
          {isAdmin && (
            <Link to="/zones" className="block text-ice text-xs mt-3">
              Configure restricted zones →
            </Link>
          )}
          <p className="text-[11px] text-stone-500 pt-3">
            Bounding boxes and IDs are decision-support overlays. Operators must verify every event.
          </p>
        </div>
      </div>
      <div>
        <h2 className="text-sm tracking-widest text-stone-500 mb-2">RECENT EVENTS</h2>
        <div className="space-y-1">
          {events.map((e) => (
            <Link key={e.id} to="/events" className="block text-sm border border-white/5 px-3 py-2 hover:border-phosphor-500/30">
              <span className="font-mono text-xs text-stone-500 mr-2">{e.event_id}</span>
              {e.event_type} · {e.object_type} · ID {e.tracking_id} · {Math.round((e.confidence || 0) * 100)}%
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-stone-500">{k}</span>
      <span className="font-mono text-xs">{String(v)}</span>
    </div>
  );
}
