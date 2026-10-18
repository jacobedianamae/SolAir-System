# In-app notifications

The bell opens a dropdown rather than navigating to Security. It shows the 50 most recent authorized activity items, with category filters, timestamps, source labels and links to the relevant page/vehicle.

Sources:

- **Security:** recorded motion, lid, mount and other security events.
- **Alerts:** recorded device-offline, sensor-fault and GPS-unavailable events.
- **Harvested energy:** positive recorded solar/wind Wh increments grouped by vehicle, source and UTC day. Missing sensors, zero energy and gaps do not generate invented harvest notifications. A changing daily amount updates the same feed item. CPE v2 frames are excluded from this harvest aggregation: bench-supply and MPPT-output meters remain visible in CPE channels/history, and do not establish harvested solar/wind energy. An explicit validated source mapping would be needed before adding those channels to harvest notifications.
- **System updates:** recorded vehicle registration/assignment/image changes, device credential rotation, calibration records and the current user's account changes. These are actual administrative changes, not fabricated software-release announcements. Credentials and raw audit targets are never included in the feed.
- **Assistance:** recorded requests and acknowledgment/resolution states.
- **Messages:** received messages from other users for authorized vehicles.

Demonstration and hardware sources are separated by the selected data mode. Administrative updates are explicitly labeled SYSTEM and can appear in either mode. Drivers see only their current assigned vehicles; other roles remain restricted to their current TODA.

The feed refreshes after dashboard/live-update refreshes and on the existing 15-second UI timer. Failures show a stale-data message and Retry control. No browser push or background phone delivery is claimed.

Clicking an item marks it read and opens its related screen. Mark all read marks the loaded items, without acknowledging security events, resolving assistance or marking messages read. Read markers are scoped to account, TODA and mode, saved in this browser, and synchronized across same-origin tabs. They are not synchronized across devices. The existing profile preference controls notification badges; the activity feed remains available when badges are disabled.

Implementation: `GET /api/notifications`, `server/notifications.ts`, `packages/notifications/index.ts`, and `src/Notifications.tsx`. No database schema change was required. Authorization/aggregation tests use disposable SQLite, or PGlite PostgreSQL when `SOLAIR_TEST_POSTGRES=1`. `tests/notifications-browser.ts` must use a separately seeded disposable local production preview through `TEST_URL`, because it registers a test vehicle to verify live system updates. Public basemap tiles are mocked during these automated UI checks.

For repeatable group-checkout browser validation, build first, then run `npx tsx tests/notifications-preview.ts`. This runner owns a temporary database and localhost port 15372, explicitly seeds a DEMO offline alert and a system registration record, and runs `tests/notifications-browser.ts`. It preserves the hardware-only offline sweep; no synthetic hardware messages are sent.
