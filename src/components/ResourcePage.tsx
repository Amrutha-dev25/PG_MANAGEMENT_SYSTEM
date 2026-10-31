"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, ArrowUpDown } from "lucide-react";
import { api, qs, money, num, fmtDate, fmtTime } from "@/lib/client";
import { RESOURCES, can, type Column, type Resource } from "@/lib/resources";
import { Badge, Confirm, Empty, Modal, PageHead, Pagination, Skeleton, useSession, useToast, useDebounced } from "./ui";
import { FieldInput } from "./FormFields";


export function renderCell(col: Column, row: any): React.ReactNode {
  const v = row[col.key];
  switch (col.kind) {
    case "money": return <span className="num">{money(v)}</span>;
    case "date": return v ? fmtDate(v) : <span className="muted">—</span>;
    case "time": return fmtTime(v);
    case "number": return <span className="num">{num(v)}</span>;
    case "badge": return <Badge value={v} />;
    case "pct": return `${v}%`;
    case "days": {
      if (v === null || v === undefined) return "—";
      const d = Number(v);
      return d < 0 ? <Badge value="EXPIRED" label={`Expired ${-d}d ago`} /> : d <= 60 ? <Badge value="EXPIRING" label={`${d} days left`} /> : <Badge value="ACTIVE" label="Valid" />;
    }
    default: return v === null || v === undefined || v === "" ? <span className="muted">—</span> : <span className="cell-text" title={String(v)}>{String(v)}</span>;
  }
}

export function ResourceForm({ res, initial, onDone, onClose }: { res: Resource; initial?: any; onDone: () => void; onClose: () => void }) {
  const session = useSession();
  const toast = useToast();
  const editing = !!initial;
  const fields = res.fields.filter((f) => (!editing || !f.createOnly) && (!f.adminOnly || session.role === "ADMIN"));
  const [values, setValues] = useState<Record<string, any>>(() => {
    const v: Record<string, any> = {};
    for (const f of fields) v[f.name] = initial?.[f.name] ?? (f.type === "tags" || f.type === "multiref" ? [] : f.type === "boolean" ? true : "");
    return v;
  });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const set = (name: string, v: any) => setValues((x) => {
    const next = { ...x, [name]: v };
    // changing a parent select clears dependent selects (e.g. property -> supervisor)
    for (const f of fields) if (f.ref?.dependsOn === name) next[f.name] = "";
    return next;
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const body: Record<string, any> = {};
      for (const f of fields) body[f.name] = values[f.name];
      if (editing) await api(`/api/r/${res.key}/${encodeURIComponent(initial.__id)}`, { method: "PUT", body });
      else await api(`/api/r/${res.key}`, { method: "POST", body });
      toast(`${res.singular} ${editing ? "updated" : "created"}`);
      onDone();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={`${editing ? "Edit" : "New"} ${res.singular.toLowerCase()}`} onClose={onClose} wide
      footer={<><button className="btn ghost" type="button" onClick={onClose}>Cancel</button><button className="btn primary" form="resform" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create"}</button></>}>
      <form id="resform" onSubmit={submit} className="form-grid">
        {fields.map((f) => <FieldInput key={f.name} field={f} values={values} set={set} disabled={editing && f.readOnlyOnEdit} />)}
        {error && <div className="form-error span2" role="alert">{error}</div>}
      </form>
    </Modal>
  );
}

interface Props {
  resource: string;
  extra?: React.ReactNode;                              // buttons next to "New"
  rowActions?: (row: any, reload: () => void) => React.ReactNode;
  reloadKey?: number;
  hideCreate?: boolean;
  subtitle?: string;
}

export default function ResourcePage({ resource, extra, rowActions, reloadKey = 0, hideCreate, subtitle }: Props) {
  const res = RESOURCES[resource];
  const session = useSession();
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1); const pageSize = 10;
  const [search, setSearch] = useState(""); const q = useDebounced(search);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [form, setForm] = useState<{ initial?: any } | null>(null);
  const [del, setDel] = useState<any>(null);
  const [filterOpts, setFilterOpts] = useState<Record<string, { value: string; label: string }[]>>({});
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  const columns = res.columns.filter((c) => !c.adminOnly || session.role === "ADMIN");
  const canCreate = !hideCreate && can(res, "create", session.role);
  const canEdit = can(res, "update", session.role), canDelete = can(res, "delete", session.role);

  useEffect(() => {
    for (const f of res.filters) if (f.ref && session.role !== "RESIDENT")
      api<{ options: any[] }>(`/api/options/${f.ref}`).then((r) => setFilterOpts((o) => ({ ...o, [f.name]: r.options }))).catch(() => {});
  }, [res, session.role]);

  useEffect(() => { setPage(1); }, [q, filters, sort]);
  useEffect(() => {
    let alive = true; setLoading(true);
    api<any>(`/api/r/${resource}${qs({ page, pageSize, q, ...filters, sort: sort?.key, dir: sort?.dir })}`)
      .then((r) => { if (alive) { setRows(r.rows); setTotal(r.total); setError(""); } })
      .catch((e) => alive && setError(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [resource, page, q, filters, sort, tick, reloadKey]);

  async function openEdit(row: any) {
    try { setForm({ initial: await api(`/api/r/${resource}/${encodeURIComponent(row.__id)}`) }); }
    catch (e: any) { toast(e.message, "error"); }
  }
  async function doDelete() {
    try { await api(`/api/r/${resource}/${encodeURIComponent(del.__id)}`, { method: "DELETE" }); toast(`${res.singular} deleted`); setDel(null); reload(); }
    catch (e: any) { toast(e.message, "error"); setDel(null); }
  }
  const toggleSort = (key: string) => setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  const hasActions = canEdit || canDelete || !!rowActions;
  const delLabel = useMemo(() => del ? columns.slice(1, 3).map((c) => del[c.key]).filter(Boolean).join(" · ") || del.__id : "", [del, columns]);

  return (
    <>
      <PageHead title={res.title} subtitle={subtitle ?? res.description}>
        {extra}
        {canCreate && <button className="btn primary" onClick={() => setForm({})}><Plus size={17} /> New {res.singular.toLowerCase()}</button>}
      </PageHead>

      <div className="card table-card">
        <div className="toolbar">
          <div className="search"><Search size={16} /><input placeholder={`Search ${res.title.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" /></div>
          {res.filters.map((f) => (
            <select key={f.name} className="input select" aria-label={f.label} value={filters[f.name] || ""}
              onChange={(e) => setFilters((x) => ({ ...x, [f.name]: e.target.value }))}>
              <option value="">{f.label}: all</option>
              {(f.options ? f.options.map((o) => ({ value: o, label: o.replace(/_/g, " ") })) : filterOpts[f.name] || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
        </div>

        {error ? <div className="form-error m">{error}</div> : loading && !rows.length ? <Skeleton /> : !rows.length ? <Empty title={`No ${res.title.toLowerCase()} found`} hint={q || Object.values(filters).some(Boolean) ? "Try a different search or filter." : canCreate ? `Create the first ${res.singular.toLowerCase()}.` : undefined} /> : (
          <div className={`table-wrap ${loading ? "dim" : ""}`}>
            <table className="data">
              <thead><tr>
                {columns.map((c) => (
                  <th key={c.key} className={c.kind === "money" || c.kind === "number" ? "r" : ""}>
                    {c.sortable ? <button className="th-sort" onClick={() => toggleSort(c.key)}>{c.label}<ArrowUpDown size={13} className={sort?.key === c.key ? "on" : ""} /></button> : c.label}
                  </th>
                ))}
                {hasActions && <th className="r">Actions</th>}
              </tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.__id}>
                    {columns.map((c) => <td key={c.key} className={c.kind === "money" || c.kind === "number" ? "r" : ""}>{renderCell(c, row)}</td>)}
                    {hasActions && (
                      <td className="r actions">
                        {rowActions?.(row, reload)}
                        {canEdit && <button className="btn icon ghost" title="Edit" aria-label="Edit" onClick={() => openEdit(row)}><Pencil size={16} /></button>}
                        {canDelete && <button className="btn icon ghost danger-text" title="Delete" aria-label="Delete" onClick={() => setDel(row)}><Trash2 size={16} /></button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
      </div>

      {form && <ResourceForm res={res} initial={form.initial} onClose={() => setForm(null)} onDone={() => { setForm(null); reload(); }} />}
      {del && <Confirm title={`Delete ${res.singular.toLowerCase()}?`} message={`“${delLabel}” will be permanently removed. This cannot be undone.`} onConfirm={doDelete} onCancel={() => setDel(null)} />}
    </>
  );
}
