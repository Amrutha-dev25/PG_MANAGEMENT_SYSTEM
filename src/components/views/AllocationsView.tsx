"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, LogOut, Plus, Search, XCircle } from "lucide-react";
import { api, qs, fmtDate, money, todayStr } from "@/lib/client";
import { Badge, Confirm, Empty, Modal, PageHead, Pagination, Skeleton, useDebounced, useSession, useToast } from "../ui";

type Opt = { value: string; label: string; Property_ID?: string };

function BedPicker({ roomId, value, onChange }: { roomId: string; value: string; onChange: (v: string) => void }) {
  const [beds, setBeds] = useState<any[]>([]);
  useEffect(() => { if (!roomId) { setBeds([]); return; } api<any>(`/api/allocations/options${qs({ room: roomId })}`).then((r) => setBeds(r.beds)).catch(() => setBeds([])); }, [roomId]);
  return (
    <select className="input" required value={value} onChange={(e) => onChange(e.target.value)} disabled={!roomId}>
      <option value="">{roomId ? "Select bed…" : "Choose a room first"}</option>
      {beds.map((b) => <option key={b.Bed_No} value={b.Bed_No}>Bed {b.Bed_No} · {b.Bed_Type}</option>)}
    </select>
  );
}

function AllocateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [opts, setOpts] = useState<{ residents: Opt[]; rooms: Opt[] }>({ residents: [], rooms: [] });
  const [f, setF] = useState({ Resident_ID: "", Room_ID: "", Bed_No: "", Check_In_Date: todayStr(), Check_Out_Date: "", Remarks: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { api<any>("/api/allocations/options").then(setOpts).catch((e) => setErr(e.message)); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/api/allocations", { method: "POST", body: f }); toast("Resident checked in"); onDone(); } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <Modal title="Allocate a bed" onClose={onClose} wide footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="allocform" disabled={busy}>{busy ? "Allocating…" : "Check in"}</button></>}>
      <form id="allocform" className="form-grid" onSubmit={submit}>
        <div className="field span2"><label>Resident <b className="req">*</b></label>
          <select className="input" required value={f.Resident_ID} onChange={(e) => setF({ ...f, Resident_ID: e.target.value })}><option value="">Select resident without a bed…</option>{opts.residents.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="field span2"><label>Room <b className="req">*</b></label>
          <select className="input" required value={f.Room_ID} onChange={(e) => setF({ ...f, Room_ID: e.target.value, Bed_No: "" })}><option value="">Select room with free beds…</option>{opts.rooms.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="field"><label>Bed <b className="req">*</b></label><BedPicker roomId={f.Room_ID} value={f.Bed_No} onChange={(v) => setF({ ...f, Bed_No: v })} /></div>
        <div className="field"><label>Check-in date <b className="req">*</b></label><input className="input" type="date" required value={f.Check_In_Date} onChange={(e) => setF({ ...f, Check_In_Date: e.target.value })} /></div>
        <div className="field"><label>Expected check-out</label><input className="input" type="date" value={f.Check_Out_Date} onChange={(e) => setF({ ...f, Check_Out_Date: e.target.value })} /></div>
        <div className="field span2"><label>Remarks</label><input className="input" maxLength={500} value={f.Remarks} onChange={(e) => setF({ ...f, Remarks: e.target.value })} /></div>
        {err && <div className="form-error span2">{err}</div>}
      </form>
    </Modal>
  );
}

function TransferModal({ row, onClose, onDone }: { row: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [rooms, setRooms] = useState<Opt[]>([]);
  const [f, setF] = useState({ Room_ID: "", Bed_No: "", Date: todayStr(), Remarks: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { api<any>("/api/allocations/options").then((r) => setRooms(r.rooms)).catch((e) => setErr(e.message)); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/api/allocations/transfer", { method: "POST", body: { ...f, Allocation_No: row.Allocation_No } }); toast("Resident transferred"); onDone(); } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <Modal title={`Transfer ${row.Resident_Name}`} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="tf" disabled={busy}>{busy ? "Transferring…" : "Transfer"}</button></>}>
      <p className="muted small">Currently in {row.Property_Name}, room {row.Room_No}, bed {row.Bed_No}. The old allocation is closed and a new one opened in a single database transaction.</p>
      <form id="tf" className="form-grid" onSubmit={submit}>
        <div className="field span2"><label>New room</label><select className="input" required value={f.Room_ID} onChange={(e) => setF({ ...f, Room_ID: e.target.value, Bed_No: "" })}><option value="">Select…</option>{rooms.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="field"><label>Bed</label><BedPicker roomId={f.Room_ID} value={f.Bed_No} onChange={(v) => setF({ ...f, Bed_No: v })} /></div>
        <div className="field"><label>Transfer date</label><input className="input" type="date" required min={row.Check_In_Date} value={f.Date} onChange={(e) => setF({ ...f, Date: e.target.value })} /></div>
        {err && <div className="form-error span2">{err}</div>}
      </form>
    </Modal>
  );
}

export default function AllocationsView() {
  const s = useSession(); const toast = useToast();
  const ops = s.role !== "RESIDENT";
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [search, setSearch] = useState(""); const q = useDebounced(search);
  const [status, setStatus] = useState(""); const [property, setProperty] = useState("");
  const [props, setProps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState(""); const [tick, setTick] = useState(0);
  const [modal, setModal] = useState<null | "new" | { type: "transfer" | "out" | "cancel"; row: any }>(null);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => { if (ops) api<any>("/api/options/property").then((r) => setProps(r.options)).catch(() => {}); }, [ops]);
  useEffect(() => { setPage(1); }, [q, status, property]);
  useEffect(() => {
    let alive = true; setLoading(true);
    api<any>(`/api/allocations${qs({ page, pageSize: 10, q, Allocation_Status: status, Property_ID: property })}`)
      .then((r) => { if (alive) { setRows(r.rows); setTotal(r.total); setErr(""); } }).catch((e) => alive && setErr(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [page, q, status, property, tick]);

  async function close(row: any, st: "COMPLETED" | "CANCELLED") {
    try { await api(`/api/allocations/${row.Allocation_No}/close`, { method: "POST", body: { status: st, date: todayStr() > row.Check_In_Date ? todayStr() : row.Check_In_Date } }); toast(st === "COMPLETED" ? "Resident checked out — bed is free again" : "Allocation cancelled"); setModal(null); reload(); }
    catch (e: any) { toast(e.message, "error"); setModal(null); }
  }

  return (
    <>
      <PageHead title={ops ? "Allocations" : "My Stay"} subtitle={ops ? "Check residents in, transfer them between beds and check them out. Every action runs as an atomic MySQL transaction." : "Your current and past stays."}>
        {ops && <button className="btn primary" onClick={() => setModal("new")}><Plus size={17} /> Allocate bed</button>}
      </PageHead>
      <div className="card table-card">
        <div className="toolbar">
          <div className="search"><Search size={16} /><input placeholder="Search resident, room, property…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="input select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Status: all</option><option>ACTIVE</option><option>COMPLETED</option><option>CANCELLED</option></select>
          {ops && <select className="input select" value={property} onChange={(e) => setProperty(e.target.value)} aria-label="Property"><option value="">Property: all</option>{props.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>}
        </div>
        {err ? <div className="form-error m">{err}</div> : loading && !rows.length ? <Skeleton /> : !rows.length ? <Empty title="No allocations found" /> : (
          <div className={`table-wrap ${loading ? "dim" : ""}`}><table className="data"><thead><tr>
            <th>No.</th><th>Resident</th><th>Property</th><th>Room · Bed</th><th className="r">Rent</th><th>Check-in</th><th>Check-out</th><th>Status</th>{ops && <th className="r">Actions</th>}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.Allocation_No}><td>{r.Allocation_No}</td><td><b>{r.Resident_Name}</b></td><td>{r.Property_Name}</td><td>{r.Room_No} · Bed {r.Bed_No}</td>
                <td className="r num">{money(r.Rent)}</td><td>{fmtDate(r.Check_In_Date)}</td><td>{fmtDate(r.Check_Out_Date)}</td><td><Badge value={r.Allocation_Status} /></td>
                {ops && <td className="r actions">{r.Allocation_Status === "ACTIVE" && <>
                  <button className="btn sm ghost" onClick={() => setModal({ type: "transfer", row: r })}><ArrowRightLeft size={14} /> Transfer</button>
                  <button className="btn sm ghost" onClick={() => setModal({ type: "out", row: r })}><LogOut size={14} /> Check out</button>
                  <button className="btn icon ghost danger-text" title="Cancel allocation" aria-label="Cancel allocation" onClick={() => setModal({ type: "cancel", row: r })}><XCircle size={16} /></button></>}</td>}
              </tr>))}</tbody></table></div>)}
        <Pagination page={page} pageSize={10} total={total} onPage={setPage} />
      </div>
      {modal === "new" && <AllocateModal onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal && typeof modal === "object" && modal.type === "transfer" && <TransferModal row={modal.row} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal && typeof modal === "object" && modal.type === "out" && <Confirm danger={false} confirmLabel="Check out" title="Check out resident?" message={`${modal.row.Resident_Name} will be checked out of room ${modal.row.Room_No}, bed ${modal.row.Bed_No} today and the bed becomes available.`} onConfirm={() => close(modal.row, "COMPLETED")} onCancel={() => setModal(null)} />}
      {modal && typeof modal === "object" && modal.type === "cancel" && <Confirm confirmLabel="Cancel allocation" title="Cancel this allocation?" message={`The allocation ${modal.row.Allocation_No} for ${modal.row.Resident_Name} will be marked CANCELLED and the bed freed.`} onConfirm={() => close(modal.row, "CANCELLED")} onCancel={() => setModal(null)} />}
    </>
  );
}
