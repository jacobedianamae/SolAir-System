# Operational acceptance — evidence still required

Software fixtures and compilation do not establish physical operation or SMS delivery. Record each physical result, observer/date and evidence path; no physical PASS is prefilled here.

| Stage | Action | Required passing evidence | Current physical status |
|---|---|---|---|
| Low-voltage inspection | Identify exact boards, GPIO labels, supplies, signal ground, driver polarity and fuse; keep load current off breadboard contacts | Photos, manufacturer ratings and measured supply/logic levels | Pending |
| Core device | Upload only after approval; test IMU and lid/mount individually and together | Genuine serial vectors, raw/debounced transitions, firmware/device identity | Pending on this build |
| Arm/disarm | Wait boot interval; reject insecure switches; ARM, release contacts; DISARM | Serial commands and matching telemetry state; no unsupported remote claim | Pending |
| Cutoff | LED/test load first; then approved siren circuit | Measured GPIO/load waveform during network timeout, sensor timeout, NVS pressure, calibration/commands, reset and power loss | Pending |
| Independent circuit safety | Test disconnected control, reset/brownout and any required hardware one-shot | Safe OFF and bounded physical output; GPIO command alone insufficient | Pending |
| Data binding | Select two registered devices and switch modes; save engineer evidence | Each stored record/export remains on the expected device and source | Software fixtures pass; actual USB pending |
| Authenticated upload | Use provisioned device token and correct LAN/HTTPS address | Durable acknowledgment, matching persisted record and dashboard; reject bad/rotated token | Software fixtures pass; actual device pending |
| Offline recovery | Disable Wi-Fi/backend, trigger events, reboot, recover via USB/Wi-Fi in different orders | Previously unseen events saved once; newest state/GPS stay newest; failed persistence never removes event | Software fixtures pass; flash/power-loss pending |
| Queue limits | Exceed six queued events with transport unavailable | Visible dropped counts/fault; no claim of unlimited or loss-free buffering | Pending physically |
| Time/freshness | Test NTP missing, old UTC, GPS no-fix/stale and sensor faults | Distinct contact/measurement/sensor/GPS ages and honest unknown timestamps | Software paths implemented; physical pending |
| Energy | Safe low-voltage/reference-instrument testing only | Valid ADS/ACS/PZEM calibration and source/load labels; no bench Wh labeled PV harvest or vehicle charging | Unresolved/unverified per canonical CPE notes |
| Accounts | Direct signup without approval, email confirmation, empty-fleet login, contact change, recovery/logout, foreign-TODA attempts | Actual provider confirmation; no unauthorized membership or role escalation | Fixtures pass; hosted provider delivery pending |
| SMS dry-run | Commission fixture device/contacts only in isolated stores | Simulated state, zero provider sends, demo/USB/replay isolation | Software fixtures pass |
| Approved real SMS | Fund/configure approved route; allowlist two consenting verified test recipients; real device alarm | Incident ID, provider ID, signed delivery state where available, independent handset receipt and incurred charge | Not performed |
| SMS failures | Bad code/number, no funds, explicit rejection, ambiguous timeout, repeated/out-of-order callbacks | Honest failed/unknown states; no blind resend; budget/cooldown enforced | Software fixtures pass; actual carrier pending |
| Modem | Exact carrier USB supply/AT port and SIM first, then explicitly approved SMS test | Registration, modem acceptance and separate handset receipt; carrier cost recorded | Not performed |
| Multi-device operation | Driver phone and operator PC on different networks | Same central records; authorized updates; reconnect and backend restart persistence | Hosted physical test pending |

Existing user-reported historical observations remain in [CLOUD_CONTINUATION.md](CLOUD_CONTINUATION.md) and [CPE_VALIDATION.md](CPE_VALIDATION.md). They are not automatically passes for this changed firmware. Keep the approved wiring and unresolved ADS issue visible. No traction battery, charging controls or wind commissioning is authorized by these software changes.
