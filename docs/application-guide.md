# Application guide

A Next.js App Router notes app using React, JSX, Tailwind CSS, and react-hot-toast.

## Start the app

1. Run `npm ci` from the repository root.
2. Run `npm run setup` to create only missing `db.json` and `.env.local` files from public templates. Existing files are never overwritten.
3. Run `npm run dev` and open http://localhost:3000.
4. Create your account at `/auth/signup`, then sign in with its username and password.

The sample database contains only two synthetic notes and empty account/session/reset collections. The first account claims those sample notes; later accounts get separate empty notes lists. Your private database is ignored by Git. If `DATABASE_FILE` points elsewhere, initialize that private file from `db.example.json` before starting the server.

Next.js reads and writes the private database on the server. Do not run JSON Server against it or place it under `public/`, since that bypasses authenticated routes. SMTP is optional for normal notes/sign-in; configure it only when you need recovery email.

## Email recovery

Signup asks for a username, email address, password, and matching confirmation. Use an email address you own.

Configure these server-only environment variables in `.env.local`:

- `APP_URL`: the application's trusted public origin; use HTTPS in production.
- `SMTP_HOST`, `SMTP_PORT`: your provider's SMTP server; normally 587 for STARTTLS or 465 for TLS.
- `SMTP_USER`, `SMTP_PASSWORD`: SMTP credentials or an app password from your provider.
- `SMTP_FROM`: an approved sender address, such as `Note App <notes@example.com>`.

Never prefix these variables with `NEXT_PUBLIC_`, and never commit real credentials. Without SMTP configuration, signup/signin work, but password recovery reports that it is unavailable. A successful request uses a generic message to avoid revealing whether a username exists. SMTP acceptance does not guarantee inbox delivery; also check spam and your provider's delivery dashboard. Delivery failures write only a fixed diagnostic message, without private account data.

At `/auth/forgot-password`, enter the current username. Follow the emailed link within 15 minutes. The reset page allows a username change, a password change, or both; leave both password fields blank to keep the password. A successful reset returns to sign-in and invalidates all previous sessions and reset links.

Reset secrets use URL fragments so they do not appear in server access logs. The browser exchanges the secret for an HttpOnly reset cookie and removes the fragment. An invalid, expired, or used link cannot update an account. Email ownership is proven when the recovery link is used; signup itself does not require email verification.

## Code map

- `src/app/auth/`: four JSX authentication pages.
- `src/components/auth/`: shared form, fields, recovery-link handling, and logout.
- `src/app/(app)/`: protected application layout and existing notes/tags routes (URLs are unchanged).
- `src/app/api/auth/[action]/route.js`: authentication endpoints.
- `src/app/api/notes/`: authenticated note endpoints.
- `src/lib/server/`: database, password hashing, sessions, email, and ownership checks.
- `src/lib/validation.js`: shared validation, also enforced on the server.
- `src/services/`: browser API calls.

All UI files use JSX; backend utilities use JavaScript. No TypeScript is required.

Passwords are stored as salted scrypt hashes (N=131072, r=8, p=1). Random session and reset secrets are stored only as SHA-256 hashes. Cookies are HttpOnly, SameSite=Lax, and Secure in production. Mutations require a matching Origin. Expiry, account uniqueness, reset consumption, and note ownership are checked on the server. Authentication attempts are rate limited in the database.

## Storage limits

Local development uses JSON files with atomic writes and a disk lock. Production exclusively uses private Vercel Blob with fresh reads and conditional ETag writes. See [Blob migration and recovery](blob-migration.md) for setup, imports, backups and limitations. DATABASE_FILE applies only to development.

Lock files now contain an atomically published process ID, host and unique owner token. A confirmed dead local owner is recovered automatically; a live owner is never evicted solely because its lock is old. Old ownerless legacy locks are recoverable after a one-minute initialization grace period. Recovery claims serialize competing reclaimers, and normal writes remain atomic. An occupied live lock returns a retryable HTTP 503 after about ten seconds. Foreign-host or malformed owner metadata is left locked because ownership cannot be established safely. If manual recovery is needed, stop every app process before touching a lock. For a public multi-instance deployment, move the database adapter and rate limiting to transactional shared storage.

The first account claims the previous personal notes. Create it yourself before making the app publicly accessible.

## Checks

- `npm run lint`
- `npm run test:auth`
- `npm run build`

The integration test starts its own Next.js server on port 3057, uses a temporary copy of the database, and captures mail with a local SMTP server. It sends no external email and verifies signup, duplicate users, signin, recovery, credential changes, secure storage, session invalidation, expiry, rate limiting, ownership, and existing note operations. Set `AUTH_TEST_PORT` if that port is busy.

Implementation references: [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), and [Nodemailer SMTP](https://nodemailer.com/smtp/).


### Appearance

Choose Light or Dark under /setting/theme (also linked from desktop and mobile navigation). The one-year note-app-theme cookie is read by the root layout, so the initial server HTML and hydration share the same theme without a loading flash. Light is the default. Semantic Tailwind v4 color tokens and the exact design palette live in src/app/globals.css; reusable preference state lives in `src/providers/ThemeProvider.jsx`.

Browser theme checks: run npm run build, then npm run test:theme with Playwright available and Microsoft Edge installed. Set THEME_PLAYWRIGHT_PATH to an external Playwright installation if needed. The checks use port 3068, a temporary database, both themes across four viewport sizes, and save screenshots in the reported temporary directory. They do not modify the app database.

For the current folder map, see [Project structure](project-structure.md). For all test commands and prerequisites, see [Testing](testing.md).


## Notes editing and save behavior

Open a note and choose **Edit Note**. The title, content and tags are populated from the saved note. Save persists only those editable fields and advances `lastEdited` when they change; Cancel restores the saved view. Archived notes are editable under the same rules and keep their archived state. Authentication and ownership are checked again in the PATCH endpoint. Client-supplied IDs, ownership values and unrelated fields cannot overwrite the stored record.

Creation and editing share these limits: 200 title characters, 100000 content characters, 1-30 tags, 50 characters per tag and a 128 KiB JSON request limit. Duplicate trimmed tags are removed. Unicode can reach the byte limit before the character limit. The form identifies invalid fields and preserves a failed draft. Archive, restore and delete confirmations show pending/error states and support keyboard focus containment and Escape cancellation.

A create attempt keeps an `Idempotency-Key` across retries of the same draft. The server atomically retains its request fingerprint and note ID for 24 hours. Repeated requests return the original note; reusing a key with different content or after deleting that note returns 409. No content-based deduplication is applied to intentional new notes. Navigating away while a save completes does not redirect the newer page.

Tags link to `/tag?name=<encoded value>` so spaces, Unicode, `#`, slashes and reserved route names are safe. Existing simple root-level tag routes remain compatible. The visible Create New Note link works on desktop, tablet and mobile layouts above the bottom navigation.

## Authentication throttling and proxy trust

There is no shared quota across authentication actions. The persisted 15-minute limits are scoped by action and client, with additional account limits for signup/sign-in/recovery and reset-cookie limits for password updates. Sign-in keeps a 15-attempt account limit across different browsers or deleted cookies; password recovery keeps its five-request account limit. Invalid reset-verification input cannot select an account bucket or consume sign-in/signup allowances.

Without proxy configuration, standard Next.js Route Handlers do not provide a verified socket address. The app uses a server-signed, HttpOnly client cookie for browser/action limits and persisted account limits for credential attacks. Deleting that cookie can start a new browser quota; it does not bypass the account limits. Cookie signatures rotate with the app process. For public deployment, enforce network-based limits at a trusted edge or enable the authenticated proxy mode below. Ordinary `Forwarded`, `X-Forwarded-For` and `X-Real-IP` headers are always ignored by application throttling.

To enable network-based client scope, set a server-only `AUTH_TRUSTED_PROXY_SECRET` of at least 32 random characters. Your controlled reverse proxy must strip incoming `X-Auth-Proxy-Secret` and `X-Auth-Client-IP`, then inject the configured secret and one validated client IP. Derive that IP from a verified connection or an explicitly allowlisted proxy chain, never an arbitrary incoming forwarded header. Restrict direct upstream access and protect the proxy-to-app transport. Configured mode rejects missing/wrong secrets and malformed or multi-address values; equivalent IPv6 representations share a bucket. Reset-verification traffic remains separate from sign-in/signup traffic even for the same client.

Run `npm run test:qa` for the 56 note/auth/reliability regressions against an isolated development server. See the [testing guide](testing.md) for browser installation and isolated test data handling.
