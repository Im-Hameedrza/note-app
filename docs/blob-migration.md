# Storage audit and migration

## Findings before implementation

The checkout is Next.js 16.3.8 with JavaScript/JSX and jsconfig.json, not TypeScript. There was no db.json, .env.local or node_modules in this worktree. No actual private records were initially available in this worktree. The original ignored database was subsequently located in the main Git worktree and passed the migration validator in place; no records were printed, modified or uploaded. The tracked db.example.json has two synthetic unowned notes and no accounts, sessions or passwords.

Previously src/lib/server/database.js directly read and atomically rewrote the local file. Its in-process queue and cross-process disk lock only protected processes sharing that disk. An ignored db.json is absent from the deployed function bundle; including it would still not make function disk persistent or shared. This explains ENOENT and why bundling the file is insufficient.

Direct database-file references before migration:
- src/lib/server/database.js: runtime reads/writes (now local-storage.js).
- scripts/setup.mjs: exclusive creation from db.example.json.
- tests/integration/auth.integration.mjs: temporary fixture, root-file preservation check.
- tests/integration/setup.test.mjs: setup creation/preservation checks.
- tests/browser/theme.browser.cjs, settings.browser.cjs and qa-regressions.browser.cjs: temporary fixtures, and preservation checks where applicable.
- README.md, .env.example and docs: configuration/instructions only.

json-server is an unused installed dependency, with no active script or HTTP service. Do not start it against private data.

## Existing schema and security

| Collection | Fields and relationships |
| --- | --- |
| users | id, username, usernameKey, email, passwordHash, createdAt; optional updatedAt |
| notes | id, userId referencing users.id, title, content, tags[], isArchived, lastEdited |
| sessions | tokenHash, userId, expiresAt (milliseconds) |
| passwordResets | tokenHash, userId, expiresAt (milliseconds) |
| rateLimits | key (SHA-256), count, expiresAt |
| noteRequests | key, userId, noteId, fingerprint, expiresAt; a deleted note may retain a retry tombstone |

Unknown fields are preserved. Missing collections normalize to empty arrays. Migration validates unique IDs/account keys, relationships, field types, timestamps and hash formats. Unowned notes cannot enter production: create their legitimate owner using the local app before importing. Do not assign private records to an arbitrary first production registrant. Invalid or plaintext credentials are rejected; no automatic credential conversion or account creation occurs.

Passwords use scrypt N=131072/r=8/p=1, random 16-byte salt and timing-safe verification. Session and reset tokens use 32 random bytes and only their SHA-256 hashes are stored. Sessions last seven days; reset links last fifteen minutes. Successful reset consumes all reset links and sessions for that user. Cookies are HttpOnly, SameSite=Lax and Secure in production. Reset email links use fragments to avoid HTTP access logs. SMTP credentials stay server-side, and failed delivery removes the pending token.

Auth endpoints remain /api/auth/[action]; signup/signin/recovery are intentionally available without a session, with origin checks, input validation and persisted throttling. Notes GET/POST/PATCH/DELETE validate session ownership; mutations validate the session inside the conditional update. Public user projections expose only ID and username. No raw database or migration HTTP endpoint exists.

Themes/fonts remain cookie preferences. No UI, URLs or navigation were redesigned.

Existing environment variables: APP_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, DATABASE_FILE, AUTH_TRUSTED_PROXY_SECRET; NODE_ENV plus build/test-only AUTH_TEST_BUILD, NEXT_TELEMETRY_DISABLED and test port/browser overrides. New storage variables: BLOB_READ_WRITE_TOKEN and optional BLOB_DATABASE_PATH.

## Configure Vercel

1. In the intended Vercel project open Storage, Create Storage, Blob.
2. Choose **Private**, select a region close to your functions, name the store and connect it to Production. Use separate stores for Preview and Development to prevent test writes to production.
3. Verify BLOB_READ_WRITE_TOKEN exists in project Environment Variables. The application explicitly passes that server-side token; OIDC is not substituted. Never use NEXT_PUBLIC_ or place the token in Git.
4. Set APP_URL to your exact production HTTPS origin. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM for recovery. No JWT/session secret is required by the existing opaque-token session scheme.
5. Optionally set BLOB_DATABASE_PATH (default notes/database.json). Keep it stable across deployments. Leave AUTH_TRUSTED_PROXY_SECRET unset unless you have the authenticated proxy described in application-guide.md.
6. Import the private database before serving users; missing blobs fail closed with 503 and are never seeded during requests/builds.
7. Deploy manually through Vercel after validation. No deployment is performed by this change.

## Local development

Run npm ci, npm run setup and npm run dev. Leave BLOB_READ_WRITE_TOKEN blank to use local db.json; DATABASE_FILE may select another initialized private file. Setup never overwrites existing files and is for local use only.

To develop against Blob, use a separate private development store and set its token in ignored .env.local. When a token is present Blob is used even in development. Production (NODE_ENV=production or VERCEL=1) always requires Blob; DATABASE_FILE cannot override this. A bare npm start with no token will intentionally reject database requests.

The repository contains JavaScript, so no TypeScript project check exists. Lint and Next build check the application; do not interpret that as a TypeScript check.

## Import existing records exactly once

No production migration has been run. The original db.json is never modified by the CLI.

1. Obtain your original db.json from its existing machine. Keep an offline encrypted backup outside the repository. The original database remains in the main Git worktree; this worktree contains only the local public sample created for testing.
2. Stop writes to the original application. Review the users in that file privately: do not upload demo accounts/passwords. If needed, work on a separate copy with DATABASE_FILE pointing to that copy, and use the local app to establish legitimate ownership of any legacy unowned notes. Retain the original untouched.
3. Set the target private store token in .env.local and verify the intended store/project in Vercel. Set BLOB_DATABASE_PATH if needed. CLI commands load .env.local; keep production tokens out of shell history.
4. Validate with no upload:

   npm run blob:db -- validate "C:/private/finalized-db.json"

5. Dry-run the import:

   npm run blob:db -- import "C:/private/finalized-db.json"

6. After reviewing validation and explicitly authorizing the upload yourself, run once:

   npm run blob:db -- import "C:/private/finalized-db.json" --apply

The upload is create-only (allowOverwrite:false, no random suffix). It refuses any existing destination, including a concurrent initial import. Repeating an import cannot overwrite data. IDs, timestamps, credential hashes and all existing collections remain intact; only absent collection defaults are added. No real record data is logged. Validation alone cannot tell synthetic users from legitimate users: operator review is required.

If an import response is lost, do not delete/reimport blindly. Take a backup of the destination and compare privately. Import has no force-overwrite flag.

For a genuinely new empty production app, explicitly create a private JSON file containing empty users/notes/sessions/passwordResets/rateLimits/noteRequests arrays, validate and import it. Never run local sample setup as production initialization.

## Backups and recovery

Back up before migration, regularly while operating, and before any recovery. The CLI reads one fresh database snapshot and writes a new local file with exclusive creation and restrictive permissions:

   npm run blob:db -- backup backups/notes-2026-10-16.json

Keep backups encrypted off-machine with access controls and a retention policy; they contain password hashes, emails, notes and session/reset hashes. Local .gitignore excludes backups/. On Windows, POSIX file modes do not configure NTFS ACLs; use a private folder restricted to your Windows account. A backup on the same computer is not disaster recovery. No automatic backup scheduler is included.

To recover, stop application writes, validate a selected private backup, inspect it privately and explicitly authorize replacement:

   npm run blob:db -- validate backups/notes-2026-10-16.json
   npm run blob:db -- restore backups/notes-2026-10-16.json --confirm-restore

Restore saves the current database to a new backups/before-restore-UUID.json first, then replaces only the ETag it just read. A failed backup prevents replacement. A concurrent write makes replacement fail; pause writers and investigate before retrying. There is no unconditional overwrite. Keep the generated pre-restore file. Recovery can roll back sessions/password resets as well as notes; consider invalidating restored sessions/reset links in a reviewed recovery copy. If the destination is missing/corrupt, restore intentionally refuses: recover a verified backup into a new BLOB_DATABASE_PATH using create-only import, then update the environment and redeploy manually. Never delete the old blob to make import succeed.

## Concurrency, caching and failure limits

SDK 2.8.2 supports get(access:private,useCache:false) for origin reads and put(ifMatch:etag) for conditional writes. Content and ETag come from the same response; never combine a cached body with fresh head metadata. Existing API responses remain Cache-Control:no-store. No process-local database cache is used.

Each mutation reads the whole JSON, checks auth/business rules against that version, and conditionally replaces it. Only precondition failures retry, up to five attempts with bounded jitter. Each retry re-reads and re-runs the callback, including ownership, reset-token validity and uniqueness checks. Callbacks must have no external side effects; email and cookie changes stay outside. A detected concurrent edit/delete/archive of the same note is rejected rather than replayed over the changed note. Unrelated changes may safely retry. Exhaustion returns HTTP 409.

This prevents storage-level lost updates, but does not detect a stale browser draft submitted as a later independent request: the existing editor has no client version precondition. That later edit has sequential last-write semantics. No database-level transactions, multi-blob atomicity or distributed locks are claimed. Auth flows can involve multiple separate mutations and email delivery cannot commit atomically with storage.

A definite failed upload does not replace previous content. A transport failure after a remote commit is ambiguous. The application only retries ETag precondition failures, but SDK 2.8.2 separately defaults to up to ten internal retries for certain transport/server errors. Five application conflict attempts therefore do not mean five total HTTP requests, and neither layer provides exactly-once operations. Refresh before retrying. Existing idempotency keys protect note creation, but not every authentication action is idempotent. Single-object ETag handling also cannot distinguish delete/recreate or identical-content ABA histories by itself; do not externally edit/delete/recreate the database while the app is active.

Every read downloads/parses the entire database, and every mutation uploads the entire database. Origin reads have higher latency and bypass CDN savings. Multiple reads per page, auth throttling writes, scrypt CPU and growing note content make this suitable only for a small low-traffic app. Under contention operations can return 409; Blob/service outages can return 503 or a sanitized 500. Monitor latency/errors, function memory/duration and database size. Blob charges for storage, operations and transfer depend on current plan/region; backups add storage and reads. Check current Vercel pricing rather than assuming free use.

The existing browser-throttling cookie signing key is process-local and changes across cold starts/replicas. Persisted account-scoped throttling still applies, but browser-only identity limits are weaker in a serverless fleet; configure a trusted proxy where appropriate. No new credential is silently generated as a replacement.

References:
- https://vercel.com/docs/vercel-blob
- https://vercel.com/docs/vercel-blob/using-blob-sdk
- https://vercel.com/docs/vercel-blob/private-storage
- https://vercel.com/docs/vercel-blob/usage-and-pricing

## Validation scope

npm run test:storage uses synthetic records with mocked storage and the actual SDK through a network-disabled Undici MockAgent. It checks conditional concurrency, failure preservation, fresh/private reads, initialization and migration safety, real HTTP authorization/private-access/ETag headers, SDK HTTP 412 mapping, retry re-reads and the server-only import guard. It does not contact a real Vercel store or establish live service consistency/availability guarantees.

Existing auth/browser suites use temporary local databases and explicitly clear inherited Blob configuration. Browser suites that previously used next start now use next dev because the local adapter is development-only. They validate UI/app behavior, not production Blob end-to-end operation. The production build is checked separately. A private staging-store smoke test is required before rollout.
## Git commands for this checkout

This worktree was on detached HEAD during inspection. Create a branch before committing:

   git switch -c feat/private-blob-storage
   git diff --check
   git add .env.example README.md docs/application-guide.md docs/project-structure.md docs/testing.md docs/blob-migration.md package.json package-lock.json scripts/blob-database.mjs src/lib/server/api.js src/lib/server/database.js src/lib/server/local-storage.js src/lib/server/blob-storage.mjs src/lib/server/storage-schema.mjs src/lib/server/notes.js src/components/notes/ArchiveRestoreButton.jsx tests/integration/blob-storage.test.mjs tests/integration/blob-services.test.mjs tests/integration/production-storage.test.mjs tests/integration/auth.integration.mjs tests/browser/theme.browser.cjs tests/browser/settings.browser.cjs tests/browser/qa-regressions.browser.cjs
   git diff --cached --stat
   git diff --cached --check
   git commit -m "Use private Vercel Blob for production JSON storage"
   git push -u origin feat/private-blob-storage

Review staged contents before committing. No Git commit, push, production import or deployment has been performed here. A Git push can trigger Vercel automatic deployments on a connected project: disable that integration first if you require a strictly manual rollout.

## Verified follow-up — 2026-10-16

Verification used Node.js 22.23.3, Next.js 16.3.8 and Microsoft Edge on Windows.

| Check | Actual result |
| --- | --- |
| npm run test:storage | 16/16 passed, including actual SDK HTTP behavior with network disabled |
| npm run test:setup | 3/3 passed |
| npm run test:auth | Passed: registration/login/logout, recovery, hashed credentials, notes lifecycle and ownership |
| npm run test:settings | Passed, including clean browser console |
| npm run test:theme | Passed completely, including clean browser console and hydration checks |
| npm run test:qa | 56/56 passed, including tags, archive/restore, access control and concurrent writes |
| npm run lint | Passed |
| npm run build | Passed |
| npm run test:production-storage | Passed: actual production server returns 503 without token and never falls back to local disk |
| npm audit --omit=dev | Zero vulnerabilities |
| Patched dependency smoke tests | Sharp native PNG/resize/WebP and source-map-js mapping round-trip passed |
| Original and local db.json | Byte-for-byte unchanged throughout full verification |

This is a JavaScript/JSX project; no separate TypeScript project check is configured. The build's TypeScript phase is not claimed as a standalone typecheck.

The hydration issue was fixed without changing the design or class tokens: ArchiveRestoreButton now uses one line for its className, avoiding Windows CRLF attribute differences. Browser screenshots use caret:initial to avoid Playwright's temporary caret-style DOM mutation during hydration. Hydration warnings remain asserted rather than suppressed. The theme test also waits for the existing archive-state-driven server-refresh remount before the next dialog action.

### Dependency investigation

The compatible lockfile updates installed sharp 0.35.5 (from 0.35.4) and source-map-js 1.2.2 (from 1.2.1). Patched brace-expansion releases 1.1.21 and 5.0.12 were also installed within existing dependency ranges. Next.js remains 16.3.8; no forced audit fix, framework downgrade or unreviewed dependency override was used.

Production audit is clear. Full audit retains five high-severity development-only entries: braces, micromatch, fast-glob, @next/eslint-plugin-next and eslint-config-next. These trace to the same unpatched braces denial-of-service advisory; the latest published braces remains 3.0.3 and the advisory lists no patched version. npm's proposed eslint-config-next downgrade to 14.2.35 is incompatible with the intended framework/tooling version and was not applied. Use trusted lint patterns and track the upstream patch.

Sources:
- https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w
- https://github.com/advisories/GHSA-68fv-2mgg-jv7q
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

### Staging readiness and remaining limits

Ready for isolated staging testing. No live Blob store operation, real data import, commit, push or deployment was performed. The original database previously passed read-only validation and remains unchanged.

Live private-store integration is still unverified: staging must confirm the chosen store is private, unauthorized direct reads fail, CRUD persists across function restarts/deployments, ETag conflicts are handled on the actual service, and SMTP works over production HTTPS. Those require an isolated staging store and explicit operator initialization approval; this work does not import records automatically.

Known JSON-storage limits remain: whole-file reads/writes and associated cost/latency, bounded conflict failures under load, sequential stale browser drafts, SDK transport ambiguity, no database-level transactions and process-local browser-throttling signatures across serverless replicas. Account-scoped limits remain persisted. See the concurrency section above before production rollout.
## Files changed

- .env.example
- README.md
- docs/application-guide.md
- docs/project-structure.md
- docs/testing.md
- docs/blob-migration.md
- package.json
- package-lock.json
- scripts/blob-database.mjs
- src/lib/server/api.js
- src/lib/server/database.js
- src/lib/server/local-storage.js
- src/lib/server/blob-storage.mjs
- src/lib/server/storage-schema.mjs
- src/lib/server/notes.js
- src/components/notes/ArchiveRestoreButton.jsx
- tests/integration/auth.integration.mjs
- tests/integration/blob-storage.test.mjs
- tests/integration/blob-services.test.mjs
- tests/integration/production-storage.test.mjs
- tests/browser/theme.browser.cjs
- tests/browser/settings.browser.cjs
- tests/browser/qa-regressions.browser.cjs
