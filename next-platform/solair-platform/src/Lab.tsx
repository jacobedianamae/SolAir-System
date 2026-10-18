import { useEffect, useRef, useState } from "react";
import {
  Usb,
  Activity,
  Cpu,
  CheckCircle,
  Download,
  Wifi,
  FlaskConical,
} from "lucide-react";
import { api, stamp, value } from "./api";
import { SerialBench } from "./Serial";
import type { Vehicle } from "./types";
import type { Telemetry } from "../packages/telemetry-contract";
import { guides } from "./bench-guides";
import CpeReadings from "./CpeReadings";
import CpeHistory from "./CpeHistory";
import CpeIngressErrors from "./CpeIngressErrors";
const tests = [
  "ESP32 connectivity",
  "MPU6050 I²C detection",
  "Microswitch transitions",
  "Anti-tamper LED",
  "ADS1115 known-voltage measurement",
  "ACS758 zero-current calibration",
  "GPS reception and fix",
  "LTE AT verification",
  "HW-548 control verification",
  "Siren after safety verification",
  "End-to-end telemetry",
  "Offline and reconnection",
  "PZEM USB / MAX3485 measurement",
  "Combined all-sensors soak",
];
export default function Lab({
  vehicle,
  mode,
  refresh,
  toast,
}: {
  vehicle: Vehicle;
  mode: string;
  refresh: () => void;
  toast: (s: string) => void;
}) {
  const bench = useRef(new SerialBench());
  const [connected, setConnected] = useState(false),
    [baud, setBaud] = useState(115200),
    [live, setLive] = useState<Telemetry | null>(null),
    [log, setLog] = useState<string[]>([]),
    [session, setSession] = useState(""),
    [evidence, setEvidence] = useState<any[]>([]),
    [creds, setCreds] = useState<any>(null),
    [samples, setSamples] = useState<number[]>([]);
  const [test, setTest] = useState(tests[0]),
    [result, setResult] = useState("NOT TESTED"),
    [notes, setNotes] = useState(""),
    [measurements, setMeasurements] = useState(""),
    [reference, setReference] = useState(""),
    [cal, setCal] = useState<any[]>([]);
  const t = live || vehicle.telemetry;
  const addLog = (s: string) =>
    setLog((l) =>
      [`${new Date().toLocaleTimeString("en-PH")} ${s}`, ...l].slice(0, 80),
    );
  useEffect(() => {
    api(`/bench/evidence/${vehicle.device_id}?mode=${mode}`)
      .then(setEvidence)
      .catch(() => {});
    api(`/calibrations/${vehicle.device_id}`)
      .then(setCal)
      .catch(() => {});
  }, [vehicle.device_id, mode]);
  useEffect(() => () => { void bench.current.disconnect().catch(() => {}); }, [vehicle.device_id, mode]);
  const connect = async () => {
    try {
      if (mode !== "hardware")
        throw new Error("Select REAL HARDWARE mode before USB connection");
      await bench.current.connect(
        baud,
        (t) => {
          if (t.device_id !== vehicle.device_id || t.source_type !== "hardware" || t.transport !== "usb") {
            addLog("Rejected frame: device or hardware USB provenance does not match this bench");
            return;
          }
          setLive(t);
          setSamples((s) => t.accelerometer ? [...s.slice(-39), t.accelerometer[0]] : []);
          addLog(`RX ${t.device_id} #${t.sequence}`);
          api("/ingest", "POST", t, { "X-Bench-Transport": "usb" }).catch((e) =>
            addLog(e.message),
          );
        },
        addLog,
        () => {
          setConnected(false);
          setLive(null);
          addLog("Port disconnected; last server readings retained");
        },
      );
      setConnected(true);
      addLog("USB port opened");
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const command = async (cmd: string) => {
    try {
      await bench.current.command(cmd);
      addLog(
        `TX ${cmd}; await reported state, GPIO is not proof of physical operation`,
      );
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const save = async () => {
    try {
      let sid = session;
      if (!sid) {
        sid = (
          await api(`/bench/sessions?mode=${mode}`, "POST", {
            device_id: vehicle.device_id,
          })
        ).id;
        setSession(sid);
      }
      await api("/bench/results", "POST", {
        session_id: sid,
        device_id: vehicle.device_id,
        mode,
        test,
        result,
        measurements,
        notes,
        evidence: reference,
        firmware: t?.firmware_version || "Not reported",
      });
      setEvidence(
        await api(`/bench/evidence/${vehicle.device_id}?mode=${mode}`),
      );
      toast("Test evidence saved. Physical result recorded by engineer.");
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const exportEvidence = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              device: vehicle.device_id,
              mode,
              physical_tests: evidence,
              calibrations: cal,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    a.download = `solair-bench-${mode}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <div className="lab-connect panel">
        <div>
          <span className="eyebrow">HARDWARE WORKSPACE</span>
          <h2>From breadboard to road.</h2>
          <p>Connect, observe and document genuine device behavior.</p>
        </div>
        <div className="connection-actions">
          <select
            aria-label="Serial baud rate"
            value={baud}
            onChange={(e) => setBaud(+e.target.value)}
          >
            <option>115200</option>
            <option>9600</option>
          </select>
          <button
            className="primary"
            onClick={
              connected
                ? async () => {
                    await bench.current.disconnect();
                    setConnected(false);
                  }
                : connect
            }
          >
            <Usb size={17} />
            {connected ? "Disconnect USB" : "Connect ESP32"}
          </button>
        </div>
      </div>
      <div className="lab-info">
        <span>
          <Cpu size={16} /> {vehicle.device_id}
        </span>
        <span>
          <span className={"dot " + (connected ? "green" : "")} />
          {connected ? "USB connected" : vehicle.status}
        </span>
        <span>Firmware {t?.firmware_version || "—"}</span>
        <span>
          Uptime{" "}
          {t?.device_uptime_ms == null
            ? "—"
            : Math.floor(t.device_uptime_ms / 1000) + " s"}
        </span>
        <span>Heartbeat {stamp(vehicle.telemetry?.received_at)}</span>
      </div>
      <div className="lab-grid">
        <section className="panel"><h3>Sensor sample age</h3><p>Independent of device contact and GPS-fix age. These ages were reported at acquisition, not proof of current connectivity.</p>{t&&Object.entries(t.sensor_age_ms||{}).length?<ul>{Object.entries(t.sensor_age_ms||{}).map(([sensor,age])=><li key={sensor}>{sensor}: {age} ms at frame capture</li>)}</ul>:<p>Sensor ages unavailable in this firmware frame.</p>}</section>
      <CpeReadings t={t} />
        <section className="panel">
          <div className="panel-heading">
            <h3>
              <Activity size={18} /> Motion & enclosure
            </h3>
            <span className="badge">{t?.sensor_health.mpu6500_compatible && t.sensor_health.mpu6500_compatible !== "absent" ? "MPU6500-compatible" : "IMU"}</span>
          </div>
          <div className="axis-readings">
            {["X", "Y", "Z"].map((a, i) => (
              <div key={a}>
                <small>{a} acceleration</small>
                <strong>
                  {value(t?.accelerometer?.[i], 3)} <em>m/s²</em>
                </strong>
                <small>Gyro {value(t?.gyroscope?.[i], 2)} °/s</small>
              </div>
            ))}
          </div>
          <svg viewBox="0 0 400 85" className="spark">
            <path
              d={samples
                .map((v, i) => `${i ? "L" : "M"} ${i * 10} ${42 - v * 8}`)
                .join(" ")}
              fill="none"
              stroke="#00a89a"
              strokeWidth="2"
            />
            <path d="M0 42H400" stroke="#d8e2ea" strokeDasharray="4 4" />
          </svg>
          <div className="switch-row">
            <span>Lid · GPIO25</span>
            <strong>
              {t?.lid_state || "Not reported"} · raw {t?.lid_raw ?? "—"}
            </strong>
          </div>
          <div className="switch-row">
            <span>Mount · GPIO26</span>
            <strong>
              {t?.mount_state || "Not reported"} · raw {t?.mount_raw ?? "—"}
            </strong>
          </div>
          <div className="button-row">
            <button disabled={t?.schema_version===2} onClick={() => command("calibrate_motion")}>
              {t?.schema_version===2?"Motion calibration: recorded firmware coefficients":"Calibrate baseline"}
            </button>
            <button onClick={() => command(t?.armed ? "disarm" : "arm")}>
              {t?.armed ? "Disarm bench" : "Arm bench"}
            </button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>
              <Cpu size={18} /> Sensor diagnostics
            </h3>
          </div>
          {[
            "mpu6050",
            "mpu6500_compatible",
            "switches",
            "ads1115",
            "acs758",
            "gps",
            "lte",
            "pzem017",
            "wind",
          ].map((s) => (
            <div className="switch-row" key={s}>
              <span>{s.toUpperCase()}</span>
              <span className="badge">
                {t?.sensor_health[s] || "Not reported"}
              </span>
            </div>
          ))}
          <p className="subtle">
            ADS gain: {t?.ads_gain || "—"} · A0: {value(t?.ads_voltage?.[0], 4)}{" "}
            V · raw {t?.ads_raw?.[0] ?? "—"}
          </p>
          <p className="subtle">
            ACS output {value(t?.acs_output_v, 4)} V · zero{" "}
            {value(t?.acs_zero_v, 4)} V
          </p>
          <p className="subtle">
            GPS: {t?.gps_fix ? "Valid fix" : "No fix"} · satellites{" "}
            {t?.satellites ?? "—"} · age {t?.gps_fix_age_ms ?? "—"} ms
          </p>
          <p className="subtle">
            LTE registration {t?.lte_registration || "Unavailable"} · signal{" "}
            {t?.lte_signal_quality ?? "—"}
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>
              <FlaskConical size={18} /> Guided physical test
            </h3>
            <span className="badge">
              {mode === "demo" ? "SIMULATED WORKSPACE" : "ENGINEER EVIDENCE"}
            </span>
          </div>
          <label>
            Test
            <select value={test} onChange={(e) => setTest(e.target.value)}>
              {tests.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <ol className="guide-steps">
            {guides[test]?.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <label>
            Observed result
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              {["NOT TESTED", "PASS", "FAIL", "BLOCKED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Measured values
            <input
              value={measurements}
              onChange={(e) => setMeasurements(e.target.value)}
              placeholder="Instrument reading, units and conditions"
            />
          </label>
          <label>
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what actually happened"
            />
          </label>
          <label>
            Evidence reference
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Photo/report filename or reference"
            />
          </label>
          <button className="primary" onClick={save}>
            <CheckCircle size={16} />
            Save test record
          </button>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>
              <Wifi size={18} /> Transport & safe output
            </h3>
          </div>
          <p>USB and Wi-Fi use validated v1/v2 telemetry. Remote commands are not connected; bench controls require USB.</p>
          <a className="button" href={`/api/cpe-export/${vehicle.id}?mode=${mode}`}>Export CPE CSV (up to 5,000 rows)</a>
          <details><summary>Last payload / device provenance</summary><pre>{JSON.stringify(t,null,2)||"No accepted payload"}</pre></details>
          {mode==='hardware'&&<CpeIngressErrors vehicleId={vehicle.id} />}
          <code>
            POST /api/ingest
            <br />
            Authorization: Bearer device-token
          </code>
          <button
            onClick={async () => {
              try {
                setCreds(
                  await api("/devices/provision", "POST", {
                    vehicle_id: vehicle.id,
                  }),
                );
                toast("Device token rotated; previous token is revoked");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            Provision / rotate device credential
          </button>
          {creds && (
            <div className="secret">
              <strong>Copy once into solair_config.h</strong>
              <textarea readOnly value={creds.device_token} />
              <button onClick={() => setCreds(null)}>Hide credential</button>
            </div>
          )}
          <div className="safety">
            <strong>Siren disabled by default</strong>
            <p>
              GPIO27 command:{" "}
              {t?.alarm_active ? "Active" : "Inactive / unavailable"}.
              Verification:{" "}
              {t?.siren_verified
                ? "Firmware reports verified"
                : "Not physically verified"}
              . A GPIO state is not proof of siren operation.
            </p>
          </div>
          <div className="button-row">
            <button onClick={() => command("led_test")}>
              Test low-voltage LED
            </button>
            <button onClick={() => command("alarm_off")}>
              Clear bench alarm
            </button>
          </div>
          <p className="subtle">
            Powered siren enablement requires a documented electrical test and
            firmware configuration. No traction controls exist.
          </p>
        </section>
      </div>
      <section className="panel">
        <CpeHistory vehicleId={vehicle.id} mode={mode} />
        <div className="panel-heading">
          <h3>Evidence & calibration records</h3>
          <button onClick={exportEvidence}>
            <Download size={16} />
            Export JSON
          </button>
          <a className="button" href={`/api/bench-export/${encodeURIComponent(vehicle.device_id||'')}?mode=${mode}`}>Export evidence CSV</a>
        </div>
        <div className="button-row">
          <button
            onClick={async () => {
              const values = window.prompt(
                "Calibration JSON (offset, reference instrument, units)",
              );
              if (!values) return;
              const evidence = window.prompt(
                "Physical calibration evidence reference",
              );
              if (!evidence) return;
              try {
                await api("/calibrations", "POST", {
                  device_id: vehicle.device_id,
                  sensor: "ACS758",
                  values_json: values,
                  evidence,
                });
                setCal(await api(`/calibrations/${vehicle.device_id}`));
                toast(
                  "Calibration record saved; apply verified coefficients in firmware",
                );
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            Record ACS calibration
          </button>
          <button onClick={refresh}>Refresh network telemetry</button>
        </div>
        {evidence.length ? (
          evidence.map((e) => (
            <div className="switch-row" key={e.id}>
              <span>
                {e.test} · {stamp(e.created_at)}
              </span>
              <strong>
                {e.result} ·{" "}
                {e.mode === "demo"
                  ? "SIMULATED"
                  : e.measurements || "No measurement"}
              </strong>
            </div>
          ))
        ) : (
          <p className="empty">
            No tests recorded. Hardware tests start as NOT TESTED.
          </p>
        )}
        {cal.map((c) => (
          <p key={c.id}>
            {c.sensor} · {stamp(c.created_at)} · {c.evidence}
          </p>
        ))}
      </section>
      <details className="panel serial-log">
        <summary>Serial transition log · {log.length} lines</summary>
        <pre>{log.join("\n") || "Awaiting hardware connection"}</pre>
      </details>
    </>
  );
}
