"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, BedDouble, IndianRupee, MessageSquareWarning, UserCheck, Users, Phone, Mail, CalendarDays } from "lucide-react";
import { api, fmtDate, fmtDateTime, money, num } from "@/lib/client";
import { Badge, Empty, PageHead, Skeleton, useSession } from "../ui";
import { BarChart, Donut, HBars } from "../charts";

const MONTH = (m: string) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m.slice(5, 7)) - 1];

function Stat({ icon, label, value, sub, tint }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; tint: string }) {
  return (
    <div className="card stat">
      <div className={`stat-icon tint-${tint}`}>{icon}</div>
      <div><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{sub && <div className="stat-sub">{sub}</div>}</div>
    </div>
  );
}

export default function DashboardView() {
  const s = useSession();
  const [d, setD] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { api("/api/dashboard").then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="form-error">{err}</div>;
  if (!d) return <><PageHead title="Dashboard" /><Skeleton rows={6} /></>;
  const hour = new Date().getHours();
  const greet = `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${s.name.split(" ")[0]}`;

  if (d.role === "RESIDENT") {
    const p = d.profile, a = d.allocation, dues = d.dues;
    return (
      <>
        <PageHead title={greet} subtitle="Here is everything about your stay at a glance." />
        <div className="grid g3">
          <div className="card hero-card">
            <div className="muted small">Your room</div>
            {a ? <><div className="big">Room {a.Room_No} · Bed {a.Bed_No}</div><div>{a.Property_Name}</div>
              <div className="chips-row"><Badge value="ACTIVE" label={`Since ${fmtDate(a.Check_In_Date)}`} /><Badge value="VERIFIED" t="blue" label={`${money(a.Rent)} / month`} /></div></>
              : <div className="big">No active allocation</div>}
          </div>
          <Stat icon={<IndianRupee size={20} />} label="Total due" tint="amber" value={money(dues?.Total_Due)} sub={Number(dues?.Overdue_Amount) > 0 ? <span className="danger-text">{money(dues.Overdue_Amount)} overdue</span> : "You are up to date"} />
          <Stat icon={<MessageSquareWarning size={20} />} label="Open complaints" tint="rose" value={d.openComplaints} sub={<Link href="/complaints">View or raise one →</Link>} />
        </div>
        <div className="grid g2">
          <div className="card"><h3 className="card-title">My details</h3>
            <dl className="kv"><dt>Name</dt><dd>{p?.Full_Name}</dd><dt>Age</dt><dd>{p?.Age}</dd><dt><Mail size={14} /> Email</dt><dd>{p?.Email}</dd><dt><Phone size={14} /> Phone</dt><dd>{p?.Phones || "—"}</dd>
              <dt><CalendarDays size={14} /> Last paid</dt><dd>{fmtDate(dues?.Last_Paid_On)}</dd></dl></div>
          <div className="card"><h3 className="card-title">Upcoming payments</h3>
            {d.nextDue.length ? <ul className="list">{d.nextDue.map((n: any) => (
              <li key={n.Payment_No}><div><b>{n.Payment_Type}</b><small className="muted"> · due {fmtDate(n.Payment_Date)}</small></div><span className="num">{money(n.Amount)}</span></li>))}</ul> : <Empty title="No pending payments" hint="Great job staying on top of your rent." />}
          </div>
        </div>
      </>
    );
  }

  const k = d.kpi; const usable = Number(k.UsableBeds) || 1;
  return (
    <>
      <PageHead title={greet} subtitle="Live overview of occupancy, collections and open issues across all properties." />
      <div className="grid g4">
        <Stat icon={<BedDouble size={20} />} label="Beds occupied" tint="indigo" value={`${k.OccupiedBeds}/${k.UsableBeds}`} sub={`${k.AvailableBeds} beds available`} />
        <Stat icon={<Users size={20} />} label="Active residents" tint="teal" value={num(k.ActiveResidents)} sub={`${k.Properties} properties`} />
        <Stat icon={<IndianRupee size={20} />} label="Collected this month" tint="green" value={money(k.CollectedThisMonth)} sub={`${money(k.PendingDues)} pending`} />
        <Stat icon={<AlertTriangle size={20} />} label="Overdue dues" tint="rose" value={money(k.OverdueDues)} sub={<Link href="/payments">Review payments →</Link>} />
      </div>

      <div className="grid g3 mt">
        <div className="card center"><h3 className="card-title left">Overall occupancy</h3><Donut value={Number(k.OccupiedBeds)} total={usable} label="beds filled" size={150} />
          <div className="muted small">{k.OpenComplaints} open complaints · {k.VisitorsInside} visitors inside</div></div>
        <div className="card span2"><h3 className="card-title">Monthly revenue <span className="legend"><i className="dot a" />Collected<i className="dot b" />Pending</span></h3>
          <BarChart data={d.revenue.map((r: any) => ({ label: MONTH(r.Month), a: Number(r.Collected), b: Number(r.Pending) }))} /></div>
      </div>

      <div className="grid g3 mt">
        <div className="card"><h3 className="card-title">Occupancy by property</h3>
          <div className="prop-list">{d.occupancy.map((o: any) => (
            <div key={o.Property_ID}><div className="row-between"><b>{o.Property_Name}</b><span className="muted small">{o.Occupied_Beds}/{Number(o.Total_Beds) - Number(o.Maintenance_Beds)} beds</span></div>
              <div className="progress"><div style={{ width: `${o.Occupancy_Pct}%` }} /></div></div>))}</div></div>
        <div className="card"><h3 className="card-title">Open complaints by priority</h3>
          {d.complaintsByPriority.length ? <HBars data={d.complaintsByPriority.map((c: any) => ({ label: c.Priority, value: Number(c.n) }))} color="var(--rose)" /> : <Empty title="No open complaints" />}</div>
        <div className="card"><h3 className="card-title">Licence alerts</h3>
          {d.licenseAlerts.length ? <ul className="list">{d.licenseAlerts.map((l: any) => (
            <li key={l.License_ID}><div><b>{l.License_Type}</b><small className="muted"> · {l.Property_Name}</small></div>
              <Badge value={l.Alert} label={l.Days_Left < 0 ? `Expired ${-l.Days_Left}d ago` : `${l.Days_Left}d left`} /></li>))}</ul> : <Empty title="All licences valid" />}</div>
      </div>

      <div className="grid g2 mt">
        <div className="card"><h3 className="card-title">Residents with highest dues</h3>
          {d.topDues.length ? <table className="data compact"><tbody>{d.topDues.map((r: any) => (
            <tr key={r.Resident_ID}><td>{r.Resident_Name}</td><td className="r num">{money(r.Total_Due)}</td><td className="r">{Number(r.Overdue_Amount) > 0 ? <Badge value="OVERDUE" /> : <Badge value="PENDING" />}</td></tr>))}</tbody></table> : <Empty title="No dues" />}</div>
        <div className="card"><h3 className="card-title">Recent activity <small className="muted">(MongoDB audit log)</small></h3>
          {d.recent.length ? <ul className="list activity">{d.recent.map((a: any) => (
            <li key={a._id}><div><b>{a.actor.username}</b> <Badge value={a.action} t="violet" /> <span className="muted">{a.entity}{a.entityId ? ` · ${a.entityId}` : ""}</span></div><small className="muted">{fmtDateTime(a.createdAt)}</small></li>))}</ul> : <Empty title="No activity yet" />}</div>
      </div>
    </>
  );
}
