'use client';
import NextImage from 'next/image';
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  MapPin,
  Truck,
  Zap,
  Shield,
  LifeBuoy,
  MessageSquare,
  History,
  Settings,
  FlaskConical,
  ArrowUpRight,
  ArrowRight,
  Sun,
  Wind,
  Bell,
  LogOut,
  Radio,
  Download,
  Menu,
  UserRound,
  Plus,
  WifiOff,
} from "lucide-react";
import { api, stamp, value, money } from "./api";
import { VehicleVisualization } from "./VehicleVisualization";
import type { Vehicle, Profile } from "./types";
import PasswordRecovery from './PasswordRecovery';
import AccountMenu from './AccountMenu';
import {SignUp,ContactPreferences,IncidentHistory,OperationAdmin} from './Operational';
import People from './People';
import TodaMenu from './TodaMenu';
import {RegistrationDetails,ActivityLog} from './Registration';
import Notifications from './Notifications';
import { Appearance, ThemeProvider } from './Theme';
import { HelpSupport, ProblemReport } from './Support';
import CpeReadings from './CpeReadings';
import CpeHistory from './CpeHistory';
import { power, freshness } from "../packages/telemetry-contract";
import "./style.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
const FleetMap = lazy(() => import("./FleetMap"));
const Lab = lazy(() => import("./Lab"));
const nav = [
  ["Overview", LayoutDashboard],
  ["Live Fleet Map", MapPin],
  ["Vehicles", Truck],
  ["Energy", Zap],
  ["Security", Shield],
  ["SOS & Assistance", LifeBuoy],
  ["Messages", MessageSquare],
  ["History & Reports", History],
  ["People & assignments", UserRound],
  ["Devices", Shield],
  ["Organizations", Truck],
  ["Activity log", History],
  ["Settings", Settings],
] as const;
function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <Zap size={23} fill="currentColor" />
      </span>
      <span>
        SOLAIR<i>CONNECTED MOBILITY</i>
      </span>
    </div>
  );
}
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="panel">
        <h2>Something interrupted this view.</h2>
        <button onClick={() => location.reload()}>Reload SOLAIR</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [health, setHealth] = useState<any>(null);
  const invite = new URLSearchParams(location.search).get("token");
  const [name, setName] = useState("");
  useEffect(() => {
    api("/health")
      .then((h) => {
        setHealth(h);
        if (h.environment === "local development") {
          setEmail("operator@solair.local");
          setPassword("SolairDemo!2026");
        }
      })
      .catch(() => setHealth({ environment: "Offline app shell" }));
  }, []);
  return (
    <main className="login">
      <section className="login-art">
        <Brand />
        <span className="eyebrow">ENERGY. SECURITY. CONNECTION.</span>
        <h1>
          A smarter journey
          <br />
          starts here.
        </h1>
        <p>
          One platform for your e-trike,
          <br />
          your people and the road ahead.
        </p>
        <VehicleVisualization />
        <small>White BEMAC 68VM · Reference-based visualization</small>
      </section>
      <section className="login-form">
        <span className="badge">{health?.environment || "Connecting"}</span>
        <h2>{invite ? "Join your TODA" : "Welcome to SOLAIR"}</h2>
        <p>Connected energy and fleet intelligence.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              if (invite) {
                await api("/register", "POST", {
                  token: invite,
                  name,
                  password,
                });
                history.replaceState({}, "", "/");
                setError("Account created. Sign in with your invited email.");
              } else {
                await api("/login", "POST", { email, password });
                onLogin();
              }
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {invite ? (
            <label>
              Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          ) : (
            <label>
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              required
              minLength={invite ? 12 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary">
            {invite ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        {!invite&&<a className="button" href="/signup">Sign up</a>}
        {health?.auth_provider==='supabase'&&!invite&&<button onClick={async()=>{try{const r=await api('/password/reset-request','POST',{email});setError(r.message);}catch(e){setError((e as Error).message);}}}>Forgot password?</button>}
      {health?.environment === "local development" && !invite && (
          <div className="demo-login">
            <small>LOCAL DEMO ACCOUNTS · same displayed password</small>
            <div>
              {["operator", "driver", "engineer", "admin"].map((r) => (
                <button key={r} onClick={() => setEmail(`${r}@solair.local`)}>
                  {r}
                </button>
              ))}
            </div>
            <p>
              Demonstration readings are explicitly simulated. Real hardware
              starts empty.
            </p>
          </div>
        )}
        <p className="subtle">
          Account invitations are issued by your TODA. Password reset email
          delivery requires provider setup.
        </p>
      </section>
    </main>
  );
}
function Metric({
  label,
  val,
  unit,
  detail,
  icon: Icon = Zap,
}: {
  label: string;
  val: string;
  unit?: string;
  detail: string;
  icon?: any;
}) {
  return (
    <div className="metric">
      <div>
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>
        {val}
        <em>{unit}</em>
      </strong>
      <small>{detail}</small>
    </div>
  );
}
function Hero({
  v,
  onDetail,
  mode,
  driver = false,
  organization = "Your TODA",
}: {
  v: Vehicle;
  onDetail: () => void;
  mode: string;
  driver?: boolean;
  organization?: string;
}) {
  return (
    <section className={"vehicle-hero " + (driver ? "driver-hero" : "")}>
      <div className="hero-top">
        <span className="eyebrow">
          {driver ? "YOUR CONNECTED E-TRIKE" : "FLEET SPOTLIGHT"}
        </span>
        <span className="hero-chip">
          <span className={"dot " + (v.status === "Online" ? "green" : "")} />
          {v.status}
        </span>
      </div>
      <div className="hero-copy">
        <span>{v.id} / PASSENGER ELECTRIC</span>
        <h2>
          BEMAC <b>68VM</b>
        </h2>
        <p>
          {v.driver_name || "Awaiting driver assignment"} · {organization}
        </p>
      </div>
      <VehicleVisualization vehicle={v} />
      <div className="hero-bottom">
        <span>
          <Shield size={17} />
          {v.telemetry?.armed
            ? "Last reported armed"
            : v.telemetry?.armed === false
              ? "Disarmed"
              : "Security not reported"}
        </span>
        <button onClick={onDetail}>
          Vehicle details
          <ArrowUpRight size={16} />
        </button>
      </div>
      <small className="hero-source">
        {mode === "demo" ? "DEMO / SIMULATED" : "REAL HARDWARE"} ·{" "}
        {v.status === "Online" ? "RECENT SAMPLE" : "STALE / LAST REPORTED"} ·{" "}
        {stamp(v.telemetry?.received_at)}
      </small>
    </section>
  );
}
function Energy({ v, mode }: { v: Vehicle; mode: string }) {
  const t = v.telemetry;
  return (
    <>
      <CpeReadings t={t} />
      <CpeHistory vehicleId={v.id} mode={mode} />
      <div className="metrics energy-metrics">
        <Metric
          label="Battery voltage"
          val={value(t?.battery_voltage_v)}
          unit="V"
          detail={
            t?.battery_voltage_v == null
              ? "Not yet instrumented"
              : "Reported pack-side voltage"
          }
        />
        <Metric
          label="Battery current"
          val={value(t?.battery_current_a)}
          unit="A"
          detail="Positive = charging · negative = discharge"
        />
        <Metric
          label="Battery power"
          val={value(
            power(t?.battery_voltage_v ?? null, t?.battery_current_a ?? null),
          )}
          unit="W"
          detail={
            t?.battery_current_a == null
              ? "Requires independent current sensor"
              : t.battery_current_a > 0
                ? "Charging"
                : t.battery_current_a < 0
                  ? "Discharging"
                  : "Idle"
          }
        />
        <Metric
          label="Harvested solar energy"
          val={value(v.solar_wh, 2)}
          unit="Wh"
          detail="Integrated recorded samples · gaps excluded"
          icon={Sun}
        />
      </div>
      <div className="two-col">
        <section className="panel">
          <div className="panel-heading">
            <h3>
              <Sun size={18} /> Solar intelligence
            </h3>
            <span className="badge amber">400 W nominal array</span>
          </div>
          <div className="electrical-grid">
            <div>
              <span>PV input voltage</span>
              <strong>{value(t?.solar_voltage_v)} V</strong>
            </div>
            <div>
              <span>PV input current</span>
              <strong>{value(t?.solar_current_a)} A</strong>
            </div>
            <div>
              <span>PV power</span>
              <strong>
                {value(
                  power(t?.solar_voltage_v ?? null, t?.solar_current_a ?? null),
                )}{" "}
                W
              </strong>
            </div>
            <div>
              <span>Controller output</span>
              <strong>
                {value(t?.solar_output_voltage_v)} V /{" "}
                {value(t?.solar_output_current_a)} A
              </strong>
            </div>
          </div>
          <p className="subtle">
            PV input and controller output are separate measurements. MPT-7210A
            validation remains pending.
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>
              <Wind size={18} /> Wind subsystem
            </h3>
            <span className="badge">Not commissioned</span>
          </div>
          <div className="electrical-grid">
            <div>
              <span>Output voltage</span>
              <strong>{value(t?.wind_voltage_v)} V</strong>
            </div>
            <div>
              <span>Output current</span>
              <strong>{value(t?.wind_current_a)} A</strong>
            </div>
            <div>
              <span>Power</span>
              <strong>
                {value(
                  power(t?.wind_voltage_v ?? null, t?.wind_current_a ?? null),
                )}{" "}
                W
              </strong>
            </div>
            <div>
              <span>Energy yield</span>
              <strong>{value(v.wind_wh, 2)} Wh</strong>
            </div>
          </div>
          <p className="subtle">
            Future wind harvesting is supported by the contract. No operational
            yield is claimed.
          </p>
        </section>
      </div>
      <section className="forecast panel">
        <Shield size={24} />
        <div>
          <h3>Battery forecasting awaits validated data</h3>
          <p>
            State of charge and remaining runtime are unavailable. Nominal
            voltage alone cannot establish either.
          </p>
        </div>
        <span className="badge">RESEARCH IN PROGRESS</span>
      </section>
      <p className="subtle">
        {mode === "demo" ? "Simulated readings" : "Hardware readings"} · Last contact {stamp(t?.received_at)} · Measurement {stamp(t?.device_timestamp)} · Calibration{" "}
        {t?.calibration_status || "unverified"} · Recorded solar value at
        illustrative tariff {money(12)} / kWh:{" "}
        {v.solar_wh === null ? "—" : money((v.solar_wh / 1000) * 12)}. Tariff is
        user-verifiable, not a billing estimate.
      </p>
    </>
  );
}
function App() {
  const [user, setUser] = useState<Profile | null>(null),
    [loaded, setLoaded] = useState(false),
    [page, setPage] = useState("Overview"),
    [mode, setMode] = useState("demo"),
    [fleet, setFleet] = useState<Vehicle[]>([]),
    [selected, setSelected] = useState(""),
    [alerts, setAlerts] = useState<any[]>([]),
    [help, setHelp] = useState<any[]>([]),
    [messages, setMessages] = useState<any[]>([]),
    [records, setRecords] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [orgs, setOrgs] = useState<any[]>([]),
    [organization, setOrganization] = useState("Your TODA"),
    [notice, setNotice] = useState(""),
    [offline, setOffline] = useState(!navigator.onLine),
    [drawer, setDrawer] = useState(false),
    [health, setHealth] = useState<any>(null),
    [queueCount, setQueueCount] = useState(0),
    [tick, setTick] = useState(0),
    [offset, setOffset] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notificationRevision, setNotificationRevision] = useState(0);
  const logoutPending = useRef(false);
  const [reportPage, setReportPage] = useState("Overview");
  const requestKey = useRef("");
  requestKey.current = `${user?.id || ""}:${user?.org_id || ""}:${mode}`;
  const toast = useCallback((s: string) => {
    setNotice(s);
    setTimeout(() => setNotice(""), 7000);
  }, []);
  const clearSession = useCallback(() => {
    requestKey.current = "";
    setUser(null); setFleet([]); setAlerts([]); setHelp([]); setMessages([]);
    setRecords([]); setUsers([]); setOrgs([]); setNotice("");
    setOrganization("Your TODA"); setQueueCount(0); setDrawer(false);
    setSelected(""); setOffset(0); setPage("Overview");
  }, []);
  async function logout() {
    if (logoutPending.current) return;
    logoutPending.current = true; setLoggingOut(true);
    try {
      await api("/logout", "POST");
      clearSession();
      try { localStorage.setItem("solair-signout", crypto.randomUUID()); } catch { /* Current tab is signed out. */ }
    } catch {
      toast("Could not log out. Reconnect and try again; your server session has not been confirmed as closed.");
    } finally { logoutPending.current = false; setLoggingOut(false); }
  }
  useEffect(() => {
    const signout = (event: StorageEvent) => { if (event.key === "solair-signout" && event.newValue) clearSession(); };
    window.addEventListener("storage", signout);
    return () => window.removeEventListener("storage", signout);
  }, [clearSession]);
  useEffect(() => {
    if (!drawer) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [drawer]);
  const login = () =>
    api("/me")
      .then((u) => {
        setFleet([]);
        setMessages([]);
        setAlerts([]);
        setHelp([]);
        setNotice("");
        setUser(u);
        setOrganization(u.organization_name||"Your TODA");
        setLoaded(true);
        setPage("Overview");
      })
      .catch(() => {
        setUser(null);
        setLoaded(true);
      });
  useEffect(() => {
    login();
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(()=>{});
    api("/health")
      .then((h) => {
        setHealth(h);
        if (h.environment !== "local development") setMode("hardware");
      })
      .catch(() => setHealth({ environment: "Offline app shell" }));
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  const suffix = `?mode=${mode}`;
  const refresh = useCallback(async () => {
    if (!user) return;
    const key = `${user.id}:${user.org_id}:${mode}`;
    try {
      const [f, a, h, membership] = await Promise.all([
        api("/fleet" + suffix),
        api("/alerts" + suffix),
        api("/help" + suffix),
        api("/me"),
      ]);
      if (requestKey.current !== key) return;
      setOrganization(membership.organization_name||"Your TODA");
      if(membership.org_id!==user.org_id||membership.role!==user.role)setUser(membership);
      setFleet(f);
      setSelected(current => f.some((item:Vehicle)=>item.id===current)?current:(f[0]?.id||''));
      setAlerts(a);
      setHelp(h);
      setNotificationRevision((value) => value + 1);
      setOffline(false);
    } catch (e) {
      if (requestKey.current !== key) return;
      if((e as {status?:number}).status===401){clearSession();toast("Your account access changed or your session expired. Sign in again to load your saved TODA.");return;}
      setOffline(true);
      toast((e as Error).message);
    }
  }, [user, suffix, toast, clearSession]);
  useEffect(() => {
    void refresh();
    const recheck=()=>void refresh();
    window.addEventListener("focus",recheck);window.addEventListener("online",recheck);
    return()=>{window.removeEventListener("focus",recheck);window.removeEventListener("online",recheck);};
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const stream = new EventSource("/api/events");
    stream.addEventListener("update", () => {
      void refresh();
      if (page === "Messages")
        void api(`/messages/${selected}${suffix}`).then(data => { if (active) setMessages(data); }).catch(() => {});
    });
    stream.onerror = () => setOffline(true);
    stream.addEventListener("ready", () => setOffline(false));
    return () => { active = false; stream.close(); };
  }, [user, refresh, page, selected, suffix]);
  useEffect(() => {
    if (!user || !selected) return;
    let active = true;
    const apply = (setter: (data: any) => void) => (data: any) => { if (active) setter(data); };
    if (page === "Messages")
      api(`/messages/${selected}${suffix}`)
        .then(apply(setMessages))
        .catch((e) => toast(e.message));
    if (page === "History & Reports")
      api(`/history/${selected}${suffix}&offset=${offset}`)
        .then(apply(setRecords))
        .catch((e) => toast(e.message));
    return () => { active = false; };
  }, [page, selected, suffix, user, offset, toast]);
  useEffect(()=>{
    if(!user)return;let active=true;
    if(page==='People & assignments'&&['operator','admin'].includes(user.role))void api('/users').then(rows=>{if(active)setUsers(rows);}).catch(e=>toast(e.message));
    if(user.role==='admin'&&page==='Organizations')void api('/organizations').then(rows=>{if(active)setOrgs(rows);}).catch(e=>toast(e.message));
    return()=>{active=false;};
  },[page,user,toast]);
  const flushQueue = useCallback(async () => {
    if (!user) return;
    const key = `solair-unsent-${user.id}`,
      q = JSON.parse(localStorage.getItem(key) || "[]");
    const remaining = [];
    for (const item of q) {
      try {
        await api(`/help?mode=${item.mode}`, "POST", item.body);
      } catch {
        remaining.push(item);
      }
    }
    localStorage.setItem(key, JSON.stringify(remaining));
    setQueueCount(remaining.length);
    if (q.length > remaining.length) {
      toast("Queued help request received by server");
      void refresh();
    }
  }, [user, refresh, toast]);
  useEffect(() => {
    const online = () => {
      setOffline(false);
      void flushQueue();
      void refresh();
    };
    const off = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", off);
    if (user)
      setQueueCount(
        JSON.parse(localStorage.getItem(`solair-unsent-${user.id}`) || "[]")
          .length,
      );
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", off);
    };
  }, [user, flushQueue, refresh]);
  const act = async (fn: () => Promise<any>, message: string) => {
    try {
      await fn();
      toast(message);
      void refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  useEffect(()=>{setOffset(0);setMessages([]);setRecords([]);},[selected,mode]);
  const select = useCallback((id: string) => setSelected(id), []);
  const baseVehicle = fleet.find((v) => v.id === selected);
  const v = baseVehicle
    ? {
        ...baseVehicle,
        status: freshness(baseVehicle.telemetry?.received_at || null),
      }
    : undefined;
  const driver = user?.role === "driver";
  const labAllowed = ["engineer", "admin"].includes(user?.role || "");
  const go = (p: string) => {
    if (p === "Report a problem") setReportPage(page);
    setPage(p);
    setDrawer(false);
  };
  const currentFleet = fleet.map((v) => ({
    ...v,
    status: !v.telemetry
      ? "Never connected"
      : Date.now() - Date.parse(v.telemetry.received_at) < 30000
        ? "Online"
        : Date.now() - Date.parse(v.telemetry.received_at) < 90000
          ? "Delayed"
          : "Offline",
  }));
  void tick;
  if (!loaded) return <div className="loading">Connecting to SOLAIR…</div>;
  if (!user) return <Login onLogin={login} />;
  const driverNav = [
    ["Overview", LayoutDashboard],
    ["Live Fleet Map", MapPin],
    ["Energy", Zap],
    ["Security", Shield],
    ["SOS & Assistance", LifeBuoy],
    ["Settings", UserRound],
  ] as const;
  return (
    <div className={"app " + (driver ? "driver-app" : "")}>
      {drawer && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setDrawer(false)} />}
      <aside className={drawer ? "sidebar open" : "sidebar"}>
        <Brand />
        <TodaMenu key={`${user.id}:${user.org_id}`} user={user} organization={organization} selectedVehicle={v}/>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {(driver ? driverNav : nav).filter(([p])=>!["Organizations","Activity log"].includes(p)||user.role==='admin').filter(([p])=>p!=='Devices'||labAllowed).filter(([p])=>p!=='People & assignments'||['admin','operator'].includes(user.role)).map(([p, Icon]) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => go(p)}
            >
              <Icon size={18} />
              {driver
                ? (
                    {
                      Overview: "My vehicle",
                      "Live Fleet Map": "Location",
                      Security: "Alerts",
                      "SOS & Assistance": "Help",
                      Settings: "Settings",
                    } as any
                  )[p] || p
                : p}
              {p === "SOS & Assistance" &&
                help.filter((h) => h.status === "pending").length > 0 && (
                  <b>{help.filter((h) => h.status === "pending").length}</b>
                )}
            </button>
          ))}
          <button className="logout" onClick={() => { void logout(); }} disabled={loggingOut}>
            <LogOut size={17} />{loggingOut ? "Logging out…" : "Log out"}
          </button>
          {labAllowed && (
            <>
              <span className="nav-label">ENGINEERING</span>
              <button
                onClick={() => go("CPE Lab")}
                className={page === "CPE Lab" ? "active" : ""}
              >
                <FlaskConical size={18} />
                CPE Lab<span className="lab-tag">LAB</span>
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-logo">
            <Sun size={20} />
            <span>
              Powered by possibility.<small>Energy · Security · Mobility</small>
            </span>
          </div>
          <button className="account" onClick={() => go("Settings")}>
            <span className="avatar">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              {user.name}
              <small>{user.role}</small>
            </span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu"
            aria-label="Toggle menu"
            onClick={() => setDrawer(!drawer)}
          >
            <Menu size={21} />
          </button>
          <div>
            <span>SOLAIR PLATFORM</span>
            <b> / </b>
            {page}
          </div>
          <div className="top-actions">
            <span className="local-label">
              {health?.environment === "local development"
                ? "Local development"
                : health?.environment === 'local production preview' ? 'Local production preview' : 'Centralized workspace'}
            </span>
            <Notifications key={`${user.id}:${user.org_id}:${mode}`} user={user} mode={mode} refreshKey={tick + notificationRevision} go={go} select={select} />
            <AccountMenu user={user} go={go} logout={logout} busy={loggingOut} />
          </div>
        </header>
        <div className={"data-banner " + (mode === "hardware" ? "real" : "")}>
          <span>
            <Radio size={14} />
            {mode === "demo"
              ? "DEMO / SIMULATED DATA"
              : "REAL HARDWARE · NO SIMULATED READINGS"}
          </span>
          <select
            aria-label="Data mode"
            value={mode}
            onChange={(e) => {
              if(e.target.value===mode)return;
              setMode(e.target.value);
              setFleet([]);
              setAlerts([]);
              setHelp([]);
              setMessages([]);
              setRecords([]);
              setOffset(0);
            }}
          >
            {!health?.operational&&<option value="demo">Demonstration</option>}
            <option value="hardware">Real hardware bench</option>
          </select>
        </div>
        {offline && (
          <div className="offline">
            <WifiOff size={16} />
            Connection unavailable. Displayed readings are stale. Actions may
            remain unsent.
          </div>
        )}
        {queueCount > 0 && (
          <div className="offline">
            {queueCount} help request(s) QUEUED / UNSENT.{" "}
            <button onClick={flushQueue}>Retry delivery</button>
          </div>
        )}
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {driver
                  ? "YOUR EVERYDAY COMPANION"
                  : page === "CPE Lab"
                    ? "SOLAIR ENGINEERING"
                    : organization.toUpperCase()}
              </span>
              <h1>
                {driver && page === "Overview"
                  ? `Ready for the road, ${user.name.split(" ")[0]}.`
                  : page === "Overview"
                    ? "Fleet overview"
                    : page === "Live Fleet Map"
                      ? "Fleet location"
                      : page}
              </h1>
              <p>
                {page === "Overview"
                  ? "A clearer view of your energy, vehicles and people."
                  : page === "CPE Lab"
                    ? "Observe real hardware. Build reliable evidence."
                    : "Connected insights. Clear decisions."}
              </p>
            </div>
            <div className="heading-actions">
              {fleet.length > 1 && (
                <select
                  aria-label="Selected vehicle"
                  value={v?.id || ""}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {fleet.map((v) => (
                    <option key={v.id}>{v.id}</option>
                  ))}
                </select>
              )}
              <button onClick={refresh}>
                <Radio size={15} />
                Refresh
              </button>
            </div>
          </div>
          {v?.telemetry && (
            <div className="measurement-banner">
              {!v.telemetry.device_timestamp ? "MEASUREMENT TIME UNKNOWN" : Date.now() - Date.parse(v.telemetry.device_timestamp) < 30000
                ? "RECENT READING"
                : "STALE / HISTORICAL READING"}{" "}
              · Last contact {stamp(v.telemetry.received_at)} · Device measurement {v.telemetry.device_timestamp?stamp(v.telemetry.device_timestamp):'UTC unavailable'} · GPS {v.telemetry.gps_fix?`reported fix age ${v.telemetry.gps_fix_age_ms} ms`:'no current fix'} ·{" "}
              {mode === "demo" ? "SIMULATED" : "REPORTED HARDWARE"}
            </div>
          )}
          {driver&&page==='Overview'&&<RegistrationDetails userId={user.id} compact/>}
          {!v ? (
            !["Settings","People & assignments","Devices","Organizations","Activity log"].includes(page) &&
            <section className={page === "Live Fleet Map" ? "panel full-map" : "panel empty"}>
              {page === "Live Fleet Map" ? (
                <>
                  <div className="panel-heading"><h3>Malabon, Philippines</h3><span className="badge">0 valid positions</span></div>
                  <Suspense fallback={<p>Loading map…</p>}>
                    <FleetMap vehicles={fleet} select={select} mode={mode} />
                  </Suspense>
                  <p>No assigned vehicles. Showing Malabon as a reference.</p>
                </>
              ) : (
                <>
                  <Truck size={36} />
                  <h2>No assigned vehicle</h2>
                  <p>Your account is ready. An administrator can link your TODA and your operator can assign a vehicle in People & assignments.</p>
                </>
              )}
            </section>
          ) : (
            <>
              {page === "Overview" && (
                <>
                  {!driver && (
                    <div className="metrics fleet-metrics">
                      <Metric
                        label="Registered vehicles"
                        val={String(fleet.length).padStart(2, "0")}
                        detail="In your authorized fleet"
                        icon={Truck}
                      />
                      <Metric
                        label="Online devices"
                        val={String(
                          currentFleet.filter((v) => v.status === "Online")
                            .length,
                        ).padStart(2, "0")}
                        detail="Heartbeat within 30 seconds"
                        icon={Radio}
                      />
                      <Metric
                        label="Offline / awaiting data"
                        val={String(
                          currentFleet.filter((v) =>
                            ["Offline", "Never connected"].includes(v.status),
                          ).length,
                        ).padStart(2, "0")}
                        detail="Review connection status"
                        icon={WifiOff}
                      />
                      <Metric
                        label="Needs attention"
                        val={String(
                          alerts.filter((a) => !a.ack_by).length +
                            help.filter((h) => h.status !== "resolved").length,
                        ).padStart(2, "0")}
                        detail="Open security and help requests"
                        icon={Shield}
                      />
                    </div>
                  )}
                  <div className={driver ? "driver-overview" : "overview-grid"}>
                    <Hero
                      v={v}
                      mode={mode}
                      organization={organization}
                      driver={driver}
                      onDetail={() => go("Vehicle details")}
                    />
                    {driver ? (
                      <section className="panel driver-electrical">
                        <h3>Your battery, at a glance</h3>
                        <div className="electrical-grid">
                          <div>
                            <span>Voltage</span>
                            <strong>
                              {value(v.telemetry?.battery_voltage_v)} <em>V</em>
                            </strong>
                          </div>
                          <div>
                            <span>Current</span>
                            <strong>
                              {value(v.telemetry?.battery_current_a)} <em>A</em>
                            </strong>
                          </div>
                        </div>
                        <p className="subtle">
                          {v.telemetry?.battery_current_a == null
                            ? "Battery current is not yet instrumented."
                            : "Positive current = charging; negative = discharge."}
                        </p>
                        <button onClick={() => go("Energy")}>
                          Explore energy
                          <ArrowRight size={16} />
                        </button>
                      </section>
                    ) : (
                      <section className="panel overview-map">
                        <div className="panel-heading">
                          <h3>Fleet on the map</h3>
                          <button onClick={() => go("Live Fleet Map")}>
                            Expand
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                        <Suspense fallback={<p>Loading map…</p>}>
                          <FleetMap
                            vehicles={fleet}
                            select={select}
                            mode={mode}
                          />
                        </Suspense>
                        <div className="map-footer">
                          <span>
                            <span className="dot green" />
                            Valid reported fixes
                          </span>
                <span>Malabon, Philippines</span>
                        </div>
                      </section>
                    )}
                  </div>
                  <div className="overview-bottom">
                    <section className="panel">
                      <div className="panel-heading">
                        <h3>Energy snapshot</h3>
                        <button onClick={() => go("Energy")}>
                          View energy
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                      <div className="energy-snapshot">
                        <div className="solar-icon">
                          <Sun size={26} />
                        </div>
                        <div>
                          <small>Solar PV power · {v.id}</small>
                          <strong>
                            {value(
                              power(
                                v.telemetry?.solar_voltage_v ?? null,
                                v.telemetry?.solar_current_a ?? null,
                              ),
                            )}
                            <em> W</em>
                          </strong>
                          <span>Wind: not commissioned</span>
                        </div>
                        <SolarSparkline vehicleId={v.id} mode={mode} />
                      </div>
                      <small className="subtle">
                        {mode === "demo"
                          ? "SIMULATED · Last recorded PV reading"
                          : "Last recorded PV reading · inspect Energy for timestamps"}
                      </small>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h3>Priority activity</h3>
                        <button onClick={() => go("SOS & Assistance")}>
                          View requests
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                      {help
                        .filter((h) => h.status !== "resolved")
                        .slice(0, 2)
                        .map((h) => (
                          <button
                            className="activity-row"
                            key={h.id}
                            onClick={() => go("SOS & Assistance")}
                          >
                            <LifeBuoy size={20} />
                            <span>
                              <strong>
                                {h.type} · {h.vehicle_id}
                              </strong>
                              <small>
                                {h.status} · {stamp(h.created_at)}
                              </small>
                            </span>
                            <ArrowRight size={16} />
                          </button>
                        ))}
                      {alerts
                        .filter((a) => !a.ack_by)
                        .slice(0, 2)
                        .map((a) => (
                          <button
                            className="activity-row"
                            key={a.id}
                            onClick={() => go("Security")}
                          >
                            <Shield size={20} />
                            <span>
                              <strong>
                                {a.type} · {a.vehicle_id}
                              </strong>
                              <small>
                                {mode === "demo" ? "Simulated event · " : ""}
                                {stamp(a.created_at)}
                              </small>
                            </span>
                            <ArrowRight size={16} />
                          </button>
                        ))}
                      {!help.some((h) => h.status !== "resolved") &&
                        !alerts.some((a) => !a.ack_by) && (
                          <p className="empty">
                            No open requests or recorded security alerts.
                          </p>
                        )}
                    </section>
                  </div>
                  {driver && (
                    <button
                      className="help-wide"
                      onClick={() => go("SOS & Assistance")}
                    >
                      <LifeBuoy size={22} />
                      <span>
                        Need a hand?
                        <small>Contact your TODA or send an SOS</small>
                      </span>
                      <ArrowRight size={20} />
                    </button>
                  )}
                  {!driver && (
                    <VehicleTable
                      vehicles={currentFleet}
                      open={(id) => {
                        setSelected(id);
                        go("Vehicle details");
                      }}
                    />
                  )}
                </>
              )}
              {page === "Live Fleet Map" && (
                <section className="panel full-map">
                  <div className="panel-heading">
                    <h3>
                      {mode === "demo"
                        ? "Simulated fleet locations"
                        : "Reported GPS locations"}
                    </h3>
                    <span className="badge">
                      {fleet.filter((v) => v.gps).length} valid positions
                    </span>
                  </div>
                  <Suspense fallback={<p>Loading map…</p>}>
                    <FleetMap vehicles={fleet} select={select} mode={mode} />
                  </Suspense>
                  <p>
                    {v.id}:{" "}
                    {v.gps
                      ? `${v.gps.latitude}, ${v.gps.longitude} · last known ${stamp(v.gps.measured_at)}`
                      : "No valid GPS fix recorded"}
                  </p>
                  <button onClick={() => go("Vehicle details")}>
                    Open selected vehicle
                    <ArrowRight size={16} />
                  </button>
                </section>
              )}
              {page === "Vehicles" && (
                <VehicleTable
                  vehicles={currentFleet}
                  open={(id) => {
                    setSelected(id);
                    go("Vehicle details");
                  }}
                />
              )}
              {page === "Vehicle details" && (
                <>
                  <Hero v={v} mode={mode} onDetail={() => go("Energy")} />
                  <section className="panel specs">
                    <h3>Vehicle reference specifications</h3>
                    <div className="electrical-grid">
                      <div>
                        <span>Manufacturer dimensions</span>
                        <strong>3,300 × 1,440 × 1,820 mm</strong>
                      </div>
                      <div>
                        <span>Inspected unit nominal pack</span>
                        <strong>
                          {v.nominal_voltage} V · {v.nominal_capacity} Ah
                        </strong>
                      </div>
                      <div>
                        <span>Battery configuration</span>
                        <strong>4 Toshiba modules · 2S2P</strong>
                      </div>
                      <div>
                        <span>Auxiliary system</span>
                        <strong>12 V reference</strong>
                      </div>
                    </div>
                    <p className="subtle">
                      Specifications are reference values, not live readings.
                      Charging limits and BMS/CAN access remain unverified.
                      Solar: 2 × 200 W panels; canopy mount planned.
                    </p>
                  </section>
                  <Energy v={v} mode={mode} />
                </>
              )}
              {page === "Energy" && (
                <>
                  <Energy v={v} mode={mode} />
                  <EnergyHistory v={v} mode={mode} />
                </>
              )}
              {page === "Security" && (
                <>
                  <div className="metrics">
                    <Metric
                      label="Security state"
                      val={
                        v.telemetry?.armed
                          ? "Armed"
                          : v.telemetry?.armed === false
                            ? "Disarmed"
                            : "—"
                      }
                      detail="Reported device state"
                      icon={Shield}
                    />
                    <Metric
                      label="Enclosure lid"
                      val={v.telemetry?.lid_state || "—"}
                      detail="Debounced GPIO25 input"
                      icon={Shield}
                    />
                    <Metric
                      label="Mount state"
                      val={v.telemetry?.mount_state || "—"}
                      detail="Debounced GPIO26 input"
                      icon={Shield}
                    />
                    <Metric
                      label="Local alarm"
                      val={
                        v.telemetry?.alarm_active
                          ? "Active"
                          : v.telemetry?.alarm_active === false
                            ? "Inactive"
                            : "—"
                      }
                      detail="Physical siren verification separate"
                      icon={Bell}
                    />
                  </div>
                  <IncidentHistory vehicleId={v.id} user={user} refreshKey={tick+notificationRevision} mode={mode}/>
                  <section className="panel">
                    <div className="panel-heading">
                      <h3>Security incident timeline</h3>
                      <span className="badge">
                        {mode === "demo"
                          ? "SIMULATED"
                          : "RECORDED HARDWARE EVENTS"}
                      </span>
                    </div>
                    {alerts.length ? (
                      alerts.map((a) => (
                        <div className="incident" key={a.id}>
                          <span className="incident-icon">
                            <Shield size={20} />
                          </span>
                          <div>
                            <strong>
                              {a.type} · {a.vehicle_id}
                            </strong>
                            <p>
                              {stamp(a.created_at)} ·{" "}
                              {a.ack_by
                                ? "Acknowledged"
                                : "Awaiting acknowledgment"}
                            </p>
                          </div>
                          {!driver && !a.ack_by && (
                            <button
                              onClick={() =>
                                act(
                                  () =>
                                    api(
                                      `/alerts/${encodeURIComponent(a.id)}/ack`,
                                      "POST",
                                    ),
                                  "Alert acknowledged",
                                )
                              }
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="empty">
                        No recorded alerts. Missing sensors do not establish a
                        secure state.
                      </p>
                    )}
                  </section>
                </>
              )}
              {page === "SOS & Assistance" && (
                <>
                  <div className="two-col">
                    {driver && (
                      <section className="panel">
                        <h3>Help is one request away.</h3>
                        <p>
                          Your request goes to the authorized TODA operator.
                        </p>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            const body = {
                              id: crypto.randomUUID(),
                              vehicle_id: v.id,
                              type: String(f.get("type")),
                              notes: String(f.get("notes")),
                            };
                            try {
                              await api("/help" + suffix, "POST", body);
                              toast(
                                "Server received your request. Awaiting operator acknowledgment.",
                              );
                              void refresh();
                            } catch {
                              const key = `solair-unsent-${user.id}`,
                                q = JSON.parse(
                                  localStorage.getItem(key) || "[]",
                                );
                              q.push({ body, mode });
                              localStorage.setItem(key, JSON.stringify(q));
                              setQueueCount(q.length);
                              toast(
                                "Request QUEUED / UNSENT. No server acknowledgment received.",
                              );
                            }
                          }}
                        >
                          <label>
                            Assistance type
                            <select name="type">
                              <option>Mechanical assistance</option>
                              <option>Charging assistance</option>
                              <option>Emergency SOS</option>
                              <option>Other</option>
                            </select>
                          </label>
                          <label>
                            Tell your operator what happened
                            <textarea
                              name="notes"
                              maxLength={2000}
                              required
                              placeholder="Your situation and how to reach you"
                            />
                          </label>
                          <button className="primary">
                            <LifeBuoy size={17} />
                            Send help request
                          </button>
                        </form>
                      </section>
                    )}
                    <section className="panel">
                      <h3>Request activity</h3>
                      {help.length ? (
                        help.map((h) => (
                          <div className="request" key={h.id}>
                            <div>
                              <strong>
                                {h.type} · {h.vehicle_id}
                              </strong>
                              <span
                                className={
                                  "badge " +
                                  (h.status === "pending" ? "amber" : "")
                                }
                              >
                                {h.status}
                              </span>
                            </div>
                            <p>{h.notes}</p>
                            <small>
                              {stamp(h.created_at)} · Received by server
                            </small>
                            {!driver && h.status !== "resolved" && (
                              <button
                                onClick={() =>
                                  act(
                                    () =>
                                      api(`/help/${h.id}`, "PATCH", {
                                        status:
                                          h.status === "pending"
                                            ? "acknowledged"
                                            : "resolved",
                                      }),
                                    "Request status saved",
                                  )
                                }
                              >
                                {h.status === "pending"
                                  ? "Acknowledge"
                                  : "Mark resolved"}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelected(h.vehicle_id);
                                go("Messages");
                              }}
                            >
                              Open conversation
                              <MessageSquare size={16} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="empty">
                          No server-received requests in this data mode.
                        </p>
                      )}
                    </section>
                  </div>
                </>
              )}
              {page === "Messages" && (
                <section className="panel messages">
                  <h3>Vehicle conversation · {v.id}</h3>
                  <p>
                    Authorized driver and TODA personnel · persistent server
                    messages
                  </p>
                  <div className="message-list">
                    {messages.length ? (
                      messages.map((m) => (
                        <div
                          className={
                            "bubble " + (m.sender_id === user.id ? "own" : "")
                          }
                          key={m.id}
                        >
                          <small>
                            {m.sender_name} · {stamp(m.created_at)}
                          </small>
                          <p>{m.body}</p>
                          <small>
                            {m.read_at
                              ? "Read " + stamp(m.read_at)
                              : "Server received"}
                          </small>
                          {m.sender_id !== user.id && !m.read_at && (
                            <button
                              onClick={() =>
                                act(async () => {
                                  await api(`/messages/${m.id}/read`, "POST");
                                  setMessages(
                                    await api(`/messages/${v.id}${suffix}`),
                                  );
                                }, "Marked as read")
                              }
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="empty">
                        Start the conversation. No canned messages.
                      </p>
                    )}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const body = new FormData(form).get("body");
                      await act(async () => {
                        await api(`/messages/${v.id}${suffix}`, "POST", {
                          body,
                        });
                        setMessages(await api(`/messages/${v.id}${suffix}`));
                        form.reset();
                      }, "Message received by server");
                    }}
                  >
                    <input
                      name="body"
                      aria-label="Message"
                      placeholder="Write to your driver or TODA…"
                      maxLength={2000}
                      required
                    />
                    <button
                      className="primary"
                      disabled={offline || user.role === "engineer"}
                    >
                      Send
                      <ArrowRight size={16} />
                    </button>
                  </form>
                  {offline && (
                    <p className="error">
                      Messages cannot be sent while offline.
                    </p>
                  )}
                </section>
              )}
              {page === "History & Reports" && (
                <section className="panel"><a className="button" href={`/api/research-export/${encodeURIComponent(v.id)}?mode=${mode}`}>Export telemetry CSV (up to 5,000)</a>
                  <div className="panel-heading">
                    <h3>Telemetry archive · {v.id}</h3>
                    <a className="button" href={`/api/export/${v.id}${suffix}`}>
                      <Download size={16} />
                      Export JSON
                    </a>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Received (Manila)</th>
                          <th>Source</th>
                          <th>Transport</th>
                          <th>Battery V</th>
                          <th>Battery A</th>
                          <th>PV W</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => {
                          const t = JSON.parse(r.payload);
                          return (
                            <tr key={r.id}>
                              <td>{stamp(r.received_at)}</td>
                              <td>
                                {r.mode === "demo" ? "SIMULATED" : "HARDWARE"}
                              </td>
                              <td>{t.transport}</td>
                              <td>{value(t.battery_voltage_v)}</td>
                              <td>{value(t.battery_current_a)}</td>
                              <td>
                                {value(
                                  power(t.solar_voltage_v, t.solar_current_a),
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!records.length && (
                    <p className="empty">No historical records.</p>
                  )}
                  <div className="button-row">
                    <button
                      disabled={!offset}
                      onClick={() => setOffset(Math.max(0, offset - 100))}
                    >
                      Previous
                    </button>
                    <span>
                      Records {offset + 1}–{offset + records.length}
                    </span>
                    <button
                      disabled={records.length < 100}
                      onClick={() => setOffset(offset + 100)}
                    >
                      Next
                    </button>
                  </div>
                </section>
              )}
              {page === "CPE Lab" && labAllowed && (
                <Suspense fallback={<p>Loading engineering workspace…</p>}>
                  <Lab
                    key={`${user.id}:${user.org_id}:${v.device_id}:${mode}`}
                    vehicle={v}
                    mode={mode}
                    refresh={refresh}
                    toast={toast}
                  />
                </Suspense>
              )}
            </>
          )}
          {page === "Settings" && <div className="settings-grid">
              <section className="panel">
                <Appearance />
                <h3>Your SOLAIR profile</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void act(async () => {
                      await api("/profile", "PATCH", {
                        name: f.get("name"),
                        notifications: f.get("notifications") === "on",
                      });
                      await login();
                    }, "Profile updated");
                  }}
                >
                  <label>
                    Name
                    <input name="name" defaultValue={user.name} required />
                  </label>
                  <label>
                    Email
                    <input value={user.email} readOnly />
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      name="notifications"
                      defaultChecked={!!user.notifications}
                    />
                    In-app notification preference
                  </label>
                  <p className="subtle">
                    Push delivery is not configured. This preference does not
                    enable browser push.
                  </p>
                  <button className="primary">Save profile</button>
                </form>
                <button onClick={() => go("Messages")}>
                  Open TODA messages
                  <MessageSquare size={16} />
                </button>
                <p className="subtle">
                  Your account details and alert preferences are saved securely. Vehicle access is managed separately.
                </p>
              </section>
              <RegistrationDetails userId={user.id}/>
              <ContactPreferences />
          </div>}
          {page === "People & assignments" && ["admin","operator"].includes(user.role) && <div className="settings-grid"><People user={user} onChange={async()=>{setUsers(await api('/users'));await refresh();}}/>
                <section className="panel">
                  <h3>Vehicle assignments and invitations</h3>
                  {v && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void act(
                          () =>
                            api("/assign", "POST", {
                              vehicle_id: f.get("vehicle"),
                              driver_id: f.get("driver"),
                              operator_id:f.get("operator")||undefined,
                            }),
                          "Assignment saved",
                        );
                      }}
                    >
                      <label>
                        Vehicle
                        <select name="vehicle">
                          {fleet.map((v) => (
                            <option key={v.id}>{v.id}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Driver
                        <select name="driver">
                          {users
                            .filter((u) => u.role === "driver")
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>Responsible operator<select name="operator" aria-label="Responsible operator"><option value="">Keep existing / not assigned</option>{users.filter(p=>['operator','admin'].includes(p.role)&&(user.role==='admin'||p.id===user.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                      <button>Assign vehicle</button>
                    </form>
                  )}
                  <h3>Register a vehicle</h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act(
                        () =>
                          api("/vehicles", "POST", {
                            id: f.get("id"),
                            name: f.get("name"),
                            brand:f.get("brand"),
                          }),
                        "Vehicle registered",
                      );
                    }}
                  >
                    <label>Vehicle type<select name="brand" aria-label="Registered vehicle type"><option value="BEMAC">BEMAC</option><option value="NWOW">NWOW</option></select></label>
                    <label>
                      Vehicle ID
                      <input
                        name="id"
                        pattern="[A-Za-z0-9-]{1,40}"
                        placeholder="ET-09"
                        required
                      />
                    </label>
                    <label>
                      Display name
                      <input
                        name="name"
                        placeholder="BEMAC 68VM / ET-09"
                        required
                      />
                    </label>
                    <button>Register vehicle</button>
                  </form>
                  <h3>Invite an account</h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      try {
                        const r = await api("/invite", "POST", {
                          email: f.get("email"),
                          role: f.get("role"),
                        });
                        toast("Invitation created. Share the displayed link.");
                        window.prompt(
                          "Invitation link (24 hours)",
                          location.origin + r.invitation_url,
                        );
                      } catch (e) {
                        toast((e as Error).message);
                      }
                    }}
                  >
                    <label>
                      Email
                      <input type="email" name="email" required />
                    </label>
                    <label>
                      Role
                      <select name="role">
                        {(user.role === "admin"
                          ? ["driver", "operator", "engineer", "admin"]
                          : ["driver"]
                        ).map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <button>
                      <Plus size={15} />
                      Create invitation
                    </button>
                  </form>
                </section>          </div>}
          {page === "Devices" && labAllowed && <div className="settings-grid">{user.role==='admin'&&<OperationAdmin deviceId={v?.device_id||null}/>}<section className="panel"><h3>Vehicle appearance</h3>
                {labAllowed && v && (
                  <label>
                    Replace selected vehicle visualization
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 3000000) {
                          toast("Use an optimized image under 3 MB");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () =>
                          void act(
                            () =>
                              api("/vehicle-image/" + v.id, "POST", {
                                mime: file.type,
                                base64: String(reader.result).split(",")[1],
                              }),
                            "Vehicle image updated",
                          );
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                )}
          </section></div>}
          {page === "Organizations" && user.role==='admin' && <div className="settings-grid">
                <section className="panel">
                  <h3>Organizations</h3>
                  {orgs.filter(o=>!o.id.startsWith('unassigned-')).map((o) => (
                    <div className="switch-row" key={o.id}>
                      <span>{o.name}</span>
                      <button
                        disabled={o.id === user.org_id}
                        onClick={() =>
                          act(async () => {
                            await api("/admin/workspace", "POST", {
                              org_id: o.id,
                            });
                            await login();
                          }, "Administrator workspace changed")
                        }
                      >
                        Open workspace
                      </button>
                    </div>
                  ))}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await act(async () => {
                        await api("/organizations", "POST", {
                          name: f.get("name"),
                        });
                        setOrgs(await api("/organizations"));
                      }, "Organization created");
                    }}
                  >
                    <input
                      name="name"
                      aria-label="Organization name"
                      required
                      placeholder="New TODA name"
                    />
                    <button>Create organization</button>
                  </form>
                </section>          </div>}
          {page === "Activity log" && user.role==='admin' && <ActivityLog/>}
          {page === "Help and support" && <HelpSupport go={go} />}
          {page === "Report a problem" && <ProblemReport page={reportPage} mode={mode} vehicleId={v?.id} />}
          <footer>
            SOLAIR · Hybrid energy & edge security
            <span>
              Asia/Manila ·{" "}
              {mode === "demo"
                ? "Demonstration environment"
                : "Hardware bench environment"}
            </span>
          </footer>
        </main>
      </div>
      {driver && (
        <nav className="bottom-nav">
          {driverNav.map(([p, I]) => (
            <button
              className={page === p ? "active" : ""}
              key={p}
              onClick={() => go(p)}
            >
              <I size={20} />
              <span>
                {
                  (
                    {
                      Overview: "Home",
                      "Live Fleet Map": "Location",
                      Energy: "Energy",
                      Security: "Alerts",
                      "SOS & Assistance": "Help",
                      Settings: "Settings",
                    } as any
                  )[p]
                }
              </span>
            </button>
          ))}
        </nav>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
function SolarSparkline({vehicleId,mode}:{vehicleId:string;mode:string}){
 const [samples,setSamples]=useState<(number|null)[]>([]);
 useEffect(()=>{let active=true;setSamples([]);void api(`/history/${vehicleId}?mode=${mode}`).then(rows=>{if(active)setSamples(rows.slice(0,12).reverse().map((r:any)=>{const t=JSON.parse(r.payload);return power(t.solar_voltage_v,t.solar_current_a);}));}).catch(()=>{});return()=>{active=false;};},[vehicleId,mode]);
 const max=Math.max(1,...samples.filter((p):p is number=>p!==null));
 return samples.some(p=>p!==null)?<div className="tiny-bars" role="img" aria-label={mode==='demo'?'Simulated recorded solar power samples':'Recorded solar power samples'}>{samples.map((p,i)=><i key={i} title={p===null?'Unavailable sample':`${p.toFixed(1)} W`} style={{height:p===null?0:Math.max(0,p)/max*100+'%'}} />)}</div>:<span className="subtle">No recorded trend</span>;
}
function VehicleTable({
  vehicles,
  open,
}: {
  vehicles: Vehicle[];
  open: (id: string) => void;
}) {
  return (
    <section className="panel fleet-table">
      <div className="panel-heading">
        <h3>Your fleet</h3>
        <span className="badge">{vehicles.length} vehicles</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Assigned driver</th>
              <th>Connection</th>
              <th>Battery voltage</th>
              <th>Last reported</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td>
                  <div className="vehicle-cell">
                    <NextImage src={v.image_url} alt="White BEMAC" width={96} height={64} sizes="65px" unoptimized={v.image_url.startsWith('/api/')} />
                    <div>
                      <strong>{v.id}</strong>
                      <small>BEMAC 68VM</small>
                    </div>
                  </div>
                </td>
                <td>{v.driver_name || "Unassigned"}</td>
                <td>
                  <span
                    className={"badge " + (v.status === "Online" ? "teal" : "")}
                  >
                    {v.status}
                  </span>
                </td>
                <td>{value(v.telemetry?.battery_voltage_v)} V</td>
                <td>{stamp(v.telemetry?.received_at)}</td>
                <td>
                  <button
                    aria-label={`Open ${v.id}`}
                    onClick={() => open(v.id)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function EnergyHistory({ v, mode }: { v: Vehicle; mode: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let active=true;setRows([]);
    void api(`/history/${v.id}?mode=${mode}`).then(data=>{if(active)setRows(data);}).catch(()=>{});
    return()=>{active=false;};
  }, [v.id, mode]);
  const points = rows
    .slice()
    .reverse()
    .map((r) => {
      const t = JSON.parse(r.payload);
      return power(t.solar_voltage_v, t.solar_current_a);
    });
  const max = Math.max(1, ...(points.filter((p) => p !== null) as number[]));
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Recorded PV power trend</h3>
        <a className="button" href={`/api/export/${v.id}?mode=${mode}`}>
          <Download size={15} />
          Export
        </a>
      </div>
      {points.some((p) => p !== null) ? (
        <>
          <svg
            viewBox="0 0 900 170"
            className="energy-chart"
            role="img"
            aria-label="Recorded solar power samples"
          >
            <path d="M0 150H900 M0 75H900" stroke="#e7edf1" />
            <path
              d={points
                .map((p, i) =>
                  p === null
                    ? ""
                    : `${i === 0 || points[i - 1] === null ? "M" : "L"} ${(i * 900) / Math.max(1, points.length - 1)} ${150 - (p / max) * 130}`,
                )
                .join(" ")}
              fill="none"
              stroke="#00a89a"
              strokeWidth="3"
            />
          </svg>
          <p className="subtle">
            {stamp(rows.at(-1)?.measured_at)} → {stamp(rows[0]?.measured_at)} ·{" "}
            {mode === "demo" ? "SIMULATED" : "HARDWARE"} · max {value(max)} W
          </p>
        </>
      ) : (
        <p className="empty">No validated electrical samples available.</p>
      )}
    </section>
  );
}
export default function SolairApp(){return <ThemeProvider><Boundary>{location.pathname==='/reset-password'?<PasswordRecovery/>:location.pathname==='/signup'?<SignUp/>:<App/>}</Boundary></ThemeProvider>;}
