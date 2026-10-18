# Operational accounts and alarm notifications — implementation handoff

Date: 18 October 2026. This is a software implementation and verification report, not physical commissioning evidence.

## Where the work is

- Isolated checkout: `C:\Users\Anyang\Videos\SolAir\solair-operational`.
- Application: `next-platform/solair-platform`.
- Branch: `feature/operational-accounts-sms`, based on group commit `dc199cab099b528f5094b2b7f139190ff5e7bd23`.
- Original demo checkout remains unchanged at `2d372ac`; group-integration checkout remains unchanged at `dc199ca`.
- All new changes are uncommitted and unstaged. Nothing was pushed, merged, reset, deployed or uploaded to hardware.
- Review preview: http://localhost:3001/ using its own ignored demo database. SMS is disabled and paid requests are disabled. The original site's process and database were preserved.

For exact startup commands, environment-variable names, account workflows and deployment gates, use [operational setup](OPERATIONAL_SETUP.md). For physical and provider checks, use [acceptance checklist](OPERATIONAL_ACCEPTANCE.md). Existing [hardware documentation](CPE_VALIDATION.md) remains authoritative for recorded electrical observations; this report does not clear unresolved ADS accuracy findings.

## Implemented behavior

Public signup creates a driver account directly, with no administrator approval request. Each account starts in its own empty workspace, without existing TODA or vehicle access. Existing invitation/assignment controls remain separate; a trusted administrator can now link an unassigned account through People & assignments. Operational accounts require trusted provider identity and verified email. Mobile numbers normalize to Philippine `+639…` format. Phone ownership verification and SMS consent are separate, and changing the number removes verification. Email changes require password confirmation and provider confirmation. Existing login, logout, recovery and engineering restrictions remain enforced.

Operational mode uses a separate PostgreSQL/Supabase environment and rejects demonstration data access. Demo and bench activity cannot send operational SMS. Existing BEMAC artwork, Malabon map, appearance controls, account menu, support, notification dropdown and dashboards remain.

Authenticated, commissioned alarm events create persistent incidents with stable identities, coalesced causes, occurrence/receipt times, uncertainty, last-known location, delivery attempts and acknowledgment. A reported active alarm never proves that the physical siren sounded. Only verified, consenting, authorized recipients are eligible. Delayed events with unknown historical assignment notify only the responsible operator. The worker rechecks authorization and consent before submitting.

The backend Twilio adapter is disabled by default. It has durable claims, deduplication, cooldowns, bounded safe retries, signed callbacks, explicit uncertain outcomes and a daily alert-segment budget. Provider acceptance is distinct from confirmed delivery. Ambiguous submissions are not automatically resent. Phone verification has separate rate limits and costs. See setup for exact rules and provider restrictions; SMS bodies omit clickable links pending Philippine sender/template/URL approval.

Vehicle selection now binds requests to the authorized selection. CPE evidence is bound to user, organization, device and source context. Valid previously unseen delayed events persist without replacing newer live state, GPS or energy calculations. Ingestion returns an exact durable acknowledgment. Historical replay does not make a device or sensor appear fresh.

Canonical CPE firmware 2.1 adds stable alarm identities, simultaneous-cause handling, separate event and measurement timestamps, successful-sample ages and a hardware-timer interrupt cutoff independent of network task progress. GPIO assignments and active private settings were preserved. Arduino IDE copies were synchronized from canonical sources. Backend deployment must precede this firmware because the new journal expects the exact durable acknowledgment.

## Verification performed

| Check | Result | Scope |
|---|---|---|
| SQLite automated suite | 75/75 passed | Temporary test stores |
| Embedded PostgreSQL/PGlite automated suite, final source | 75/75 passed; final guard 19/19 focused rerun | PostgreSQL compatibility; not hosted Supabase connectivity |
| Type checking and lint | Passed | Application/backend source |
| Production build | Passed | Final shared telemetry fields included |
| Operational browser rerun | 14 check groups passed | Direct signup, immediate local sign-in, empty-fleet isolation, ET-02-only driver requests, incident causes/time/CSV/permissions, contact handling, 390px layout, protected CPE access, no runtime errors |
| Existing browser regressions | Passed | Account controls, notifications, desktop/mobile map, fleet navigation, PWA and CPE fixtures |
| Canonical firmware integrated profile | Compiled | RAM 47,088 bytes; flash 825,361 bytes |
| Canonical firmware compile_all_only profile | Compiled | RAM 47,272 bytes; flash 843,361 bytes |
| Modem SMS helper | Dry run passed | No port opened and no SMS sent |
| Git whitespace check | Passed | Changes remain unstaged |

Browser and API data were explicitly software fixtures in isolated databases. Browser screenshots and fixture results are ignored test outputs. No synthetic frames were inserted into a working real-device database. Visual inspection covered signup, mobile contact settings and incident history. Map regression fixtures do not prove unrestricted production tile-service availability.

No physical ESP32 upload, real sensor/switch test, siren timing measurement, power-cut recovery, ADC calibration, modem SMS, phone OTP, email receipt, handset SMS receipt or hosted Railway/Supabase commissioning was performed. Compilation and API acceptance are not evidence of those outcomes.

## Remaining limits before operational use

1. Configure and commission Supabase confirmation/recovery email and the paid provider through private environment variables. Obtain owner approval before enabling spending. Verify actual handset delivery and signed callbacks using approved recipients.
2. Run the physical acceptance checklist with the hardware lead. In particular, measure alarm cutoff during network failure, verify simultaneous triggers, wiring/default output state and real calibration. Do not route siren or traction load through a solderless breadboard.
3. The local journal is bounded to six event frames plus a replaceable heartbeat. Overflow, power failure and flash durability require evidence. Persistent identity conflicts hold the queue for investigation; this is not a loss-free recorder.
4. Existing USB ARM/DISARM remains the supported local mechanism. The optional local arm GPIO is unassigned. Remote arming is not implemented by this change.
5. Automatic backend/modem SMS fallback is not enabled. The A7670E helper is an explicitly gated manual USB diagnostic; supply, carrier, registration and actual SMS support remain unverified.
6. Device authentication establishes the submitting identity; it cannot independently prove physical sensor provenance. Delayed driver assignment history is incomplete, so uncertain old incidents use the designated operator only.
7. Uncertain SMS submissions need provider investigation. Cooldown-suppressed messages remain recorded and are not automatically released later. Alert segment limits do not include verification, SMTP, sender or hosting charges.
8. Battery, wind and other measurements remain unavailable where real calibrated inputs have not been commissioned. Existing unresolved hardware observations remain unresolved.

## Security and preservation

No real environment files, credentials, device tokens, private databases, build products or historical firmware were transferred into this change. Only the blank operational environment example is intended for version control. Existing generated artifacts in repository history were not rewritten. New database changes are additive migrations; new operational tables deny direct anonymous/authenticated browser access. Existing device authentication, organization/assignment checks, CPE access, private LAN listener and prior migrations were retained. Operational deployment requires HTTPS and disallows the bench HTTP ingress configuration.

The original white vehicle assets, map implementation and pin definitions have no changes in this branch. Generated Arduino source copies are intentional; binary builds and private configuration remain ignored.

## Review and subsequent Git steps

Review this isolated branch and run the acceptance checks before approving a commit or push. Suggested commit message: `feat: add approved operational accounts and guarded alarm notifications`.

After explicit approval, from the isolated repository root, inspect `git status --short` and `git diff`, stage only reviewed application paths, inspect `git diff --cached`, then commit and push with `git push -u origin feature/operational-accounts-sms`. Open a pull request against the group's agreed target branch. Do not merge until group review. These actions have not been performed.

## Exact file inventory

The lists below are generated from the final local Git diff; paths are relative to the authoritative application directory. No tracked deletions are intended.

### Modified files

- `.gitignore`
- `README.md`
- `docs/CLOUD_CONTINUATION.md`
- `docs/CPE_VALIDATION.md`
- `docs/RAILWAY_SUPABASE.md`
- `docs/TELEMETRY.md`
- `firmware/arduino-ide/00_esp32_boot_and_status_led/config.example.h`
- `firmware/arduino-ide/00_esp32_boot_and_status_led/engine.h`
- `firmware/arduino-ide/00_esp32_boot_and_status_led/modules.h`
- `firmware/arduino-ide/01_i2c_mpu6050/config.example.h`
- `firmware/arduino-ide/01_i2c_mpu6050/engine.h`
- `firmware/arduino-ide/01_i2c_mpu6050/modules.h`
- `firmware/arduino-ide/02_tamper_switches/config.example.h`
- `firmware/arduino-ide/02_tamper_switches/engine.h`
- `firmware/arduino-ide/02_tamper_switches/modules.h`
- `firmware/arduino-ide/03_mosfet_logic_led_first/config.example.h`
- `firmware/arduino-ide/03_mosfet_logic_led_first/engine.h`
- `firmware/arduino-ide/03_mosfet_logic_led_first/modules.h`
- `firmware/arduino-ide/04_12v_alarm_fused/config.example.h`
- `firmware/arduino-ide/04_12v_alarm_fused/engine.h`
- `firmware/arduino-ide/04_12v_alarm_fused/modules.h`
- `firmware/arduino-ide/05_ads1115/config.example.h`
- `firmware/arduino-ide/05_ads1115/engine.h`
- `firmware/arduino-ide/05_ads1115/modules.h`
- `firmware/arduino-ide/05a_ads_register_crosscheck/config.example.h`
- `firmware/arduino-ide/05a_ads_register_crosscheck/engine.h`
- `firmware/arduino-ide/05a_ads_register_crosscheck/modules.h`
- `firmware/arduino-ide/06_acs758/config.example.h`
- `firmware/arduino-ide/06_acs758/engine.h`
- `firmware/arduino-ide/06_acs758/modules.h`
- `firmware/arduino-ide/07_gps_neo6m/config.example.h`
- `firmware/arduino-ide/07_gps_neo6m/engine.h`
- `firmware/arduino-ide/07_gps_neo6m/modules.h`
- `firmware/arduino-ide/08b_a7670e_esp_uart/config.example.h`
- `firmware/arduino-ide/08b_a7670e_esp_uart/engine.h`
- `firmware/arduino-ide/08b_a7670e_esp_uart/modules.h`
- `firmware/arduino-ide/09b_pzem_esp32_max3485/config.example.h`
- `firmware/arduino-ide/09b_pzem_esp32_max3485/engine.h`
- `firmware/arduino-ide/09b_pzem_esp32_max3485/modules.h`
- `firmware/arduino-ide/10_wifi_authenticated_ingest/config.example.h`
- `firmware/arduino-ide/10_wifi_authenticated_ingest/engine.h`
- `firmware/arduino-ide/10_wifi_authenticated_ingest/modules.h`
- `firmware/arduino-ide/11_combined_all_sensors_soak/config.example.h`
- `firmware/arduino-ide/11_combined_all_sensors_soak/engine.h`
- `firmware/arduino-ide/11_combined_all_sensors_soak/modules.h`
- `firmware/arduino-ide/solair_cpe/config.example.h`
- `firmware/arduino-ide/solair_cpe/engine.h`
- `firmware/arduino-ide/solair_cpe/modules.h`
- `firmware/arduino-ide/source-manifest.json`
- `firmware/solair-cpe/config.example.h`
- `firmware/solair-cpe/engine.h`
- `firmware/solair-cpe/modules.h`
- `packages/telemetry-contract/index.ts`
- `server/app.ts`
- `server/db.ts`
- `server/health.ts`
- `server/identity.ts`
- `server/index.ts`
- `server/retention.ts`
- `src/FleetMap.tsx`
- `src/Lab.tsx`
- `src/VehicleVisualization.tsx`
- `src/api.ts`
- `src/main.tsx`
- `src/style.css`
- `src/types.ts`
- `tests/postgres-store.ts`
- `tests/providers.test.ts`

### Added files

- `.env.operational.example`
- `backend/migrations/005_operations.sql`
- `backend/migrations/006_operations_supabase.sql`
- `backend/migrations/007_registration.sql`
- `backend/migrations/008_registration_supabase.sql`
- `backend/migrations/009_registration_details.sql`
- `backend/migrations/010_registration_details_supabase.sql`
- `docs/OPERATIONAL_ACCEPTANCE.md`
- `docs/OPERATIONAL_IMPLEMENTATION_2026-10-18.md`
- `docs/OPERATIONAL_SETUP.md`
- `packages/operations/index.ts`
- `scripts/modem-sms-bench.py`
- `server/administration.ts`
- `server/operational-routes.ts`
- `server/operations.ts`
- `server/registration.ts`
- `src/Operational.tsx`
- `src/People.tsx`
- `src/Registration.tsx`
- `src/TodaMenu.tsx`
- `tests/operational-browser.ts`
- `tests/operations-rls.test.ts`
- `tests/operations.test.ts`
- `tests/regression-preview.ts`

### Intentionally excluded

Real `.env` files, private firmware configuration, working databases, caches, dependencies, screenshots, generated binaries, historical standalone firmware and original checkout changes are excluded. Only canonical firmware sources and synchronized IDE source copies changed.

## Signup change requested after initial handoff

The signup page now posts to `/api/signup`, creates a driver profile and saved contact preferences transactionally, and shows **Account created** with a **Sign in** link. It does not create an access request. The local preview allows immediate login; configured Supabase still requires email confirmation. Duplicate accounts, invalid/mismatched inputs and public privilege/vehicle claims are rejected. Legacy pending requests are preserved; approving a legacy request for an already registered email is rejected. No existing requests or user data were automatically converted or removed.

Final checks after this change: SQLite 70/70, embedded PostgreSQL 70/70, production build/type checking, lint and all eight operational browser groups passed. The signup screenshot was visually inspected. Preview port 3001 was restarted with the same separate database and SMS disabled; port 3000 was untouched. Hosted confirmation email delivery remains untested. No firmware changed for this signup revision, and nothing was committed or pushed.

## Administration and account directory revision

Separated personal Settings from People & assignments, Devices, Organizations and Activity log. Added a server-paginated/searchable account directory (25 per page), including unassigned accounts for administrators; operators remain scoped to their own TODA. Administrators can link previously unassigned accounts to a real TODA, approve driver/operator/engineer access and then assign a driver separately. This revokes the affected user's sessions and records the change. Established cross-TODA transfers and editing existing administrator accounts are excluded from this new form. No working user records were automatically changed.

Signup records Driver/Operator intended use without granting public operator/admin rights. Additive migrations 007/008 protect the preference table. Legacy requests are a separate collapsed list, with an explicit archive action that preserves accounts and request history. Empty registration workspaces are omitted from the Organizations display. Device readiness now explains physical evidence and responsible-operator settings separately from user signup and paid activation.

Additional implementation paths: `server/administration.ts`, `src/People.tsx`, `backend/migrations/007_registration.sql`, `backend/migrations/008_registration_supabase.sql`, with navigation/layout changes in `src/main.tsx` and `src/style.css`, signup/device copy in `src/Operational.tsx`, database migration wiring and focused tests. Hardware firmware and private configuration were not changed for this revision.

Final administration revision validation: 72/72 SQLite tests and 72/72 embedded PostgreSQL tests passed; lint, TypeScript and the production build passed. All nine operational browser groups passed, including new account search, mobile layout, administrator TODA/operator approval, legacy-request archival and separated pages. Existing account/theme/logout browser groups and all 14 fleet/navigation browser checks also passed. The mobile People page was visually inspected. The build initially caught a no-vehicle TypeScript guard issue and browser testing caught an inaccessible selector label; both were corrected before these final passes.

The port-3001 review preview was restarted against its existing separate database with additive migrations and SMS disabled. Existing working accounts were preserved; no actual person was automatically assigned, promoted, deleted or moved. No hardware upload, physical retest, hosted email/SMS validation, commit or push occurred.

## BEMAC/NWOW, driver details, operator information and readable activity

Added BEMAC/NWOW driver selection at signup. Existing unspecified registrations remain unspecified until the user edits them in Settings; no actual vehicle, model or assignment is inferred. Driver Home/Settings now show role, TODA, declared type, map display name, actual vehicle model/ID/name and explicitly assigned operator. Display names are added as plain text to authorized map popups; vehicle IDs and GPS validity remain unchanged. Vehicle creation now records BEMAC/NWOW model choice. BEMAC retains the approved white artwork; NWOW uses a clearly labeled missing-photo placeholder until a real approved image is provided.

Restored the literal Settings label in driver sidebar/mobile navigation; the account-menu Profile shortcut still opens it. Operators can add business name, service area and an optional shared contact number in Settings. Administrators can edit operator information through People → Manage account. Private verified SMS contacts remain separate. Explicit responsible-operator assignment enforces TODA/role authorization; changing an approved recipient clears device notification readiness until administrator review, rather than sending to the previous operator or enabling SMS automatically.

Activity now uses an admin-only, global, searchable/paginated feed of readable registrations, assignments, access changes, operator updates, device work and security/assistance actions. Sign-ins are a separate category. Newly recorded assignment/access changes include descriptions; older missing historical details are not fabricated. Raw problem-report JSON is not returned by this feed.

Added: `backend/migrations/009_registration_details.sql`, `backend/migrations/010_registration_details_supabase.sql`, `server/registration.ts`, `src/Registration.tsx`. Updated existing migration wiring, registration/assignment routes, People forms, marker labels, vehicle presentation, styles and focused tests. New tables have direct-browser access denied in Supabase.

Verification: full SQLite 75/75 after final assignment guards; full embedded PostgreSQL 75/75, followed by focused PostgreSQL operations 19/19 after the final notification-routing guard. Type checking, lint and production build passed. All 11 operational browser groups passed, including signup selector, driver registration/Settings, operator editing, readable registration activity and mobile layout. Existing account/theme/logout groups, Malabon desktop/mobile map groups and 14 fleet/navigation checks passed. Driver Settings and activity screenshots were visually inspected. An initial browser assertion matched two legitimate activity rows during asynchronous filtering; its response wait/target was corrected and the complete runner then passed.

No original checkout changes, user assignment/promotion, paid sends, credentials changes, firmware upload or physical hardware tests were performed. Existing review accounts and database were preserved; port 3001 was refreshed with SMS disabled. Nothing was committed or pushed.

## TODA membership display and explicit saved assignment

A read-only check of the reported review account found no saved TODA membership update; both the registration panel and sidebar accurately reflected its unassigned database record. After the user explicitly selected the intended TODA, the existing administrator API linked that existing account, preserved its driver role and other profile data, recorded the update, revoked its sessions and verified the saved membership. Only the temporary automation administrator session was logged out. No password, phone, vehicle assignment or paid-service setting was changed.

The sidebar now receives the organization name in its authenticated `/api/me` membership response, eliminating the separate late organization-name request. Refresh/focus/reconnect recheck membership and clear revoked sessions instead of keeping a stale workspace. The People save action and success message explicitly identify the saved TODA. Unassigned workspaces no longer display misleading MC initials.

SQLite 75/75 and focused embedded PostgreSQL operations 19/19 passed with a new assertion that saved login membership and registration TODA agree after re-login. Type checking, lint, production build and existing account/theme/logout browser groups passed. No schema or firmware changes were needed for this revision. The new browser coverage verifies the sidebar and registration after an administrator saves a previously unassigned account.

Final membership browser rerun: all 12 groups passed, including the saved-TODA sidebar/registration assertion. The refreshed port-3001 preview retains the user-approved membership, and SMS remains disabled. Nothing committed or pushed.

## Compact TODA dropdown

Implemented the approved minimal sidebar dropdown in `src/TodaMenu.tsx`: saved TODA plus assigned driver vehicle ID/model, or No assigned vehicle. No contacts, registration shortcuts or membership-changing actions were added. Fleet staff see the selected authorized vehicle labeled Selected vehicle. Assignments load from the existing protected registration API, with honest loading/error states. Click/Enter toggle, outside click dismisses, and Escape closes the popup before the mobile drawer while restoring trigger focus. Per-user/organization remounting and request cleanup prevent a previous account's details from remaining open.

Type checking, lint, production build and all 14 isolated operational browser groups passed. Assigned/unassigned driver cases, authorized ET-02 isolation, Escape/focus, outside click, and 390px popup bounds were verified; mobile screenshot was visually inspected. The initial mobile test attempted to click a backdrop point covered by the sidebar; it was corrected to exercise successive Escape dismissal and the full runner passed. No backend, schema, account, hardware, private configuration or paid-service behavior changed for this dropdown revision. No commit or push.
