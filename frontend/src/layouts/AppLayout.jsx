import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  Camera,
  LayoutDashboard,
  LogOut,
  MapPinned,
  MonitorPlay,
  ScanLine,
  Settings,
  Shield,
  Siren,
  Play,
  Square,
} from "lucide-react";

import { useAuth } from "../hooks/useAuth.jsx";
import { useOpsData } from "../hooks/useOpsData.js";
import api from "../services/api.js";
import { useEffect, useState } from "react";
import TacticalAlertBell from "../components/TacticalAlertBell.jsx";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/live-monitor", label: "Live Border Monitor", icon: ScanLine },
  { to: "/cameras", label: "Cameras", icon: Camera },
  { to: "/alerts", label: "Alerts", icon: Siren },
  { to: "/events", label: "Events", icon: Bell },
  { to: "/analytics", label: "Analytics", icon: Activity },
  { to: "/zones", label: "Zones", icon: MapPinned },
  { to: "/hardware", label: "Hardware Diagnostics", icon: MonitorPlay },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [demoOn, setDemoOn] = useState(false);
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(new Date());
  const { cameras } = useOpsData();
  const onlineCount = cameras.filter((camera) => camera.status === "ONLINE").length;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startDemo = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api.post("/analytics/start", { demo: true });
      setDemoOn(true);
      setMsg("Demo Mode running — detections require human verification.");
    } catch (e) {
      setMsg(e.response?.data?.error || "Could not start demo");
    } finally {
      setBusy(false);
    }
  };

  const stopDemo = async () => {
    setBusy(true);
    try {
      await api.post("/analytics/stop", {});
      setDemoOn(false);
      setMsg("Demo stopped.");
    } catch (e) {
      setMsg(e.response?.data?.error || "Could not stop demo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-night-950 text-slate-200">
      <aside className="w-[260px] shrink-0 hidden md:flex flex-col border-r border-emerald-500/15 bg-slate-950/80 backdrop-blur-md">
        <div className="px-5 py-6 border-b border-phosphor-500/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 grid place-items-center border border-phosphor-500/40 text-phosphor-400">
              <Shield size={22} />
            </div>
            <div>
              <div className="font-semibold tracking-[0.18em] text-phosphor-400 text-sm">BORDERGUARD</div>
              <div className="text-[10px] font-mono text-ice/80">AI  ·  OPS CONSOLE</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.label}
              to={l.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm tracking-wide border-l-2 ${
                  isActive && l.label !== "Live Monitoring"
                    ? "border-phosphor-500 bg-phosphor-500/10 text-phosphor-400"
                    : "border-transparent text-stone-400 hover:text-stone-100 hover:bg-white/5"
                }`
              }
            >
              <l.icon size={16} />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-phosphor-500/10 space-y-3">
          <div className="text-[11px] font-mono text-stone-500">{user?.role}</div>
          <div className="text-sm">{user?.username}</div>
          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            className="flex items-center gap-2 text-sm text-stone-400 hover:text-red-300"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-4 gap-3">
          <div className="md:hidden flex items-center gap-2 text-phosphor-400 font-semibold tracking-widest text-xs">
            <Shield size={16} /> BORDERGUARD
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px] font-mono text-slate-500">
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> SYSTEM NOMINAL</span>
            <span>{onlineCount}/{cameras.length} CAMERAS ACTIVE</span>
            <span>{now.toLocaleTimeString("en-GB", { hour12: false })}</span>
          </div>
          <div className="flex items-center gap-2">
            <TacticalAlertBell />
            <button
              disabled={busy}
              onClick={startDemo}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold tracking-wider bg-phosphor-500 text-night-950 hover:bg-phosphor-400 disabled:opacity-50"
            >
              <Play size={14} /> START DEMO
            </button>
            <button
              disabled={busy}
              onClick={stopDemo}
              className="flex items-center gap-2 px-3 py-1.5 text-xs tracking-wider border border-stone-600 hover:border-stone-400"
            >
              <Square size={12} /> EMERGENCY STOP
            </button>
          </div>
        </header>
        {msg && (
          <div className="px-4 py-2 text-xs font-mono bg-phosphor-500/10 text-phosphor-400 border-b border-phosphor-500/20">
            {msg} {demoOn ? "· LIVE PROCESSING" : ""}
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
