# CPE software validation â€” 11 October 2026

Device: Windows / Node24.15.0 / npm11.12.1. Authoritative root: `C:\Users\Admin\Videos\SolAir\next-platform\solair-platform`.

## Executed software checks

| Check | Result / scope |
|---|---|
| Locked npm install | PASS after permitted network access; no dependency upgrades |
| TypeScript / Next production build | PASS; existing premium app builds with the added CPE panels |
| SQLite isolated API/provider suite | **42/42 PASS**; includes v2 quality/null/identity/load semantics, relational persistence, authenticated CSV, recovered-event liveness separation, role denial and device-only ingress |
| Embedded PostgreSQL/PGlite suite | **42/42 PASS**; same CPE/core semantics; Supabase role boundaries tested locally, not against a hosted account |
| Python laptop diagnostics | Syntax compile PASS; synthetic read-only Modbus CRC/address/length/scaling PASS; no serial port opened |
| Firmware compilation | **14/14 targets PASS**: integrated, all-input-driver coverage, and12 individual Arduino targets. Final affected-source refresh also passed 5/5 targets |
| Lint | PASS after correcting the export regex and test wait comment |
| Built-app browser | **7 observations PASS**: empty real CPE, accepted fixture values/provenance, authenticated CSV, load-mode history,390px overflow, shared driver channels and no runtime errors. Disposable TEST FIXTURE SQLite only |
| Upload / physical / hosted services | **NOT RUN**. No GPIO activation, real serial connection, sensor calibration, LTE registration, shunt/load wiring or charging performed by this review |

Tooling corrections during work: sandbox npm cache-only access required a permitted network install; Node tests required subprocess access. Windows toolchain path length prevented compiler launch until a short project-local junction was used. The compiler then exposed a C++11 constexpr limitation and `alarm` POSIX-name collision, both corrected. An additive Supabase table-permission migration corrected an ordering failure. Browser testing exposed a repeated-mode selection edge case; the app now ignores selecting the already-active mode. Browser-origin USB ingestion is used so production Secure session-cookie behavior is preserved. These initial failures are not counted as passes.

## Current physical and transport limits

- Default unknown module interfaces and powered output remain disabled. Team-reported earlier siren/MPU/switch/power success is distinct from new combined-firmware observation. No full/partial bench-ready physical verdict is earned by these tests.
- UART allocation is real source, compiled with EspSoftwareSerial; GPS stability/checksums/overflow during LTE/Wi-Fi/Modbus activity still requires the actual soak. Compilation does not prove concurrency timing.
- Wi-Fi supports rootCA-verified HTTPS and a deliberate isolated privateHTTP bench opt-in. A76XX privateHTTP fallback code is implemented but uncommissioned; public cellular cannot normally route to a private laptop IP. Carrier-specific productionHTTPS CA setup remains a precise gate; no public insecure fallback/TLS bypass is supplied.
- HW-548 active-HIGH is now supported by team-reported GPIO27 measurements; reset-safe interface remains pending. Modem connector/supply/levels, ACS conditioning/calibration and exact PZEM revision/shunt/isolation must be documented. A GPIO command is not physical siren feedback. Float/disconnect detection of analog wiring is hardware-dependent.
- Bounded important-event NVS storage is six separate event strings plus one latest volatile snapshot; trigger queue16. Capacity/write failure/real power interruption can lose data. Only real tests establish reset recovery; this work does not claim loss-free delivery.
- CPE CSV cap5,000 rows; UI history uses recent100 records, displays20 v2 snapshots. Existing paginated API/full payload JSON remain available. MeterWh/load mode are retained without inventing PV-input/battery charging/SOC.
- Wind controller, traction/BMS charging approval, GPS calibration and physical output timings remain external gates. Existing SOS/messages/roles/PWA remain in the same app; cloud deployment/provider and phone-to-PC acceptance were not performed.

## Evidence

Software fixture artifacts and final compile logs are under `docs/cpe-evidence/`. No provisioned secrets or real measurements belong in those files. Physical group results should be stored separately with tester/date/wiring/instrument/config and explicit PASS/FAIL/BLOCKED in the [consolidated acceptance guide](COMPLETE_CPE_BENCH_AND_APP_ACCEPTANCE.md).

## Final refresh

Final source refresh: SQLite 42/42 and PostgreSQL/PGlite 42/42 PASS; production TypeScript/Next build and lint PASS. All 14 firmware targets compiled/linked. After the final source/quality metadata changes, integrated, compile_all_only, GPS07, Wi-Fi10 and combined11 passed a further5/5 refresh. The combined default image uses 46,928 bytes RAM and 816,357 bytes flash; compile_all_only provides input-driver compile coverage and must never be uploaded. Primary documentation file links and 152 preserved historical source/image hashes also passed checks. Final built-app browser rerun: 7/7 observations PASS; outcome is recorded in browser-results.json and browser.log.



## Hardware clarification follow-up

The group's11 October clarification establishes the12 V adapter-only home bench and GPIO27 active-HIGH observation (OFF approximately0 V; ON3.0â€“3.3 V), not reset-safe OFF. All module implementations remain present and unverified interfaces stay disabled. PZEM range verification and a separately gated laptop50 A setup/readback command were added. Python syntax and synthetic scaling/CRC/range/readback/mismatch/timeout/write-echo tests PASS without opening ports. This follow-up changes firmware/laptop diagnostics/documentation only; the earlier application/database/browser results remain applicable. Compile refresh results are recorded in cpe-evidence/hardware-clarification-firmware.log. No upload, hardware write or physical test was run.


Follow-up compilation: **4/4 PASS** (integrated, compile_all_only, PZEM09b, combined11). Combined default image46,928 bytes RAM /816,365 bytes flash. Range checks and all enabled input drivers compile; no hardware commissioning is inferred.

## 12 October â€” Arduino IDE Test00 missing SoftwareSerial.h correction

The shared diagnostic previously pulled GPS/sensor headers into Test00. Test00 now has an ESP32-core-only branch; authoritative source and all IDE copies were regenerated. Standard Test00 compilation PASS. An isolated build of the actual generated IDE sketch with no external library dependencies also compiled/linked PASS on Arduino ESP32 2.0.17 (21,464 bytes RAM /269,533 bytes flash). Evidence: cpe-evidence/led-no-sensor-libraries-build.log. This verifies compilation without SoftwareSerial.h; actual IDE UI upload and physical LED test are still pending. Later sensor diagnostics retain their documented dependencies, including EspSoftwareSerial8.2.0. No pins, credentials, or physical wiring were changed.

## 12 October â€” MPU address ACK without valid readings

User reports Test00 physically working. Test01 uploaded but printed detected=0/zero vectors; user reports SCAN finds0x68. This establishes reported address response, not valid MPU measurements. Added read-only MPU_PROBE for register0x75, transaction status/byte count, identity, initialization and validity. Pinned library source expects identity0x68. Regenerated IDE folders and compiled Test01 PASS (23,344 bytes RAM /306,485 bytes flash). Evidence: cpe-evidence/mpu-identity-probe-build.log. Chip-ID result and physical sensor PASS remain pending; no identification bypass, voltage change or port access was performed.

### User-reported MPU probe result â€” 12 October

Reported repeated probe: bus address0x68, register_status=0, bytes=1, WHO_AM_I=0x70, initialized=0, read_valid=0. This confirms successful identity-register transactions in the supplied log; it does not confirm MPU6050 measurements. TDK's MPU-6500 family register map identifies0x70 as its device identity; this is consistent with that family, not physical authenticity/model confirmation. Board/chip marking verification remains pending. The installed Arduino Adafruit_MPU6050 library2.2.9 and pinned2.2.6 both check expected ID0x68; neither was modified. The user's earlier pasted diagnostic also calls mpu.begin(0x68); its switch/LED functionality continues even when imuOK is false. Earlier startup/imu_ok evidence or different historical library/device state is needed to reconcile the reported prior success. No identity bypass, I2C address/power change, driver substitution or physical pass was applied.

### Subsequent compatible-driver implementation â€” 12 October

Added a separate MPU6500-compatible profile for the reported0x70 identity, based on [TDK's register map](https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6500-Register-Map2.pdf). It checks identity, resets/wakes with nonblocking settling, verifies configuration by readback and requires complete14-byte sensor frames. Configuration uses Â±4g/8192LSB/g and Â±500deg/s/65.5LSB/(deg/s); output is m/sÂ² and rad/s, converted to degrees/s in backend telemetry. All-zero motion frames and failed reads remain invalid; vectors are never synthesized. Existing MPU6050 library/identity checking remains intact.

Test01 enables the compatible profile automatically. Combined/final firmware defaults to disabled until the team explicitly enables ALLOW_MPU6500_COMPAT after gravity/tilt/rotation checks. Telemetry identifies the profile using firmware_version and sensor_health.mpu6500_compatible; the existing CPE Lab shows it without claiming a confirmed MPU6050. This requires no database migration.

Software checks: TypeScript typecheck and focused ESLint PASS; CPE API regression5/5 PASS on isolated SQLite and5/5 on the PGlite PostgreSQL adapter, including compatible-profile identity/vector persistence. Logs: cpe-evidence/imu6500-backend-sqlite.log, imu6500-backend-postgres.log, imu6500-typecheck.log. These use TEST FIXTURE data, not sensor evidence. All13 IDE folders regenerated with identical shared headers; private config retained. Original detailed wiring guide SHA256 remains2E72401D960568AA638EFD6CCA438254CA7E561B1CA9FACF76D5C5507415CD57.

Physical status: Test00 PASS is user-reported. Test01 compatible profile, calibration, actual sensor model, combined operation and dashboard hardware measurements remain PENDING. No device upload, serial-port opening, GPIO activation or physical test was performed by this agent. Re-upload updated Test01 and follow its table before claiming a pass.

Final firmware compilation: integrated, compile_all_only, 01_i2c_mpu6050 and 11_combined_all_sensors_soak all PASS against the final source on ESP32 Arduino2.0.17. Evidence: cpe-evidence/imu6500-firmware-build.log. IDE packaging91/91 header/source/hash comparisons PASS across13 folders. Compiler success does not execute or physically validate the new sensor driver; Arduino IDE upload and actual readings remain the team's next step.

### Subsequent team bench report â€” moving to Test05

User reports the updated IMU works, with small stationary raw fluctuations (example285â€“292). Supplied Test02 log shows released1/1, lid pressed0/1 and mount pressed1/0; simultaneous0/0 was requested but not separately logged. After Test04 instructions, user reports all described buzzer behaviour working and requests Test05. Record this as team-reported manual ON/OFF/5-second-cutoff/startup behaviour, without independently captured measurements or timing evidence. Disconnected-control/USB-loss behaviour, current measurement and full combined/backend hardware acceptance remain pending. ADS1115 Test05 has not yet been physically reported.

### Test05 detected ADS but zero displayed voltage â€” 12 October

User reports ADS detected and approximately3V measured between ESP ground and ADS A0, while firmware displayed0V. Code inspection found continuous conversions combined with OS-bit completion polling: the poll cannot complete while the ADC continuously converts. Confirmed behaviour against the installed/pinned Adafruit ADS1X15 source and [TI ADS1115 datasheet](https://www.ti.com/lit/ds/symlink/ads1115.pdf). Changed the shared scanner to nonblocking single-shot reads; scan resets toA0 on reconnect, invalidates after disconnect/conversion timeout, and marks healthy only after all four channels have completed. Added read_valid and increasing sample count to Test05 diagnostics. Regenerated all13 Arduino IDE folders; private configurations preserved. Retest both GND and measured3V3 references; physical ADS pass remains pending. This corrects the final integrated acquisition as well as Test05; no wiring/polarity/library change was applied.

Compilation PASS: Test05, integrated and compile_all_only (ESP32 Arduino2.0.17); log cpe-evidence/ads-single-shot-firmware-build.log. Packaging91/91 header/source/hash comparisons PASS; original detailed wiring guide hash unchanged. Compilation and source inspection are software evidence; actual ADC conversion/voltage agreement and disconnect/reconnect recovery still require physical testing.

### Independent ADS comparison prepared; GPS/LTE continuation

Team reports all grounded channels remain aboutâˆ’0.10â€¦âˆ’0.12V, powered ADS-GND to ESP-GND measurements varyingâˆ’0.01â€¦âˆ’0.4V on a20V DC meter range, followed by unpowered steady continuity with displayed001â€“003. These reports do not yet establish the cause or a valid ADC ground/reference. Added independent05a_ads_register_crosscheck using only Arduino/Wire direct transactions, bounded single-shot polling and configuration/read-length checks; no shared scanner/library offset correction. Compiled PASS on ESP32 Arduino2.0.17, evidence cpe-evidence/ads-register-crosscheck-build.log. Generated14 IDE folders. Physical independent comparison PENDING; no upload performed here. Test06 electrical gate remains pending. Added docs/CPE_CONTINUE_TESTS_05_TO_08.md with independent-test progression and manual Arduino Serial Monitor LTE USB commands. GPS breakout power/TX and exact LTE carrier USB supply still require confirmation.

Subsequent user-supplied05a log: valid=1 for all channels, expected configuration readback A0=0xC383/A1=0xD383/A2=0xE383/A3=0xF383. With inputs intended grounded, A0 rawâˆ’1522â€¦âˆ’1555 (âˆ’0.19025â€¦âˆ’0.19438V); A1âˆ’1080â€¦âˆ’1082, A2âˆ’1087â€¦âˆ’1094, A3âˆ’1086â€¦âˆ’1114 (roughlyâˆ’0.135â€¦âˆ’0.13925V). The independent implementation reproduces negative grounded-input readings, so the shared SOLAIR scanner alone does not explain the discrepancy. Register transaction success is not voltage accuracy or device authenticity proof. Test05 remains UNRESOLVED; cause is not established and no automatic offset correction is approved. Independent GPS/LTE testing can proceed after their own electrical prerequisites; this does not mark ADS/ACS passed.

Further05a comparison prepared: v2 adds differential A0âˆ’A1 and A2âˆ’A3 reads without offset subtraction, using the same verified register write/read/timeout checks. Continue guide includes an isolated USB-only ESP+ADS setup with two explicitly bridged ground strips, other modules disconnected and actual soldered header contacts required. Physical comparison remains pending; code alone cannot establish or repair the reported ground/reference discrepancy. User requested other module tests deferred until tomorrow and cloud/Git setup deferred while troubleshooting ADS.

05a v2 compilation PASS on ESP32 Arduino2.0.17; evidence cpe-evidence/ads-register-crosscheck-v2-build.log. Arduino IDE copy regenerated. No physical upload or ADC pass is claimed.

Subsequent team v2 log: A0 rawâˆ’1233/âˆ’1262 (âˆ’0.15413/âˆ’0.15775V), A1â€“A3 rawâˆ’928 (âˆ’0.11600V). Differential A0âˆ’A1 raw0/19 (0/0.00238V), A2âˆ’A3 raw0/1 (0/0.00013V), all valid with expected register configurations. Near-zero differences between intended equal inputs do not establish accurate single-ended ground readings or uniquely identify the cause. Test05 remains UNRESOLVED. Latest state is also captured in docs/CLOUD_CONTINUATION.md for source/cloud handoff; no offset compensation was added.


## 18 October 2026 — separate-checkout UI integration (software verification only)

Branch `feature/local-ui-notifications` integrates account/logout controls, Light/Dark/System appearance, support/problem reports, authorized notifications and Malabon map fixes. The group CPE firmware, telemetry contract, migrations, hardware-only offline sweep and private device listener were preserved. SQLite and embedded PostgreSQL suites each passed 54 tests; production build, type checking, lint and desktop/mobile browser checks passed. CPE browser readings were explicitly software fixtures in a temporary database. No firmware was uploaded, outputs activated or physical tests performed. ADS single-ended accuracy remains unresolved as recorded above. No commit or push was made.

See [the integration report](LOCAL_UI_INTEGRATION_2026-10-18.md) for exact files, validation limits and proposed review/commit commands.


## 18 October 2026 — operational accounts, incident/SMS software (not physical commissioning)

Implemented on isolated branch `feature/operational-accounts-sms`, based on group commit `dc199ca`, under `C:/Users/Anyang/Videos/SolAir/solair-operational`. Existing original/demo and group-integration checkouts were preserved. Added approval-based signup, actual email-confirmation flow, verified mobile preferences, administrator device commissioning, incident/delivery records, a disabled-by-default provider worker, CSV exports and additive protected migrations. Fixed selection, CPE device/mode evidence binding and valid unseen delayed-event recovery. Firmware2.1 adds stable activation IDs, simultaneous causes, separate event/capture timestamps, successful-sample ages and an IRAM timer cutoff. IDE copies were synchronized; no pins or active private configurations changed.

Final software SQLite and embedded PostgreSQL suites each passed 68/68 tests, including the optional event timestamp fields. The final operational browser rerun passed all eight check groups. Type checking, lint, production builds and desktop/mobile account/map/fleet/PWA/CPE browser fixture suites passed. Integrated/all-module firmware configurations compiled. No physical upload, output activation, real SMS/OTP/email delivery, hosted commissioning or new ADS calibration pass is claimed. The existing unresolved electrical observations above remain unresolved. No commit/push was performed for this feature branch.

See [operational setup](OPERATIONAL_SETUP.md), [physical/provider acceptance gates](OPERATIONAL_ACCEPTANCE.md), and [implementation report](OPERATIONAL_IMPLEMENTATION_2026-10-18.md). Live SMS remains disabled; automatic modem fallback and remote arming are not enabled. Use existing USB ARM/DISARM; an optional local arm input remains unassigned until hardware approval.
