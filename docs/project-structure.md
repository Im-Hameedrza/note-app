# Project structure

```text
src/
  app/                    App Router pages, layouts, API handlers and global styles
    (app)/                Authenticated application shell
      (notes)/            Lists, search, tags, create and note detail/editor routes
      setting/            Theme, font and password settings
      settings/           Compatibility redirect
      tags/               Tag navigation
    api/                  Authentication and notes endpoints
    auth/                 Signup, signin, recovery and reset pages
  components/
    auth/                 Account forms and logout controls
    navigation/           Desktop, tablet and mobile navigation
    notes/                Shared editor, lists, search, tags and note actions
    settings/             Appearance and account settings
    ui/                   Accessible async confirmation dialog
  hooks/                  Browser form, save and mutation coordination
  lib/                    Shared validation, filtering and preference helpers
    server/               Private JSON storage, sessions, hashing, mail and APIs
  providers/              Theme and font state
  services/               Browser API calls
scripts/                  Explicit non-destructive local setup
tests/
  integration/            Safe setup and account/notes API checks
  browser/                Theme, settings and QA regressions
public/                   Publicly served icons/assets; never private data
docs/                     Public setup, architecture and testing guides
```

Root configuration includes `package.json`, `package-lock.json`, `next.config.mjs`, `eslint.config.mjs`, `jsconfig.json` and `postcss.config.mjs`. The `@/` alias resolves to `src/`. UI uses JSX, with JavaScript server utilities.

`db.example.json` and `.env.example` are safe public templates. `npm run setup` creates missing private `db.json` and `.env.local` files without replacing existing ones. The generated files stay ignored. `AGENTS.md` contains the framework's local documentation instructions; `CLAUDE.md` refers to it. Both are safe to commit and contain no credentials.

## Application flow

The root layout reads appearance cookies and supplies theme/font providers. The protected layout validates the session and loads only the signed-in user's notes. Server Components call `lib/server`; browser components call `services`, which use authenticated API routes. Every note mutation checks ownership again on the server.

`NoteEditor` shares populated create/edit fields. `useCreateNote` coordinates validation, one pending state, idempotent creation retries and route-safe completion. PATCH operations whitelist editable fields and preserve IDs, ownership, archive state and unrelated metadata. Archived notes remain editable. Actual saved state controls Archive/Restore actions.

`noteValidation.js` shares client/server limits. `notes.js` contains pure note filtering and navigation context. Encoded `/tag?name=...` links support arbitrary valid tag names while existing simple root-level tag routes remain available.

`ConfirmModal` uses a native modal dialog with focus management, safe keyboard dismissal, pending controls and visible errors. Network mutations and notifications stay in hooks rather than reusable dialog markup.

Authentication forms and reset-link handling stay separate from server account operations. Server secrets are never imported into client components. Rate limits are scoped by action and client/account; optional proxy trust is documented in the application guide.

The JSON adapter uses atomic writes, owner-aware locks and serialized abandoned-lock recovery. It is intended for local persistent disk, not distributed or ephemeral storage. For production infrastructure beyond that model, replace the storage adapter rather than exposing the JSON file.

## Local-only folders

`.next`, `.next-auth-tests`, `node_modules`, `archives`, `output`, local reports/results, backups and scratch directories are ignored. They are preserved on disk but are not application source and should not be committed. Public documentation must not link to those private artifacts.
