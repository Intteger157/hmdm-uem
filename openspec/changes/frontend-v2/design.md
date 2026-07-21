## Context

Headwind MDM ships a monolithic WAR: Jersey REST API (`/rest/*`) plus an AngularJS 1.x admin UI in `server/src/main/webapp`. The backend already supports headless operation via JWT (`POST /rest/public/jwt/login`, `JWTFilter` on `/rest/private/*`). The exploration confirmed that session cookies are not required when a valid Bearer token is supplied.

Strategic decisions for this change:

| Topic | Decision |
|-------|----------|
| Auth | JWT only; MD5 client hash; no 2FA/RSA in MVP |
| Router | TanStack Router (type-safe) |
| Plugins | Iframe fallback for legacy plugin UI (post-MVP) |
| i18n | English + Russian in MVP |
| Windows | UI stubs + feature flags; `Platform` type everywhere |
| Cutover | Parallel run at `/v2` |

## Goals / Non-Goals

**Goals:**

- Stand up `/frontend-v2` as an independent Vite + React + TypeScript project.
- Proxy `/rest` to the Java backend in development; build with `base: '/v2/'` for production.
- Implement JWT auth (login, token storage, Axios interceptor, 403 logout).
- Provide authenticated app shell (layout, navigation, protected routes).
- Embed `Platform` in shared types and route search params from day one.
- Enable EN/RU via react-i18next.

**Non-Goals:**

- Feature parity with legacy Angular UI (devices CRUD, configurations editor, etc.) — later phases.
- Backend REST or WAR modifications in Phase 0–1.
- Plugin UI rewrites or iframe embed component (Phase 2+).
- Windows backend API or real Windows device data.
- CORS configuration (dev uses Vite proxy; prod uses same-origin nginx).
- Removal of legacy webapp from WAR.

## Decisions

### 1. Project location and build base path

**Decision:** `frontend-v2/` at repo root; Vite `base: '/v2/'`.

**Rationale:** Parallel run requires the SPA assets under `/v2` while legacy UI stays at `/`. TanStack Router and asset URLs must align with nginx location.

**Alternative considered:** Subdomain (`v2.example.com`) — rejected; adds TLS/DNS complexity without benefit.

### 2. Authentication: JWT Bearer only

**Decision:** Login via `POST /rest/public/jwt/login`; store JWT in Zustand + `localStorage`; attach `Authorization: Bearer <token>` on every private request.

**Rationale:** Cross-origin/session-less SPA does not need HttpSession. `JWTFilter` already initializes `SecurityContext` before `AuthFilter`.

**Flow:**

```
LoginPage → MD5(password).toUpperCase() → POST /rest/public/jwt/login
         → store jwt → GET /rest/private/users/current → store user + permissions
Private API → Axios interceptor adds Bearer → 403 → clear store → /v2/login
```

**Alternative considered:** Session cookies via `/rest/public/auth/login` — rejected; requires same-origin and complicates separated dev server.

### 3. HTTP client and error handling

**Decision:** Axios instance with two layers:

1. HTTP 403 → logout + redirect (auth failure at filter level).
2. HTTP 200 + `{ status: 'ERROR' }` → throw typed `ApiError` with i18n message key.

**Rationale:** Matches legacy Angular interceptor behavior and backend envelope contract.

### 4. State management split

**Decision:**

| Concern | Tool |
|---------|------|
| Auth (jwt, user, permissions) | Zustand + persist middleware |
| Server data | TanStack Query (Phase 2+) |
| UI ephemeral state | React local state |

**Rationale:** Auth is synchronous and global; server cache belongs in Query.

### 5. Routing (TanStack Router)

**Decision:** File-based route tree under `src/routes/`; root layout with auth guard; `basepath: '/v2'`.

**MVP routes:**

| Path | Access | Purpose |
|------|--------|---------|
| `/login` | Public | JWT login |
| `/dashboard` | Protected | Placeholder home |
| `/` | Redirect | → `/dashboard` |

**Alternative considered:** React Router — rejected per strategic decision.

### 6. Platform abstraction

**Decision:** `type Platform = 'android' | 'windows'` in `shared/api/types/platform.ts`. Device routes accept `?platform=` search param. Windows UI reads `VITE_WINDOWS_MDM_ENABLED` (default `false`).

**Rationale:** Avoids Android-only assumptions in types and column configs before Windows API exists.

### 7. Styling and components

**Decision:** Tailwind CSS v4 + Shadcn UI (New York style, zinc base).

**Rationale:** Aligns with user stack choice; Shadcn gives accessible primitives for shell and future data tables.

### 8. i18n

**Decision:** react-i18next; JSON bundles in `src/locales/en/` and `src/locales/ru/`; default `en`; persist language in `localStorage`.

**Alternative considered:** Port all 13 legacy `.js` locales — deferred; conversion script in later phase.

### 9. Plugin integration (future)

**Decision:** `<PluginIframe src={legacyPluginUrl} />` loading legacy Angular plugin routes inside authenticated shell.

**Not implemented in Phase 0–1** — documented for Phase 3+.

### 10. Deployment topology

```
nginx
├── location /v2/     → frontend-v2/dist (SPA fallback index.html)
├── location /rest/   → Tomcat/Jetty WAR backend
└── location /        → legacy Angular (WAR webapp)
```

Dev:

```
Vite :5173/v2/
  proxy /rest → http://localhost:8080
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| JWT login lacks 2FA/RSA | Document limitation; orgs requiring 2FA stay on legacy UI until extended |
| No CORS on backend | Vite proxy (dev); nginx same-origin (prod) |
| MD5 password hashing is legacy | Required for API compatibility; no change in MVP |
| `/v2` base path breaks absolute asset paths | Enforce Vite `base` + TanStack `basepath` |
| Windows stubs confuse users | Feature flag off by default; empty states with "Coming soon" |
| Plugin iframe CSP/X-Frame-Options | Spike in Phase 3; may need nginx header overrides |

## Migration Plan

1. **Phase 0–1:** Deploy `frontend-v2/dist` to `/v2`; no change to WAR or legacy `/`.
2. **Phase 2+:** Incrementally port features; users opt in via `/v2` URL.
3. **Cutover (future):** Redirect `/` → `/v2` when parity reached; remove legacy webapp from WAR in separate change.

**Rollback:** Remove nginx `/v2` location; legacy UI unaffected.

## Open Questions

- Exact backend URL/port in team dev environments (default `localhost:8080` assumed).
- nginx config ownership (infra repo vs. hmdm-docker) — document in deploy README when Phase 2 starts.
- JWT token refresh: backend issues fixed TTL (~24h); silent re-login UX TBD in Phase 2.
