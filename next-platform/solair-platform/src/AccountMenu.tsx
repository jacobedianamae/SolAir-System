import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleHelp, Flag, LogOut, UserRound } from "lucide-react";
import type { Profile } from "./types";
import { Appearance } from "./Theme";

export default function AccountMenu({ user, go, logout, busy }: {
  user: Profile; go: (page: string) => void; logout: () => Promise<void>; busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  function navigate(page: string) { setOpen(false); go(page); }
  return <div className="account-menu" ref={root}>
    <button ref={trigger} className="account-trigger" aria-label="Open account menu" aria-expanded={open} aria-controls="account-options" aria-haspopup="dialog" onClick={() => setOpen(!open)}>
      <span className="avatar small">{user.name[0]}</span><ChevronDown size={12} />
    </button>
    {open && <div id="account-options" className="account-dropdown" role="dialog" aria-label="Account options">
      <div className="account-menu-heading"><strong>{user.name}</strong><span>{user.email}</span></div>
      <button ref={first} onClick={() => navigate("Settings")}><UserRound size={17} />Profile</button>
      <button onClick={() => navigate("Help and support")}><CircleHelp size={17} />Help and support</button>
      <button onClick={() => navigate("Report a problem")}><Flag size={17} />Report a problem</button>
      <Appearance />
      <button className="account-logout" disabled={busy} onClick={() => { void logout(); }}><LogOut size={17} />{busy ? "Logging out…" : "Log out"}</button>
    </div>}
  </div>;
}
