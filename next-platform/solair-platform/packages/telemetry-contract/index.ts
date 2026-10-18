import { z } from "zod";
const voltage = z.number().finite().min(0).max(100).nullable().default(null);
const current = z.number().finite().min(-100).max(100).nullable().default(null);
const quality = z.enum(["ok", "unavailable", "fault", "uncalibrated"]);
export const cpeSchema = z.object({
  historical: z.boolean(),
  meter_source: z.enum(["bench_supply","mppt_output","unknown"]),
  mpu_raw: z.array(z.number().int().min(-32768).max(32767)).length(7).nullable(),
  load_mode: z.enum(["bench_resistor", "vehicle_charging", "none", "unknown"]),
  pzem: z.object({ quality, voltage_v: z.number().finite().min(0).max(350).nullable(), current_a: z.number().finite().min(0).max(300).nullable(), power_w: z.number().finite().min(0).max(100000).nullable(), energy_wh: z.number().finite().nonnegative().nullable(), alarm_high: z.boolean().nullable(), alarm_low: z.boolean().nullable() }).strict(),
  acs: z.object({ quality, current_a: current, adc_mv: z.number().finite().min(0).max(3300).nullable(), zero_v: voltage, sensitivity_v_per_a: z.number().positive().max(10).nullable() }).strict(),
  lte: z.object({ quality, at_detected: z.boolean(), registered: z.boolean(), attached: z.boolean(), rssi: z.number().int().min(0).max(99).nullable(), uplink_commissioned: z.boolean() }).strict(),
  gps: z.object({ quality, hdop: z.number().finite().nonnegative().nullable(), checksum_failures: z.number().int().nonnegative(), software_uart_overflows: z.number().int().nonnegative() }).strict(),
  alarm: z.object({ commanded: z.boolean(), output_level: z.number().int().min(0).max(1).nullable(), feedback: z.boolean().nullable(), reason: z.enum(["lid", "mount", "motion", "test"]).nullable(), duration_ms: z.number().int().min(0).max(10000) }).strict(),
  queue_dropped: z.number().int().nonnegative(),
}).strict().superRefine((v,c)=>{
  const p=v.pzem;
  if(p.quality!=="ok" && [p.voltage_v,p.current_a,p.power_w,p.energy_wh].some(x=>x!==null)) c.addIssue({code:"custom",message:"Unavailable PZEM cannot carry measurements"});
  if(p.quality==="ok" && [p.voltage_v,p.current_a,p.power_w,p.energy_wh].some(x=>x===null)) c.addIssue({code:"custom",message:"Healthy PZEM requires all measurements"});
  if(v.acs.quality!=="ok" && v.acs.current_a!==null) c.addIssue({code:"custom",message:"ACS current requires calibrated quality"});
  if(v.lte.registered && !v.lte.at_detected) c.addIssue({code:"custom",message:"LTE registration requires AT detection"});
  if(v.lte.attached && !v.lte.registered) c.addIssue({code:"custom",message:"LTE attachment requires registration"});
});
export const telemetrySchema = z
  .object({
    schema_version: z.union([z.literal(1), z.literal(2)]),
    cpe: cpeSchema.nullable().default(null),
    device_id: z.string().min(1).max(80),
    firmware_version: z.string().max(80),
    boot_id: z.string().min(1).max(80),
    sequence: z.number().int().nonnegative(),
    device_uptime_ms: z.number().int().nonnegative(),
    device_timestamp: z.iso.datetime().nullable().default(null),
    source_type: z.enum(["hardware", "demo"]),
    transport: z.enum(["usb", "wifi", "lte", "simulation"]),
    sensor_age_ms: z.record(z.string(),z.number().finite().nonnegative()).default({}),
    sensor_health: z.record(
      z.string(),
      z.enum(["ok", "absent", "fault", "uncalibrated"]),
    ),
    battery_voltage_v: voltage,
    battery_current_a: current,
    auxiliary_voltage_v: voltage,
    solar_voltage_v: voltage,
    solar_current_a: current,
    solar_output_voltage_v: voltage,
    solar_output_current_a: current,
    wind_voltage_v: voltage,
    wind_current_a: current,
    accelerometer: z
      .array(z.number().finite().min(-200).max(200))
      .length(3)
      .nullable()
      .default(null),
    gyroscope: z
      .array(z.number().finite().min(-3000).max(3000))
      .length(3)
      .nullable()
      .default(null),
    lid_state: z.enum(["secure", "tampered"]).nullable().default(null),
    mount_state: z.enum(["secure", "tampered"]).nullable().default(null),
    lid_raw: z.number().int().min(0).max(1).nullable().default(null),
    mount_raw: z.number().int().min(0).max(1).nullable().default(null),
    motion_detected: z.boolean().nullable().default(null),
    armed: z.boolean().nullable().default(null),
    alarm_active: z.boolean().nullable().default(null),
    siren_verified: z.boolean().default(false),
    gps_fix: z.boolean().default(false),
    latitude: z.number().min(-90).max(90).nullable().default(null),
    longitude: z.number().min(-180).max(180).nullable().default(null),
    gps_fix_age_ms: z.number().nonnegative().nullable().default(null),
    satellites: z.number().int().nonnegative().nullable().default(null),
    ads_raw: z
      .array(z.number().int().min(-32768).max(32767).nullable())
      .length(4)
      .nullable()
      .default(null),
    ads_voltage: z
      .array(z.number().min(-6.144).max(6.144).nullable())
      .length(4)
      .nullable()
      .default(null),
    ads_gain: z.string().nullable().default(null),
    acs_output_v: voltage,
    acs_zero_v: voltage,
    calibration_status: z
      .enum(["unverified", "calibrated"])
      .default("unverified"),
    lte_registration: z.string().nullable().default(null),
    lte_signal_quality: z.number().min(0).max(99).nullable().default(null),
    alarm_id: z.string().min(1).max(80).nullable().default(null),
    alarm_causes: z.array(z.enum(['lid','mount','motion','sensor_fault'])).max(4).default([]),
    event_timestamp: z.iso.datetime().nullable().optional(),
    event_uptime_ms: z.number().int().nonnegative().optional(),
    event_id: z.string().max(80).nullable().default(null),
    event_type: z
      .enum(["motion", "lid", "mount", "sensor_fault"])
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((t, c) => {
    if ((t.schema_version===2)!==(t.cpe!==null)) c.addIssue({code:"custom",message:"v2 requires CPE data; v1 cannot carry CPE data"});
    if(t.cpe?.historical && (!t.event_id||!t.event_type))c.addIssue({code:"custom",message:"Historical CPE frames require event identity"});
    if(t.transport==="lte" && !t.cpe?.lte.uplink_commissioned) c.addIssue({code:"custom",message:"LTE transport requires commissioned uplink"});
    if (
      t.gps_fix &&
      (t.latitude === null ||
        t.longitude === null ||
        t.gps_fix_age_ms === null ||
        t.gps_fix_age_ms > 30000)
    )
      c.addIssue({
        code: "custom",
        message: "A valid GPS fix requires coordinates and age ≤30 seconds",
      });
    if (!t.gps_fix && (t.latitude !== null || t.longitude !== null))
      c.addIssue({
        code: "custom",
        message: "Coordinates require a valid GPS fix",
      });
    if (t.source_type === "hardware" && t.transport === "simulation")
      c.addIssue({ code: "custom", message: "Simulation cannot be hardware" });
    if (t.source_type === "demo" && t.transport !== "simulation")
      c.addIssue({
        code: "custom",
        message: "Demo must use simulation transport",
      });
    if (
      t.source_type === "hardware" &&
      t.calibration_status !== "calibrated" &&
      [
        t.battery_voltage_v,
        t.battery_current_a,
        t.solar_voltage_v,
        t.solar_current_a,
        t.wind_voltage_v,
        t.wind_current_a,
        t.solar_output_voltage_v,
        t.solar_output_current_a,
      ].some((v) => v !== null)
    )
      c.addIssue({
        code: "custom",
        message: "Electrical measurements require calibration",
      });
  });
export type Telemetry = z.infer<typeof telemetrySchema>;
export function power(v: number | null, i: number | null) {
  return v === null || i === null ? null : v * i;
}
export function integrateWh(
  previous: { at: string; power: number | null } | null,
  next: { at: string; power: number | null },
  maxGapMs = 30000,
) {
  if (!previous || previous.power === null || next.power === null) return 0;
  const dt = Date.parse(next.at) - Date.parse(previous.at);
  return dt > 0 && dt <= maxGapMs
    ? (((previous.power + next.power) / 2) * dt) / 3600000
    : 0;
}
export function freshness(at: string | null) {
  if (!at) return "Never connected";
  const age = Date.now() - Date.parse(at);
  return age < 30000 ? "Online" : age < 90000 ? "Delayed" : "Offline";
}
export class NDJSONParser {
  private buffer = "";
  constructor(
    private onMessage: (t: Telemetry) => void,
    private onError: (e: string) => void,
  ) {}
  feed(chunk: string) {
    this.buffer += chunk;
    if (this.buffer.length > 65536) {
      this.buffer = "";
      this.onError("Serial buffer exceeded limit");
      return;
    }
    let i: number;
    while ((i = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, i).trim();
      this.buffer = this.buffer.slice(i + 1);
      if (!line) continue;
      try {
        this.onMessage(telemetrySchema.parse(JSON.parse(line)));
      } catch {
        this.onError("Invalid telemetry line rejected");
      }
    }
  }
}
