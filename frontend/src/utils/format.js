export function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour12: false })}`;
}

export function severityClass(sev) {
  const m = {
    LOW: "text-ice",
    MEDIUM: "text-amber-signal",
    HIGH: "text-orange-400",
    CRITICAL: "text-red-400",
  };
  return m[sev] || "text-stone-300";
}

export function statusDot(status) {
  if (status === "ONLINE") return "bg-phosphor-500";
  if (status === "CONNECTING") return "bg-amber-signal animate-pulse";
  if (status === "ERROR") return "bg-orange-500";
  return "bg-red-500";
}
