# Version 1 telemetry contract

The canonical source is `packages/telemetry-contract/index.ts`. USB and HTTPS use the same strict Zod schema. Unknown fields, invalid types, nonfinite/out-of-range values and invalid provenance are rejected. The firmware creates this format; browser USB authenticates engineer access and submits unchanged validated frames.

```json
{
  "schema_version": 1,
  "device_id": "SOL-ET-01",
  "firmware_version": "solair-1.0.0",
  "boot_id": "unique-per-boot",
  "sequence": 1,
  "device_uptime_ms": 2000,
  "device_timestamp": null,
  "source_type": "hardware",
  "transport": "usb",
  "sensor_health": { "mpu6050": "ok", "ads1115": "absent", "wind": "absent" },
  "accelerometer": [0, 0, 9.81],
  "gyroscope": [0, 0, 0],
  "battery_voltage_v": null,
  "battery_current_a": null,
  "lid_state": "secure",
  "mount_state": "secure",
  "gps_fix": false,
  "latitude": null,
  "longitude": null,
  "calibration_status": "unverified"
}
```

This example is explanatory, not physical evidence. Do not submit it as genuine hardware data outside isolated software tests.

| Fields                                          | Units / validity                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| IDs / boot / sequence                           | Device-bound stable ID, unique boot, nonnegative integer sequence; `(device, mode, boot, sequence)` deduplicates   |
| device_timestamp                                | UTC ISO time or null; >60 s future rejected; receipt UTC stored separately                                         |
| device_uptime_ms                                | Nonnegative milliseconds, useful when NTP unavailable                                                              |
| source_type / transport                         | `hardware`: USB/Wi-Fi/LTE; `demo`: simulation only                                                                 |
| sensor_health                                   | `ok`, `absent`, `fault`, `uncalibrated`; independent module availability                                           |
| battery_voltage_v / battery_current_a           | 0–100 V / ±100 A; null unless independently instrumented/calibrated; positive current charges, negative discharges |
| solar_voltage_v / solar_current_a               | PV input, 0–100 V / ±100 A; not controller output                                                                  |
| solar_output_voltage_v / solar_output_current_a | Separate controller output V/A                                                                                     |
| wind_voltage_v / wind_current_a                 | Independent wind output V/A                                                                                        |
| auxiliary_voltage_v                             | Auxiliary-side voltage only                                                                                        |
| accelerometer / gyroscope                       | Three axes, m/s² (±200) and °/s (±3000)                                                                            |
| lid_raw / mount_raw                             | 0/1; debounced interpreted states separately secure/tampered                                                       |
| armed / alarm_active / motion_detected          | Nullable reported booleans; GPIO command is not proof of physical sound                                            |
| siren_verified                                  | Firmware configuration flag, not a software-validated physical test                                                |
| ads_raw / ads_voltage / ads_gain                | Four raw counts ±32768, converted ADC-input V ±6.144; gain does not override supply-rail limits                    |
| acs_output_v / acs_zero_v                       | Raw conditioned sensor-output/offset volts; no automatic pack-current assignment                                   |
| gps_fix / latitude / longitude / gps_fix_age_ms | Fix must be true, valid coordinate ranges, age ≤30 s; no fix requires null coordinates                             |
| satellites                                      | Nonnegative integer when known                                                                                     |
| lte_registration / lte_signal_quality           | Explicit reported diagnostics or null; AT detection is not network registration                                    |
| calibration_status                              | unverified/calibrated; hardware electrical channels require calibrated state                                       |
| event_id / event_type                           | Stable event identity and motion/lid/mount/sensor_fault; duplicate IDs stored once                                 |

Fields not supplied default to null where defined, not zero. Firmware default pack, solar and wind measurements remain null. A nominal 55.2 V / 80 Ah / ~4.4 kWh specification is separate vehicle metadata. SOC and runtime are not inferred from voltage.

## Time, freshness and energy

UTC stored centrally; `en-PH`, `Asia/Manila` displayed. Heartbeat: <30 s Online, 30–90 s Delayed, >90 s Offline, no record Never connected. Location is a last-known fix with its timestamp. Measurement age is independent of network receipt, especially for queued frames. Device timestamp is preferred; null timestamp uses receipt time explicitly. Uptime/sequence remain in raw exports for bench reconstruction.

`P=V×I`. Trapezoidal Wh uses adjacent actual timestamps. Null samples, reversed times and gaps above 30 seconds accumulate nothing. PV and wind energy are stored by source. No integration through downtime; lifetime totals only mean retained recorded samples, not meter-certified lifetime production.

Demo and hardware records use independent `mode` partitions in telemetry, energy, location, events, help, messages and bench sessions, with scoped queries and exports. Demo never populates hardware views. Raw hardware provenance requires either a registered device token or an authorized engineer's real USB session; software cannot independently certify a physical source, so acceptance testing is still required.

## Ingestion

`POST /api/ingest`, JSON body, device `Authorization: Bearer <token>` for Wi-Fi/LTE. USB uses session auth and `X-Bench-Transport: usb` from CPE Lab. Device-token provision/rotation is engineer/admin only. Tokens are hashed in the database and returned once. Human admin/server credentials never belong in firmware.

Rate limits: 300 ingest requests/minute/IP, 10 login attempts/minute/IP. Payload is limited, schema strict, future timestamps/replayed sequence rejected, duplicate sequence acknowledged idempotently. Atomic inserts preserve telemetry and related energy/GPS/events together. Fleet updates use organization-scoped SSE invalidations; clients refetch only authorized data.


## Operational firmware 2.1 timestamp clarification

`device_timestamp` / `device_uptime_ms` describe frame/measurement capture. Optional `event_timestamp` / `event_uptime_ms` describe the separately captured cause occurrence. Explicit null event UTC remains unknown even if capture happens after NTP synchronization; legacy frames without these optional fields retain their documented fallback. Sensor ages use successful reads; ADS1115 reports the oldest of its four channel samples. Do not attach a fresh acquisition-time GPS fix to an older event as if it were the event location. These semantics are implemented and compiled; actual timing/fix correctness still requires bench evidence.
