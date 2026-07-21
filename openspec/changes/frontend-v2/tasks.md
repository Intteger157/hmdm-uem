## 1. Phase 0 — Scaffold

- [x] 1.1 Create `frontend-v2/` with Vite React-TS template (`npm create vite@latest`)
- [x] 1.2 Install core deps: TanStack Router, TanStack Query, Zustand, Axios, react-i18next, md5, tailwindcss
- [x] 1.3 Configure `vite.config.ts`: `base: '/v2/'`, `@/` alias, `/rest` proxy → `http://localhost:8080`
- [x] 1.4 Configure TypeScript paths (`@/*` → `src/*`) in `tsconfig.app.json`
- [x] 1.5 Add Tailwind CSS v4 + PostCSS; wire `src/index.css`
- [x] 1.6 Initialize Shadcn UI (components.json, `src/components/ui/` primitives)
- [x] 1.7 Create folder structure: `src/features/`, `src/shared/`, `src/layouts/`, `src/routes/`
- [x] 1.8 Add shared types: `ApiResponse<T>`, `Platform`, env types (`VITE_API_BASE`, `VITE_WINDOWS_MDM_ENABLED`)
- [x] 1.9 Add `.env.example` and document dev/prod env vars
- [x] 1.10 Verify `npm run dev` serves at `/v2/` and proxy reaches backend `/rest`

## 2. Phase 1 — Auth + Shell

- [x] 2.1 Implement Axios client (`src/shared/api/client.ts`) with Bearer interceptor and 403 handler
- [x] 2.2 Implement MD5 password helper (`src/shared/lib/password.ts`) — uppercase hex digest
- [x] 2.3 Implement auth API (`src/features/auth/api/auth-api.ts`): JWT login + fetch current user
- [x] 2.4 Implement Zustand auth store with persist (`src/features/auth/store/auth-store.ts`)
- [x] 2.5 Implement permission helper (`src/shared/lib/permissions.ts`)
- [x] 2.6 Set up react-i18next with `en` and `ru` bundles (login, nav, common)
- [x] 2.7 Configure TanStack Router: `basepath: '/v2'`, route tree, root providers
- [x] 2.8 Implement `AuthLayout` and `AppLayout` (sidebar, header, outlet)
- [x] 2.9 Implement `LoginPage` with form, error state, post-login redirect
- [x] 2.10 Implement auth guards: protected routes redirect to `/login`; login redirects if authenticated
- [x] 2.11 Implement placeholder `DashboardPage`
- [x] 2.12 Wire `QueryClientProvider` and auth hydration on app boot
- [ ] 2.13 Manual test: login against running backend, refresh persists session, 403 clears token

## 3. Phase 2 — Core Android parity (future)

- [ ] 3.1 Dashboard: `GET /rest/private/summary/devices`
- [x] 3.2 Devices list: server-side pagination via `POST /rest/private/devices/search`
- [ ] 3.3 Device CRUD and bulk actions
- [ ] 3.4 Configurations list and editor
- [ ] 3.5 Applications management (Android/Web)
- [ ] 3.6 Users and Groups admin
- [ ] 3.7 Settings page

## 4. Phase 3 — Platform stubs + plugins (future)

- [ ] 4.1 Platform filter and adaptive device columns (android vs windows)
- [ ] 4.2 Windows stub pages: packages (.msi/winget), scripts
- [ ] 4.3 `PluginIframe` component for legacy plugin UI
- [ ] 4.4 Locale conversion script for remaining 11 legacy languages

## 5. Phase 4 — Deploy parallel run (future)

- [ ] 5.1 CI job: `npm run build` → artifact `frontend-v2/dist`
- [ ] 5.2 nginx: `location /v2/` → static SPA with fallback; `/rest/` → backend
- [ ] 5.3 Document cutover checklist and rollback steps
