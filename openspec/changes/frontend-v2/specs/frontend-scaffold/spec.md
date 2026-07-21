## ADDED Requirements

### Requirement: Standalone Vite project exists at repository root

The project SHALL maintain a `frontend-v2/` directory containing a Vite + React + TypeScript application independent of the Java WAR webapp.

#### Scenario: Developer opens frontend-v2

- **WHEN** a developer clones the repository
- **THEN** they find `frontend-v2/package.json`, `frontend-v2/vite.config.ts`, and `frontend-v2/src/` at the expected paths

### Requirement: Development server proxies REST API

The Vite dev server SHALL proxy requests matching `/rest` to the configured backend origin (default `http://localhost:8080`).

#### Scenario: API call from dev server

- **WHEN** the SPA running on the Vite dev server sends a request to `/rest/public/jwt/login`
- **THEN** the request is forwarded to the Java backend without CORS errors

### Requirement: Production build uses /v2 base path

The Vite build SHALL set `base: '/v2/'` so static assets and router base path align with parallel deployment.

#### Scenario: Production asset URLs

- **WHEN** `npm run build` completes
- **THEN** `index.html` references scripts and styles under `/v2/assets/`

### Requirement: Core toolchain is configured

The scaffold SHALL include TypeScript strict mode, Tailwind CSS, and path alias `@/` → `src/`.

#### Scenario: Import via alias

- **WHEN** source code imports from `@/shared/api/client`
- **THEN** TypeScript and Vite resolve the path without error
