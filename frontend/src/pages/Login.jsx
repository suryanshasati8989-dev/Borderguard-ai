import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";

export default function Login() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (token) {
    navigate("/dashboard", { replace: true });
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-night-950">
      <div className="relative hidden md:flex flex-col justify-between p-10 border-r border-phosphor-500/15 overflow-hidden">
        <div className="absolute inset-0 opacity-40 scanlines" />
        <div>
          <div className="flex items-center gap-3 text-phosphor-400">
            <Shield />
            <span className="tracking-[0.35em] text-sm">BORDERGUARD AI</span>
          </div>
          <h1 className="mt-16 text-4xl font-semibold leading-tight text-stone-100 max-w-md">
            AI-Based Intelligent Video Analytics Platform for Border Surveillance
          </h1>
          <p className="mt-6 max-w-md text-stone-400 text-sm leading-relaxed">
            Converts authorized CCTV and demo feeds into detections, tracks, intrusion alerts and
            event history. Every AI result is an alert for a human operator — not an autonomous
            decision.
          </p>
        </div>
        <p className="text-[11px] font-mono text-stone-600">
          Hackathon prototype · Existing CCTV infrastructure · Human-in-the-loop
        </p>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <div className="text-xs tracking-[0.3em] text-phosphor-400">OPERATOR ACCESS</div>
            <h2 className="text-2xl mt-2">Sign in</h2>
          </div>
          <label className="block text-sm">
            Username
            <input
              className="mt-1 w-full bg-night-800 border border-stone-700 px-3 py-2 outline-none focus:border-phosphor-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              className="mt-1 w-full bg-night-800 border border-stone-700 px-3 py-2 outline-none focus:border-phosphor-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button
            disabled={busy}
            className="w-full py-2.5 bg-phosphor-500 text-night-950 font-semibold tracking-widest text-sm disabled:opacity-50"
          >
            {busy ? "AUTHENTICATING…" : "LOGIN"}
          </button>
          <p className="text-[11px] text-stone-500 leading-relaxed">
            Accounts are created from environment variables on first start. Credentials are never
            hardcoded in the application source.
          </p>
        </form>
      </div>
    </div>
  );
}
