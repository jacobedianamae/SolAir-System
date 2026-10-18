# Railway + Supabase deployment

Prepared 11 October 2026. Accounts and credentials have not been configured. This is a runnable deployment package and setup guide; hosted access has not been demonstrated. Local development continues without credentials using `npm run dev`.

## Create the Supabase project

1. Create an account and a new Supabase project. Save its database password privately. Use a fresh project for SOLAIR.
2. In **Connect**, copy the **Session pooler** PostgreSQL URL on port **5432**. Session mode suits this persistent Node backend and supports IPv4. Copy the actual host, project-qualified username and database from your dashboard; URL-encode the password. [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres).
3. Download the project's database root certificate from its database settings. Put the complete PEM content in sealed Railway variable `SOLAIR_DATABASE_CA`, using actual newlines or literal `\n`. The adapter explicitly verifies TLS with this CA, overriding URL SSL options. Keep `DATABASE_URL` private; never disable certificate verification. [Verified TLS](https://supabase.com/docs/guides/database/psql).
4. Copy the project URL and **legacy JWT `anon` and `service_role` keys** from API settings into the variables below. The server-side Postgres Changes adapter uses the service-role JWT. Never expose it as `NEXT_PUBLIC_*` or place it in frontend code.
5. Enable email/password authentication and require actual email confirmation. Provider-created invitations now send a confirmation link rather than marking email ownership verified automatically. For the operational access-request workflow, enable provider email signup but keep SOLAIR profile/TODA/role approval on the backend; follow [OPERATIONAL_SETUP.md](OPERATIONAL_SETUP.md). Creating a Supabase Auth identity alone grants no SOLAIR fleet access. Use a separate operational project/database and do not reuse demo identities.
6. After choosing the Railway domain, set Supabase Auth **Site URL** to that HTTPS origin and add its exact `/reset-password` URL as an allowed redirect. [Redirect settings](https://supabase.com/docs/guides/auth/redirect-urls).
7. Configure custom SMTP in Supabase before relying on reset emails for ordinary users. The app reports provider acceptance, not delivery. Default Supabase email restrictions can prevent delivery outside approved addresses. [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

## Create the Railway service

1. Create your Railway project. Connect a **new private repository containing this source**, or deploy this folder with Railway CLI after configuring it. Do not reuse a prior SOLAIR repository. Exclude secrets, `data/`, `.tools/` and private `solair_config.h`.
2. Set the service root to the folder containing `package.json`, `Dockerfile` and `railway.json` (use `/` if it is the repository root). The Dockerfile builds Next.js using Node 24 and starts the custom Next/Express server. No Next standalone output is used. [Dockerfile deployment](https://docs.railway.com/builds/dockerfiles).
3. Add the variables below in **Variables**. Railway supplies `PORT`; production binds `0.0.0.0`. Do not set `SOLAIR_ALLOW_LOCAL_PREVIEW` on Railway. [Variable setup](https://docs.railway.com/variables).
4. In **Networking**, generate an HTTPS public domain. Set `SOLAIR_PUBLIC_URL` to its origin without a trailing slash, apply staged variables and redeploy. Update Supabase Auth URLs above. [Public networking](https://docs.railway.com/networking/public-networking).
5. Use one replica initially: rate limits are process-local. Supabase realtime propagates committed operational changes into authorized SSE; shared rate limiting is needed before scaling replicas. Keep `/api/*` outside public CDN caches.

## Exact environment names

| Name | Value/source |
| --- | --- |
| `NODE_ENV` | `production`; Dockerfile also sets it |
| `SOLAIR_AUTH_PROVIDER` | `supabase` |
| `SOLAIR_REALTIME_PROVIDER` | `supabase` |
| `DATABASE_URL` | Actual Supabase session-pooler URL, private URL-encoded password |
| `SOLAIR_DATABASE_CA` | Project database root certificate PEM |
| `SUPABASE_URL` | Actual project HTTPS URL |
| `SUPABASE_ANON_KEY` | Legacy anon JWT; used server-side for identity/recovery |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy service-role JWT; sealed, server-only |
| `SOLAIR_PUBLIC_URL` | Exact Railway HTTPS origin |
| `PORT` | Railway-provided port |

Optional: `SOLAIR_LOCATION_RETENTION_DAYS=30`. Bootstrap-only: `SOLAIR_ADMIN_EMAIL`, `SOLAIR_ADMIN_PASSWORD` (unique 12+ characters), `SOLAIR_ORG_ID=manila`, `SOLAIR_ORG_NAME`. Remove the bootstrap password after account creation. Credential examples are blank. `.env`/`.env.local` are ignored; configure credentials locally or in the dashboard, never in chat.

## Schema, identity and realtime

Startup applies `backend/migrations/001_core.sql`, then `002_supabase.sql` when Supabase authentication is selected. Alternatively apply these in order in Supabase SQL Editor or run `npm run db:migrate` with the private environment. Schema operations require the project database owner connection.

Migration 002 enables RLS on all SOLAIR tables and revokes direct `anon`/`authenticated` access. Browsers use SOLAIR APIs, never raw Supabase queries. API authorization filters role, organization and driver assignment. Supabase proves identity at sign-in; the backend issues an opaque, hashed, eight-hour HttpOnly Secure cookie session stored in the shared PostgreSQL database. Supabase stores passwords; the profile stores only a `supabase-managed` marker. Account changes/recovery revoke SOLAIR sessions.

The publication contains `telemetry`, `security_events`, `help_requests`, and `messages`. Sessions, invitations, credential tables and profiles are not published. The server subscribes with its private service role and emits **empty organization-scoped invalidations** over SSE; clients then refetch authorized records. Never add an anonymous-read policy copied from a generic example. [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

Check HTTPS `/api/health`: `database=PostgreSQL`, `auth_provider=supabase`, `realtime_provider=supabase`, `realtime_status=subscribed`. A reachable process with realtime `connecting`/`error` is not proof of synchronization.

## Bootstrap and commissioning

1. Run `npm run bootstrap` once in a private environment with the above variables and bootstrap secrets. Use a provider-connected job/shell, or a local checkout with temporary ignored `.env.local` pointing to the new Supabase project. Do not put passwords in command arguments. Bootstrap is not automatic and never seeds demo telemetry.
2. Sign in at the HTTPS origin. Register vehicles, invite operators/engineers/drivers, and assign drivers. Invitations are returned for manual sharing; no invitation email delivery is fabricated.
3. Provision an ESP32 token in CPE Lab, then follow [HARDWARE.md](HARDWARE.md). Validate a genuine Wi-Fi frame and server timestamp.
4. Schedule `npm run retention` daily with the private DB environment. Arrange backups and an approved expiry policy. Retention removes expired location-bearing telemetry and dependent energy/location records.

## Separate-device acceptance

Use a phone on mobile data and an operator computer on a different network at the **same HTTPS origin**. Confirm matching help/message/telemetry timestamps and persistence after reload; operator acknowledgment must reach the driver. Verify a second TODA cannot read the first fleet and drivers cannot see unassigned vehicles. Confirm realtime subscription and a committed change triggering both authorized clients to refetch. Install the PWA on Android Chrome and test offline unsent help/reconnect acknowledgment. Record actual evidence.

Local automated browser contexts verify software flows but do not replace hosted checks. Railway deployment, Supabase Auth/SMTP/realtime connectivity, actual ESP32 sensors and separate-network behavior remain unverified until configured and exercised. Software work does not wait for those accounts.
