## Why

The current Headwind MDM admin UI is an AngularJS 1.x SPA bundled inside the Java WAR (`server/src/main/webapp`). This coupling blocks modern frontend tooling, slows iteration, and makes multi-platform UI (Android + future Windows MDM) harder to evolve. A separate React SPA deployed in parallel at `/v2` lets us rebuild the console incrementally without disrupting the legacy UI or the existing REST backend.

## What Changes

- Add a new standalone frontend project at `/frontend-v2` (React + Vite + TypeScript + Tailwind CSS + Shadcn UI).
- Authenticate exclusively via JWT (`POST /rest/public/jwt/login`); client-side MD5 password hashing; 2FA and RSA deferred from MVP.
- Use TanStack Router for type-safe routing with base path `/v2/`.
- Introduce a platform abstraction (`Platform = 'android' | 'windows'`) in shared types and device UI from day one.
- Ship Windows MDM as UI stubs behind feature flags until backend APIs exist.
- Support English and Russian i18n in MVP; remaining legacy locales converted later via script.
- Legacy plugin UIs remain unchanged; new shell will embed them via iframe fallback (post-MVP component).
- **Parallel run**: legacy Angular UI stays at `/`; new SPA at `/v2` until feature parity and cutover.

## Capabilities

### New Capabilities

- `frontend-scaffold`: Vite project structure, dev proxy to `/rest`, build output for `/v2` deployment, shared tooling (ESLint, TypeScript, Tailwind, Shadcn).
- `frontend-auth`: JWT login flow, Zustand auth store, Axios interceptors, permission helpers, 403 handling, protected routes.
- `frontend-shell`: App layout (sidebar, header, user menu), TanStack Router tree, `/v2` base path, login and placeholder dashboard routes.
- `frontend-platform`: `Platform` type, platform filter UI, adaptive device column configs, Windows stub pages and feature flags.
- `frontend-i18n`: react-i18next setup with English and Russian resource bundles.

### Modified Capabilities

<!-- No existing OpenSpec capability specs in this repo yet. Backend REST API behavior is unchanged in MVP. -->

## Impact

- **New directory**: `frontend-v2/` at repository root (sibling to `server/`).
- **Backend**: No WAR or REST changes required for Phase 0–1; existing JWT and private REST endpoints consumed as-is.
- **Deployment**: Reverse proxy must serve `frontend-v2/dist` at `/v2` and continue proxying `/rest` to the Java backend.
- **Legacy UI**: `server/src/main/webapp` remains untouched during parallel run.
- **Dependencies**: npm packages (React 19, Vite, TanStack Router/Query, Zustand, Axios, Tailwind, Shadcn, react-i18next).
- **Out of scope (MVP)**: Plugin React rewrites, Windows backend API, full locale migration, 2FA/RSA auth, removal of legacy webapp.
