# H01 / H22 — Google login runtime correction (2026-09-30)

## Reproduced cause

At http://localhost:3001/app/auth/login, Nginx in `gotek-frontend` served
`/assets/index-Wox_u0g8.js`. Inspection of this served asset found
`loginWithGoogle({email:"alex.rivera@gotek.vn",name:"Alex Rivera"})` in the
Google button handler, with no `initTokenClient` or `requestAccessToken`.
The active container therefore still contained the mock login, regardless of
the source edits and `.env` credentials. Earlier reports attributing this
incident to stale cookies were hypotheses, not verified root cause.

## Changes and local rollout

- Retained removal of the mock account and backend rejection of missing credentials.
- Docker frontend build accepts the public OAuth Client ID, falling back from
  `VITE_GOOGLE_CLIENT_ID` to root `GOOGLE_CLIENT_ID`.
- Local Vite preserves `frontend/.env` support and explicitly resolves the public
  Client ID from frontend, root or process configuration; backend secrets are not exposed.
- Popup creation stays synchronous with the click. Logout of the existing GoTek
  session occurs only after Google returns a credential.
- Ran `docker compose up -d --build --no-deps backend frontend` locally. No database
  reset, migration, seed or production deployment was performed.

## Verification

- Docker build completed: backend TypeScript gate and frontend TypeScript/Vite gate passed.
- `npm run test:frontend`: 5/5 passed outside sandbox; first sandbox attempt failed
  before running tests at `uv_os_get_passwd`. These existing tests do not cover OAuth.
- Served asset after rebuild: `/assets/index-DR5RoQoN.js`.
- Served asset contains `initTokenClient` and `requestAccessToken`: true.
- Served asset contains the configured root Google Client ID: true (value not recorded).
- Served asset contains `alex.rivera@gotek.vn`: false.
- HTML loads `accounts.google.com/gsi/client`: true.
- POST `/api/auth/google` through port 3001 with `{}`: 401 `GOOGLE_CREDENTIAL_REQUIRED`, no Set-Cookie.
- POST same route with the old mock email/name payload: 401 `GOOGLE_CREDENTIAL_REQUIRED`, no Set-Cookie.
- In-app browser opened the login page and clicked Google. It remained at the
  login route; no automatic admin navigation occurred. The Google popup was not
  visible among browser tabs, so account selection and successful OAuth remain unverified.

## Limits and next check

Full backend/DB regression and real Google-account login were not run. No OAuth
identity or session records were read or changed manually. Existing sessions were
not globally revoked. This verifies replacement of the stale runtime and rejection
of mock login, not full Google SSO acceptance or production readiness.

Next: reload the existing browser tab at http://localhost:3001/app/auth/login,
complete Google account selection, and compare the selected account email with
the resulting `/api/me` identity without sharing credentials/tokens. If popup or
consent fails, record the visible error; do not reintroduce mock login.

Known follow-up: backend audience validation is currently conditional on
`GOOGLE_CLIENT_ID`, and App.refresh catches `/me` errors. Mandatory audience
configuration, failed-refresh handling and dedicated OAuth regression tests
remain hardening work; this report does not claim those are fixed.
