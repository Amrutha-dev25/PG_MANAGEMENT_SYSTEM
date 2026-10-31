"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, Plus, Star, Trash2 } from "lucide-react";
import { api, qs, fmtDate, fmtDateTime, fmtTime } from "@/lib/client";
import { RESOURCES } from "@/lib/resources";
import { Badge, Confirm, Empty, Modal, PageHead, Skeleton, Stars, useSession, useToast } from "../ui";
import { ResourceForm } from "../ResourcePage";

const TAGS = ["tasty", "fresh", "average", "cold", "oily", "undercooked", "variety"];

function Rate({ menu, onClose, onDone }: { menu: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState<number>(menu.myRating || 0); const [comment, setComment] = useState(""); const [tags, setTags] = useState<string[]>([]); const [err, setErr] = useState("");
  async function submit() {
    if (!rating) { setErr("Choose a star rating."); return; }
    try { await api(`/api/menus/${menu.Menu_ID}/feedback`, { method: "POST", body: { rating, comment, tags } }); toast("Thanks for your feedback!"); onDone(); } catch (e: any) { setErr(e.message); }
  }
  return (
    <Modal title={`Rate ${menu.Meal_Type.toLowerCase()} · ${fmtDate(menu.Menu_Date)}`} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit}>Submit</button></>}>
      <div className="center"><Stars value={rating} onChange={setRating} size={34} /></div>
      <div className="chip-grid mt">{TAGS.map((t) => <button type="button" key={t} className={`chip ${tags.includes(t) ? "on" : ""}`} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>)}</div>
      <div className="field mt"><label>Comment (optional)</label><textarea className="input" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
      {err && <div className="form-error">{err}</div>}
    </Modal>
  );
}

function Reviews({ menu, onClose }: { menu: any; onClose: () => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api<any>(`/api/menus/${menu.Menu_ID}/feedback`).then((r) => setRows(r.feedback)).catch(() => setRows([])); }, [menu.Menu_ID]);
  return (
    <Modal title={`Reviews · ${menu.Meal_Type.toLowerCase()} · ${fmtDate(menu.Menu_Date)}`} onClose={onClose}>
      {!rows ? <Skeleton rows={3} /> : !rows.length ? <Empty title="No reviews yet" /> : <ul className="list">{rows.map((r) => (
        <li key={r._id}><div><Stars value={r.rating} size={14} /> <b>{r.residentId}</b><div>{r.comment || <span className="muted">No comment</span>}</div><div className="chips-row">{(r.tags || []).map((t: string) => <Badge key={t} value={t} t="violet" />)}</div></div><small className="muted">{fmtDateTime(r.createdAt)}</small></li>))}</ul>}
    </Modal>
  );
}

function AddDish({ menu, onClose, onDone }: { menu: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [foods, setFoods] = useState<any[]>([]); const [f, setF] = useState({ Food_Item_ID: "", Quantity: "1" }); const [err, setErr] = useState("");
  useEffect(() => { api<any>("/api/options/food_item").then((r) => setFoods(r.options)).catch(() => {}); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await api("/api/r/menu_item", { method: "POST", body: { Menu_ID: menu.Menu_ID, ...f } }); toast("Dish added"); onDone(); } catch (x: any) { setErr(x.message); }
  }
  return (
    <Modal title="Add dish to menu" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="ad">Add</button></>}>
      <form id="ad" className="form-grid" onSubmit={submit}>
        <div className="field span2"><label>Dish *</label><select className="input" required value={f.Food_Item_ID} onChange={(e) => setF({ ...f, Food_Item_ID: e.target.value })}><option value="">Select…</option>{foods.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="field"><label>Quantity per resident *</label><input className="input" type="number" min="0.5" step="0.5" required value={f.Quantity} onChange={(e) => setF({ ...f, Quantity: e.target.value })} /></div>
        {err && <div className="form-error span2">{err}</div>}
      </form>
    </Modal>
  );
}

export default function MenusView() {
  const s = useSession(); const toast = useToast(); const ops = s.role !== "RESIDENT";
  const [data, setData] = useState<any>(null); const [date, setDate] = useState(""); const [property, setProperty] = useState("");
  const [props, setProps] = useState<any[]>([]); const [err, setErr] = useState(""); const [tick, setTick] = useState(0);
  const [modal, setModal] = useState<any>(null);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => { if (ops) api<any>("/api/options/property").then((r) => setProps(r.options)).catch(() => {}); }, [ops]);
  useEffect(() => { api<any>(`/api/menus${qs({ date, Property_ID: property })}`).then((r) => { setData(r); setErr(""); if (!date) setDate(r.date); }).catch((e) => setErr(e.message)); }, [date, property, tick]);
  if (err) return <div className="form-error">{err}</div>;
  if (!data) return <><PageHead title="Meal Menus" /><Skeleton rows={4} /></>;
  const idx = data.dates.indexOf(data.date);
  const go = (d: number) => { const n = data.dates[idx + d]; if (n) setDate(n); };
  const groups: Record<string, any[]> = {}; for (const m of data.menus) (groups[m.Property_Name] ||= []).push(m);
  async function rmItem(m: any, it: any) { try { await api(`/api/r/menu_item/${encodeURIComponent(`${m.Menu_ID}~${it.Menu_Item_No}`)}`, { method: "DELETE" }); reload(); } catch (e: any) { toast(e.message, "error"); } }
  async function rmMenu() { try { await api(`/api/r/menu/${modal.menu.Menu_ID}`, { method: "DELETE" }); toast("Menu deleted"); setModal(null); reload(); } catch (e: any) { toast(e.message, "error"); setModal(null); } }
  return (
    <>
      <PageHead title="Meal Menus" subtitle="Dishes live in MySQL; resident ratings and comments are stored and averaged in MongoDB.">
        {ops && <button className="btn primary" onClick={() => setModal({ type: "new" })}><Plus size={17} /> New menu</button>}
      </PageHead>
      <div className="card toolbar date-bar">
        <button className="btn icon ghost" onClick={() => go(1)} disabled={idx >= data.dates.length - 1} aria-label="Previous day"><ChevronLeft size={18} /></button>
        <select className="input select" value={data.date} onChange={(e) => setDate(e.target.value)} aria-label="Date">{data.dates.map((d: string) => <option key={d} value={d}>{fmtDate(d)}</option>)}</select>
        <button className="btn icon ghost" onClick={() => go(-1)} disabled={idx <= 0} aria-label="Next day"><ChevronRight size={18} /></button>
        {ops && <select className="input select" value={property} onChange={(e) => setProperty(e.target.value)} aria-label="Property"><option value="">All properties</option>{props.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>}
      </div>
      {!data.menus.length ? <Empty title="No menus for this date" hint={ops ? "Use “New menu” to plan a meal." : undefined} /> : Object.entries(groups).map(([name, menus]) => (
        <section key={name} className="mt"><h3 className="group-title">{name}</h3>
          <div className="grid g2">{menus.map((m) => (
            <div key={m.Menu_ID} className="card menu-card">
              <div className="row-between"><div><b className="meal">{m.Meal_Type}</b><span className="muted small"> · {fmtTime(m.Meal_Time)}</span></div>
                <div className="rating">{m.avgRating ? <><Star size={15} fill="currentColor" /> <b>{m.avgRating}</b><span className="muted small"> ({m.ratingCount})</span></> : <span className="muted small">No ratings yet</span>}</div></div>
              {m.items.length ? <ul className="dishes">{m.items.map((it: any) => (
                <li key={it.Menu_Item_No}><span>{it.Food_Name}</span><span className="muted small">{Number(it.Quantity)} {it.Unit}</span>{ops && <button className="btn icon ghost danger-text tiny" aria-label="Remove dish" onClick={() => rmItem(m, it)}><Trash2 size={13} /></button>}</li>))}</ul> : <div className="muted small pad">No dishes added yet.</div>}
              <div className="row-between menu-actions">
                {s.role === "RESIDENT" ? <button className="btn sm ghost" onClick={() => setModal({ type: "rate", menu: m })}><Star size={14} /> {m.myRating ? `Your rating: ${m.myRating}★ · change` : "Rate this meal"}</button>
                  : <button className="btn sm ghost" onClick={() => setModal({ type: "reviews", menu: m })}><MessageCircle size={14} /> Reviews</button>}
                {ops && <div className="gap"><button className="btn sm ghost" onClick={() => setModal({ type: "dish", menu: m })}><Plus size={14} /> Dish</button><button className="btn icon ghost danger-text" aria-label="Delete menu" onClick={() => setModal({ type: "delmenu", menu: m })}><Trash2 size={15} /></button></div>}
              </div>
            </div>))}</div></section>))}
      {modal?.type === "new" && <ResourceForm res={RESOURCES.menu} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal?.type === "rate" && <Rate menu={modal.menu} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal?.type === "reviews" && <Reviews menu={modal.menu} onClose={() => setModal(null)} />}
      {modal?.type === "dish" && <AddDish menu={modal.menu} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal?.type === "delmenu" && <Confirm title="Delete menu?" message={`This ${modal.menu.Meal_Type.toLowerCase()} menu, its dishes and its ratings (MongoDB) will be removed.`} onConfirm={rmMenu} onCancel={() => setModal(null)} />}
    </>
  );
}
