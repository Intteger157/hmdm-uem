## ADDED Requirements

### Requirement: JWT login with MD5 password hash

The login flow SHALL authenticate via `POST /rest/public/jwt/login` sending `{ login, password }` where `password` is the uppercase MD5 hex digest of the plain-text password.

#### Scenario: Successful login

- **WHEN** the user submits valid credentials on the login page
- **THEN** the client receives a JWT token and stores it for subsequent requests

#### Scenario: Invalid credentials

- **WHEN** the user submits invalid credentials
- **THEN** the login page displays an error message and does not store a token

### Requirement: Bearer token on private requests

The HTTP client SHALL attach `Authorization: Bearer <jwt>` to every request under `/rest/private/*`.

#### Scenario: Authenticated API call

- **WHEN** a logged-in user triggers a request to `/rest/private/users/current`
- **THEN** the request includes the Authorization header with the stored JWT

### Requirement: HTTP 403 triggers logout

The HTTP client SHALL clear auth state and redirect to `/login` when any response returns HTTP status 403.

#### Scenario: Expired or revoked token

- **WHEN** the backend returns 403 for a private endpoint
- **THEN** the client removes the JWT and navigates to the login page

### Requirement: User profile loaded after login

After successful JWT login, the client SHALL fetch `GET /rest/private/users/current` and store the user object including role permissions.

#### Scenario: Permissions available in UI

- **WHEN** login completes successfully
- **THEN** the auth store contains the current user with `userRole.permissions` for client-side checks

### Requirement: Auth state persists across reload

The JWT and user snapshot SHALL persist in `localStorage` so a page reload keeps the session until logout or 403.

#### Scenario: Browser refresh while logged in

- **WHEN** the user refreshes the browser on a protected page
- **THEN** they remain authenticated without re-entering credentials

### Requirement: Permission helper mirrors legacy behavior

The client SHALL expose `hasPermission(name: string)` returning true for superAdmin or when the named permission exists in the user's role.

#### Scenario: Super admin bypass

- **WHEN** the current user has `userRole.superAdmin === true`
- **THEN** `hasPermission` returns true for any permission name
