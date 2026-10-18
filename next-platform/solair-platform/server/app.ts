import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Store } from "./db";
import { hash, token, passwordHash, verifyPassword, type User } from "./auth";
import type {IdentityProvider} from './identity';
import { notifications } from './notifications';
import { operationalRoutes } from './operational-routes';
import { operational, recordIncident } from './operations';
import {
  telemetrySchema,
  power,
  integrateWh,
  freshness,
} from "../packages/telemetry-contract";
type AuthRequest = Request & { user: User };
const now = () => new Date().toISOString();
export function createApp(db: Store, production = false, identity: IdentityProvider | null = null) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "https://tile.openstreetmap.org"],
              connectSrc: ["'self'"],
              workerSrc: ["'self'"],
            },
          }
        : false,
    }),
  );
  app.use("/api/vehicle-image", express.json({ limit: "4mb" }));
  app.use(express.json({ limit: "96kb" }));
  app.use(cookieParser());
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== `${req.protocol}://${req.get("host")}`
    )
      return res.status(403).json({ error: "Cross-origin action rejected" });
    next();
  });
  const clients = new Map<Response, User>();
  const streamSessions = new Map<Response, string>();
  const notify = (org: string) => {
    for (const [res, u] of clients)
      if (u.org_id === org) res.write("event: update\ndata: {}\n\n");
  };
  const auth = async (req: Request, res: Response, next: NextFunction) => {
    const [u] = await db.query(
      "SELECT p.id,p.org_id,p.email,p.name,p.role,p.notifications,o.name AS organization_name FROM sessions s JOIN profiles p ON p.id=s.user_id JOIN organizations o ON o.id=p.org_id WHERE s.token_hash=? AND s.expires_at>?",
      [hash(req.cookies.session || ""), now()],
    );
    if (!u) return res.status(401).json({ error: "Sign in required" });
    (req as AuthRequest).user = u;
    next();
  };
  const role =
    (...roles: string[]) =>
    (req: Request, res: Response, next: NextFunction) =>
      roles.includes((req as AuthRequest).user.role)
        ? next()
        : res.status(403).json({ error: "This role is not permitted" });
  const mode = (req: Request) =>
    req.query.mode === "demo" ? "demo" : "hardware";
  const vehicle = async (u: User, id: string) => {
    const [v] = await db.query(
      "SELECT v.*,a.driver_id,p.name AS driver_name,r.display_name AS driver_display_name,d.id AS device_id FROM vehicles v LEFT JOIN assignments a ON a.vehicle_id=v.id LEFT JOIN profiles p ON p.id=a.driver_id LEFT JOIN profile_registration r ON r.user_id=p.id LEFT JOIN devices d ON d.vehicle_id=v.id WHERE v.id=? AND v.org_id=?",
      [id, u.org_id],
    );
    return v && (u.role !== "driver" || v.driver_id === u.id) ? v : null;
  };
  const audit = async (u: User, action: string, target: string) =>
    db.run("INSERT INTO audit_logs VALUES (?,?,?,?,?,?)", [
      randomUUID(),
      u.org_id,
      u.id,
      action,
      target,
      now(),
    ]);
  app.use('/api', (req,res,next)=>{
    if(operational() && req.query.mode==='demo')return res.status(403).json({error:'Demonstration data is unavailable in the operational environment'});
    next();
  });
  operationalRoutes(app,db,auth,identity,notify);
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      environment: production
        ? process.env.DATABASE_URL
          ? "production PostgreSQL"
          : "local production preview"
        : "local development",
      operational: operational(),
      database: process.env.DATABASE_URL ? "PostgreSQL" : "SQLite",
      push_configured: false,
      auth_provider:identity?.name||'local',
      realtime_provider:process.env.SOLAIR_REALTIME_PROVIDER||'local',
      realtime_status:app.locals.realtimeStatus||'local',
    }),
  );
  app.post(
    "/api/login",
    rateLimit({ windowMs: 60000, limit: 10 }),
    async (req, res) => {
      const b = z
        .object({ email: z.email(), password: z.string().max(200) })
        .parse(req.body);
      const provedId=identity?await identity.authenticate(b.email.toLowerCase(),b.password):null;
      const [u] = identity?await db.query('SELECT * FROM profiles WHERE id=?',[provedId||'']):await db.query("SELECT * FROM profiles WHERE email=?", [b.email.toLowerCase()]);
      const identityId = identity?provedId:u&&verifyPassword(b.password,u.password_hash)?u.id:null;
      if (!u || identityId !== u.id)
        return res
          .status(401)
          .json({ error: "Email or password is incorrect" });
      if(operational()&&(!identity?.emailVerified||!await identity.emailVerified(u.id)))return res.status(403).json({error:'Verify email ownership before operational access'});
      if(identity&&u.email!==b.email.toLowerCase())await db.run('UPDATE profiles SET email=? WHERE id=?',[b.email.toLowerCase(),u.id]);
      const t = token();
      await db.run("INSERT INTO sessions VALUES (?,?,?)", [
        hash(t),
        u.id,
        new Date(Date.now() + 8 * 3600000).toISOString(),
      ]);
      res.cookie("session", t, {
        httpOnly: true,
        secure: production,
        sameSite: "strict",
        maxAge: 8 * 3600000,
        path: "/",
      });
      await audit(u, "sign_in", u.id);
      res.json({ ok: true });
    },
  );
  app.post("/api/logout", async (req, res) => {
    const sessionHash = hash(req.cookies.session || "");
    await db.run("DELETE FROM sessions WHERE token_hash=?", [
      sessionHash,
    ]);
    for (const [stream, key] of streamSessions) if (key === sessionHash) {
      streamSessions.delete(stream); clients.delete(stream); stream.end();
    }
    res.clearCookie("session", { path: "/", httpOnly: true, sameSite: "strict", secure: production });
    res.json({ ok: true });
  });
  app.post("/api/problem-reports", auth, rateLimit({ windowMs: 60000, limit: 10 }), async (req, res) => {
    const u = (req as AuthRequest).user;
    const report = z.object({
      summary: z.string().trim().min(5).max(120), details: z.string().trim().min(10).max(4000),
      page: z.string().max(100), mode: z.enum(["demo", "hardware"]), vehicle_id: z.string().max(40).nullable(),
    }).strict().parse(req.body);
    if (report.vehicle_id && !(await vehicle(u, report.vehicle_id))) return res.status(403).json({ error: "Vehicle access denied" });
    const id = randomUUID();
    await audit(u, "problem_report", JSON.stringify({ id, ...report }));
    res.status(201).json({ id, status: "received" });
  });
  app.post('/api/password/reset-request',rateLimit({windowMs:60000,limit:10}),async(req,res)=>{
    if(!identity?.requestRecovery)return res.status(503).json({error:'Password recovery requires configured Supabase authentication'});
    const email=z.email().parse(req.body.email);await identity.requestRecovery(email);
    res.json({accepted:true,message:'Recovery request accepted by the provider. Check your email; delivery is not independently verified.'});
  });
  app.post('/api/password/recover',rateLimit({windowMs:60000,limit:10}),async(req,res)=>{
    if(!identity?.recoverPassword)return res.status(503).json({error:'Password recovery is not configured'});
    const b=z.object({access_token:z.string().min(1).max(8000),refresh_token:z.string().min(1).max(8000),password:z.string().min(12).max(200)}).parse(req.body);
    const id=await identity.recoverPassword(b.access_token,b.refresh_token,b.password);
    await db.run('DELETE FROM sessions WHERE user_id=?',[id]);res.json({ok:true});
  });
  app.get("/api/me", auth, (req, res) => res.json((req as AuthRequest).user));
  app.get("/api/events", auth, (req, res) => {
    const u = (req as AuthRequest).user;
    res.set({ "Content-Type": "text/event-stream", Connection: "keep-alive" });
    res.flushHeaders();
    clients.set(res, u);
    streamSessions.set(res, hash(req.cookies.session || ""));
    res.write("event: ready\ndata: {}\n\n");
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20000);
    const expiry = setTimeout(() => res.end(), 8 * 3600000);
    req.on("close", () => {
      clients.delete(res);
      streamSessions.delete(res);
      clearInterval(heartbeat);
      clearTimeout(expiry);
    });
  });
  app.get("/api/notifications", auth, async (req, res) => {
    res.json(await notifications(db, (req as AuthRequest).user, mode(req)));
  });
  app.get("/api/fleet", auth, async (req, res) => {
    const u = (req as AuthRequest).user;
    const list = await db.query(
      "SELECT id FROM vehicles WHERE org_id=? ORDER BY id",
      [u.org_id],
    );
    const result = [];
    for (const { id } of list) {
      const v = await vehicle(u, id);
      if (!v) continue;
      const [t] = await db.query(
        "SELECT * FROM telemetry WHERE device_id=? AND mode=? AND id NOT IN (SELECT telemetry_id FROM cpe_samples WHERE historical=1) AND id NOT IN (SELECT telemetry_id FROM archived_frames) ORDER BY received_at DESC LIMIT 1",
        [v.device_id, mode(req)],
      );
      const [gps] = await db.query(
        "SELECT * FROM gps_records WHERE device_id=? AND mode=? ORDER BY measured_at DESC LIMIT 1",
        [v.device_id, mode(req)],
      );
      const [e] = await db.query(
        "SELECT SUM(CASE WHEN source='solar' THEN increment_wh ELSE NULL END) AS solar_wh,SUM(CASE WHEN source='wind' THEN increment_wh ELSE NULL END) AS wind_wh FROM energy_measurements WHERE device_id=? AND mode=? AND power_w IS NOT NULL",
        [v.device_id, mode(req)],
      );
      result.push({
        ...v,
        telemetry: t
          ? {
              ...JSON.parse(t.payload),
              received_at: t.received_at,
              measured_at: t.measured_at,
            }
          : null,
        status: freshness(t?.received_at || null),
        measurement_time_quality: t ? (JSON.parse(t.payload).device_timestamp ? 'device_utc' : 'receipt_only') : 'unavailable',
        measurement_age_ms: t && JSON.parse(t.payload).device_timestamp ? Math.max(0,Date.now()-Date.parse(JSON.parse(t.payload).device_timestamp)) : null,
        gps_age_ms: gps ? Math.max(0,Date.now()-Date.parse(gps.measured_at)) : null,
        gps: gps || null,
        solar_wh: e.solar_wh,
        wind_wh: e.wind_wh,
      });
    }
    res.json(result);
  });
  app.get("/api/history/:id", auth, async (req, res) => {
    const v = await vehicle((req as AuthRequest).user, String(req.params.id));
    if (!v) return res.status(403).json({ error: "Vehicle access denied" });
    const offset = Math.max(0, Number(req.query.offset) || 0);
    res.json(
      await db.query(
        "SELECT * FROM telemetry WHERE device_id=? AND mode=? ORDER BY received_at DESC LIMIT 100 OFFSET ?",
        [v.device_id, mode(req), offset],
      ),
    );
  });
  app.get("/api/export/:id", auth, async (req, res) => {
    const v = await vehicle((req as AuthRequest).user, String(req.params.id));
    if (!v) return res.status(403).json({ error: "Vehicle access denied" });
    const rows = await db.query(
      "SELECT * FROM telemetry WHERE device_id=? AND mode=? ORDER BY received_at DESC LIMIT 5000",
      [v.device_id, mode(req)],
    );
    res.set(
      "Content-Disposition",
      `attachment; filename="solair-${v.id}-${mode(req)}.json"`,
    );
    const energy=await db.query('SELECT e.* FROM energy_measurements e JOIN telemetry t ON t.id=e.telemetry_id WHERE t.device_id=? AND t.mode=? ORDER BY t.received_at DESC LIMIT 15000',[v.device_id,mode(req)]);
    res.json({ source_type: mode(req), exported_at: now(), records: rows, energy_measurements:energy, limit:5000 });
  });
  app.get("/api/cpe-export/:id", auth, async (req,res)=>{
    const v=await vehicle((req as AuthRequest).user,String(req.params.id));
    if(!v)return res.status(403).json({error:"Vehicle access denied"});
    const rows=await db.query("SELECT * FROM cpe_samples WHERE device_id=? AND mode=? ORDER BY received_at DESC LIMIT 5000",[v.device_id,mode(req)]);
    const keys=["telemetry_id","device_id","mode","load_mode","received_at","device_timestamp","pzem_voltage_v","pzem_current_a","pzem_power_w","pzem_energy_wh","acs_current_a","lte_registered","alarm_commanded","quality_json"];
    const cell=(x:unknown)=>'"'+(typeof x==='number'?String(x):String(x??"").replace(/^[=+@-]/,"'$&")).replaceAll('"','""')+'"';
    res.type("text/csv").set("Content-Disposition",`attachment; filename="solair-cpe-${mode(req)}.csv"`).set("X-Export-Limit","5000").send([keys.join(","),...rows.map(r=>keys.map(k=>cell(r[k])).join(","))].join("\r\n"));
  });
  app.get("/api/cpe-diagnostics/:id",auth,role('engineer','admin'),async(req,res)=>{
    const v=await vehicle((req as AuthRequest).user,String(req.params.id));
    if(!v)return res.status(403).json({error:'Vehicle access denied'});
    res.json(await db.query("SELECT action,created_at FROM audit_logs WHERE org_id=? AND target=? AND action LIKE 'device_ingest_rejected:%' ORDER BY created_at DESC LIMIT 10",[(req as AuthRequest).user.org_id,v.device_id]));
  });
  app.get("/api/alerts", auth, async (req, res) => {
    const u = (req as AuthRequest).user;
    let rows = await db.query(
      "SELECT e.*,v.id AS vehicle_id FROM security_events e JOIN devices d ON d.id=e.device_id JOIN vehicles v ON v.id=d.vehicle_id WHERE v.org_id=? AND e.mode=? ORDER BY e.created_at DESC LIMIT 200",
      [u.org_id, mode(req)],
    );
    if (u.role === "driver") {
      const allowed = await db.query(
        "SELECT vehicle_id FROM assignments WHERE driver_id=?",
        [u.id],
      );
      rows = rows.filter((r) =>
        allowed.some((a) => a.vehicle_id === r.vehicle_id),
      );
    }
    res.json(rows);
  });
  app.post(
    "/api/alerts/:id/ack",
    auth,
    role("operator", "engineer", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      const [e] = await db.query(
        "SELECT e.*,d.vehicle_id FROM security_events e JOIN devices d ON d.id=e.device_id WHERE e.id=?",
        [req.params.id],
      );
      if (!e || !(await vehicle(u, e.vehicle_id)))
        return res.status(403).json({ error: "Access denied" });
      await db.run("UPDATE security_events SET ack_by=? WHERE id=?", [
        u.id,
        e.id,
      ]);
      await audit(u, "alert_ack", e.id);
      notify(u.org_id);
      res.json({ ok: true });
    },
  );
  app.get("/api/help", auth, async (req, res) => {
    const u = (req as AuthRequest).user;
    res.json(
      await db.query(
        `SELECT * FROM help_requests WHERE org_id=? AND mode=?${u.role === "driver" ? " AND driver_id=?" : ""} ORDER BY created_at DESC LIMIT 100`,
        u.role === "driver"
          ? [u.org_id, mode(req), u.id]
          : [u.org_id, mode(req)],
      ),
    );
  });
  app.post("/api/help", auth, role("driver"), async (req, res) => {
    const u = (req as AuthRequest).user;
    const b = z
      .object({
        id: z.uuid(),
        vehicle_id: z.string(),
        type: z.enum([
          "Emergency SOS",
          "Mechanical assistance",
          "Charging assistance",
          "Other",
        ]),
        notes: z.string().max(2000),
      })
      .parse(req.body);
    if (!(await vehicle(u, b.vehicle_id)))
      return res.status(403).json({ error: "Vehicle access denied" });
    await db.run(
      "INSERT INTO help_requests VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      [
        b.id,
        u.org_id,
        b.vehicle_id,
        u.id,
        mode(req),
        b.type,
        b.notes,
        "pending",
        now(),
        now(),
      ],
    );
    await audit(u, "help_submitted", b.id);
    notify(u.org_id);
    res
      .status(201)
      .json({ id: b.id, status: "pending", server_received_at: now() });
  });
  app.patch(
    "/api/help/:id",
    auth,
    role("operator", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      const status = z
        .enum(["acknowledged", "resolved"])
        .parse(req.body.status);
      const [h] = await db.query(
        "SELECT * FROM help_requests WHERE id=? AND org_id=?",
        [req.params.id, u.org_id],
      );
      if (!h) return res.status(404).json({ error: "Request not found" });
      if (
        h.status === "resolved" ||
        (status === "resolved" && h.status !== "acknowledged")
      )
        return res
          .status(409)
          .json({ error: "Acknowledge the request before resolving it" });
      await db.run(
        "UPDATE help_requests SET status=?,updated_at=? WHERE id=?",
        [status, now(), h.id],
      );
      await audit(u, "help_" + status, h.id);
      notify(u.org_id);
      res.json({ ok: true });
    },
  );
  app.get("/api/messages/:id", auth, async (req, res) => {
    const u = (req as AuthRequest).user;
    if (!(await vehicle(u, String(req.params.id))))
      return res.status(403).json({ error: "Vehicle access denied" });
    res.json(
      await db.query(
        "SELECT m.*,p.name AS sender_name FROM messages m JOIN profiles p ON p.id=m.sender_id WHERE m.vehicle_id=? AND m.org_id=? AND m.mode=? ORDER BY created_at LIMIT 200",
        [req.params.id, u.org_id, mode(req)],
      ),
    );
  });
  app.post(
    "/api/messages/:id",
    auth,
    role("driver", "operator", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      if (!(await vehicle(u, String(req.params.id))))
        return res.status(403).json({ error: "Vehicle access denied" });
      const body = z.string().trim().min(1).max(2000).parse(req.body.body);
      const id = randomUUID();
      await db.run("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?)", [
        id,
        u.org_id,
        req.params.id,
        u.id,
        mode(req),
        body,
        now(),
        null,
      ]);
      notify(u.org_id);
      res.status(201).json({ id, delivery: "server received" });
    },
  );
  app.post("/api/messages/:id/read", auth, async (req, res) => {
    const u = (req as AuthRequest).user;
    const [m] = await db.query(
      "SELECT * FROM messages WHERE id=? AND org_id=?",
      [req.params.id, u.org_id],
    );
    if (!m || !(await vehicle(u, m.vehicle_id)))
      return res.status(403).json({ error: "Access denied" });
    if (m.sender_id !== u.id)
      await db.run("UPDATE messages SET read_at=? WHERE id=?", [now(), m.id]);
    res.json({ ok: true });
  });
  app.patch("/api/profile", auth, async (req, res) => {
    const u = (req as AuthRequest).user;
    const b = z
      .object({
        name: z.string().trim().min(1).max(80),
        notifications: z.boolean(),
      })
      .parse(req.body);
    await db.run("UPDATE profiles SET name=?,notifications=? WHERE id=?", [
      b.name,
      b.notifications ? 1 : 0,
      u.id,
    ]);
    res.json({ ok: true });
  });
  app.get("/api/users", auth, role("operator", "admin"), async (req, res) =>
    res.json(
      await db.query("SELECT id,name,email,role FROM profiles WHERE org_id=?", [
        (req as AuthRequest).user.org_id,
      ]),
    ),
  );
  app.post("/api/assign",auth,role("operator","admin"),async(req,res)=>{
    const u=(req as AuthRequest).user;
    const b=z.object({vehicle_id:z.string(),driver_id:z.string(),operator_id:z.string().optional()}).parse(req.body);
    const [d]=await db.query("SELECT id,name FROM profiles WHERE id=? AND org_id=? AND role='driver'",[b.driver_id,u.org_id]);
    if(!d||!await vehicle(u,b.vehicle_id))return res.status(403).json({error:'Invalid organization assignment'});
    let operator:any=null;
    if(b.operator_id){
      [operator]=await db.query("SELECT id,name FROM profiles WHERE id=? AND org_id=? AND role IN ('operator','admin')",[b.operator_id,u.org_id]);
      if(!operator||(u.role==='operator'&&operator.id!==u.id))return res.status(403).json({error:'Choose an authorized operator in this TODA; operators can select only themselves'});
    }
    await db.transaction(async tx=>{
      await tx.run('INSERT INTO assignments VALUES (?,?) ON CONFLICT(vehicle_id) DO UPDATE SET driver_id=excluded.driver_id',[b.vehicle_id,b.driver_id]);
      if(operator){
        await tx.run('INSERT INTO vehicle_operators VALUES (?,?) ON CONFLICT(vehicle_id) DO UPDATE SET operator_id=excluded.operator_id',[b.vehicle_id,operator.id]);
        await tx.run('UPDATE device_operation SET commissioned=0 WHERE device_id IN (SELECT id FROM devices WHERE vehicle_id=?) AND (operator_id IS NULL OR operator_id<>?)',[b.vehicle_id,operator.id]);
      }
      const id=randomUUID();await tx.run('INSERT INTO audit_logs VALUES (?,?,?,?,?,?)',[id,u.org_id,u.id,'vehicle_assigned',b.vehicle_id,now()]);
      await tx.run('INSERT INTO activity_details VALUES (?,?)',[id,`Assigned ${d.name} to ${b.vehicle_id}${operator?'; responsible operator: '+operator.name:'. Operator assignment unchanged.'}`]);
    });notify(u.org_id);res.json({ok:true});
  });
  app.post("/api/invite", auth, role("operator", "admin"), async (req, res) => {
    const u = (req as AuthRequest).user;
    const b = z
      .object({
        email: z.email(),
        role: z.enum(["driver", "operator", "engineer", "admin"]),
      })
      .parse(req.body);
    if (u.role === "operator" && b.role !== "driver")
      return res
        .status(403)
        .json({ error: "Operators may invite drivers only" });
    const t = token();
    await db.run("INSERT INTO invitations VALUES (?,?,?,?,?,?,?)", [
      randomUUID(),
      u.org_id,
      b.email,
      b.role,
      hash(t),
      new Date(Date.now() + 86400000).toISOString(),
      0,
    ]);
    await audit(u, "invite_created", b.email);
    res.json({
      invitation_url: `/register?token=${t}`,
      expires_in: "24 hours",
      delivery: "Share this link directly; email delivery is not configured",
    });
  });
  app.post(
    "/api/register",
    rateLimit({ windowMs: 60000, limit: 10 }),
    async (req, res) => {
      const b = z
        .object({
          token: z.string(),
          name: z.string().min(1).max(80),
          password: z.string().min(12).max(200),
        })
        .parse(req.body);
      let createdId:string|null=null;
      try {
        const registered=await db.transaction(async tx=>{
          const [i]=await tx.query('UPDATE invitations SET used=1 WHERE token_hash=? AND used=0 AND expires_at>? RETURNING *',[hash(b.token),now()]);
          if(!i)return false;
          if(operational()&&!identity?.registerApplicant)throw new Error('Operational signup requires verified email registration');
          createdId=identity?(operational()?await identity.registerApplicant!(i.email,b.password):await identity.createUser(i.email,b.password)):randomUUID();
          await tx.run('INSERT INTO profiles(id,org_id,email,name,role,password_hash) VALUES (?,?,?,?,?,?)',[createdId,i.org_id,i.email,b.name,i.role,identity?'supabase-managed':passwordHash(b.password)]);
          await tx.run('INSERT INTO audit_logs VALUES (?,?,?,?,?,?)',[randomUUID(),i.org_id,createdId,'account_registered',createdId,now()]);
          return true;
        });
        if(!registered)return res.status(400).json({error:'Invitation invalid or expired'});
      } catch(error){if(identity?.removeUser&&createdId)await identity.removeUser(createdId).catch(()=>{});throw error;}
      res.status(201).json({ ok: true });
    },
  );
  app.get("/api/audit", auth, role("admin"), async (req, res) =>
    res.json(
      await db.query(
        "SELECT * FROM audit_logs WHERE org_id=? ORDER BY created_at DESC LIMIT 200",
        [(req as AuthRequest).user.org_id],
      ),
    ),
  );
  app.post(
    "/api/vehicles",
    auth,
    role("operator", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      const b = z
        .object({
          id: z.string().regex(/^[A-Za-z0-9-]{1,40}$/),
          name: z.string().min(1).max(80),
          brand:z.enum(["BEMAC","NWOW"]).default("BEMAC"),
        })
        .parse(req.body);
      await db.run("INSERT INTO vehicles(id,org_id,name,model) VALUES (?,?,?,?)", [
        b.id,
        u.org_id,
        b.name,
        b.brand==='NWOW'?'NWOW':'BEMAC 68VM Passenger',
      ]);
      await audit(u, "vehicle_created", b.id);
      notify(u.org_id);
      res.status(201).json({ id: b.id });
    },
  );
  app.patch(
    "/api/users/:id",
    auth,
    role("operator", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      const b = z
        .object({
          name: z.string().min(1).max(80),
          role: z.enum(["driver", "operator", "engineer", "admin"]),
        })
        .parse(req.body);
      const [p] = await db.query(
        "SELECT * FROM profiles WHERE id=? AND org_id=?",
        [req.params.id, u.org_id],
      );
      if (
        !p ||
        u.id === p.id ||
        (u.role === "operator" && (p.role !== "driver" || b.role !== "driver"))
      )
        return res
          .status(403)
          .json({ error: "Account update is not permitted" });
      await db.run("UPDATE profiles SET name=?,role=? WHERE id=?", [
        b.name,
        b.role,
        p.id,
      ]);
      if(!["operator","admin"].includes(b.role))await db.run("DELETE FROM vehicle_operators WHERE operator_id=?",[p.id]);
      await db.run("DELETE FROM sessions WHERE user_id=?", [p.id]);
      await audit(u, "account_updated", p.id);
      res.json({ ok: true });
    },
  );
  app.post("/api/admin/workspace", auth, role("admin"), async (req, res) => {
    const u = (req as AuthRequest).user;
    const id = z.string().parse(req.body.org_id);
    if (
      !(await db.query("SELECT id FROM organizations WHERE id=?", [id])).length
    )
      return res.status(404).json({ error: "Organization not found" });
    await audit(u, "admin_workspace_changed", id);
    await db.run("UPDATE profiles SET org_id=? WHERE id=?", [id, u.id]);
    res.json({ ok: true });
  });
  app.get("/api/organization", auth, async (req, res) =>
    res.json(
      (
        await db.query("SELECT * FROM organizations WHERE id=?", [
          (req as AuthRequest).user.org_id,
        ])
      )[0],
    ),
  );
  app.post(
    "/api/vehicle-image/:id",
    auth,
    role("engineer", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      const v = await vehicle(u, String(req.params.id));
      if (!v) return res.status(403).json({ error: "Vehicle access denied" });
      const b = z
        .object({
          mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
          base64: z.string().max(4000000),
        })
        .parse(req.body);
      const bytes = Buffer.from(b.base64, "base64");
      const valid =
        b.mime === "image/png"
          ? bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
          : b.mime === "image/jpeg"
            ? bytes.subarray(0, 3).toString("hex") === "ffd8ff"
            : bytes.subarray(0, 4).toString() === "RIFF" &&
              bytes.subarray(8, 12).toString() === "WEBP";
      if (!valid || bytes.length > 3000000)
        return res
          .status(400)
          .json({ error: "Use a valid PNG, JPEG or WebP under 3 MB" });
      await db.run(
        "INSERT INTO vehicle_images VALUES (?,?,?,?,?) ON CONFLICT(vehicle_id) DO UPDATE SET mime=excluded.mime,base64=excluded.base64,uploaded_by=excluded.uploaded_by,uploaded_at=excluded.uploaded_at",
        [v.id, b.mime, b.base64, u.id, now()],
      );
      await db.run("UPDATE vehicles SET image_url=? WHERE id=?", [
        `/api/vehicle-image/${v.id}`,
        v.id,
      ]);
      await audit(u, "vehicle_image_uploaded", v.id);
      notify(u.org_id);
      res.json({ ok: true });
    },
  );
  app.get("/api/vehicle-image/:id", auth, async (req, res) => {
    const u = (req as AuthRequest).user;
    if (!(await vehicle(u, String(req.params.id))))
      return res.status(403).json({ error: "Vehicle access denied" });
    const [i] = await db.query(
      "SELECT * FROM vehicle_images WHERE vehicle_id=?",
      [req.params.id],
    );
    if (!i) return res.status(404).json({ error: "Image not found" });
    res.type(i.mime).send(Buffer.from(i.base64, "base64"));
  });
  app.get("/api/organizations", auth, role("admin"), async (_req, res) =>
    res.json(await db.query("SELECT * FROM organizations")),
  );
  app.post("/api/organizations", auth, role("admin"), async (req, res) => {
    const name = z.string().min(2).max(100).parse(req.body.name);
    const id = randomUUID();
    await db.run("INSERT INTO organizations VALUES (?,?)", [id, name]);
    await audit((req as AuthRequest).user, "organization_created", id);
    res.status(201).json({ id });
  });
  app.post(
    "/api/devices/provision",
    auth,
    role("engineer", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      const id = z.string().parse(req.body.vehicle_id);
      const v = await vehicle(u, id);
      if (!v) return res.status(403).json({ error: "Vehicle access denied" });
      const t = token(),
        did = v.device_id || `SOL-${id}`;
      await db.run(
        "INSERT INTO devices VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash",
        [did, id, hash(t), null, now()],
      );
      await audit(u, "device_credential_rotated", did);
      res.json({
        device_id: did,
        device_token: t,
        warning: "Shown once. Store in ignored firmware config; never commit.",
      });
    },
  );
  app.post(
    "/api/bench/sessions",
    auth,
    role("engineer", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      const device = z.string().parse(req.body.device_id);
      const [d] = await db.query("SELECT vehicle_id FROM devices WHERE id=?", [
        device,
      ]);
      if (!d || !(await vehicle(u, d.vehicle_id)))
        return res.status(403).json({ error: "Device access denied" });
      const id = randomUUID();
      await db.run("INSERT INTO bench_sessions VALUES (?,?,?,?,?,?)", [
        id,
        device,
        u.id,
        mode(req),
        now(),
        null,
      ]);
      res.status(201).json({ id });
    },
  );
  app.post(
    "/api/bench/results",
    auth,
    role("engineer", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      const b = z
        .object({
          session_id: z.uuid(),
          device_id: z.string().optional(),
          mode: z.enum(["hardware","demo"]).optional(),
          test: z.string().min(1).max(100),
          result: z.enum(["PASS", "FAIL", "BLOCKED", "NOT TESTED"]),
          measurements: z.string().max(2000),
          notes: z.string().max(4000),
          evidence: z.string().max(1000),
          firmware: z.string().max(80),
        })
        .parse(req.body);
      const [s] = await db.query(
        "SELECT * FROM bench_sessions WHERE id=? AND engineer_id=?",
        [b.session_id, u.id],
      );
      if(operational()&&(!b.device_id||!b.mode))return res.status(400).json({error:'Expected device and source are required in operational evidence'});
      const [sessionDevice]=s?await db.query('SELECT vehicle_id FROM devices WHERE id=?',[s.device_id]):[];
      if (!s || !sessionDevice || !await vehicle(u,sessionDevice.vehicle_id) || s.closed_at || (b.device_id && b.device_id!==s.device_id) || (b.mode && b.mode!==s.mode)) return res.status(403).json({ error: "Session/device/source context mismatch" });
      await db.run("INSERT INTO bench_results VALUES (?,?,?,?,?,?,?,?,?)", [
        randomUUID(),
        b.session_id,
        b.test,
        b.result,
        b.measurements,
        b.notes,
        b.evidence,
        b.firmware,
        now(),
      ]);
      res.status(201).json({ ok: true });
    },
  );
  app.get(
    "/api/bench/evidence/:device",
    auth,
    role("engineer", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      const [d] = await db.query("SELECT vehicle_id FROM devices WHERE id=?", [
        req.params.device,
      ]);
      if (!d || !(await vehicle(u, d.vehicle_id)))
        return res.status(403).json({ error: "Device access denied" });
      res.json(
        await db.query(
          "SELECT r.*,s.mode,s.device_id,s.engineer_id FROM bench_results r JOIN bench_sessions s ON s.id=r.session_id WHERE s.device_id=? AND s.mode=? ORDER BY r.created_at DESC",
          [req.params.device, mode(req)],
        ),
      );
    },
  );
  app.post(
    "/api/calibrations",
    auth,
    role("engineer", "admin"),
    async (req, res) => {
      const u = (req as AuthRequest).user;
      const b = z
        .object({
          device_id: z.string(),
          sensor: z.string().min(1).max(80),
          values_json: z.string().max(4000),
          evidence: z.string().min(1).max(1000),
        })
        .parse(req.body);
      JSON.parse(b.values_json);
      const [d] = await db.query("SELECT vehicle_id FROM devices WHERE id=?", [
        b.device_id,
      ]);
      if (!d || !(await vehicle(u, d.vehicle_id)))
        return res.status(403).json({ error: "Device access denied" });
      await db.run("INSERT INTO calibrations VALUES (?,?,?,?,?,?,?)", [
        randomUUID(),
        b.device_id,
        u.id,
        b.sensor,
        b.values_json,
        b.evidence,
        now(),
      ]);
      await audit(u, "calibration_recorded", b.device_id);
      res.status(201).json({ ok: true });
    },
  );
  app.get(
    "/api/calibrations/:device",
    auth,
    role("engineer", "admin"),
    async (req, res) => {
      const [d] = await db.query("SELECT vehicle_id FROM devices WHERE id=?", [
        req.params.device,
      ]);
      if (!d || !(await vehicle((req as AuthRequest).user, d.vehicle_id)))
        return res.status(403).json({ error: "Device access denied" });
      res.json(
        await db.query(
          "SELECT * FROM calibrations WHERE device_id=? ORDER BY created_at DESC",
          [req.params.device],
        ),
      );
    },
  );
  let ingestChain = Promise.resolve();
  app.post(
    "/api/ingest",
    rateLimit({ windowMs: 60000, limit: 300 }),
    async (req, res) => {
      const parsed = telemetrySchema.safeParse(req.body);
      if (!parsed.success) {
        // Record only authenticated device errors, never raw payloads/tokens or spoofed device identities.
        if(typeof req.body?.device_id==='string'){
          const [device]=await db.query("SELECT d.token_hash,v.org_id FROM devices d JOIN vehicles v ON v.id=d.vehicle_id WHERE d.id=?",[req.body.device_id]);
          if(device&&hash((req.headers.authorization||'').replace(/^Bearer /,''))===device.token_hash){
            await db.run('INSERT INTO audit_logs VALUES (?,?,?,?,?,?)',[randomUUID(),device.org_id,null,'device_ingest_rejected: invalid telemetry schema',req.body.device_id,now()]);
            notify(device.org_id);
          }
        }
        return res
          .status(400)
          .json({
            error: "Invalid telemetry",
            issues: parsed.error.issues.map((i) => i.message),
          });
      }
      const t = parsed.data;
      const [d] = await db.query(
        "SELECT d.*,v.org_id FROM devices d JOIN vehicles v ON v.id=d.vehicle_id WHERE d.id=?",
        [t.device_id],
      );
      if (!d)
        return res.status(401).json({ error: "Device authentication failed" });
      if (req.headers["x-bench-transport"] === "usb") {
        const [u] = await db.query(
          "SELECT p.* FROM sessions s JOIN profiles p ON p.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
          [hash(req.cookies.session || ""), now()],
        );
        if (
          !u ||
          !["engineer", "admin"].includes(u.role) ||
          u.org_id !== d.org_id ||
          t.transport !== "usb" ||
          t.source_type !== "hardware"
        )
          return res.status(403).json({ error: "Bench access denied" });
      } else if (
        hash((req.headers.authorization || "").replace(/^Bearer /, "")) !==
          d.token_hash ||
        t.source_type !== "hardware" ||
        !["wifi", "lte"].includes(t.transport)
      )
        return res.status(401).json({ error: "Device authentication failed" });
      const execute = async () => {
        const duplicate = await db.query(
          "SELECT id,payload FROM telemetry WHERE device_id=? AND mode=? AND boot_id=? AND sequence=?",
          [t.device_id, t.source_type, t.boot_id, t.sequence],
        );
        if (duplicate.length) {
          const prior=JSON.parse(duplicate[0].payload);
          // USB and Wi-Fi may forward the same acquisition frame; transport alone may differ.
          if(JSON.stringify({...telemetrySchema.parse(prior),transport:t.transport})!==JSON.stringify(t)) {
            res.status(409).json({error:"Conflicting payload for stored identity"}); return;
          }
          res.json({ accepted: true, duplicate: true, ack:{persisted:true,device_id:t.device_id,boot_id:t.boot_id,sequence:t.sequence} });
          return;
        }
        const [last] = await db.query(
          "SELECT sequence FROM telemetry WHERE device_id=? AND mode=? AND boot_id=? ORDER BY sequence DESC LIMIT 1",
          [t.device_id, t.source_type, t.boot_id],
        );
        if (last && t.sequence < last.sequence && !t.cpe?.historical && !t.event_id) {
          res.status(409).json({ error: "Replayed sequence rejected" });
          return;
        }
        if (
          (t.device_timestamp && Date.parse(t.device_timestamp) > Date.now() + 60000) ||
          (t.event_timestamp && Date.parse(t.event_timestamp) > Date.now() + 60000)
        ) {
          res.status(400).json({ error: "Future timestamp rejected" });
          return;
        }
        const historical=!!t.cpe?.historical || !!(last && t.sequence<last.sequence && t.event_id);
        const received = now(),
          at = t.device_timestamp || received,
          id = randomUUID();
        await db.transaction(async (tx) => {
          const [prev] = await tx.query(
            "SELECT measured_at,payload FROM telemetry WHERE device_id=? AND mode=? AND id NOT IN (SELECT telemetry_id FROM cpe_samples WHERE historical=1) AND id NOT IN (SELECT telemetry_id FROM archived_frames) ORDER BY received_at DESC LIMIT 1",
            [t.device_id, t.source_type],
          );
          await tx.run("INSERT INTO telemetry VALUES (?,?,?,?,?,?,?,?)", [
            id,
            t.device_id,
            t.source_type,
            t.boot_id,
            t.sequence,
            received,
            at,
            JSON.stringify(t),
          ]);
          if(historical) await tx.run('INSERT INTO archived_frames VALUES (?,?)',[id,'Delayed/recovered event; not a live sample']);
          if(t.cpe) {
            const c=t.cpe;
            await tx.run("INSERT INTO cpe_samples VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[id,t.device_id,t.source_type,c.load_mode,received,t.device_timestamp,c.pzem.voltage_v,c.pzem.current_a,c.pzem.power_w,c.pzem.energy_wh,c.acs.current_a,c.lte.registered?1:0,c.alarm.commanded?1:0,JSON.stringify(c),c.historical?1:0]);
          }
          for (const source of ["solar", "wind"] as const) {
            if(historical)continue;
            const p = power(t[`${source}_voltage_v`], t[`${source}_current_a`]);
            const pt = prev ? JSON.parse(prev.payload) : null;
            const wh = integrateWh(
              pt
                ? {
                    at: prev.measured_at,
                    power: power(
                      pt[`${source}_voltage_v`],
                      pt[`${source}_current_a`],
                    ),
                  }
                : null,
              { at, power: p },
            );
            await tx.run(
              "INSERT INTO energy_measurements VALUES (?,?,?,?,?,?,?,?)",
              [randomUUID(), id, t.device_id, t.source_type, source, p, wh, at],
            );
          }
          if (t.gps_fix && !historical)
            await tx.run("INSERT INTO gps_records VALUES (?,?,?,?,?,?,?)", [
              randomUUID(),
              id,
              t.device_id,
              t.source_type,
              t.latitude,
              t.longitude,
              at,
            ]);
          if (t.event_id && t.event_type)
            await tx.run(
              "INSERT INTO security_events VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
              [
                `${t.device_id}:${t.boot_id}:${t.event_id}`,
                t.device_id,
                t.source_type,
                t.event_type,
                t.event_timestamp!==undefined?(t.event_timestamp||received):at,
                null,
              ],
            );
          const previousHealth = prev ? JSON.parse(prev.payload).sensor_health : {};
          for (const [sensor, status] of Object.entries(t.sensor_health)) {
            if(historical)continue;
            if (status !== "fault" || previousHealth[sensor] === "fault") continue;
            await tx.run("INSERT INTO security_events VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING", [
              `${t.device_id}:${t.boot_id}:${t.sequence}:fault:${sensor}`,
              t.device_id, t.source_type,
              sensor === "gps" ? "GPS unavailable" : `Sensor fault · ${sensor}`,
              at, null,
            ]);
          }
          await recordIncident(tx,t,d,received,req.headers['x-bench-transport']==='usb');
          await tx.run("UPDATE devices SET firmware_version=? WHERE id=?", [
            t.firmware_version,
            t.device_id,
          ]);
        });
        notify(d.org_id);
        res
          .status(201)
          .json({ accepted: true, id, backend_received_at: received, ack:{persisted:true,device_id:t.device_id,boot_id:t.boot_id,sequence:t.sequence} });
      };
      const job = ingestChain.then(execute);
      ingestChain = job.catch(() => {});
      await job;
    },
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found" }),
  );
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return res.status(400).json({ error: "Invalid request" });
    console.error(err.message);
    res.status(500).json({ error: "Server could not complete this action" });
  });
  app.locals.notify = notify;
  return app;
}
