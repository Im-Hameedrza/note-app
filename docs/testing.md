# Testing

Run `npm ci` and `npm run setup` from the project root first. Setup creates only missing private runtime files. It never replaces existing data.

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint across application source, configuration, scripts and tests |
| `npm run test:setup` | Safe first-run setup and non-overwriting existing-file behavior |
| `npm run build` | Production compilation and route generation |
| `npm run test:auth` | Account, recovery, session, ownership and notes API integration |
| `npm run test:theme` | Theme persistence, layouts and note confirmation flows |
| `npm run test:settings` | Authentication forms, settings, fonts, history and recovery UI |
| `npm run test:qa` | 56 note/auth/reliability regression cases |

## Browser prerequisites

Playwright is a locked development dependency, installed by `npm ci`. Install its Chromium browser once:

```sh
npx playwright install chromium
```

On Linux, browser system libraries may also be needed; Playwright's `install --with-deps chromium` command installs them where supported. Microsoft Edge can be used instead if it is already installed:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:theme
```

```sh
PLAYWRIGHT_CHANNEL=msedge npm run test:theme
```

All browser suites default to the installed Playwright Chromium browser. `PLAYWRIGHT_CHANNEL` is optional. Existing `THEME_PLAYWRIGHT_PATH` overrides remain supported for an externally managed Playwright installation; no absolute local tool path is required by the repository.

## Suggested sequence

```sh
npm run lint
npm run test:setup
npm run test:storage
npm run test:auth
npm run build
npm run test:production-storage
npm run test:theme
npm run test:settings
npm run test:qa
```

Run suites sequentially. Auth and settings development servers share `.next-auth-tests`. Theme and QA use .next development output; do not build or run another dev server using that directory while those suites are active. QA secondary servers use .next-auth-tests sequentially.

## Isolation, ports and artifacts

| Suite | Server mode / default ports | Data and email |
| --- | --- | --- |
| Setup | No server | Fresh temporary folders and synthetic sentinels |
| Auth | Development; 3057 (`AUTH_TEST_PORT`) | Public sample seed in a temporary database; local SMTP capture |
| Theme | Development; 3068 | Fresh temporary database; no external email |
| Settings | Development; 3069 (`SETTINGS_TEST_PORT`) | Fresh temporary database; local SMTP capture |
| QA | Development; 3077-3079 (`QA_TEST_PORT` plus two ports) | Fresh temporary databases and competing local processes; no external email |

The auth suite seeds from `db.example.json`, never from real note content. Auth/QA read the original local database only to verify its bytes remain unchanged. Authentication proxy settings are isolated from local production configuration; explicit proxy-mode cases configure their own test secret. Test accounts and `.test` emails in source are synthetic fixtures, not real credentials.

Servers are shut down and their temporary databases removed in suite cleanup. Screenshots, structured results and diagnostic logs stay in the temporary evidence path printed by the test. Git ignores build/test output and local audit records; do not copy evidence into `public/` or commit private screenshots.

## Regression scope

The 56-case QA suite checks the complete create/view/edit/archive/restore/delete lifecycle, ownership and partial updates, numeric legacy IDs, archived edits, lastEdited preservation, cancel/error paths, repeated saves, mobile creation, encoded tag filters, async keyboard dialogs, retry idempotency, navigation during save, scoped authentication limits, spoofed/trusted proxy headers, dead/live/malformed locks, competing recovery, concurrent writes, and Light/Dark layouts at 320/375/768/1024/1440px.

Settings history assertions wait for React to commit the expected active menu state after Back/Forward, then still require exactly one active item with the expected label. Existing theme/settings suites also check for unexpected runtime/console and hydration errors.

These automated checks do not replace physical-device, cross-browser, production infrastructure, sustained-load or full security testing. Historical local QA artifacts remain excluded from the public source tree.

## Blob storage validation

Run npm run test:storage for the synthetic mocked-SDK storage/migration tests. The suite checks private uncached reads, ETag retries, contention exhaustion, missing token/blob, upload failures and create-only migration. It does not use a live Blob store.

All existing app integration/browser suites explicitly clear inherited Blob settings and use development-only local JSON fixtures. Theme and QA suites now start next dev; their results are not production Blob end-to-end coverage. Build production separately with npm run build. This is a JavaScript/JSX repository; there is no configured TypeScript project check.

For live validation, use a separate private staging store, explicitly import a reviewed empty database, run registration/login, notes CRUD/archive/restore and a second-user access check, then redeploy the staging function and verify persistence. Never point automated fixtures at a production token. No live migration or deployment is performed by these tests.

Run npm run test:production-storage after npm run build to check that an actual production server returns 503 for missing Blob credentials without falling back to local disk.

## Hydration and SDK transport coverage

Browser screenshots use caret:initial so capture does not inject inline caret styles into server-rendered inputs before hydration. Theme checks still fail on any unexpected hydration/runtime console errors. The archive/restore button retains the exact same utility classes on one line to avoid CRLF attribute mismatches on Windows.

Storage tests include the actual @vercel/blob SDK using Undici MockAgent with outbound networking disabled. They verify authenticated private origin URLs, cache bypass, conditional-write headers, real HTTP 412 error conversion and fresh reads on retry. Existing tests cover five-attempt exhaustion, failed/ambiguous uploads and same-note conflicts. These checks do not substitute for a live private staging-store test.

See the current results and outstanding development-only braces audit findings in [Blob migration and staging readiness](blob-migration.md#verified-follow-up--2026-10-16).
