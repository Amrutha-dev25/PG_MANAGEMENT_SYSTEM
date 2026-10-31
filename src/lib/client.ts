"use client";
// Browser-side helpers: API client + formatters.
export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/login")) {
    window.location.href = "/login";
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    if (data?.error) throw new Error(data.error);
    if (res.status === 404) throw new Error("This action was not found on the server (404). Stop the app, run  npm install  then  npm run dev  again.");
    if (res.status >= 500) throw new Error(`The server had a problem (${res.status}). Check the terminal running the app for details.`);
    throw new Error(`Request failed (${res.status})`);
  }
  return data as T;
}

export const qs = (o: Record<string, any>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const money = (n: any) => (n === null || n === undefined || n === "" ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
export const num = (n: any) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-IN"));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(d?: string | null) {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : d;
}
export const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "—");
export function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const monthStr = () => todayStr().slice(0, 7);
export const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function tone(v: any): string {
  const s = String(v ?? "").toUpperCase();
  if (["AVAILABLE", "PAID", "VERIFIED", "GOOD", "NEW", "ACTIVE", "RESOLVED", "COMPLETED", "LEFT", "LOW"].includes(s)) return "green";
  if (["FAILED", "REJECTED", "DAMAGED", "POOR", "URGENT", "EXPIRED", "CANCELLED", "OVERDUE"].includes(s)) return "red";
  if (["MAINTENANCE", "FAIR", "HIGH", "PENDING", "EXPIRING", "OPEN"].includes(s)) return "amber";
  if (["OCCUPIED", "IN_PROGRESS", "INSIDE", "MEDIUM", "REFUNDED"].includes(s)) return "blue";
  if (["CLOSED"].includes(s)) return "gray";
  return "violet";
}
