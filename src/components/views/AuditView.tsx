"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api, qs, fmtDateTime } from "@/lib/client";
import { Badge, Empty, PageHead, Pagination, Skeleton, useDebounced } from "../ui";

export default function AuditView() {
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [search, setSearch] = useState(""); const q = useDebounced(search);
  const [action, setAction] = useState(""); const [entity, setEntity] = useState(""); const [entities, setEntities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState("");
  useEffect(() => { setPage(1); }, [q, action, entity]);
  useEffect(() => {
    let alive = true; setLoading(true);
    api<any>(`/api/audit${qs({ page, q, action, entity })}`).then((r) => { if (alive) { setRows(r.rows); setTotal(r.total); setEntities(r.entities); setErr(""); } })
      .catch((e) => alive && setErr(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [page, q, action, entity]);
  return (
    <>
      <PageHead title="Audit Log" subtitle="Every sign-in and data change, stored as flexible documents in MongoDB (audit_logs)." />
      <div className="card table-card">
        <div className="toolbar"><div className="search"><Search size={16} /><input placeholder="Search user or record id…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="input select" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action"><option value="">Action: all</option>{["CREATE", "UPDATE", "DELETE", "ACTION", "LOGIN", "LOGOUT", "LOGIN_FAILED"].map((a) => <option key={a}>{a}</option>)}</select>
          <select className="input select" value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Entity"><option value="">Entity: all</option>{entities.map((a) => <option key={a}>{a}</option>)}</select></div>
        {err ? <div className="form-error m">{err}</div> : loading && !rows.length ? <Skeleton /> : !rows.length ? <Empty title="No audit entries" /> : (
          <div className={`table-wrap ${loading ? "dim" : ""}`}><table className="data"><thead><tr><th>When</th><th>User</th><th>Role</th><th>Action</th><th>Entity</th><th>Record</th><th>Details</th></tr></thead>
            <tbody>{rows.map((r) => (<tr key={r._id}><td>{fmtDateTime(r.createdAt)}</td><td><b>{r.actor.username}</b></td><td><Badge value={r.actor.role} t="violet" /></td><td><Badge value={r.action} t={r.action === "DELETE" || r.action === "LOGIN_FAILED" ? "red" : r.action === "CREATE" ? "green" : "blue"} /></td>
              <td>{r.entity}</td><td>{r.entityId || "—"}</td><td><code className="small">{r.details ? JSON.stringify(r.details) : "—"}</code></td></tr>))}</tbody></table></div>)}
        <Pagination page={page} pageSize={15} total={total} onPage={setPage} />
      </div>
    </>
  );
}
