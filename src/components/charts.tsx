"use client";
// Tiny dependency-free SVG charts.
import { money } from "@/lib/client";

export function Donut({ value, total, label, size = 132, color = "var(--primary)" }: { value: number; total: number; label?: string; size?: number; color?: string }) {
  const r = 52, c = 2 * Math.PI * r; const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 132 132" role="img" aria-label={`${Math.round(pct * 100)} percent`}>
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--track)" strokeWidth="14" />
      <circle cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 66 66)" style={{ transition: "stroke-dasharray .8s ease" }} />
      <text x="66" y="66" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--text)">{Math.round(pct * 100)}%</text>
      {label && <text x="66" y="86" textAnchor="middle" fontSize="10.5" fill="var(--muted)">{label}</text>}
    </svg>
  );
}

export function BarChart({ data, height = 190, format = money }: { data: { label: string; a: number; b?: number }[]; height?: number; format?: (n: number) => string }) {
  const w = 460, pad = 28, max = Math.max(1, ...data.map((d) => Math.max(d.a, d.b ?? 0)));
  const bw = (w - pad * 2) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" role="img" className="barchart">
      {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={pad} x2={w - 8} y1={height - 28 - (height - 52) * g} y2={height - 28 - (height - 52) * g} stroke="var(--border)" strokeDasharray="3 4" />)}
      {data.map((d, i) => {
        const x = pad + i * bw, h1 = ((height - 52) * d.a) / max, h2 = ((height - 52) * (d.b ?? 0)) / max;
        return (
          <g key={d.label}>
            <rect x={x + bw * 0.14} y={height - 28 - h1} width={bw * 0.34} height={h1} rx="5" fill="var(--primary)"><title>{`${d.label}: ${format(d.a)}`}</title></rect>
            {d.b !== undefined && <rect x={x + bw * 0.5} y={height - 28 - h2} width={bw * 0.34} height={h2} rx="5" fill="var(--warn)"><title>{`${d.label} pending: ${format(d.b)}`}</title></rect>}
            <text x={x + bw / 2} y={height - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({ data, color = "var(--primary)", format = (n: number) => String(n) }: { data: { label: string; value: number }[]; color?: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hbars">
      {data.map((d) => (
        <div key={d.label} className="hbar">
          <span className="hbar-label">{d.label}</span>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: color }} /></div>
          <span className="hbar-val">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}
