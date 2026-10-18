> Current local application: `C:\Users\Anyang\Videos\SolAir\solair-platform` at http://localhost:3000/. Use `npm.cmd run start:combined`. The separate-checkout/port-3001 instructions below document the earlier review environment; see [current integration guide](PORT3000_INTEGRATION.md).

# SOLAIR accounts, incidents and SMS setup

This extends the existing premium application. It does not replace the demo, certify hardware, or activate a paid service.

## Start the new software locally

Use Node 24. In PowerShell:

```powershell
Set-Location 'C:\Users\Anyang\Videos\SolAir\solair-operational\next-platform\solair-platform'
npm.cmd ci
$env:PORT='3001'
$env:SOLAIR_ENVIRONMENT='demo'
$env:SOLAIR_SMS_MODE='disabled'
$env:SOLAIR_DB_PATH='data/review.db'
$env:DATABASE_URL=''
$env:SOLAIR_INGEST_HOST=''
npm.cmd run dev
```

Open http://localhost:3001. This is a separate demo database. The original site's process and database are not replaced. Existing documented local demo users work after the empty development database is seeded; they are not production accounts.

## Use the account workflows

1. On the login screen choose **Sign up**. Choose Driver or TODA operator as the intended use, then enter name, email, matching 12+ character password, mobile number and optional SMS consent. Select **Create account**. An operator preference does not grant fleet-management access by itself.
2. Registration creates the account immediately; it does not submit an approval request. Local preview users can sign in immediately. With Supabase configured, confirm the email address before signing in.
3. Public accounts receive the driver role and a private empty workspace named **No TODA assigned**. No existing fleet, vehicle, administrator/operator permission or operational SMS eligibility is granted. Account settings are available before a vehicle is assigned.
4. As an administrator open **People & assignments**, search for the registered name/email, choose **Manage account**, select the real TODA and approved access, and save. This signs out the affected user. Assign a driver to a vehicle in the separate assignment form on the same page. The person signs in again to use the approved access. Accounts already linked to a real TODA cannot be moved across fleets by this form; that requires history review. Legacy requests are preserved in a collapsed section and can be archived without deleting accounts.
5. In **Profile/Settings → Contact and SMS preferences**, save or withdraw SMS consent and edit the mobile number. `0917 123 4567`, `639171234567` and `+63 917 123 4567` normalize to `+639171234567`. These are formatting examples, not approved recipients. Changing the number invalidates its verification.
6. **Request verification code** and **Verify mobile number** use Twilio Verify only after paid verification is explicitly enabled and configured. Otherwise the interface states that verification is disabled and the contact stays unverified. No hardcoded code or fake verification exists.
7. Email changes require the current password and provider confirmation. Login synchronizes a changed email only after the identity provider authenticates the same existing profile ID. A pending request cannot grant itself access. Password recovery uses the existing Supabase flow and session revocation.

Appearance, account/logout menu, support, notifications, BEMAC artwork and Malabon mapping are retained. CPE Lab remains engineer/admin only. Operational databases reject requests for demo mode; a browser dropdown cannot bypass this rule.

## Operational deployment: separate from demo and bench

Follow [Railway/Supabase setup](RAILWAY_SUPABASE.md) for the existing database, TLS, identity and realtime credentials. Use a **separate Supabase project/database and auth users** for operation. Never deploy the local demo database. The operational server refuses startup with demo telemetry, local seeding, missing PostgreSQL/Supabase identity or a non-HTTPS public origin.

Unlike the older invitation-only instructions, the direct signup flow requires Supabase email signup and email confirmation enabled. Direct registration creates a SOLAIR driver profile in a private empty workspace, without existing fleet membership. Configure custom SMTP, correct redirect URLs, provider rate limits and abuse protection before exposing signup. Keep secure email-change confirmation enabled. Provider email delivery and phone verification need actual commissioning; API acceptance is not delivery.

`backend/migrations/005_operations.sql` adds operational tables without replacing legacy tables or records. `006_operations_supabase.sql` enables RLS and denies direct browser access to the new tables. Startup applies them through the existing adapter. Test migrations and take an approved private backup before pointing a new build at an existing operational database.

## New environment variables

All credentials belong in Railway/Supabase dashboards or ignored local configuration, never frontend code or chat. `.env.operational.example` contains names only.

| Variable | Meaning/default |
|---|---|
| `SOLAIR_ENVIRONMENT` | `demo`/`bench`; `operational` enables operational-only policies and startup requirements |
| `SOLAIR_SMS_MODE` | `disabled` default; `test` is a dry run with no provider calls; `live` requires explicit paid approval |
| `SOLAIR_SMS_ALLOW_PAID` | Must explicitly equal `1` before alert or verification provider requests can be made |
| `TWILIO_ACCOUNT_SID` | Server-only provider account identifier |
| `TWILIO_AUTH_TOKEN` | Server-only API/callback authentication secret |
| `TWILIO_MESSAGING_SERVICE_SID` | Approved messaging service/sender for Philippine alerts |
| `TWILIO_VERIFY_SERVICE_SID` | Phone ownership verification service |
| `SOLAIR_SMS_TEST_RECIPIENTS` | Comma-separated approved `+639…` commissioning numbers; private |
| `SOLAIR_SMS_COMMISSIONING` | Leave unset to restrict live requests to the commissioning allowlist; `complete` requires owner approval after acceptance |
| `SOLAIR_SMS_DAILY_SEGMENT_LIMIT` | Default 20 reserved alert segments per UTC day; conservative estimate, not a total billing guarantee |

The alert segment budget does not include Verify/SMTP charges, sender rental/registration, hosting, tax or carrier fees. Phone verification requests have their own authenticated/IP rate limit and provider controls. Configure spending alerts/limits in provider dashboards. Do not enable paid variables merely to try the interface.

Twilio is implemented as a replaceable backend adapter. Sender/Philippine route approval and funded service are needed. Links are omitted from alert SMS until a compliant registered URL/template is approved; available coordinates and recorded location time are included instead. References: [Philippines prices](https://www.twilio.com/en-us/sms/pricing/ph), [Philippine sender and URL requirements](https://www.twilio.com/en-us/guidelines/ph/sms), [Verify charges](https://www.twilio.com/en-us/verify/pricing), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Pair and commission a real device

1. Register the vehicle in its authorized TODA, then use the existing engineer/admin provisioning control to obtain its one-time device token. Keep it in ignored firmware configuration. Never use a human session/password as a device token.
2. Follow the current [CPE wiring tables](CPE_TEST_BY_TEST_WIRING_TABLES.md) and [CPE continuation](CLOUD_CONTINUATION.md). Preserve their established pins and unresolved electrical gates. No wiring or active private flags were changed by this software work.
3. Upload the reviewed canonical `firmware/solair-cpe/solair_cpe.ino` only after physical approval. New telemetry adds stable alarm IDs, cause lists, captured event time and sensor ages. Old firmware remains ingest-compatible but does not automatically gain operational SMS eligibility without the explicit alarm identity.
4. After actual acceptance, an administrator records the evidence reference and responsible operator under device commissioning. Engineers can inspect or decommission but cannot approve live SMS commissioning.
5. The driver and designated operator must each have verified email/mobile ownership and SMS consent. No verified driver assignment means no driver SMS. If event occurrence time is unknown or delayed over 15 minutes, only the designated operator is selected for review because assignment history is not yet available.
6. Ordinary USB bench ingestion cannot enqueue operational SMS, even when the payload says `hardware`. Use a separate bench database/configuration. Tests must never be pointed at a working fleet.

## Alarm, recovery and delivery behavior

Sensor → ESP32 local detector/output → persistent queue → authenticated HTTPS → atomic telemetry/event/incident transaction → authorized dashboard and durable SMS worker. The browser does not originate SMS jobs.

The final CPE firmware retains the 10-second boot/secure-contact ARM gate and USB `ARM`/`DISARM` at 115200 baud. An optional physical control is implemented but defaults to `LOCAL_ARM_PIN=-1`: no new pin or wiring is assigned. A hardware lead must approve a free pin and secure switch wiring before enabling it. There is no remote ARM/DISARM command channel or false dashboard confirmation.

The configured alarm pulse defaults to five seconds and cannot exceed ten seconds. An IRAM hardware-timer ISR de-energizes the established GPIO independent of ordinary task, mutex, UART, HTTP and sensor waits. The software timer/main-loop cutoff remain additional paths. New causes do not extend the pulse; every cause shares the same activation identity. DISARM resets the latch. The timer does not prove physical sound, correct driver polarity, reset-safe circuitry or protection against every electrical/interrupt fault. A physically independent cutoff is still required wherever the safety specification demands that stronger guarantee.

The existing CPE journal retains at most six event frames plus a replaceable heartbeat. Writes/removals are checked, overflow is reported and events are not acknowledged on conflicts/errors. New firmware requires a matching `{ack:{persisted:true,device_id,boot_id,sequence}}` response. Deploy the backend before updating firmware. Valid unseen delayed events persist once without replacing live telemetry/GPS or accumulating historical harvest. Current device contact, device UTC/unknown measurement time, per-sensor reported ages and GPS age remain distinct. This finite journal is not a loss-free recorder; power-cut/overflow testing is mandatory.

An incident connects alarm identity, causes, reported state, uncertain/device UTC time, server receipt, last-known location, notification attempts and operator acknowledgment. It never marks physical siren sound confirmed automatically. Find it in **Security → Alarm incidents and SMS delivery**.

SMS rules:

- Only authenticated, commissioned operational device events can enqueue eligible recipients. Opening dashboards, replaying events, USB bench frames and demo activity cannot send alerts.
- Simultaneous causes coalesce into the same incident and queued message. Stable identities deduplicate replays, including after raw telemetry retention.
- Five-minute vehicle/recipient cooldown suppresses repeated messages but keeps every incident and suppression reason visible. Suppressed incidents are not automatically resent later. Delayed backlog is rate-limited, not described as a fresh live alarm.
- Recipient verification, consent, role, organization, assignment and commissioning are checked again at dispatch. Removing consent cannot recall an already submitted message.
- Explicit provider rate rejections may retry after 30 seconds then 120 seconds, at most three submissions. Accepted/ambiguous requests never blindly retry. An atomic database claim prevents competing workers claiming the same queued job.
- States are queued, provider accepted, delivered when a signed confirmation arrives, failed, unknown outcome, suppressed, or simulated dry-run. Delivered is not read. No callback means no delivery claim.
- `/api/sms/status?job=…` validates the provider signature and account; out-of-order callbacks cannot downgrade delivered. A crash/timeout with unknown submission outcome requires provider investigation; no automatic failover/resend is enabled.

## Purchased A7670E

Keep existing AT/registration diagnostics and electrical gates. `scripts/modem-sms-bench.py` adds a bounded USB AT SMS diagnostic, **dry-run by default**. The exact carrier supply, UART translator, USB AT port, antenna, registered SIM, SMS support/load and carrier coverage must be verified first. It does not implement automatic alarm SMS fallback.

```powershell
# No port opened, no SMS sent:
python scripts/modem-sms-bench.py
```

After explicit physical/paid approval only, configure `SOLAIR_MODEM_SMS_APPROVED=1`, private `SOLAIR_MODEM_RECIPIENT`, and the same approved test-recipient allowlist. Install pyserial in a local isolated environment and use the actual modem AT port with `--port` and `--execute-approved-test`. Do not invent a COM port. The helper checks SIM readiness/registration and labels `+CMGS` as modem acceptance only. A timeout is UNKNOWN; do not blindly repeat. Automatic backend/modem fallback stays disabled because safe duplicate prevention during partitions and carrier delivery remain uncommissioned.

## Research exports and acceptance

Telemetry CSV is in History & Reports (up to 5,000 rows); incident/delivery CSV is in Security; evidence CSV is in protected CPE Lab. Exports preserve source, device identity and timestamps, label limits, and escape spreadsheet formulas. Existing JSON/CPE CSV exports remain.

Run the software checks using temporary stores:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
$env:SOLAIR_TEST_POSTGRES='1'
npm.cmd test
Remove-Item Env:SOLAIR_TEST_POSTGRES
npm.cmd run build
node_modules/.bin/tsx.cmd tests/operational-browser.ts
node_modules/.bin/tsx.cmd tests/regression-preview.ts
node_modules/.bin/tsx.cmd tests/notifications-preview.ts
```

Browser runners own temporary databases/ports and stop their servers. They do not seed working real-device databases. Screenshots, fixture databases and build products remain ignored. See [operational acceptance](OPERATIONAL_ACCEPTANCE.md) and the final implementation report for actual check results and physical limits.


## Operational firmware 2.1 timestamp clarification

`device_timestamp` / `device_uptime_ms` describe frame/measurement capture. Optional `event_timestamp` / `event_uptime_ms` describe the separately captured cause occurrence. Explicit null event UTC remains unknown even if capture happens after NTP synchronization; legacy frames without these optional fields retain their documented fallback. Sensor ages use successful reads; ADS1115 reports the oldest of its four channel samples. Do not attach a fresh acquisition-time GPS fix to an older event as if it were the event location. These semantics are implemented and compiled; actual timing/fix correctness still requires bench evidence.

## Administration navigation and everyday use

- **Settings:** appearance (Light/Dark/System), name, account email, in-app notification preference, mobile number, SMS consent and contact verification. Account-menu Help/support and Report a problem remain available.
- **People & assignments:** searchable registered-account directory, filters, 25 accounts per page, administrator TODA/access confirmation, driver assignments, vehicle registration and invitations. Administrators see all accounts; operators see only their own TODA. Private empty registration workspaces are not presented as real TODAs.
- **Devices:** physical readiness/evidence, the operator responsible for alarms and vehicle appearance. Saving readiness does not enable paid SMS or prove a physical test passed. User accounts are managed in People, not here.
- **Organizations:** real TODAs and administrator workspace switching/creation. **Activity log:** administrator audit records.
- Driver screens retain the short Home/vehicle, Location, Energy, Alerts, Help and Profile workflow. Operator screens retain fleet tasks; engineering and organization-wide administration are not presented to ordinary operators.

New signup users can choose Driver or TODA operator. Operator access is confirmed by an administrator after identity/TODA checks. Administrator/engineer access uses protected provisioning or invitations. Public signup cannot assign itself a privileged role or another person's vehicle. Old registrations predating role preferences remain usable without fabricating a preference.

The new `007_registration.sql` table records intended use; `008_registration_supabase.sql` protects it from direct browser database access. These are additive migrations. No account or legacy request was automatically deleted, approved, assigned or moved during this UI revision.

## Driver registration, operator information and activity

1. At signup, choose Driver and select BEMAC or NWOW, or choose TODA operator. The choice describes the user's declared vehicle type; it does not claim an existing vehicle or grant permissions. Older accounts with no recorded type show Not specified and can complete it in Settings.
2. Drivers now have an explicitly labeled **Settings** button, plus the account-menu Profile shortcut. **My registration and assignments** shows name, actual role, TODA, declared type, GPS/map display name, and each genuinely assigned vehicle's model, ID, display name and responsible operator. Missing assignments stay Not assigned. The Home screen also shows a read-only summary.
3. Edit the GPS/map display name in Settings. It appears as text in the authorized vehicle's map popup; the marker still shows the unique vehicle ID. It does not change coordinates or GPS freshness. A self-declared NWOW type does not relabel an assigned BEMAC vehicle. Newly registering a vehicle also has a BEMAC/NWOW choice. NWOW uses an honest photo-unavailable placeholder until an approved image is provided, rather than showing a BEMAC as NWOW.
4. Operators complete **Operator information** in Settings: operator/business name, service area/route and optional shared contact number. An administrator can also edit it under People → Manage account. The shared number is visible only through the assigned-driver details; it does not replace verified private SMS contacts.
5. In People & assignments, select the vehicle, driver and **Responsible operator**. Only administrators can choose another authorized TODA operator; an operator can select themselves. Assignments and their actor/time are recorded. If this changes the approved notification operator, existing device notification readiness is cleared; an administrator must review Devices and choose the assigned operator before notifications can resume. Assignment never enables SMS automatically.
6. **Activity log** now shows registrations, vehicle/TODA assignments, access changes, operator information changes, device readiness/calibration, alert handling and assistance events. Search/filter and pages of 25 keep it readable. Sign-ins have a separate filter. Registration events from not-yet-linked accounts are visible to admins across registration workspaces. Historical events show only information actually recorded; previous missing snapshots are not invented.

Migrations 009/010 add and protect registration details, operator information, explicit vehicle/operator links and activity descriptions. Existing accounts, hardware records and private contact settings are preserved. These additions do not demonstrate physical GPS, sensor, siren, SMS or cloud operation.

## Confirming a saved TODA assignment

Selecting a TODA in People → Manage account is only a form selection. Click **Save TODA and account access** and look for **Saved TODA: [name]** in the success message. The affected person must sign in again because membership updates revoke their old sessions. Then verify both the sidebar and Settings → My registration and assignments. Neither the driver's declared vehicle type nor an old signup request establishes TODA membership.

The sidebar now loads the organization name from the same authenticated `/api/me` result as the account's organization ID, rather than a separate late organization-name request. Refresh/focus/reconnect rechecks membership, and a revoked session clears the stale workspace. Unassigned workspaces show a dash rather than misleading Manila initials. Vehicle assignment remains separate from TODA membership.

## Compact TODA dropdown

Click the TODA panel at the top of the sidebar. The read-only dropdown shows the saved TODA name and the driver's assigned vehicle ID/model, or **No assigned vehicle**. It omits operator contacts, registration shortcuts and duplicate account actions. Driver assignments come from the existing authorized registration endpoint; loading/error states do not pretend that a vehicle is unassigned. For fleet staff the same panel shows the currently selected authorized vehicle, labeled **Selected vehicle**, rather than implying a personal driver assignment. TODA switching remains in the existing administrator Organizations page.

Click again, click outside or press Escape to close it. On mobile, Escape closes this dropdown first while keeping navigation open. This UI does not assign vehicles, change TODA membership, modify credentials or enable SMS.
