import { useEffect, useRef, useState } from "react";
import api from "../services/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { streamUrl } from "../services/api.js";

export default function Zones() {
  const { isAdmin } = useAuth();
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState("");
  const [zones, setZones] = useState([]);
  const [tool, setTool] = useState("restricted");
  const [points, setPoints] = useState([]);
  const [line, setLine] = useState([]);
  const [name, setName] = useState("RESTRICTED ZONE");
  const [msg, setMsg] = useState("");
  const imgRef = useRef(null);

  useEffect(() => {
    api.get("/cameras").then((r) => {
      setCameras(r.data.cameras);
      if (r.data.cameras[0]) setCameraId(String(r.data.cameras[0].id));
    });
  }, []);

  useEffect(() => {
    if (!cameraId) return;
    api.get(`/zones/${cameraId}`).then((r) => setZones(r.data.zones));
  }, [cameraId]);

  const onClick = (e) => {
    if (!isAdmin || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (tool === "restricted") setPoints((p) => [...p, { x, y }]);
    else setLine((p) => (p.length >= 2 ? [{ x, y }] : [...p, { x, y }]));
  };

  const save = async () => {
    setMsg("");
    try {
      if (tool === "restricted") {
        if (points.length < 3) {
          setMsg("Draw at least 3 points for a restricted zone.");
          return;
        }
        await api.post("/zones", {
          camera_id: Number(cameraId),
          name,
          zone_type: "restricted",
          coordinates: { points },
        });
        setPoints([]);
      } else {
        if (line.length < 2) {
          setMsg("Click two points for a virtual line.");
          return;
        }
        await api.post("/zones", {
          camera_id: Number(cameraId),
          name: name || "VIRTUAL LINE",
          zone_type: "line_crossing",
          coordinates: { line: { x1: line[0].x, y1: line[0].y, x2: line[1].x, y2: line[1].y } },
        });
        setLine([]);
      }
      const { data } = await api.get(`/zones/${cameraId}`);
      setZones(data.zones);
      setMsg("Zone saved. Start Demo Mode to test intrusion / line crossing.");
    } catch (e) {
      setMsg(e.response?.data?.error || "Save failed (Administrator role required).");
    }
  };

  const remove = async (id) => {
    await api.delete(`/zones/item/${id}`);
    const { data } = await api.get(`/zones/${cameraId}`);
    setZones(data.zones);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] tracking-[0.35em] text-phosphor-400">GEOFENCE</div>
        <h1 className="text-2xl mt-1">Restricted zones & virtual lines</h1>
        <p className="text-sm text-stone-500">Administrators configure geometry. Detections inside a zone become INTRUSION_DETECTED alerts for human review.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="bg-night-800 border border-stone-700 px-3 py-2 text-sm" value={cameraId} onChange={(e) => setCameraId(e.target.value)}>
          {cameras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
        {isAdmin && (
          <>
            <button className={`px-3 py-2 text-xs ${tool === "restricted" ? "bg-phosphor-500 text-night-950" : "border border-stone-600"}`} onClick={() => setTool("restricted")}>
              Restricted polygon
            </button>
            <button className={`px-3 py-2 text-xs ${tool === "line" ? "bg-phosphor-500 text-night-950" : "border border-stone-600"}`} onClick={() => setTool("line")}>
              Virtual line
            </button>
            <input className="bg-night-800 border border-stone-700 px-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="px-3 py-2 text-xs border border-stone-600" onClick={() => { setPoints([]); setLine([]); }}>
              Clear draft
            </button>
            <button className="px-3 py-2 text-xs bg-ice text-night-950 font-semibold" onClick={save}>
              Save zone
            </button>
          </>
        )}
      </div>
      {msg && <div className="text-sm text-phosphor-400">{msg}</div>}
      <div className="relative inline-block max-w-full border border-white/10" onClick={onClick}>
        {cameraId && <img ref={imgRef} src={streamUrl(cameraId)} alt="zone canvas" className="max-w-full w-[960px]" />}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {points.length > 0 && (
            <polygon
              points={points.map((p) => `${p.x * 100}%,${p.y * 100}%`).join(" ")}
              fill="rgba(80,80,220,0.2)"
              stroke="#9aa0ff"
              strokeWidth="2"
            />
          )}
          {line.length === 2 && (
            <line x1={`${line[0].x * 100}%`} y1={`${line[0].y * 100}%`} x2={`${line[1].x * 100}%`} y2={`${line[1].y * 100}%`} stroke="#7ec8c8" strokeWidth="3" />
          )}
        </svg>
      </div>
      <div className="space-y-2">
        {zones.map((z) => (
          <div key={z.id} className="flex justify-between border border-white/5 px-3 py-2 text-sm">
            <span>
              {z.name} · {z.zone_type} · {z.enabled ? "on" : "off"}
            </span>
            {isAdmin && (
              <button className="text-red-400 text-xs" onClick={() => remove(z.id)}>
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
