## ADDED Requirements

### Requirement: TanStack Router with /v2 base path

The application SHALL use TanStack Router with `basepath: '/v2'` matching the Vite production base.

#### Scenario: Navigate to dashboard in production

- **WHEN** the user visits `https://host/v2/dashboard`
- **THEN** the dashboard route renders inside the authenticated layout

### Requirement: Public login route

The router SHALL expose an unauthenticated `/login` route that renders the login page.

#### Scenario: Unauthenticated access to login

- **WHEN** a visitor opens `/v2/login`
- **THEN** the login form is displayed without requiring a token

### Requirement: Protected routes require authentication

Routes under the authenticated layout SHALL redirect unauthenticated users to `/login`.

#### Scenario: Direct URL without token

- **WHEN** an unauthenticated user navigates to `/v2/dashboard`
- **THEN** they are redirected to `/v2/login`

### Requirement: Authenticated users skip login page

The login route SHALL redirect authenticated users to `/dashboard`.

#### Scenario: Logged-in user opens login

- **WHEN** an authenticated user navigates to `/v2/login`
- **THEN** they are redirected to `/v2/dashboard`

### Requirement: App shell layout

The authenticated layout SHALL provide a sidebar, header with user name, and main content outlet.

#### Scenario: Shell visible on dashboard

- **WHEN** an authenticated user views the dashboard
- **THEN** sidebar navigation and header are visible with a placeholder main area

### Requirement: Root path redirects to dashboard

The route `/` SHALL redirect to `/dashboard` for authenticated users.

#### Scenario: Visit /v2 root

- **WHEN** an authenticated user opens `/v2/`
- **THEN** they land on the dashboard page
