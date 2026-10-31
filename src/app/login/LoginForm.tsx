"use client";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Building2, Database, Lock, ShieldCheck, User, Utensils, Wallet } from "lucide-react";
import { api } from "@/lib/client";

const DEMOS = [
  { role: "Admin", user: "admin", pass: "Admin@123" },
  { role: "Staff", user: "staff", pass: "Staff@123" },
  { role: "Resident", user: "aarav", pass: "Resident@123" },
];

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [name, setName] = useState(""); const [role, setRole] = useState("RESIDENT");
  const [residentId, setResidentId] = useState(""); const [staffId, setStaffId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (mode === "login") {
        await api("/api/auth/login", { method: "POST", body: { username, password } });
      } else {
        await api("/api/auth/register", { method: "POST", body: { username, password, name, role, residentId, staffId, accessCode } });
      }
      router.replace("/dashboard"); router.refresh();
    } catch (err: any) { setError(err.message || "Something went wrong."); setBusy(false); }
  }

  return (
    <div className="login">
      <section className="login-hero">
        <div className="orb o1" /><div className="orb o2" /><div className="orb o3" />
        <div className="hero-inner">
          <div className="brand light"><span className="brand-mark"><Building2 size={22} /></span><span><b>PG Manager</b><small>Accommodation suite</small></span></div>
          <h1>Run every PG,<br />room and resident<br />from one place.</h1>
          <p>Allocations, rent, complaints, visitors and meals — backed by MySQL for transactions and MongoDB for timelines, feedback and audit trails.</p>
          <ul className="hero-points">
            <li><ShieldCheck size={18} /> Role-based access for admins, staff and residents</li>
            <li><Wallet size={18} /> Automatic monthly rent and live dues</li>
            <li><Utensils size={18} /> Weekly menus with resident ratings</li>
            <li><Database size={18} /> SQL + NoSQL, each used where it fits best</li>
          </ul>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="muted">{mode === "login" ? "Sign in to continue to your dashboard." : "Register with the position assigned to you."}</p>
          {mode === "register" && <>
            <div className="field"><label htmlFor="role">Account position</label>
              <select id="role" className="input" value={role} onChange={e => { setRole(e.target.value); setError(""); }}>
                <option value="RESIDENT">Resident</option><option value="STAFF">Staff</option><option value="ADMIN">Admin</option>
              </select>
            </div>
            {role === "ADMIN" && <div className="field"><label htmlFor="name">Full name</label><input id="name" className="input" value={name} onChange={e => setName(e.target.value)} required /></div>}
            {role === "RESIDENT" && <div className="field"><label htmlFor="residentId">Resident ID</label><input id="residentId" className="input" placeholder="e.g. RES001" value={residentId} onChange={e => setResidentId(e.target.value)} required /></div>}
            {role === "STAFF" && <div className="field"><label htmlFor="staffId">Staff ID</label><input id="staffId" className="input" placeholder="e.g. S001" value={staffId} onChange={e => setStaffId(e.target.value)} required /></div>}
            {role !== "RESIDENT" && <div className="field"><label htmlFor="accessCode">{role === "ADMIN" ? "Administrator registration code" : "Staff registration code"}</label><input id="accessCode" className="input" type="password" value={accessCode} onChange={e => setAccessCode(e.target.value)} required /></div>}
          </>}
          <div className="field"><label htmlFor="u">Username</label>
            <div className="input-icon"><User size={17} /><input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus minLength={3} maxLength={40} /></div></div>
          <div className="field"><label htmlFor="p">Password</label>
            <div className="input-icon"><Lock size={17} /><input id="p" className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "register" ? 8 : 1} /></div>
            {mode === "register" && <small className="hint">Use at least 8 characters.</small>}
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn primary block" disabled={busy}>{busy ? (mode === "login" ? "Signing in…" : "Creating account…") : (mode === "login" ? "Sign in" : "Create account")}</button>
          <div className="demo">
            {mode === "login" ? <>
              <span>Demo accounts (click to fill)</span>
              <div>{DEMOS.map((d) => <button type="button" key={d.user} className="chip" onClick={() => { setUsername(d.user); setPassword(d.pass); }}>{d.role}</button>)}</div>
            </> : <span>Resident accounts require a valid Resident ID. Staff and Admin accounts require their registration code.</span>}
            <span>{mode === "login" ? "New to PG Manager?" : "Already have an account?"} <button type="button" className="text-link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setAccessCode(""); }}> {mode === "login" ? "Create account" : "Sign in"} </button></span>
          </div>
        </form>
      </section>
    </div>
  );
}
