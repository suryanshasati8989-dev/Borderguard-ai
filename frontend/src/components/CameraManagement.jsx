import { useEffect, useRef, useState } from "react";
import { Bluetooth, Eye, Laptop, Pencil, Plus, RefreshCw, Search, Trash2, Wifi, Wrench, X } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../services/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { useWebcam } from "../hooks/useWebcam.js";
import { formatDateTime, statusDot } from "../utils/format.js";

const blank = { code: "", name: "", location: "", stream_url: "", camera_type: "mobile_stream", enabled: true };
const tabs = [["all", "All feeds"], ["webcam", "Webcams"], ["mobile", "Mobile streams"], ["rtsp", "RTSP"]];
const source = (camera) => camera.camera_type === "mobile_stream" ? "mobile" : camera.camera_type === "ip_rtsp" ? "rtsp" : "webcam";

function Action({ title, className = "", children, ...props }) {
  return <button title={title} aria-label={title} className={`icon-button ${className}`} {...props}>{children}</button>;
}

export default function CameraManagement() {
  const { isAdmin } = useAuth();
  const [cameras, setCameras] = useState([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const video = useRef(null);
  const webcam = useWebcam();

  const load = async () => {
    const { data } = await api.get("/cameras", { params: query ? { search: query } : {} });
    setCameras(data.cameras);
  };
  useEffect(() => { load().catch((err) => setError(err.response?.data?.error || err.message)); }, [query]);
  useEffect(() => { if (video.current && webcam.stream) video.current.srcObject = webcam.stream; }, [webcam.stream]);

  const openForm = (cameraType = "mobile_stream") => { setError(""); setMessage(""); setEditing(null); setForm({ ...blank, camera_type: cameraType }); setOpen(true); };
  const save = async (event) => {
    event.preventDefault(); setError("");
    try {
      if (editing) await api.put(`/cameras/${editing}`, form); else await api.post("/cameras", form);
      setMessage(editing ? "Feed updated." : "Feed saved. Test it before starting analytics.");
      setOpen(false); setEditing(null); setForm(blank); await load();
    } catch (err) { setError(err.response?.data?.error || "Could not save this feed."); }
  };
  const test = async (camera) => {
    setError(""); setMessage("Testing stream…");
    try { const { data } = await api.post(`/cameras/${camera.id}/test`); setMessage(data.message); } catch (err) { setError(err.response?.data?.message || err.response?.data?.error || "Stream test failed."); }
  };
  const edit = (camera) => { setEditing(camera.id); setForm({ code: camera.code, name: camera.name, location: camera.location, stream_url: "", camera_type: camera.camera_type, enabled: camera.enabled }); setOpen(true); };
  const toggle = async (camera) => { await api.put(`/cameras/${camera.id}`, { enabled: !camera.enabled }); await load(); };
  const remove = async (camera) => { if (window.confirm(`Remove ${camera.name}?`)) { await api.delete(`/cameras/${camera.id}`); await load(); } };
  const filtered = cameras.filter((camera) => tab === "all" || source(camera) === tab);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="hud-label">ASSET CONTROL / VIDEO SENSORS</div><h1 className="mt-1 text-2xl text-slate-100">Camera management</h1><p className="mt-1 text-sm text-slate-500">Configure authorized inputs. Stream credentials remain server-side and are redacted here.</p></div>{isAdmin && <button onClick={() => openForm()} className="tactical-button"><Plus size={15} /> ADD VIDEO SOURCE</button>}</div>

    <section className="glass-panel p-3 md:p-4"><div className="flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between"><div className="flex flex-wrap gap-1 border-b border-slate-800 xl:border-0">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 text-xs tracking-wide border-b-2 ${tab === id ? "border-emerald-400 text-emerald-300 bg-emerald-400/5" : "border-transparent text-slate-500 hover:text-slate-200"}`}>{label}</button>)}</div><label className="relative block max-w-sm w-full"><Search size={15} className="absolute left-3 top-2.5 text-slate-500" /><input className="tactical-input pl-9" placeholder="Search camera, location, ID" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div></section>

    {isAdmin && <section className="grid lg:grid-cols-3 gap-3"><button onClick={async () => { if (await webcam.startWebcam()) setMessage("Integrated camera preview is active in this browser. Server analytics requires a network stream."); }} className="source-card text-left"><Laptop className="text-sky-300" /><div><div className="font-medium">Use integrated camera</div><p>Browser WebRTC preview</p></div></button><button onClick={() => openForm("mobile_stream")} className="source-card text-left"><Wifi className="text-emerald-300" /><div><div className="font-medium">Connect mobile stream</div><p>RTSP or HTTP-MJPEG over Wi‑Fi</p></div></button><button onClick={webcam.scanBluetooth} className="source-card text-left"><Bluetooth className="text-violet-300" /><div><div className="font-medium">{webcam.scanningBluetooth ? "Scanning nearby devices…" : "Scan Bluetooth devices"}</div><p>{webcam.bluetoothSupported ? "Discovery only; video stays RTSP/MJPEG" : "Web Bluetooth unavailable in this browser"}</p></div></button></section>}
    {(message || error || webcam.webcamError || webcam.bluetoothError) && <div className={`glass-panel p-3 text-sm ${error || webcam.webcamError || webcam.bluetoothError ? "text-red-300" : "text-emerald-300"}`}>{error || webcam.webcamError || webcam.bluetoothError || message}</div>}
    {webcam.bluetoothDevice && <div className="glass-panel p-3 text-sm text-violet-200">Nearby device found: <strong>{webcam.bluetoothDevice.name}</strong>. Bluetooth does not transport camera video; paste that device’s RTSP/MJPEG URL in Mobile streams.</div>}
    {webcam.stream && <section className="glass-panel p-4 max-w-2xl"><div className="flex justify-between gap-3 mb-3"><div><div className="hud-label">LOCAL WEBRTC PREVIEW</div><p className="text-xs text-slate-500 mt-1">This feed stays in the browser. Server analytics requires a network camera stream.</p></div><Action title="Stop integrated camera" onClick={webcam.stopWebcam}><X size={16} /></Action></div><video ref={video} className="w-full aspect-video bg-black object-cover hud-reticle" autoPlay muted playsInline /></section>}

    <section className="glass-panel overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[840px] text-sm"><thead className="bg-slate-950/70 text-[10px] tracking-[0.14em] text-slate-500"><tr>{["CAMERA", "SOURCE", "LOCATION", "STATUS", "LAST ACTIVE", "STREAM", "ACTIONS"].map((heading) => <th key={heading} className="px-4 py-3 text-left font-medium">{heading}</th>)}</tr></thead><tbody>{filtered.map((camera) => <tr key={camera.id} className="border-t border-slate-800/80 hover:bg-emerald-400/[.025]"><td className="px-4 py-3"><div className="font-mono text-xs text-emerald-300">{camera.code}</div><div className="mt-1 text-slate-100">{camera.name}</div></td><td className="px-4 py-3"><span className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] uppercase text-slate-400">{camera.camera_type}</span></td><td className="px-4 py-3 text-slate-400">{camera.location || "—"}</td><td className="px-4 py-3"><span className="flex items-center gap-2 text-xs"><i className={`h-2 w-2 rounded-full ${statusDot(camera.status)}`} />{camera.status}</span></td><td className="px-4 py-3 text-xs font-mono text-slate-500">{formatDateTime(camera.last_active_at)}</td><td className="max-w-52 truncate px-4 py-3 text-[11px] font-mono text-slate-500">{camera.stream_url_redacted || "LOCAL / DEMO"}</td><td className="px-4 py-3"><div className="flex items-center gap-1 whitespace-nowrap"><Link to={`/cameras/${camera.id}`}><span className="icon-button" title="View camera"><Eye size={15} /></span></Link><Action title="Test stream" onClick={() => test(camera)}><Wrench size={15} /></Action>{isAdmin && <><Action title="Edit camera" onClick={() => edit(camera)}><Pencil size={15} /></Action><Action title={camera.enabled ? "Disable camera" : "Enable camera"} onClick={() => toggle(camera)}><RefreshCw size={15} /></Action><Action title="Delete camera" className="hover:text-red-300" onClick={() => remove(camera)}><Trash2 size={15} /></Action></>}</div></td></tr>)}{filtered.length === 0 && <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">No camera feeds match this view.</td></tr>}</tbody></table></div></section>

    {open && <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={save} className="glass-panel w-full max-w-2xl p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><div className="hud-label">{editing ? "EDIT VIDEO SOURCE" : "CONNECT VIDEO SOURCE"}</div><h2 className="mt-1 text-xl">{form.camera_type === "mobile_stream" ? "Mobile camera feed" : "Camera configuration"}</h2></div><Action title="Close" type="button" onClick={() => setOpen(false)}><X size={18} /></Action></div><div className="mt-5 grid md:grid-cols-2 gap-3"><Field label="Camera ID" value={form.code} onChange={(value) => setForm({ ...form, code: value })} /><Field label="Display name" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Field label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} /><label className="field-label">Source type<select className="tactical-input mt-1" value={form.camera_type} onChange={(event) => setForm({ ...form, camera_type: event.target.value })}><option value="mobile_stream">Mobile stream (RTSP/MJPEG)</option><option value="ip_rtsp">RTSP camera</option><option value="demo_file">Demo feed</option></select></label><label className="field-label md:col-span-2">Stream URL{form.camera_type !== "demo_file" && " (RTSP or HTTP-MJPEG)"}<input className="tactical-input mt-1" value={form.stream_url} onChange={(event) => setForm({ ...form, stream_url: event.target.value })} placeholder="rtsp://192.168.1.24:8554/stream or http://192.168.1.24:8080/mjpeg" autoComplete="off" required={form.camera_type === "mobile_stream" && !editing} /></label></div><p className="mt-3 text-xs text-slate-500">For phone feeds, keep both devices on the same Wi‑Fi. Credentials are not displayed after saving.</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="icon-button w-auto px-3" onClick={() => setOpen(false)}>CANCEL</button><button className="tactical-button">{editing ? "SAVE CHANGES" : "SAVE FEED"}</button></div></form></div>}
  </div>;
}

function Field({ label, value, onChange, required = false }) {
  return <label className="field-label">{label}<input required={required} className="tactical-input mt-1" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
