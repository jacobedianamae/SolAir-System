# SOLAIR local UI integration review — 18 October 2026

**Ready for your review; nothing staged, committed or pushed.** All edits are in the new group checkout. The original application remains untouched and clean.

## Workspace and history

- Original: `C:\Users\Anyang\Videos\SolAir\solair-platform`, HEAD `2d372accb591120ad8c832e1366f9b379889628e`.
- New checkout: `C:\Users\Anyang\Videos\SolAir-group-integration`.
- Remote: `https://github.com/andreirtc/SolAir.git`.
- Branch: `feature/local-ui-notifications`, based on the group's latest main at cloning: `7db97a3dce705331650c8959fe82d6e1375af85f`.
- Application: `next-platform/solair-platform`. Root AGENTS.md and current continuation instructions were followed.
- The local and group repositories have separate Git histories. Only reviewed source changes were transferred; histories were not combined. No group files were deleted.

## Integrated features

| Feature | Result |
| --- | --- |
| Account controls | Clickable avatar: Profile, Help and support, Report a problem, Log out. Existing role permissions retained. |
| Sidebar logout | Immediately below Settings (Profile for driver); no permanent outline. Mobile navigation stays usable. |
| Session safeguards | Server logout is repeatable, revokes the matching session and closes its SSE stream. Other sessions remain valid. Failed logout shows an error; confirmed logout clears same-browser tabs. |
| Appearance | Light, Dark and System; live device preference changes, saved browser choice and cross-tab synchronization. |
| Support | Help interface and problem-report form with validation, authorized vehicle context, rate limiting and a persisted administrator audit receipt. Failed requests retain the draft. This does not deliver an external email or SMS. |
| Notifications | Bell dropdown with categories, timestamps, source labels, navigation, browser-local read state, live refresh and retry. Reading does not acknowledge a security incident. |
| Notification access | TODA and driver assignment restrictions; hardware/demo separation; allowlisted system activity without raw audit targets or credentials. |
| Energy notifications | Positive recorded legacy solar/wind Wh increments, grouped per UTC day. CPE v2 samples are excluded: bench/MPPT-output measurements alone cannot establish harvested PV/wind energy. CPE views/history retain those readings. |
| Malabon map | Default center 14.668, 120.965 at zoom 14; Malabon and Show vehicles controls; refresh preserves zoom. Reference map remains available without a GPS fix. |
| Map headers | Canonical OSM tile host, origin-only cross-origin referrers and compatible production CSP. Group GPS freshness checks remain in marker coloring. |

The extra local functionality identified before integration was the logout/session safeguards and saved problem-report workflow. No registration, new role model or SMS feature was introduced.

## How overlapping files were merged

- `README.md`: appended feature/documentation links; retained the group's current CPE continuation.
- `server/app.ts`: inserted account/report/notification routes and session stream cleanup; adjusted map headers. Existing CPE ingestion, duplicate conflict checks, historical-event handling, exports and diagnostics were retained.
- `server/index.ts`: changed only the tile host in the production CSP. Preserved the device-only LAN listener, bind checks and cleanup.
- `src/main.tsx`: added UI imports/state/components and account navigation. Retained CpeReadings, CpeHistory and the data-mode guard.
- `src/FleetMap.tsx`: added Malabon controls and tile policy while retaining the group's independent GPS freshness calculation.
- Shared CSS and two existing browser helpers were transferred only after confirming the group versions exactly matched the local baseline. The CPE browser helper changed only its Sign out selector to Log out.

## Exact source changes

Paths below are relative to `next-platform/solair-platform`.

### Modified files (11)

- `README.md`
- `docs/CLOUD_CONTINUATION.md`
- `docs/CPE_VALIDATION.md`
- `server/app.ts`
- `server/index.ts`
- `src/FleetMap.tsx`
- `src/main.tsx`
- `src/style.css`
- `tests/browser.ts`
- `tests/cpe-browser.ts`
- `tests/preview.ts`

### Added files (16)

- `docs/ACCOUNT_AND_APPEARANCE.md`
- `docs/LOCAL_UI_INTEGRATION_2026-10-18.md`
- `docs/NOTIFICATIONS.md`
- `packages/notifications/index.ts`
- `server/notifications.ts`
- `src/AccountMenu.tsx`
- `src/Notifications.tsx`
- `src/Support.tsx`
- `src/Theme.tsx`
- `tests/account-browser.ts`
- `tests/account.test.ts`
- `tests/map-browser.ts`
- `tests/map-headers.test.ts`
- `tests/notifications-browser.ts`
- `tests/notifications-preview.ts`
- `tests/notifications.test.ts`

### Intentionally excluded

- All original firmware, including historical local firmware and `firmware/releases/solair-1.0.0.bin`; no build binaries or toolchains transferred.
- Real `.env` files, device/Wi-Fi configuration, tokens, credentials, key files, working databases, uploaded private data and account/session records.
- Generated `.next`, node_modules, `.pio`, caches, logs, screenshots and local runtime files. New validation evidence stays under ignored `test-results/` or OS temporary directories.
- Old local `docs/RESUME.md`, implementation/review summaries and historical evidence that could conflict with the group's current CPE handoff.
- Local environment examples and unrelated source files already present in the group checkout were not copied unnecessarily.
- Historical `cpe/` was preserved in place. Existing group documents/evidence were not replaced by local versions.

## Preserved group functionality

Compared 341 selected tracked group files with their HEAD contents (normalizing checkout line endings for text): **no content changes** in the checked firmware, telemetry/backend contracts and migrations, device listener, database adapter, identity/realtime adapters, CPE views/Lab, public artwork/assets and historical CPE files. The main-file diff also confirms preserved CPE components and GPS freshness logic.

Existing automated checks still cover device identity and credentials, unauthorized/role/assignment rejection, v1/v2 contracts, duplicate/replay handling, historical recovery without refreshing live data/GPS, diagnostics, CSV export, database constraints, Supabase access restrictions and the private device-only LAN listener. Tests exercise software fixtures, not connected ESP32 hardware.

## Validation performed now

Node 24.18.0 and npm 11.16.0 were used. `npm ci --no-audit --no-fund` succeeded; no dependency or lockfile change was needed.

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS, including final test-runner additions |
| `npm run lint` | PASS, including final test-runner additions |
| `npm test` | PASS: 54/54, disposable SQLite |
| `$env:SOLAIR_TEST_POSTGRES='1'; npm test` | PASS: 54/54 suite; PostgreSQL-capable tests use isolated PGlite. Pure/unit and other fixture-only tests retain their own stores. |
| `npm run build` | PASS: TypeScript, optimized Next.js production build, finalized PWA assets |
| Account browser | PASS: desktop/phone menu, themes/System changes, profile/help, saved report, failed report preservation, failed/successful logout and cross-tab logout |
| Notification browser | PASS: categories, navigation, read markers, live system updates, hardware/demo split, retry, mobile dark dropdown and logout |
| Map browser | PASS: 1440px and 390px; Malabon coordinates/zoom, fleet framing, recenter, refresh, empty fleet/fix, movement; stale GPS stays offline even with an online device, fresh GPS becomes online |
| Existing broader browser suite | PASS: 14 reported checks, including BEMAC, navigation, SOS/messages, late-response isolation, engineering evidence, access, offline retry and logout |
| Existing CPE browser suite | PASS: 7 reported checks with temporary TEST FIXTURE data, CPE history/CSV, driver Energy and 390px layout |
| Existing PWA suite | PASS: 10 reported checks, production defaults, service worker, offline shell, precache exclusions and mobile layout |
| Real basemap smoke check | PASS: 20 tile responses HTTP 200; visually inspected the actual Malabon map with no Access blocked tiles in this run |
| Visual inspection | Desktop dark account menu, phone account and notification dropdowns, and actual Malabon map reviewed |
| `git diff --check` | PASS |

The backend suites include new notification authorization/aggregation and account/session tests. A regression explicitly excludes CPE bench, MPPT-output and historical frames from harvest notifications.

### Test corrections and limitations

Two initial browser checks failed and were corrected in the transferred tests: the account test now waits for the dropdown render; the notification test now has a dedicated preview runner with explicit demo/system fixtures instead of assuming a demo offline event exists. The group's hardware-only offline sweep was not changed. Final reruns passed; no unresolved integration test failures remain.

PGlite is embedded PostgreSQL testing, **not a connection to the group's Supabase project**. Railway/Supabase deployment, real cloud secrets, physical ESP32/GPS/sensors, electrical wiring and siren behavior were not tested. No firmware compile/upload was needed for these unchanged firmware files. Existing unresolved ADS ground/offset observations remain unresolved in the canonical CPE validation document.

Most browser suites mock public map imagery to avoid repetitive community tile requests; the separate real-network screenshot confirms actual basemap access only at the time of this check. It does not establish physical GPS tracking or future tile-service availability.

## Reproducing the software checks

Run in PowerShell after changing to the application folder:

```powershell
Set-Location 'C:\Users\Anyang\Videos\SolAir-group-integration\next-platform\solair-platform'
npm.cmd ci --no-audit --no-fund
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
$env:SOLAIR_TEST_POSTGRES='1'
npm.cmd test
Remove-Item Env:SOLAIR_TEST_POSTGRES
npm.cmd run build
node_modules/.bin/tsx.cmd tests/notifications-preview.ts
```

The notification preview runner owns localhost port 15372 and an OS-temporary database; it seeds a **demo** offline event and an allowlisted system record. It does not change the group offline sweep or inject real-device messages. It stops its own server afterward.

For this review, account/map/general/PWA checks used a separately seeded database at ignored `test-results/integration/preview.db`, localhost port 4173 and `SOLAIR_ALLOW_LOCAL_PREVIEW=1`. The group CPE browser test used its own temporary database on port 15371. Temporary runner copies redirected the existing browser/PWA/CPE evidence into ignored `test-results/integration/` to preserve historical documentation artifacts. Account and map checks used `TEST_URL=http://127.0.0.1:4173`. Do not point these tests at a working fleet database.

Evidence available locally (ignored, not intended for commit): `test-results/account-ui/`, `test-results/notifications-ui/`, `test-results/map/`, and `test-results/integration/` (browser/PWA/CPE results, preservation metadata and real-map screenshot). The review-owned 4173 preview was stopped after testing. The original site's process was not stopped.

## Security and credentials

Existing root/application ignore rules were retained. Changed/untracked source filenames contained no real environment files, private device configuration, databases or binary artifacts. A targeted private-key/GitHub-token pattern scan found no matches in the changed source files; this is a focused check, not a claim of exhaustive secret detection.

Known demo login strings in test fixtures remain local-test credentials. They must not be provisioned as production accounts. Configured external authentication still rejects local-password fallback in the tested provider checks. No production credentials were created, copied, logged or committed.

No schema migration was added: problem reports use the existing audit store and notifications derive authorized activity from existing tables. Notification read state and appearance are browser-local, not multi-device settings. No push/SMS delivery is claimed. Harvest notification support for newer CPE sources needs a separately reviewed, validated source mapping.

Dependency installation reported the existing ESLint version as unsupported and an npm esbuild install-script approval notice. The installed build/test tooling nevertheless passed all listed checks. Dependencies were not upgraded as part of this integration.

## Final Git state and proposed next steps

- Branch: `feature/local-ui-notifications`.
- HEAD still equals the group's starting main commit above.
- **11 modified files and 16 new files; no deleted files; all integration changes unstaged.**
- No commit, push, merge, rebase, reset or history combination was performed.
- Original local HEAD unchanged, working tree clean.

Recommended single commit: `feat: integrate account controls, themes and scoped notifications`.
Alternative review title: `Integrate local account, notification and Malabon map features while preserving CPE`.

**The following commands are proposed only. Wait for owner approval before executing the staging/commit/push steps.** `git add` prepares reviewed files for a commit; `git commit` saves the local snapshot; `git push` uploads only the feature branch.

```powershell
Set-Location 'C:\Users\Anyang\Videos\SolAir-group-integration'
git branch --show-current
git status --short
git diff --check
git diff -- next-platform/solair-platform

$reviewedFiles = @(
  'next-platform/solair-platform/README.md'
  'next-platform/solair-platform/docs/CLOUD_CONTINUATION.md'
  'next-platform/solair-platform/docs/CPE_VALIDATION.md'
  'next-platform/solair-platform/server/app.ts'
  'next-platform/solair-platform/server/index.ts'
  'next-platform/solair-platform/src/FleetMap.tsx'
  'next-platform/solair-platform/src/main.tsx'
  'next-platform/solair-platform/src/style.css'
  'next-platform/solair-platform/tests/browser.ts'
  'next-platform/solair-platform/tests/cpe-browser.ts'
  'next-platform/solair-platform/tests/preview.ts'
  'next-platform/solair-platform/docs/ACCOUNT_AND_APPEARANCE.md'
  'next-platform/solair-platform/docs/LOCAL_UI_INTEGRATION_2026-10-18.md'
  'next-platform/solair-platform/docs/NOTIFICATIONS.md'
  'next-platform/solair-platform/packages/notifications/index.ts'
  'next-platform/solair-platform/server/notifications.ts'
  'next-platform/solair-platform/src/AccountMenu.tsx'
  'next-platform/solair-platform/src/Notifications.tsx'
  'next-platform/solair-platform/src/Support.tsx'
  'next-platform/solair-platform/src/Theme.tsx'
  'next-platform/solair-platform/tests/account-browser.ts'
  'next-platform/solair-platform/tests/account.test.ts'
  'next-platform/solair-platform/tests/map-browser.ts'
  'next-platform/solair-platform/tests/map-headers.test.ts'
  'next-platform/solair-platform/tests/notifications-browser.ts'
  'next-platform/solair-platform/tests/notifications-preview.ts'
  'next-platform/solair-platform/tests/notifications.test.ts'
)
git add -- $reviewedFiles
git diff --cached --stat
git diff --cached --check
# Inspect the staged contents before continuing.
git commit -m "feat: integrate account controls, themes and scoped notifications"
git push -u origin feature/local-ui-notifications
```

After a successful approved push, open a pull request from `feature/local-ui-notifications` into `main` on `andreirtc/SolAir`. Review the PR and test results before approving any merge. Do not push to main. If GitHub rejects the feature-branch push, the repository owner must grant the signed-in account write access, or the group must approve a fork/PR workflow. No push was attempted in this integration.

If the group's main advances before approval, inspect its changes and agree on an update method first; do not automatically pull, rebase or combine histories.
