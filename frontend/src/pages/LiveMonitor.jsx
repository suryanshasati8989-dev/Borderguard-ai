import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "react-qr-code";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import api, { openSse, authToken } from "../services/api.js";
import {
  Camera, SwitchCamera, Maximize, BellRing,
  Smartphone, Trash2, CheckSquare, AlertTriangle,
  Wifi, Loader, Activity
} from "lucide-react";

// ─── Detection class configs ─────────────────────────────────────────────────
const PEOPLE   = ["person"];
const ANIMALS  = ["cat","dog","bird","horse","sheep","cow","elephant","bear","zebra","giraffe"];
const VEHICLES = ["car","motorcycle","bus","truck","bicycle","boat","airplane","train"];

function classifyLabel(cls) {
  const c = cls.toLowerCase();
  if (PEOPLE.some(p => c.includes(p)))   return { tier: 1, label: "HUMAN",   color: "#EF4444", bg: "rgba(239,68,68,0.15)",   tag: "LVL-1" };
  if (VEHICLES.some(v => c.includes(v))) return { tier: 2, label: "VEHICLE",  color: "#F59E0B", bg: "rgba(245,158,11,0.15)",  tag: "LVL-2" };
  if (ANIMALS.some(a => c.includes(a)))  return { tier: 3, label: "ANIMAL",   color: "#10B981", bg: "rgba(16,185,129,0.15)",  tag: "LVL-3" };
  return                                         { tier: 4, label: "OBJECT",   color: "#94A3B8", bg: "rgba(148,163,184,0.10)", tag: "OBJ"   };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const FRAME_INTERVAL_MS = 100; // push to backend ~10fps

export default function LiveMonitor() {
  // ── refs
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null); // detection + border overlay
  const captureRef = useRef(null); // hidden frame capture
  const streamRef  = useRef(null);
  const modelRef   = useRef(null);
  const rafRef     = useRef(null);
  const timerRef   = useRef(null);
  const dragging   = useRef(null);

  // ── state
  const [devices,    setDevices]    = useState([]);
  const [deviceId,   setDeviceId]   = useState("");
  const [streaming,  setStreaming]   = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [loadMsg,    setLoadMsg]    = useState("Loading AI model…");
  const [camError,   setCamError]   = useState("");
  const [detections, setDetections] = useState([]);
  const [fps,        setFps]        = useState(0);

  // ── border state (normalised 0-1)
  const [border,       setBorder]       = useState({ x1: 0.15, y1: 0.15, x2: 0.85, y2: 0.85 });
  const [borderActive, setBorderActive] = useState(true);

  // ── alert
  const [alertTier, setAlertTier] = useState(0); // 1=human,2=vehicle,3=animal
  const alertTimer = useRef(null);

  // ── DB cameras
  const [laptopCam, setLaptopCam] = useState(null);
  const [mobileCam, setMobileCam] = useState(null);

  // ── FPS tracking
  const fpsCount = useRef(0);
  const fpsTick  = useRef(performance.now());

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Load COCO-SSD model
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadMsg("Loading COCO-SSD detection model…");
    cocoSsd.load({ base: "lite_mobilenet_v2" }).then(model => {
      modelRef.current = model;
      setModelReady(true);
      setLoadMsg("");
    }).catch(e => setLoadMsg("Model load failed: " + e.message));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Fetch cameras from DB
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/cameras").then(({ data }) => {
      setLaptopCam(data.cameras.find(c => c.code === "CAM-LAPTOP") || null);
      setMobileCam(data.cameras.find(c => c.code === "CAM-MOBILE") || null);
    }).catch(() => {});
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. SSE alert listener
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const sse = openSse((name, payload) => {
      if (name === "alert") {
        const { tier } = classifyLabel(payload?.object_type || payload?.event_type || "");
        setAlertTier(tier);
        clearTimeout(alertTimer.current);
        alertTimer.current = setTimeout(() => setAlertTier(0), 6000);
      }
    });
    return () => sse.close();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Enumerate devices
  // ─────────────────────────────────────────────────────────────────────────
  const enumDevices = useCallback(async () => {
    const all  = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const cams = all.filter(d => d.kind === "videoinput");
    setDevices(cams);
    if (cams.length && !deviceId) setDeviceId(cams[0].deviceId);
  }, [deviceId]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(s => { s.getTracks().forEach(t => t.stop()); enumDevices(); })
      .catch(() => setCamError("Camera permission denied — please allow access in your browser."));
    navigator.mediaDevices.addEventListener("devicechange", enumDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", enumDevices);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Start / stop webcam
  // ─────────────────────────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreaming(false);
    setDetections([]);
    setFps(0);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startStream = useCallback(async (did) => {
    stopStream();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: did ? { deviceId: { exact: did }, width: { ideal: 1280 }, height: { ideal: 720 } } : true
      });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      enumDevices();
      setStreaming(true);
      setCamError("");
    } catch (e) {
      setCamError("Could not open camera: " + e.message);
    }
  }, [stopStream, enumDevices]);

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Detection + drawing loop (rAF)
  // ─────────────────────────────────────────────────────────────────────────
  const drawFrame = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    // Keep canvas size matched to container
    const cw = canvas.parentElement?.offsetWidth  || video.videoWidth;
    const ch = canvas.parentElement?.offsetHeight || video.videoHeight;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width  = cw;
      canvas.height = ch;
    }

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, cw, ch);

    // ── run YOLO-style detection on the video frame
    let dets = [];
    if (modelRef.current) {
      try {
        dets = await modelRef.current.detect(video);
      } catch {}
    }

    // ── compute scale factors (video may be letterboxed inside canvas)
    const vr = video.videoWidth / video.videoHeight;
    const cr = cw / ch;
    let dw, dh, dx, dy;
    if (vr > cr) { dw = cw; dh = cw / vr; dx = 0; dy = (ch - dh) / 2; }
    else         { dh = ch; dw = ch * vr; dy = 0; dx = (cw - dw) / 2; }

    const sx = dw / video.videoWidth;
    const sy = dh / video.videoHeight;

    // ── draw detections
    const filtered = dets.filter(d => d.score >= 0.5);
    filtered.forEach(({ class: cls, bbox: [bx, by, bw, bh], score }) => {
      const { label, color, bg, tag } = classifyLabel(cls);
      const x = dx + bx * sx;
      const y = dy + by * sy;
      const w = bw * sx;
      const h = bh * sy;

      // filled background box
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);

      // border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, w, h);

      // corner accents
      const cs = 12;
      ctx.lineWidth = 3;
      [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx,cy], i) => {
        ctx.beginPath();
        ctx.moveTo(cx + (i%2===0?cs:-cs), cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + (i<2?cs:-cs));
        ctx.stroke();
      });

      // label pill
      const text = `${tag}  ${label}  ${Math.round(score*100)}%`;
      ctx.font = "bold 11px monospace";
      const tw = ctx.measureText(text).width;
      const ph = 18, px = 6;
      const lx = x, ly = y > ph + 2 ? y - ph - 2 : y + h + 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(lx, ly, tw + px*2, ph, 3);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillText(text, lx + px, ly + 13);
    });

    setDetections(filtered);

    // ── update alert tier from local detections
    if (filtered.length > 0) {
      const topTier = Math.min(...filtered.map(d => classifyLabel(d.class).tier));
      setAlertTier(topTier);
      clearTimeout(alertTimer.current);
      alertTimer.current = setTimeout(() => setAlertTier(0), 3000);
    }

    // ── draw virtual border
    if (borderActive) {
      const x1 = dx + border.x1 * dw, y1 = dy + border.y1 * dh;
      const x2 = dx + border.x2 * dw, y2 = dy + border.y2 * dh;
      const bw2 = x2 - x1, bh2 = y2 - y1;

      ctx.fillStyle = "rgba(239,68,68,0.06)";
      ctx.fillRect(x1, y1, bw2, bh2);

      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 4]);
      ctx.strokeRect(x1, y1, bw2, bh2);
      ctx.setLineDash([]);

      // handle squares
      [[x1,y1],[x2,y1],[x1,y2],[x2,y2]].forEach(([hx,hy]) => {
        ctx.fillStyle = "#EF4444";
        ctx.fillRect(hx-5, hy-5, 10, 10);
      });

      ctx.fillStyle = "#EF4444";
      ctx.font = "bold 10px monospace";
      ctx.fillText("⚠ RESTRICTED ZONE", x1 + 6, y1 - 5);
    }

    // FPS counter
    fpsCount.current++;
    const now = performance.now();
    if (now - fpsTick.current >= 1000) {
      setFps(fpsCount.current);
      fpsCount.current = 0;
      fpsTick.current  = now;
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, [border, borderActive]);

  useEffect(() => {
    if (streaming && modelReady) {
      rafRef.current = requestAnimationFrame(drawFrame);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [streaming, modelReady, drawFrame]);

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Push frames to backend
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!streaming || !laptopCam) return;
    timerRef.current = setInterval(() => {
      const video  = videoRef.current;
      const canvas = captureRef.current;
      if (!video || !canvas || !video.videoWidth) return;
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return;
        const form = new FormData();
        form.append("frame", blob, "frame.jpg");
        fetch(`/api/stream/mobile_frame/${laptopCam.id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken()}` },
          body: form,
        }).catch(() => {});
      }, "image/jpeg", 0.65);
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [streaming, laptopCam]);

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Border drag logic
  // ─────────────────────────────────────────────────────────────────────────
  const normPos = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx   = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy   = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    // convert to video-normalised coords
    const video = videoRef.current;
    const cw = rect.width, ch = rect.height;
    const vr = (video?.videoWidth || cw) / (video?.videoHeight || ch);
    const cr = cw / ch;
    let dw, dh, dx, dy;
    if (vr > cr) { dw=cw; dh=cw/vr; dx=0; dy=(ch-dh)/2; }
    else          { dh=ch; dw=ch*vr; dy=0; dx=(cw-dw)/2; }
    return { nx: clamp((cx-dx)/dw,0,1), ny: clamp((cy-dy)/dh,0,1) };
  };

  const getHandle = (nx, ny) => {
    const EPS=0.04, {x1,y1,x2,y2}=border;
    if (Math.abs(nx-x1)<EPS && Math.abs(ny-y1)<EPS) return "tl";
    if (Math.abs(nx-x2)<EPS && Math.abs(ny-y1)<EPS) return "tr";
    if (Math.abs(nx-x1)<EPS && Math.abs(ny-y2)<EPS) return "bl";
    if (Math.abs(nx-x2)<EPS && Math.abs(ny-y2)<EPS) return "br";
    if (nx>x1&&nx<x2&&ny>y1&&ny<y2)                 return "move";
    return null;
  };

  const onPointerDown = e => {
    if (!borderActive) return;
    const {nx,ny} = normPos(e);
    const h = getHandle(nx,ny);
    if (h) { dragging.current={handle:h,startNx:nx,startNy:ny,orig:{...border}}; e.preventDefault(); }
  };
  const onPointerMove = e => {
    if (!dragging.current) return;
    const {handle,startNx,startNy,orig} = dragging.current;
    const {nx,ny} = normPos(e);
    const dx=nx-startNx, dy=ny-startNy;
    setBorder(prev => {
      const b={...orig};
      if(handle==="tl")  {b.x1=clamp(b.x1+dx,0,b.x2-.05);b.y1=clamp(b.y1+dy,0,b.y2-.05);}
      if(handle==="tr")  {b.x2=clamp(b.x2+dx,b.x1+.05,1);b.y1=clamp(b.y1+dy,0,b.y2-.05);}
      if(handle==="bl")  {b.x1=clamp(b.x1+dx,0,b.x2-.05);b.y2=clamp(b.y2+dy,b.y1+.05,1);}
      if(handle==="br")  {b.x2=clamp(b.x2+dx,b.x1+.05,1);b.y2=clamp(b.y2+dy,b.y1+.05,1);}
      if(handle==="move"){const w=b.x2-b.x1,h=b.y2-b.y1;b.x1=clamp(b.x1+dx,0,1-w);b.x2=b.x1+w;b.y1=clamp(b.y1+dy,0,1-h);b.y2=b.y1+h;}
      return b;
    });
    e.preventDefault();
  };
  const onPointerUp = () => { dragging.current=null; };

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Save zone to backend
  // ─────────────────────────────────────────────────────────────────────────
  const saveBorder = async () => {
    if (!laptopCam) return alert("CAM-LAPTOP not found in database.");
    try {
      const { data: zd } = await api.get(`/zones/${laptopCam.id}`);
      for (const z of (zd.zones||[])) await api.delete(`/zones/${z.id}`).catch(()=>{});
      await api.post("/zones", {
        camera_id: laptopCam.id,
        name: "VIRTUAL BORDER",
        zone_type: "restricted",
        coordinates: { points: [
          {x:border.x1,y:border.y1},{x:border.x2,y:border.y1},
          {x:border.x2,y:border.y2},{x:border.x1,y:border.y2}
        ]},
      });
      alert("✅ Virtual border saved to AI engine.");
    } catch(e) { alert("Save failed: "+e.message); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Alert banner config
  // ─────────────────────────────────────────────────────────────────────────
  const ALERT_STYLES = {
    1: { text: "🔔 HUMAN DETECTED — INTRUDER ALERT!", cls: "bg-red-600 border-red-400 text-white animate-pulse" },
    2: { text: "⚠ VEHICLE DETECTED IN ZONE",          cls: "bg-amber-500 border-amber-300 text-black animate-pulse" },
    3: { text: "🐾 ANIMAL DETECTED IN ZONE",           cls: "bg-emerald-600 border-emerald-400 text-white" },
  };
  const alertInfo = ALERT_STYLES[alertTier];

  // Build mobile URL using the actual network IP so QR code works on phones.
  // If user is on localhost, swap it for the LAN IP (10.53.243.144).
  const mobileHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "10.53.243.144"
    : window.location.hostname;
  const mobileOrigin = `${window.location.protocol}//${mobileHost}:${window.location.port}`;

  const publisherUrl = mobileCam
    ? `${mobileOrigin}/mobile-publisher?cam=${mobileCam.id}` : "";

  // detection summary counts
  const counts = { human:0, vehicle:0, animal:0, other:0 };
  detections.forEach(d => {
    const t = classifyLabel(d.class).tier;
    if(t===1) counts.human++;
    else if(t===2) counts.vehicle++;
    else if(t===3) counts.animal++;
    else counts.other++;
  });

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-wider text-white flex items-center gap-2">
            <Camera size={20} className="text-phosphor-400" />
            LIVE BORDER MONITOR
            {!modelReady && <span className="flex items-center gap-1 text-xs text-amber-400 font-normal"><Loader size={13} className="animate-spin"/>{loadMsg}</span>}
            {modelReady  && <span className="text-xs text-phosphor-400 font-mono font-normal">AI READY</span>}
          </h1>
          <p className="text-xs text-stone-500 font-mono mt-0.5">
            COCO-SSD · In-browser object detection · {fps} FPS
          </p>
        </div>
        {alertInfo && (
          <div className={`px-4 py-2 border text-sm font-mono rounded flex items-center gap-2 ${alertInfo.cls}`}>
            <BellRing size={16}/> {alertInfo.text}
          </div>
        )}
      </div>

      {camError && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-200 p-3 text-sm flex gap-2 items-center rounded">
          <AlertTriangle size={16}/> {camError}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 flex-1 min-h-0">

        {/* ── video + canvas ── */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          <div
            className="relative flex-1 bg-black border border-night-700 min-h-[55vh] overflow-hidden"
            onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
            onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
          >
            {/* raw video (hidden behind canvas) */}
            <video ref={videoRef} autoPlay playsInline muted
              className="absolute inset-0 w-full h-full object-contain" />

            {/* detection + border canvas */}
            <canvas ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ cursor: borderActive ? "crosshair" : "default" }}
              onMouseDown={onPointerDown} onTouchStart={onPointerDown}
            />

            {/* alert full-border flash */}
            {alertTier === 1 && (
              <div className="absolute inset-0 border-4 border-red-500 animate-pulse pointer-events-none rounded" />
            )}

            {/* HUD corners */}
            {["top-3 left-3 border-t-2 border-l-2","top-3 right-3 border-t-2 border-r-2",
              "bottom-3 left-3 border-b-2 border-l-2","bottom-3 right-3 border-b-2 border-r-2"].map((c,i) => (
              <div key={i} className={`absolute w-6 h-6 ${c} border-phosphor-500/40 pointer-events-none`}/>
            ))}

            {/* LIVE badge */}
            {streaming && (
              <div className="absolute top-3 left-10 flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded text-[10px] font-mono text-phosphor-400 border border-phosphor-400/30">
                <div className="w-1.5 h-1.5 rounded-full bg-phosphor-400 animate-pulse"/> LIVE · {fps}fps
              </div>
            )}

            {/* detection count badges */}
            {streaming && (
              <div className="absolute bottom-3 left-3 flex gap-2">
                {counts.human   > 0 && <Badge n={counts.human}   label="HUMAN"   color="bg-red-500" />}
                {counts.vehicle > 0 && <Badge n={counts.vehicle} label="VEHICLE"  color="bg-amber-500" />}
                {counts.animal  > 0 && <Badge n={counts.animal}  label="ANIMAL"   color="bg-emerald-500" />}
                {counts.other   > 0 && <Badge n={counts.other}   label="OBJECT"   color="bg-slate-500" />}
              </div>
            )}
          </div>

          {/* controls */}
          <div className="flex flex-wrap gap-2 p-3 bg-night-900/60 border border-night-700 rounded">
            <select
              className="tactical-input !py-1.5 !text-xs max-w-[220px]"
              value={deviceId}
              onChange={e => { setDeviceId(e.target.value); if(streaming) startStream(e.target.value); }}
            >
              {devices.length===0 && <option>No cameras found</option>}
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label||`Camera ${d.deviceId.slice(0,6)}…`}
                </option>
              ))}
            </select>

            {!streaming
              ? <button onClick={()=>startStream(deviceId)} className="tactical-button"><Camera size={14}/> START CAMERA</button>
              : <button onClick={stopStream} className="tactical-button !bg-red-500/20 border border-red-500 !text-red-300">■ STOP</button>
            }

            <div className="w-px h-6 bg-night-700 mx-1 self-center"/>

            <button onClick={()=>setBorderActive(v=>!v)} className={`tactical-button ${!borderActive?"opacity-50":""}`}>
              <CheckSquare size={14}/> {borderActive?"BORDER ON":"BORDER OFF"}
            </button>

            <button onClick={saveBorder} disabled={!laptopCam} className="tactical-button" title="Push zone to backend AI">
              <Wifi size={14}/> SAVE TO AI
            </button>

            <button onClick={()=>setBorder({x1:.15,y1:.15,x2:.85,y2:.85})} className="icon-button" title="Reset border">
              <Trash2 size={14}/>
            </button>

            <div className="flex-1"/>
            <button onClick={()=>videoRef.current?.requestFullscreen?.()} className="icon-button" title="Fullscreen">
              <Maximize size={14}/>
            </button>
          </div>
        </div>

        {/* ── sidebar ── */}
        <div className="flex flex-col gap-4">

          {/* live detections list */}
          <div className="bg-night-900/60 border border-night-700 rounded p-4 flex-1">
            <div className="text-[10px] tracking-widest text-phosphor-400 font-sans mb-3 flex items-center gap-2">
              <Activity size={12}/> LIVE DETECTIONS
            </div>
            {detections.length === 0 ? (
              <div className="text-stone-600 text-xs font-mono text-center py-6">
                {streaming ? "No objects detected" : "Camera not started"}
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {detections.map((d, i) => {
                  const { label, color, tag } = classifyLabel(d.class);
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs border border-night-700/50 px-2 py-1.5 rounded">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:color}}/>
                      <span className="font-mono" style={{color}}>{tag}</span>
                      <span className="flex-1 capitalize">{d.class}</span>
                      <span className="font-mono text-stone-400">{Math.round(d.score*100)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* virtual border coords */}
          <div className="bg-night-900/60 border border-red-500/20 rounded p-4 font-mono text-xs">
            <div className="text-[10px] tracking-widest text-red-400 font-sans mb-3">VIRTUAL BORDER</div>
            <div className="space-y-2">
              <Row label="TOP-LEFT"     value={`${(border.x1*100).toFixed(0)}% , ${(border.y1*100).toFixed(0)}%`}/>
              <Row label="BOTTOM-RIGHT" value={`${(border.x2*100).toFixed(0)}% , ${(border.y2*100).toFixed(0)}%`}/>
            </div>
            <p className="text-stone-600 text-[10px] mt-2">Drag corners to resize · drag center to move</p>
          </div>

          {/* QR mobile connect */}
          <div className="bg-night-900/60 border border-night-700 rounded p-4">
            <div className="text-[10px] tracking-widest text-phosphor-400 font-sans mb-3 flex items-center gap-2">
              <Smartphone size={12}/> CONNECT MOBILE CAMERA
            </div>
            {publisherUrl ? (
              <>
                <div className="flex justify-center mb-3">
                  <div className="bg-white p-3 rounded"><QRCode value={publisherUrl} size={130}/></div>
                </div>
                <p className="text-[11px] text-stone-400 text-center mb-2">
                  Scan to stream your phone camera as <span className="text-phosphor-400 font-mono">CAM-MOBILE</span>
                </p>
                <a href={publisherUrl} target="_blank" rel="noreferrer"
                   className="text-[10px] font-mono text-ice/50 break-all hover:text-ice block">
                  {publisherUrl}
                </a>
              </>
            ) : (
              <p className="text-xs text-stone-500 text-center py-3">CAM-MOBILE not registered in DB.</p>
            )}
          </div>
        </div>
      </div>

      {/* hidden capture canvas */}
      <canvas ref={captureRef} className="hidden"/>
    </div>
  );
}

function Badge({ n, label, color }) {
  return (
    <div className={`flex items-center gap-1 ${color} text-white text-[10px] font-mono px-2 py-0.5 rounded`}>
      {n} {label}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-night-700/40 pb-1.5">
      <span className="text-stone-500">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
