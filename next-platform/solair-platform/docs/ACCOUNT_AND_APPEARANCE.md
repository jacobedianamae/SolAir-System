# Account menu, logout and appearance

Open your initial in the top-right corner to access:

- **Profile:** opens your existing profile/settings page.
- **Help and support:** opens SOLAIR's help topics and links to assistance/messages.
- **Report a problem:** submits an authenticated software problem report. A successful submission displays a reference. Reports are stored in the organization's administrator audit trail; no external support service or email delivery is implied. Failed submissions keep the draft and do not display success.
- **Log out:** revokes the current server session and clears the signed-in view in other tabs on the same origin. It also closes that session's server event streams. Other independently authenticated sessions remain valid.

The left panel also has a **Log out** button directly below **Settings** (Profile in the driver's navigation). It belongs to the scrollable navigation, above the account footer. On a phone, open the navigation menu to access it. The navigation overlay can be dismissed by clicking outside it or pressing Escape.

If logout cannot be confirmed, the app keeps the signed-in view and shows an error. Reconnect and retry. Logging out does not send, discard or acknowledge queued assistance requests.

## Appearance

Choose **Light**, **Dark** or **System** in the account menu or Settings.

- **System** is the default and follows changes to the device's color preference while SOLAIR is open.
- An explicit Light/Dark choice takes precedence over the device setting.
- The selection is saved in this browser, applies to the login screen too, and synchronizes between tabs.
- If browser storage is unavailable, the choice still applies for the current tab.
- Basemap imagery and the approved white BEMAC visualization retain their original colors.

The account dropdown supports keyboard focus, Escape and outside-click dismissal. Appearance choices are native radio controls.

## Implementation and checks

UI: `src/AccountMenu.tsx`, `src/Theme.tsx`, `src/Support.tsx`, integrated in `src/main.tsx`.

Backend: `POST /api/logout` is idempotent, clears the cookie and revokes its session. `POST /api/problem-reports` validates content and vehicle access, rate-limits submissions and saves a `problem_report` audit entry. Existing organization/administrator restrictions govern audit access. No database schema change was needed.

`tests/account.test.ts` uses an in-memory database. `tests/account-browser.ts` requires `TEST_URL` pointing to a separately seeded disposable **local production preview**, because it creates test problem reports and performs logout. Do not point it at a live fleet database. Screenshots/results are saved under ignored `test-results/account-ui/`.
