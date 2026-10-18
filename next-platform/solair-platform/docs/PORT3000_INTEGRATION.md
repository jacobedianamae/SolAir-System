# Combined SOLAIR at localhost:3000

Integrated on 18 October 2026. This checkout, `C:\Users\Anyang\Videos\SolAir\solair-platform`, is now the active application root. The reviewed application was transferred from the separate operational checkout into a local feature branch; unrelated Git histories were not merged.

## Open and start

Open **http://localhost:3000/**. The old review address http://localhost:3001/ redirects to port 3000, preserving the page path. Sign in again if the old review session is no longer valid. Account passwords were not reset.

In PowerShell:

```powershell
Set-Location 'C:\Users\Anyang\Videos\SolAir\solair-platform'
npm.cmd run build        # only needed after changing application source
npm.cmd run start:combined
```

The combined launcher serves the tested local production build on port 3000 and an HTTP redirect on 3001. It binds to this PC's loopback interface, uses `data/solair.db`, and explicitly disables paid SMS, cloud identity/realtime and the optional device-only LAN listener. It never seeds another demo database. This remains the local demonstration/presentation environment; it is not a cloud deployment or hardware commissioning pass. Browser appearance settings for port 3000 remain on that origin.

Do not start a second application on ports 3000/3001. Stop this launcher normally with Ctrl+C before restarting it. It does not stop unrelated port owners. A separate hardware bench listener needs the existing documented deliberate LAN configuration; this launcher does not silently enable it.

## Code and Git preservation

- Active branch: `feature/combined-operational-ui`.
- Original demo checkpoint: `2d372ac` on `solair-demo-checkpoint-2026-10-18`.
- Reviewed source: the separate operational feature checkout, based on the group's `dc199ca` plus the reviewed local changes.
- Original-only source/documentation was retained; no files were deleted. Twenty-nine existing files needed actual content changes and 239 application files were added from the reviewed source, primarily the newer CPE sources/docs and operational features. Subsequent integration-only additions include this guide, root AGENTS instructions and the combined launcher.
- Dependency and lockfile configurations matched structurally; no dependency upgrade or fresh credential configuration was required. The approved BEMAC artwork and original core migration were identical. NWOW handling, Malabon map, accounts, administration, theme, notifications, registration, CPE and guarded SMS functionality are included.
- No real environment file, private firmware configuration, generated binary or database was transferred as application source. No firmware was uploaded. No commit, push, rebase, force-push or Git merge was performed.

The application-root layout here is flat. Guides copied from the reviewed/group checkout may retain historical references to its nested `next-platform/solair-platform` path or former port 3001 preview; use this guide for the current local start path and URL.

## Database preservation and account combination

Both local servers were paused for final SQLite snapshots. The new database was prepared separately, migrations were applied, and only then was it activated. Original database files and journals were moved to a private rollback directory rather than discarded.

Every one of the **688 pre-existing rows** was checked against the original snapshot, including credential hashes, telemetry and evidence. All values matched. SQLite integrity and foreign-key checks passed.

| Records | Original | Combined before live sign-in verification |
|---|---:|---:|
| Accounts | 5 | 6 |
| Vehicles | 9 | 9 |
| Devices | 8 | 8 |
| Telemetry | 144 | 144 |
| CPE sessions | 10 | 10 |
| CPE evidence/results | 1 | 1 |

The new account, saved TODA membership, contact/registration details and compatible operational records were appended without overwriting existing profiles or device credentials. The preview's duplicate seeded demonstration telemetry was excluded; original history was retained. No preview hardware telemetry existed. Preview sessions were not imported; users may need to sign in again. No password, verified phone or hardware credential was invented or reset. Row preservation does not establish physical PASS for historical evidence.

## Private rollback material

The ignored `.tools/port3000-integration-state.json` identifies the backup directory. Its current location is:

`C:\Users\Anyang\Videos\SolAir\solair-platform\.tools\backups\port3000-2026-10-18-85db0292`

It contains original source copies, before/final SQLite snapshots of both databases, original raw database/journal files, the source-copy manifest and a data-preservation report. These files contain private application data and must never be committed or shared publicly. `data/combined-staging.db` is also private/ignored. The separate operational checkout remains available as a code reference; its server has been retired in favor of the redirect.

Rollback requires stopping the combined launcher first and restoring the selected source/database snapshot together. Do not switch branches with uncommitted integration work and expect it to disappear; Git preserves working-tree changes. Ask for a deliberate rollback if needed rather than copying a database over a running server or deleting the current work.

## Validation

The integrated checkout passed 75 automated tests, TypeScript checking and a production build using temporary test stores. Live smoke checks confirmed port-3000 HTTP 200, the path-preserving port-3001 redirect, existing administrator login, and the imported account's saved TODA and driver role. Only a temporary verification admin session was opened and closed; no synthetic telemetry or test registrations were inserted into the combined working database.

Final lint passed. All 14 operational browser groups passed in this integrated checkout, covering signup, account approval boundaries, saved TODA consistency, the compact dropdown, desktop/mobile layout, incident permissions, contact handling, protected CPE access and operator information. The launcher initially needed explicit Node builtin imports for lint; that was corrected and the final check passed. Physical hardware, actual SMS/email delivery and cloud connectivity were not retested or claimed by this cutover. SMS remains disabled. See [operational setup](OPERATIONAL_SETUP.md) and [acceptance gates](OPERATIONAL_ACCEPTANCE.md).
