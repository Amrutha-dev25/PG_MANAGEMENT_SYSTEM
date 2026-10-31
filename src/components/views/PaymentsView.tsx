"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Zap } from "lucide-react";
import { api, money, monthStr, todayStr } from "@/lib/client";
import ResourcePage from "../ResourcePage";
import { Modal, useSession, useToast, Badge } from "../ui";

function GenerateRent({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [props, setProps] = useState<any[]>([]);
  const [f, setF] = useState({ Property_ID: "", month: monthStr() });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { api<any>("/api/options/property").then((r) => setProps(r.options)).catch((e) => setErr(e.message)); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await api<any>("/api/payments/generate-rent", { method: "POST", body: f }); toast(r.created ? `${r.created} rent invoice(s) created` : "Nothing new to create — rent already generated", r.created ? "success" : "info"); onDone(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <Modal title="Generate monthly rent" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="gr" disabled={busy}>{busy ? "Generating…" : "Generate"}</button></>}>
      <p className="muted small">Creates one PENDING rent payment (due on the 5th) for every resident staying at the property that month. Safe to run twice — existing invoices are skipped.</p>
      <form id="gr" className="form-grid" onSubmit={submit}>
        <div className="field"><label>Property</label><select className="input" required value={f.Property_ID} onChange={(e) => setF({ ...f, Property_ID: e.target.value })}><option value="">Select…</option>{props.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
        <div className="field"><label>Month</label><input className="input" type="month" required value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} /></div>
        {err && <div className="form-error span2">{err}</div>}
      </form>
    </Modal>
  );
}

export default function PaymentsView() {
  const s = useSession(); const toast = useToast();
  const ops = s.role !== "RESIDENT";
  const [gen, setGen] = useState(false); const [key, setKey] = useState(0);
  const [dues, setDues] = useState<any>(null);
  useEffect(() => { if (!ops) api<any>("/api/dashboard").then((d) => setDues(d.dues)).catch(() => {}); }, [ops, key]);

  async function settle(row: any, reload: () => void) {
    try { await api(`/api/payments/${encodeURIComponent(row.Payment_No)}/settle`, { method: "POST", body: { paidOn: todayStr() } }); toast(`${row.Payment_No} marked as paid`); reload(); setKey((k) => k + 1); }
    catch (e: any) { toast(e.message, "error"); }
  }
  return (
    <>
      {!ops && dues && (
        <div className="grid g3 mb">
          <div className="card mini"><span className="muted small">Paid so far</span><b className="big-sm">{money(dues.Paid_Amount)}</b></div>
          <div className="card mini"><span className="muted small">Total due</span><b className="big-sm">{money(dues.Total_Due)}</b></div>
          <div className="card mini"><span className="muted small">Overdue</span><b className={`big-sm ${Number(dues.Overdue_Amount) > 0 ? "danger-text" : ""}`}>{money(dues.Overdue_Amount)}</b></div>
        </div>
      )}
      <ResourcePage resource="payment" reloadKey={key} subtitle={ops ? "Rent, deposits and charges. For pending items the date shown is the due date." : "Your payment history and pending dues."}
        extra={ops ? <button className="btn ghost" onClick={() => setGen(true)}><Zap size={16} /> Generate monthly rent</button> : undefined}
        rowActions={ops ? (row, reload) => (row.Payment_Status === "PENDING" || row.Payment_Status === "FAILED")
          ? <button className="btn sm ghost ok-text" onClick={() => settle(row, reload)}><CheckCircle2 size={15} /> Mark paid</button>
          : row.Is_Overdue ? <Badge value="OVERDUE" /> : null : undefined} />
      {gen && <GenerateRent onClose={() => setGen(false)} onDone={() => { setGen(false); setKey((k) => k + 1); }} />}
    </>
  );
}
