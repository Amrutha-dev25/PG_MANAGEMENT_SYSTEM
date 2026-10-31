"use client";
import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Plus, Search, Trash2 } from "lucide-react";
import { api, qs, fmtDate, fmtTime } from "@/lib/client";
import { ID_TYPES } from "@/lib/resources";
import { Badge, Confirm, Empty, Modal, PageHead, Pagination, Skeleton, useDebounced, useSession, useToast } from "../ui";

function Register({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [residents, setResidents] = useState<any[]>([]);
  const [f, setF] = useState({ Name: "", ID_Type: "Aadhaar", ID_Number: "", phone: "", Resident_ID: "", Purpose: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { api<any>("/api/options/resident").then((r) => setResidents(r.options)).catch(() => {}); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/api/visitors", { method: "POST", body: { ...f, phones: f.phone ? [f.phone] : [] } }); toast("Visitor checked in"); onDone(); } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <Modal title="Register a visitor" onClose={onClose} wide footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="rv" disabled={busy}>{busy ? "Saving…" : "Check in visitor"}</button></>}>
      <p className="muted small">A returning visitor (same ID type + number) is recognised automatically and not duplicated.</p>
      <form id="rv" className="form-grid" onSubmit={submit}>
        <div className="field"><label>Visitor name *</label><input className="input" required maxLength={120} value={f.Name} onChange={(e) => setF({ ...f, Name: e.target.value })} /></div>
        <div className="field"><label>Phone</label><input className="input" inputMode="numeric" placeholder="10 digits" pattern="([+]91)?[0-9]{10}" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div className="field"><label>ID type *</label><select className="input" value={f.ID_Type} onChange={(e) => setF({ ...f, ID_Type: e.target.value })}>{ID_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field"><label>ID number *</label><input className="input" required maxLength={80} value={f.ID_Number} onChange={(e) => setF({ ...f, ID_Number: e.target.value })} /></div>
        <div className="field span2"><label>Visiting resident *</label><select className="input" required value={f.Resident_ID} onChange={(e) => setF({ ...f, Resident_ID: e.target.value })}><option value="">Select…</option>{residents.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
        <div className="field span2"><label>Purpose *</label><input className="input" required maxLength={250} value={f.Purpose} onChange={(e) => setF({ ...f, Purpose: e.target.value })} /></div>
        {err && <div className="form-error span2">{err}</div>}
      </form>
    </Modal>
  );
}

export default function VisitorsView() {
  const s = useSession(); const toast = useToast(); const ops = s.role !== "RESIDENT";
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [search, setSearch] = useState(""); const q = useDebounced(search); const [st, setSt] = useState("");
  const [loading, setLoading] = useState(true); const [err, setErr] = useState(""); const [tick, setTick] = useState(0);
  const [reg, setReg] = useState(false); const [del, setDel] = useState<any>(null);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => { setPage(1); }, [q, st]);
  useEffect(() => {
    let alive = true; setLoading(true);
    api<any>(`/api/visitors${qs({ page, pageSize: 10, q, Visit_Status: st })}`).then((r) => { if (alive) { setRows(r.rows); setTotal(r.total); setErr(""); } })
      .catch((e) => alive && setErr(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [page, q, st, tick]);
  async function out(r: any) { try { await api(`/api/visitors/${r.Log_No}/checkout`, { method: "POST" }); toast(`${r.Visitor_Name} checked out`); reload(); } catch (e: any) { toast(e.message, "error"); } }
  async function doDelete() { try { await api(`/api/visitors/${del.Log_No}`, { method: "DELETE" }); toast("Log deleted"); setDel(null); reload(); } catch (e: any) { toast(e.message, "error"); setDel(null); } }
  return (
    <>
      <PageHead title="Visitors" subtitle={ops ? "Gate register: who is visiting whom, with check-in and check-out times." : "People who have visited you."}>
        {ops && <button className="btn primary" onClick={() => setReg(true)}><Plus size={17} /> Register visitor</button>}
      </PageHead>
      <div className="card table-card">
        <div className="toolbar"><div className="search"><Search size={16} /><input placeholder="Search visitor, resident, phone…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="input select" value={st} onChange={(e) => setSt(e.target.value)} aria-label="Status"><option value="">Status: all</option><option value="INSIDE">Inside now</option><option value="LEFT">Left</option></select></div>
        {err ? <div className="form-error m">{err}</div> : loading && !rows.length ? <Skeleton /> : !rows.length ? <Empty title="No visits found" /> : (
          <div className={`table-wrap ${loading ? "dim" : ""}`}><table className="data"><thead><tr><th>Log</th><th>Visitor</th><th>Visiting</th><th>Date</th><th>In</th><th>Out</th><th>Purpose</th><th>Status</th>{ops && <th className="r">Actions</th>}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.Log_No}><td>{r.Log_No}</td><td><b>{r.Visitor_Name}</b><div className="muted small">{r.ID_Type} · {r.Phones || "no phone"}</div></td><td>{r.Visiting}</td><td>{fmtDate(r.Visit_Date)}</td><td>{fmtTime(r.In_Time)}</td><td>{fmtTime(r.Out_Time)}</td>
                <td><span className="cell-text" title={r.Purpose}>{r.Purpose}</span></td><td><Badge value={r.Visit_Status} /></td>
                {ops && <td className="r actions">{r.Visit_Status === "INSIDE" && <button className="btn sm ghost" onClick={() => out(r)}><DoorOpen size={14} /> Check out</button>}
                  {s.role === "ADMIN" && <button className="btn icon ghost danger-text" aria-label="Delete" onClick={() => setDel(r)}><Trash2 size={16} /></button>}</td>}</tr>))}</tbody></table></div>)}
        <Pagination page={page} pageSize={10} total={total} onPage={setPage} />
      </div>
      {reg && <Register onClose={() => setReg(false)} onDone={() => { setReg(false); reload(); }} />}
      {del && <Confirm title="Delete visit log?" message={`Log ${del.Log_No} will be permanently removed.`} onConfirm={doDelete} onCancel={() => setDel(null)} />}
    </>
  );
}
