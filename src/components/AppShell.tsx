"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { LogOut, Menu as MenuIcon, Moon, Sun } from "lucide-react";
import { NAV } from "@/lib/nav";
import { api } from "@/lib/client";
import { Avatar, Icon, SessionProvider, ToastProvider, type SessionUser } from "./ui";

export default function AppShell({ session, children }: { session: SessionUser; children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === "dark"); }, []);
  useEffect(() => setOpen(false), [path]);

  function toggleTheme() {
    const next = !dark; setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("pg-theme", next ? "dark" : "light"); } catch { /* ignore */ }
  }
  async function logout() { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); router.replace("/login"); router.refresh(); }

  return (
    <SessionProvider value={session}>
      <ToastProvider>
        <div className="shell">
          {open && <div className="scrim" onClick={() => setOpen(false)} />}
          <aside className={`sidebar ${open ? "open" : ""}`}>
            <Link href="/dashboard" className="brand">
              <span className="brand-mark"><Icon name="home" size={20} /></span>
              <span><b>PG Manager</b><small>Accommodation suite</small></span>
            </Link>
            <nav aria-label="Main">
              {NAV.map((sec) => {
                const items = sec.items.filter((i) => i.roles.includes(session.role));
                if (!items.length) return null;
                return (
                  <div key={sec.title} className="nav-section">
                    <div className="nav-title">{sec.title}</div>
                    {items.map((i) => (
                      <Link key={i.href} href={i.href} className={`nav-link ${path === i.href || path.startsWith(i.href + "/") ? "active" : ""}`}>
                        <Icon name={i.icon} size={18} /><span>{i.labels?.[session.role] ?? i.label}</span>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </nav>
            <div className="user-card">
              <Avatar name={session.name} />
              <div><b>{session.name}</b><small>{session.role === "ADMIN" ? "Administrator" : session.role === "STAFF" ? "Staff" : "Resident"}</small></div>
              <button className="btn icon ghost" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
            </div>
          </aside>
          <div className="main">
            <header className="topbar">
              <button className="btn icon ghost menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><MenuIcon size={20} /></button>
              <div className="topbar-spacer" />
              <span className={`role-pill role-${session.role.toLowerCase()}`}>{session.role}</span>
              <button className="btn icon ghost" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            </header>
            <main className="content">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
