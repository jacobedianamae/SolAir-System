# SOLAIR platform

**Current CPE continuation (11 October 2026):** this is the authoritative centralized application. All-module v2 integration extends this app; the older `cpe/figma-app` is historical reference. Start with [CPE wiring/power guide](docs/CPE_BREADBOARD_WIRING_AND_TEST_GUIDE.md), [firmware targets and exact Windows commands](firmware/README.md), [consolidated physical acceptance](docs/COMPLETE_CPE_BENCH_AND_APP_ACCEPTANCE.md) and [current validation/limits](docs/CPE_VALIDATION.md). Existing BEMAC design, roles, databases and identity are retained. New firmware is `firmware/solair-cpe/solair_cpe.ino`; unknown electrical interfaces stay disabled until commissioning.

Fresh implementation in `C:\Users\Anyang\Videos\SolAir\solair-platform`. No previous SOLAIR source, configuration or firmware was reused. The master instruction is implemented as an integrated application; outstanding hardware and hosting verification is explicitly documented.

## Run locally

Node.js 24 LTS and npm are required.

```powershell
cd C:\Users\Anyang\Videos\SolAir\solair-platform
npm ci
npm run dev
```

Open **http://localhost:3000**. SQLite is created under ignored `data/`. It is one shared local backend, not a hosted fleet deployment.

Development accounts: `operator@solair.local`, `driver@solair.local`, `engineer@solair.local`, `admin@solair.local`. Local demonstration password: `SolairDemo!2026`. These accounts are seeded only by development startup when the database is empty. Production startup never seeds them. Do not deploy the local database or development accounts.

Choose **Demonstration** for explicitly simulated readings; choose **Real hardware bench** for genuine device records. Real mode starts empty. Demonstration seed readings are recorded samples, become stale, and do not pretend to be a continuously connected fleet.

## Included application

- Driver: assigned BEMAC dashboard, independent voltage/current fields, harvesting status, GPS/last known location, security history, persistent help/SOS workflow, messages, profile, mobile navigation and installable PWA.
- TODA: organization-scoped fleet overview/map, vehicle details, energy history/export, security acknowledgment, help acknowledgment/resolution, persistent conversations, account invitations, driver management, vehicle registration and assignment.
- Engineers: protected CPE Lab, 115200 baud Web Serial, validated fragmented NDJSON parsing, real USB-to-backend ingest, MPU6050/switch/ADC/GPS/LTE diagnostics, USB bench commands, device-token provisioning, guided test records, calibration references and evidence export.
- Administrators: invitations for all roles, account role management with session revocation, organization creation/workspace switching, fleet/device administration, vehicle-image replacement and audit records.
- Backend: relational migrations, SQLite development/PostgreSQL hosting adapter, private cookie sessions, Supabase identity in production and scrypt passwords locally, server-side role/organization/assignment authorization, device-scoped hashed credentials, validation, limits, duplicate/replay rejection, atomic ingest, energy/GPS/event persistence, SSE updates and offline-device events.
- Firmware: fresh Arduino/PlatformIO ESP32 code, configurable modules, debounced switches, calibrated rule-based movement detection, local alarm/LED, safe siren defaults, GPS fix handling, ADS1115 raw diagnostics, LTE AT probe, USB frames, CA-verified Wi-Fi and persistent bounded retry queue. No vehicle propulsion, braking, contactor or charging commands.

## Architecture and layout

Next.js 16 App Router, React 19, TypeScript, custom accessible CSS, Lucide and lazy-loaded Leaflet/OpenStreetMap. One custom Next/Express server serves all roles. Railway runs the Node 24 Docker image; Supabase supplies PostgreSQL, password authentication and Postgres Changes realtime. The backend issues private shared-database cookie sessions after Supabase identity validation and applies organization/assignment authorization. Supabase RLS also denies direct browser table access. SQLite/local authentication support development without credentials.

```text
src/                         Driver, operator, CPE Lab, map and visualization
app/                         Next.js layout, metadata and client application shell
server/                      Auth, API, database, ingestion, health and retention
backend/migrations/          Actual relational SQL schema
packages/telemetry-contract/  Shared versioned Zod schema, parser and energy rules
packages/forecast/            Validated-model extension interface (unavailable default)
firmware/esp32-solair/        PlatformIO firmware and ignored provisioning config
public/                      Approved white BEMAC render, icons, PWA manifest/SW
assets/vehicles/             Authentic CC0 BEMAC source reference
tests/                       Unit, API/permission and browser acceptance tests
docs/                        Hardware, architecture, deployment and test records
```

## Guides and evidence

- [Connect and test the ESP32](docs/HARDWARE.md)
- [Railway + Supabase setup and exact environment names](docs/RAILWAY_SUPABASE.md)
- [Telemetry contract and data integrity](docs/TELEMETRY.md)
- [Architecture and security decisions](docs/ARCHITECTURE.md)
- [Verification and remaining acceptance work](docs/VERIFICATION.md)
- [Vehicle asset provenance and approved corrections](assets/vehicles/README.md)
- [Operator screenshot](docs/screenshots/operator.png), [driver screenshot](docs/screenshots/driver.png), [CPE Lab screenshot](docs/screenshots/cpe-lab.png)

## Commands

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser   # server on port 3000, or set TEST_URL for production QA
npm run test:pwa       # local production preview running on port 4173
npm run db:migrate
npm run bootstrap     # environment-based first production administrator
npm run retention     # scheduled deletion of expired location-bearing telemetry
```

`npm start` serves the production build. A persistent PostgreSQL database and reachable HTTPS domain are needed for a real centralized fleet. Configuration instructions are included; no hosted deployment, physical sensor result or LTE packet transport is claimed.

The screenshot and software tests do not constitute thesis measurements. The guided physical tests remain NOT TESTED or BLOCKED until an engineer records real evidence. Wind generation, traction voltage/current sensing, SOC and validated runtime forecasting are unavailable until the hardware and models are commissioned.

## Account, appearance, notifications and Malabon map integration

Account controls include Profile, Help and support, persisted problem reports, and Log out immediately below Settings. Appearance supports Light, Dark and System. The notification bell opens an authorized activity dropdown, with hardware/demo separation. The fleet map opens on Malabon and retains the CPE GPS freshness checks.

See [Account and appearance](docs/ACCOUNT_AND_APPEARANCE.md), [Notifications](docs/NOTIFICATIONS.md), and [integration validation report](docs/LOCAL_UI_INTEGRATION_2026-10-18.md). Current CPE continuation and firmware instructions above remain authoritative.
