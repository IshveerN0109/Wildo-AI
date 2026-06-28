---
name: Auth setup
description: Replit Auth OIDC integration decisions and email notification setup
---

# Auth Setup

## What was built
- Full Replit Auth (OIDC) with PostgreSQL session storage via `lib/db/src/schema/auth.ts` (sessions + users tables).
- Auth routes at `/api/login`, `/api/callback`, `/api/logout`, `/api/auth/user`.
- `authMiddleware` mounted in `app.ts` before routes (after cookieParser).
- `@workspace/replit-auth-web` lib provides `useAuth()` hook; consumed via `AuthContext` in the frontend.
- Admin email notification on every user sign-in via `artifacts/api-server/src/lib/email.ts`.

## Email notification
- Uses nodemailer with Gmail SMTP, sends to ashishnairoo048@gmail.com.
- Requires `GMAIL_APP_PASSWORD` env secret (Gmail App Password, not account password).
- If `GMAIL_APP_PASSWORD` is not set, email is silently skipped (logs a warning).
- Sends user display name + email (never password). Flags new vs returning users.

**Why:** Admin wants to know who signs in; passwords must never be transmitted.

## Security
- Passwords are never stored or shared — Replit handles all identity.
- Sessions are `httpOnly`, `secure`, `sameSite: lax` cookies.
- PKCE mandatory on all flows.
