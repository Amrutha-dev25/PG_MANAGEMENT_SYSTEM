"use client";
import { useCallback, useEffect, useState } from "react";
import { MessageSquarePlus, Search, Trash2 } from "lucide-react";
import { api, qs, fmtDate, fmtDateTime } from "@/lib/client";
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, PRIORITIES } from "@/lib/resources";
import { Badge, Confirm, Empty, Modal, PageHead, Pagination, Skeleton, useDebounced, useSession, useToast } from "../ui";

function NewComplaint({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const s = useSession(); const toast = useToast();
  const [residents, setResidents] = useState<any[]>([]);
  const [f, setF] = useState({ Resident_ID: "", Category: "Maintenance", Priority: "MEDIUM", Description: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (s.role !== "RESIDENT") api<any>("/api/options/resident").then((r) => setResidents(r.options)).catch(() => {}); }, [s.role]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/api/complaints", { method: "POST", body: f }); toast("Complaint filed"); onDone(); } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <Modal title="File a complaint" onClose={onClose} wide footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="nc" disabled={busy}>{busy ? "Submitting…" : "Submit"}</button></>}>
      <form id="nc" className="form-grid" onSubmit={submit}>
        {s.role !== "RESIDENT" && <div className="field span2"><label>Resident *</label><select className="input" required value={f.Resident_ID} onChange={(e) => setF({ ...f, Resident_ID: e.target.value })}><option value="">Select…</option>{residents.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>}
        <div className="field"><label>Category *</label><select className="input" value={f.Category} onChange={(e) => setF({ ...f, Category: e.target.value })}>{COMPLAINT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label>Priority</label><select className="input" value={f.Priority} onChange={(e) => setF({ ...f, Priority: e.target.value })}>{PRIORITIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field span2"><label>What is the problem? *</label><textarea className="input" rows={4} required minLength={5} maxLength={2000} value={f.Description} onChange={(e) => setF({ ...f, Description: e.target.value })} /></div>
        {err && <div className="form-error span2">{err}</div>}
      </form>
    </Modal>
  );
}

function Detail({ no, onClose, onChanged }: { no: string; onClose: () => void; onChanged: () => void }) {
  const s = useSession(); const toast = useToast(); const ops = s.role !== "RESIDENT";
  const [d, setD] = useState<any>(null); const [msg, setMsg] = useState(""); const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState(""); const [prio, setPrio] = useState("");
  const load = useCallback(() => api<any>(`/api/complaints/${no}`).then((r) => { setD(r); setStatus(r.complaint.Status); setPrio(r.complaint.Priority); }).catch((e) => toast(e.message, "error")), [no, toast]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <Modal title={`Complaint ${no}`} onClose={onClose}><Skeleton rows={4} /></Modal>;
  const c = d.complaint;
  async function comment() {
    if (!msg.trim()) return;
    try { await api(`/api/complaints/${no}/updates`, { method: "POST", body: { message: msg, internal } }); setMsg(""); setInternal(false); load(); onChanged(); } catch (e: any) { toast(e.message, "error"); }
  }
  async function save() {
    try { await api(`/api/complaints/${no}`, { method: "PATCH", body: { Status: status, Priority: prio, note: msg } }); setMsg(""); toast("Complaint updated"); load(); onChanged(); } catch (e: any) { toast(e.message, "error"); }
  }
  const changed = status !== c.Status || prio !== c.Priority;
  return (
    <Modal title={`Complaint ${no}`} onClose={onClose} wide>
      <div className="detail-head"><div><b>{c.Category}</b> · {c.Resident_Name}{c.Room_No && <span className="muted"> · {c.Property_Name}, room {c.Room_No}</span>}<div className="muted small">Filed {fmtDate(c.Date_Filed)}</div></div>
        <div className="chips-row"><Badge value={c.Priority} /><Badge value={c.Status} /></div></div>
      <p className="desc-box">{c.Description}</p>
      {ops && <div className="form-grid tight">
        <div className="field"><label>Status</label><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>{COMPLAINT_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Priority</label><select className="input" value={prio} onChange={(e) => setPrio(e.target.value)}>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>}
      <h4 className="sub-title">Timeline <small className="muted">stored in MongoDB</small></h4>
      <ul className="timeline">{d.timeline.map((t: any) => (
        <li key={t._id} className={`tl-${t.type.toLowerCase()}`}><span className="tl-dot" />
          <div><div className="tl-head"><b>{t.author.username}</b><Badge value={t.author.role} t="violet" />{t.internal && <Badge value="INTERNAL" t="amber" />}{t.toStatus && <span className="muted small">{t.fromStatus} → {t.toStatus}</span>}<small className="muted">{fmtDateTime(t.createdAt)}</small></div><p>{t.message}</p></div></li>))}</ul>
      <div className="composer"><textarea className="input" rows={2} placeholder={ops ? "Write a note or reply (also sent with a status change)…" : "Add a comment…"} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} />
        <div className="row-between">{ops ? <label className="check"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (hidden from resident)</label> : <span />}
          <div className="gap"><button className="btn ghost" onClick={comment} disabled={!msg.trim()}>Add comment</button>{ops && <button className="btn primary" onClick={save} disabled={!changed}>Save status</button>}</div></div></div>
    </Modal>
  );
}

export default function ComplaintsView() {
  const s = useSession(); const toast = useToast(); const ops = s.role !== "RESIDENT";
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [mode, setMode] = useState("none");
  const [search, setSearch] = useState(""); const q = useDebounced(search);
  const [f, setF] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true); const [err, setErr] = useState(""); const [tick, setTick] = useState(0);
  const [creating, setCreating] = useState(false); const [open, setOpen] = useState<string | null>(null); const [del, setDel] = useState<any>(null);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => { setPage(1); }, [q, f]);
  useEffect(() => {
    let alive = true; setLoading(true);
    api<any>(`/api/complaints${qs({ page, pageSize: 10, q, ...f })}`).then((r) => { if (alive) { setRows(r.rows); setTotal(r.total); setMode(r.searchMode); setErr(""); } })
      .catch((e) => alive && setErr(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [page, q, f, tick]);
  const sel = (name: string, label: string, opts: string[]) => <select className="input select" aria-label={label} value={f[name] || ""} onChange={(e) => setF({ ...f, [name]: e.target.value })}><option value="">{label}: all</option>{opts.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select>;
  async function doDelete() { try { await api(`/api/complaints/${del.Complaint_No}`, { method: "DELETE" }); toast("Complaint deleted"); setDel(null); reload(); } catch (e: any) { toast(e.message, "error"); setDel(null); } }
  return (
    <>
      <PageHead title={ops ? "Complaints" : "My Complaints"} subtitle="Complaint records live in MySQL; the conversation timeline lives in MongoDB.">
        <button className="btn primary" onClick={() => setCreating(true)}><MessageSquarePlus size={17} /> New complaint</button>
      </PageHead>
      <div className="card table-card">
        <div className="toolbar"><div className="search"><Search size={16} /><input placeholder="Search complaints (full-text)…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {sel("Status", "Status", COMPLAINT_STATUSES)}{sel("Priority", "Priority", PRIORITIES)}{sel("Category", "Category", COMPLAINT_CATEGORIES)}</div>
        {q && !loading && <div className="search-note">Search mode: {mode === "fulltext" ? "MySQL FULLTEXT (MATCH … AGAINST)" : "LIKE fallback"}</div>}
        {err ? <div className="form-error m">{err}</div> : loading && !rows.length ? <Skeleton /> : !rows.length ? <Empty title="No complaints found" hint={q ? "Try other words." : "Nothing reported — enjoy the quiet."} /> : (
          <div className={`table-wrap ${loading ? "dim" : ""}`}><table className="data"><thead><tr><th>No.</th>{ops && <th>Resident</th>}<th>Category</th><th>Description</th><th>Priority</th><th>Status</th><th>Filed</th><th className="r">Updates</th>{s.role === "ADMIN" && <th />}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.Complaint_No} className="clickable" onClick={() => setOpen(r.Complaint_No)}><td>{r.Complaint_No}</td>{ops && <td><b>{r.Resident_Name}</b><div className="muted small">{r.Property_Name ? `${r.Property_Name} · ${r.Room_No}` : ""}</div></td>}
                <td><Badge value={r.Category} /></td><td><span className="cell-text wide" title={r.Description}>{r.Description}</span></td><td><Badge value={r.Priority} /></td><td><Badge value={r.Status} /></td>
                <td>{fmtDate(r.Date_Filed)}{r.Open_Days !== null && <div className="muted small">{r.Open_Days}d open</div>}</td><td className="r num">{r.Update_Count}</td>
                {s.role === "ADMIN" && <td className="r"><button className="btn icon ghost danger-text" aria-label="Delete" onClick={(e) => { e.stopPropagation(); setDel(r); }}><Trash2 size={16} /></button></td>}</tr>))}</tbody></table></div>)}
        <Pagination page={page} pageSize={10} total={total} onPage={setPage} />
      </div>
      {creating && <NewComplaint onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} />}
      {open && <Detail no={open} onClose={() => setOpen(null)} onChanged={reload} />}
      {del && <Confirm title="Delete complaint?" message={`Complaint ${del.Complaint_No} and its MongoDB timeline will be permanently removed.`} onConfirm={doDelete} onCancel={() => setDel(null)} />}
    </>
  );
}
