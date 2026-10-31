"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/client";
import { Badge, PageHead, Skeleton } from "../ui";
import { HBars } from "../charts";

const Card = ({ title, concept, children, db = "MySQL" }: { title: string; concept: string; children: React.ReactNode; db?: string }) => (
  <div className="card"><div className="row-between"><h3 className="card-title">{title}</h3><span className={`concept ${db === "MongoDB" ? "mongo" : ""}`}>{db} · {concept}</span></div>{children}</div>
);
const T = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => (
  <table className="data compact"><thead><tr>{head.map((h, i) => <th key={h} className={i > 0 ? "r" : ""}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 ? "r num" : ""}>{c}</td>)}</tr>)}</tbody></table>
);

export default function ReportsView() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { api("/api/reports").then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="form-error">{err}</div>;
  if (!d) return <><PageHead title="Reports" /><Skeleton rows={6} /></>;
  return (
    <>
      <PageHead title="Reports & Analytics" subtitle="Each card names the database concept behind it — handy for the viva." />
      <div className="grid g2">
        <Card title="Occupancy by property" concept="VIEW + FUNCTION"><T head={["Property", "Beds", "Occupied", "Occupancy"]} rows={d.occupancy.map((o: any) => [o.Property_Name, o.Total_Beds, o.Occupied_Beds, `${o.Occupancy_Pct}%`])} /></Card>
        <Card title="Rent by room type" concept="GROUP BY + AVG/MIN/MAX"><T head={["Type", "Rooms", "Avg", "Min", "Max"]} rows={d.roomTypeRent.map((r: any) => [r.Room_Type, r.Rooms, money(r.Avg_Rent), money(r.Min_Rent), money(r.Max_Rent)])} /></Card>
        <Card title="Complaints by category" concept="GROUP BY + HAVING"><T head={["Category", "Total", "Open", "High/Urgent"]} rows={d.complaintsByCategory.map((r: any) => [r.Category, r.Total, r.Open_Count, r.Urgent_Count])} /></Card>
        <Card title="Dues above the average" concept="SUBQUERY">{d.duesAboveAverage.length ? <T head={["Resident", "Total due"]} rows={d.duesAboveAverage.map((r: any) => [r.Resident_Name, money(r.Total_Due)])} /> : <p className="muted">No one is above the average.</p>}</Card>
        <Card title="Top payers" concept="WINDOW FUNCTION RANK()"><T head={["Resident", "Paid", "Rank"]} rows={d.topPayers.map((r: any) => [r.Resident_Name, money(r.Paid_Amount), `#${r.Rank_No}`])} /></Card>
        <Card title="Payroll per property" concept="LEFT JOIN + SUM"><T head={["Property", "Staff", "Monthly payroll"]} rows={d.staffPerProperty.map((r: any) => [r.Property_Name, r.Staff, money(r.Monthly_Payroll)])} /></Card>
        <Card title="Residents by home city" concept="GROUP BY + HAVING + LIMIT"><HBars data={d.residentsByCity.map((r: any) => ({ label: r.City, value: Number(r.Residents) }))} /></Card>
        <Card title="Average meal rating" concept="aggregation $group / $avg" db="MongoDB"><T head={["Property", "Meal", "Avg ★", "Reviews"]} rows={d.ratingByMeal.map((r: any) => [r.propertyId, r.mealType, r.avgRating, r.reviews])} /></Card>
        <Card title="Most used feedback tags" concept="$unwind + $group" db="MongoDB"><HBars color="var(--violet)" data={d.topTags.map((t: any) => ({ label: t.tag, value: t.count }))} /></Card>
        <Card title="Complaint resolution time" concept="MongoDB events + MySQL join" db="MongoDB">{d.resolutionByCategory.length ? <T head={["Category", "Avg days", "Resolved"]} rows={d.resolutionByCategory.map((r: any) => [r.category, r.avgDays, r.resolved])} /> : <p className="muted">No resolved complaints yet.</p>}</Card>
        <Card title="System activity" concept="$group by role/action" db="MongoDB"><T head={["Role", "Action", "Events"]} rows={d.activityByAction.map((r: any) => [r.role, <Badge key={r.action} value={r.action} t="violet" />, num(r.count)])} /></Card>
      </div>
    </>
  );
}
