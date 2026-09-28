import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../services/api.js";
import { statusDot } from "../utils/format.js";

export default function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = () => api.get("/analytics").then((r) => setData(r.data));
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="text-stone-500">Loading analytics…</div>;
  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] tracking-[0.35em] text-phosphor-400">TRENDS</div>
        <h1 className="text-2xl mt-1">Analytics</h1>
        <p className="text-xs text-stone-500 mt-1">{data.disclaimer}</p>
      </div>
      <div className="grid md:grid-cols-4 gap-3 text-sm">
        <Stat l="Persons" v={k.persons_detected} />
        <Stat l="Vehicles" v={k.vehicles_detected} />
        <Stat l="Intrusions" v={k.intrusions} />
        <Stat l="Events today" v={k.events_today} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Events per hour">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.events_per_hour}>
              <CartesianGrid stroke="#1f2a24" />
              <XAxis dataKey="hour" stroke="#8a9486" fontSize={10} interval={2} />
              <YAxis stroke="#8a9486" fontSize={10} />
              <Tooltip contentStyle={{ background: "#121917", border: "1px solid #2a3a32" }} />
              <Bar dataKey="count" fill="#a8c94a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Events per day">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.events_per_day}>
              <CartesianGrid stroke="#1f2a24" />
              <XAxis dataKey="day" stroke="#8a9486" fontSize={10} />
              <YAxis stroke="#8a9486" fontSize={10} />
              <Tooltip contentStyle={{ background: "#121917", border: "1px solid #2a3a32" }} />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#7ec8c8" />
              <Line type="monotone" dataKey="persons" stroke="#a8c94a" />
              <Line type="monotone" dataKey="vehicles" stroke="#e8b86d" />
              <Line type="monotone" dataKey="intrusions" stroke="#f87171" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Events by camera">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.events_by_camera}>
              <CartesianGrid stroke="#1f2a24" />
              <XAxis dataKey="camera" stroke="#8a9486" fontSize={10} />
              <YAxis stroke="#8a9486" fontSize={10} />
              <Tooltip contentStyle={{ background: "#121917", border: "1px solid #2a3a32" }} />
              <Bar dataKey="events" fill="#7ec8c8" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Camera health / uptime snapshot">
          <div className="space-y-2 p-2">
            {data.camera_uptime.map((c) => (
              <div key={c.camera} className="flex items-center justify-between text-sm border-b border-white/5 py-1">
                <span className="font-mono">{c.camera}</span>
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${statusDot(c.status)}`} />
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function Stat({ l, v }) {
  return (
    <div className="border border-white/5 p-3 bg-night-800/50">
      <div className="text-[10px] tracking-widest text-stone-500">{l}</div>
      <div className="text-xl font-mono mt-1">{v}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="border border-white/5 bg-night-800/40 p-3">
      <div className="text-[10px] tracking-widest text-stone-500 mb-2">{title}</div>
      {children}
    </div>
  );
}
