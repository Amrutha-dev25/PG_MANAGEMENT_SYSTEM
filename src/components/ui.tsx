"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  Building2, Users, ScrollText, BadgeCheck, Box, DoorOpen, BedDouble, Plug, Sparkles, User, FileText, Wallet, Utensils,
  LayoutDashboard, KeyRound, MessageSquareWarning, UserCheck, BarChart3, ShieldCheck, X, CheckCircle2, AlertTriangle, Info,
  Star, Home, type LucideIcon,
} from "lucide-react";
import { tone, initials } from "@/lib/client";

export const ICONS: Record<string, LucideIcon> = {
  building: Building2, users: Users, scroll: ScrollText, badge: BadgeCheck, box: Box, door: DoorOpen, bed: BedDouble, plug: Plug,
  sparkles: Sparkles, user: User, file: FileText, wallet: Wallet, utensils: Utensils, dashboard: LayoutDashboard, key: KeyRound,
  complaint: MessageSquareWarning, visitor: UserCheck, chart: BarChart3, shield: ShieldCheck, home: Home,
};
export const Icon = ({ name, size = 18 }: { name: string; size?: number }) => { const C = ICONS[name] || Box; return <C size={size} strokeWidth={1.9} />; };

// ----------------------------------------------------------------------------- session context
export interface SessionUser { username: string; role: "ADMIN" | "STAFF" | "RESIDENT"; name: string; residentId?: string; staffId?: string }
const SessionCtx = createContext<SessionUser | null>(null);
export const SessionProvider = SessionCtx.Provider;
export const useSession = () => { const s = useContext(SessionCtx); if (!s) throw new Error("No session"); return s; };

// ----------------------------------------------------------------------------- toasts
type ToastKind = "success" | "error" | "info";
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  const push = useCallback((msg: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === "success" ? <CheckCircle2 size={18} /> : t.kind === "error" ? <AlertTriangle size={18} /> : <Info size={18} />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ----------------------------------------------------------------------------- small components
export const Badge = ({ value, label, t }: { value: any; label?: string; t?: string }) =>
  value === null || value === undefined || value === "" ? <span className="muted">—</span> :
  <span className={`badge tone-${t || tone(value)}`}>{label ?? String(value).replace(/_/g, " ")}</span>;

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="btn icon ghost" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = "Delete", danger = true, onConfirm, onCancel }:
  { title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void | Promise<void>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onCancel} footer={<>
      <button className="btn ghost" onClick={onCancel}>Cancel</button>
      <button className={`btn ${danger ? "danger" : "primary"}`} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{busy ? "Working…" : confirmLabel}</button>
    </>}>
      <p className="confirm-msg">{message}</p>
    </Modal>
  );
}

export const PageHead = ({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) => (
  <div className="page-head"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{children && <div className="page-actions">{children}</div>}</div>
);

export const Empty = ({ title = "Nothing here yet", hint }: { title?: string; hint?: string }) => (
  <div className="empty"><div className="empty-art"><Sparkles size={26} /></div><b>{title}</b>{hint && <span>{hint}</span>}</div>
);

export const Skeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="skeletons">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton" style={{ opacity: 1 - i * 0.12 }} />)}</div>
);

export const Avatar = ({ name }: { name: string }) => <span className="avatar">{initials(name)}</span>;

export function Stars({ value, onChange, size = 18 }: { value: number | null; onChange?: (n: number) => void; size?: number }) {
  return (
    <span className="stars" aria-label={`${value ?? 0} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={`star ${value && n <= Math.round(value) ? "on" : ""}`} disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} star`}>
          <Star size={size} fill={value && n <= Math.round(value) ? "currentColor" : "none"} />
        </button>
      ))}
    </span>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="pagination">
      <span className="muted">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
      <div>
        <button className="btn sm ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="page-no">{page} / {pages}</span>
        <button className="btn sm ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
