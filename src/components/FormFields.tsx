"use client";
import React, { useEffect, useState } from "react";
import { api, qs } from "@/lib/client";
import type { Field } from "@/lib/resources";

type Opt = { value: string; label: string };

/** Loads dropdown options for a `ref` / `multiref` field (re-loads when the field it depends on changes). */
function useOptions(field: Field, values: Record<string, any>) {
  const [opts, setOpts] = useState<Opt[]>([]);
  const dep = field.ref?.dependsOn ? values[field.ref.dependsOn] : undefined;
  useEffect(() => {
    if (!field.ref) return;
    let alive = true;
    const params = field.ref.dependsOn && dep ? { [field.ref.dependsOn]: dep } : {};
    api<{ options: Opt[] }>(`/api/options/${field.ref.resource}${qs(params)}`).then((r) => alive && setOpts(r.options)).catch(() => alive && setOpts([]));
    return () => { alive = false; };
  }, [field.ref?.resource, field.ref?.dependsOn, dep]);
  return opts;
}

export function FieldInput({ field, values, set, disabled }: { field: Field; values: Record<string, any>; set: (name: string, v: any) => void; disabled?: boolean }) {
  const v = values[field.name];
  const opts = useOptions(field, values);
  const [tagText, setTagText] = useState("");
  const id = `f_${field.name}`;
  const common = { id, disabled, required: field.required, maxLength: field.maxLength };

  let control: React.ReactNode;
  switch (field.type) {
    case "textarea":
      control = <textarea {...common} className="input" rows={3} value={v ?? ""} onChange={(e) => set(field.name, e.target.value)} />; break;
    case "select": {
      const options = field.options || [];
      const extra = v && !options.includes(v) ? [v] : [];
      control = (
        <select {...common} className="input" value={v ?? ""} onChange={(e) => set(field.name, e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
          {extra.map((o: string) => <option key={o} value={o} disabled>{o} (system managed)</option>)}
        </select>
      ); break;
    }
    case "ref":
      control = (
        <select {...common} className="input" value={v ?? ""} onChange={(e) => set(field.name, e.target.value)}>
          <option value="">{field.required ? "Select…" : "None"}</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ); break;
    case "multiref": {
      const sel: string[] = Array.isArray(v) ? v : [];
      control = (
        <div className="chip-grid">
          {opts.map((o) => {
            const on = sel.includes(o.value);
            return <button type="button" key={o.value} disabled={disabled} className={`chip ${on ? "on" : ""}`} onClick={() => set(field.name, on ? sel.filter((x) => x !== o.value) : [...sel, o.value])}>{o.label}</button>;
          })}
        </div>
      ); break;
    }
    case "tags": {
      const tags: string[] = Array.isArray(v) ? v : [];
      const add = () => { const t = tagText.trim(); if (t && !tags.includes(t)) set(field.name, [...tags, t]); setTagText(""); };
      control = (
        <div className="tags-input">
          {tags.map((t) => <span key={t} className="chip on">{t}<button type="button" onClick={() => set(field.name, tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>×</button></span>)}
          <input id={id} value={tagText} placeholder={field.placeholder || "Type and press Enter"} disabled={disabled}
            onChange={(e) => setTagText(e.target.value)} onBlur={add}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} />
        </div>
      ); break;
    }
    case "boolean":
      control = <label className="switch"><input id={id} type="checkbox" checked={!!v} disabled={disabled} onChange={(e) => set(field.name, e.target.checked)} /><span className="slider" /><span>{v ? "Yes" : "No"}</span></label>; break;
    case "number": case "money":
      control = <input {...common} className="input" type="number" inputMode="decimal" step={field.type === "money" ? "0.01" : field.name === "Quantity" ? "0.5" : "1"} min={field.min} max={field.max} value={v ?? ""} onChange={(e) => set(field.name, e.target.value)} />; break;
    case "date": control = <input {...common} className="input" type="date" value={v ?? ""} onChange={(e) => set(field.name, e.target.value)} />; break;
    case "time": control = <input {...common} className="input" type="time" value={(v ?? "").slice(0, 5)} onChange={(e) => set(field.name, e.target.value)} />; break;
    case "email": control = <input {...common} className="input" type="email" autoComplete="off" value={v ?? ""} onChange={(e) => set(field.name, e.target.value)} />; break;
    default:
      control = <input {...common} className="input" type="text" placeholder={field.placeholder} pattern={field.pattern} title={field.patternMsg} autoComplete="off" value={v ?? ""} onChange={(e) => set(field.name, e.target.value)} />;
  }
  return (
    <div className={`field ${field.type === "textarea" || field.type === "multiref" || field.type === "tags" ? "span2" : ""}`}>
      <label htmlFor={id}>{field.label}{field.required && <b className="req"> *</b>}</label>
      {control}
      {field.hint && <small className="hint">{field.hint}</small>}
    </div>
  );
}
