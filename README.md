# Notes App

A responsive notes application built with Next.js App Router, React and Tailwind CSS, prepared for a Frontend Mentor submission. Notes and account data are stored by a private server-side JSON database.

## Features

- Sign up, sign in and sign out with account-scoped notes and protected routes.
- Create, view and edit notes, including titles, content and up to 30 tags.
- Archive, restore and permanently delete notes with accessible confirmations.
- Search titles, content and tags; filter by tags with spaces, Unicode or special characters.
- Light/Dark themes and font preferences that persist across navigation and refresh.
- Email-based account recovery and password reset when SMTP is configured.
- Responsive layouts for mobile, tablet and desktop, with validation, loading/error feedback and retry-safe saves.

## Run locally

Prerequisites: Node.js 22 or newer and npm. Development and tests were verified with Node.js 22.23.3. Git must be available for repository commands.

After cloning this repository, open its root directory and run:

```sh
npm ci
npm run setup
npm run dev
```

Open [localhost:3000](http://localhost:3000), then create an account at `/auth/signup`. Sign in with that username and password.

`npm run setup` copies `db.example.json` to the ignored `db.json` and `.env.example` to the ignored `.env.local` only when those destination files are missing. It never overwrites existing data or environment settings. The sample contains two synthetic notes and no users, passwords, sessions or reset tokens. The first account receives the sample notes; later accounts start with their own empty notes list.

Do not run JSON Server against `db.json`: this application accesses it only through authenticated Next.js server code. Do not commit your generated database or use a real account password in test fixtures.

## Environment configuration

The defaults created by setup support local signup, login and notes. Email recovery stays unavailable until you configure SMTP in `.env.local`.

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Trusted application origin; defaults to `http://localhost:3000`. Use the deployed HTTPS origin in production. |
| `SMTP_HOST`, `SMTP_PORT` | Email server and port; port defaults to 587. |
| `SMTP_USER`, `SMTP_PASSWORD` | Your provider's credentials, if required. |
| `SMTP_FROM` | Provider-approved sender address. |
| `DATABASE_FILE` | Optional private path under ignored `data/` or outside the repository; defaults to root `db.json`. Initialize a custom file from `db.example.json` first. |
| `AUTH_TRUSTED_PROXY_SECRET` | Optional authenticated proxy/IP throttling; leave unset locally and read the application guide before enabling. |

These are server-only settings. Never prefix credentials with `NEXT_PUBLIC_`, commit `.env.local`, or put your private database under `public/`.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run setup` | Create missing local database/environment files without overwriting them. |
| `npm run dev` | Start the development server. |
| `npm run build` | Compile the production application. The first build needs network access for Google-hosted Geist fonts. |
| `npm start` | Run the production build; run `build` first. |
| `npm run lint` | Run ESLint. |
| `npm run test:setup` | Verify safe first-run setup and existing-file preservation. |
| `npm run test:auth` | Integration tests with a temporary database and local SMTP capture. |
| `npm run test:theme` | Production browser tests for themes, responsive layouts and note actions. |
| `npm run test:settings` | Browser tests for authentication forms, settings, fonts and password recovery. |
| `npm run test:qa` | 56 regression checks for editing, ownership, tags, retries, dialogs, throttling and database reliability. |

Install a browser once before running browser tests:

```sh
npx playwright install chromium
npm run build
npm run test:theme
npm run test:settings
npm run test:qa
```

Run the browser suites sequentially. Auth and settings tests share the isolated `.next-auth-tests` build directory, so do not run those two suites concurrently. Tests use temporary databases and no external email. To use an already installed Microsoft Edge instead, set `PLAYWRIGHT_CHANNEL=msedge` in your shell; see the testing guide for platform-specific examples.

## Production and Frontend Mentor submission

```sh
npm ci
npm run setup
npm run build
npm start
```

The current storage adapter requires a Node.js server with persistent writable disk. GitHub Pages/static export and ephemeral serverless storage are not supported by this adapter. For public hosting, keep the database outside publicly served paths, use HTTPS and configure the trusted application origin. Do not upload local data, build output or backup archives as repository assets.

For a Frontend Mentor submission, provide this repository URL and the URL of a running deployment. Use the server and storage environment described above.

Challenge platform: [Frontend Mentor](https://www.frontendmentor.io/).

## Project documentation

- [Application guide](docs/application-guide.md): accounts, recovery, note behavior, storage and proxy trust.
- [Project structure](docs/project-structure.md): application folders and boundaries.
- [Testing](docs/testing.md): test prerequisites, ports and isolated data handling.

The repository includes application source, test source and a public sample database. Generated builds, private runtime data, local QA PDFs/results, credentials and backups remain local through `.gitignore`.
