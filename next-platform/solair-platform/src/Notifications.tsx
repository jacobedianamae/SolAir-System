import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, MessageSquare, Radio, Shield, Sun, LifeBuoy, X } from "lucide-react";
import { api, stamp } from "./api";
import type { Profile } from "./types";
import type { ActivityNotification } from "../packages/notifications";

function readSaved(key: string): string[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(values) ? values.filter((v): v is string => typeof v === "string").slice(-500) : [];
  } catch { return []; }
}
const icons = { security: Shield, alert: Shield, energy: Sun, system: Radio, assistance: LifeBuoy, message: MessageSquare };
export default function Notifications({ user, mode, refreshKey, go, select }: {
  user: Profile; mode: string; refreshKey: number; go: (page: string) => void; select: (id: string) => void;
}) {
  const key = `solair-notifications-read:${user.id}:${user.org_id}:${mode}`;
  const [open, setOpen] = useState(false), [items, setItems] = useState<ActivityNotification[]>([]);
  const [seen, setSeen] = useState<string[]>(() => readSaved(key));
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const [category, setCategory] = useState("all");
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    void api(`/notifications?mode=${mode}`).then((data) => {
      if (active) { setItems(data); setError(""); setLoading(false); }
    }).catch(() => { if (active) { setError("Updates could not be refreshed. Previously loaded activity may be stale."); setLoading(false); } });
    return () => { active = false; };
  }, [mode, user.id, user.org_id, refreshKey, retry]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) setSeen(readSaved(key)); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const unread = items.filter((item) => !seen.includes(item.revision)).length;
  function markRead(revisions: string[]) {
    setSeen((current) => {
      const next = [...new Set([...current, ...revisions])].slice(-500);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Read state remains available in this tab. */ }
      return next;
    });
  }
  return <div className="notification-menu" ref={root}>
    <button ref={trigger} className="notification-trigger" aria-label={`Open notifications${user.notifications && unread ? `, ${unread} unread` : ""}`} aria-expanded={open} aria-controls="notification-feed" aria-haspopup="dialog" onClick={() => setOpen(!open)}>
      <Bell size={20} />{user.notifications && unread > 0 ? <span className="notification-count">{unread > 9 ? "9+" : unread}</span> : null}
    </button>
    {open && <div id="notification-feed" className="notification-dropdown" role="dialog" aria-label="Notifications">
      <div className="notification-heading"><div><h2>Notifications</h2><p>{mode === "demo" ? "Demonstration · simulated activity" : "Recorded hardware & system activity"}</p></div><button ref={close} aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18} /></button></div>
      <div className="notification-tools"><label>Show<select aria-label="Notification category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All activity</option><option value="security">Security</option><option value="alert">Alerts</option><option value="energy">Harvested energy</option><option value="system">System updates</option><option value="assistance">Assistance</option><option value="message">Messages</option></select></label><button disabled={!unread} onClick={() => markRead(items.map((item) => item.revision))}><CheckCheck size={15} />Mark all read</button></div>
      {!user.notifications && <p className="notification-hint">Notification badges are off in your profile. Activity is still available here.</p>}
      {error && <div className="notification-error" role="status"><p>{error}</p><button onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Retry</button></div>}
      <div className="notification-list">
        {loading && <p className="notification-empty">Loading activity…</p>}
        {!loading && !items.some((item) => category === "all" || item.category === category) && <div className="notification-empty"><Bell size={25} /><strong>No recorded updates</strong><p>{category === "energy" ? "Harvested-energy updates appear when positive energy increments are recorded." : "New activity will appear here as SOLAIR receives it."}</p></div>}
        {items.filter((item) => category === "all" || item.category === category).map((item) => {
          const Icon = icons[item.category];
          return <button key={item.id} className={`notification-item ${seen.includes(item.revision) ? "read" : "unread"}`} onClick={() => { markRead([item.revision]); if (item.vehicle_id) select(item.vehicle_id); go(item.page); setOpen(false); }}>
            <span className={`notification-icon ${item.category}`}><Icon size={18} /></span>
            <span className="notification-content"><strong>{item.title}</strong><span>{item.body}</span><small>{stamp(item.created_at)} · {item.source === "demo" ? "SIMULATED" : item.source === "hardware" ? "HARDWARE" : "SYSTEM"}</small></span>
            {!seen.includes(item.revision) && <span className="notification-unread-dot" aria-label="Unread" />}
          </button>;
        })}
      </div>
      <p className="notification-footer">Recent activity · Reading a notification does not acknowledge a security incident.</p>
    </div>}
  </div>;
}
