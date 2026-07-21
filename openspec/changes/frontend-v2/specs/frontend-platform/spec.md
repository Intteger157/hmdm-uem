## ADDED Requirements

### Requirement: Platform type in shared interfaces

All device-related shared types SHALL include or accept `Platform` defined as `'android' | 'windows'`.

#### Scenario: TypeScript compile-time check

- **WHEN** a developer assigns an invalid platform string to a typed field
- **THEN** TypeScript reports a compile error

### Requirement: Platform search param on device routes

Device list routes SHALL accept an optional `platform` search parameter defaulting to `'android'`.

#### Scenario: Default platform

- **WHEN** the user opens `/v2/devices` without query params
- **THEN** the active platform is `android`

#### Scenario: Windows platform selected

- **WHEN** the user navigates to `/v2/devices?platform=windows`
- **THEN** the UI activates Windows column configuration (stub)

### Requirement: Windows feature flag

Windows-specific UI SHALL render full content only when `VITE_WINDOWS_MDM_ENABLED=true`; otherwise a "Coming soon" empty state SHALL be shown.

#### Scenario: Flag disabled

- **WHEN** `VITE_WINDOWS_MDM_ENABLED` is not set or is `false`
- **THEN** Windows device views show a disabled/coming-soon state without calling Windows APIs

### Requirement: Windows stub pages exist in router

The router SHALL register placeholder routes for `/applications/windows` and `/applications/scripts` (content may be stub in MVP).

#### Scenario: Navigate to Windows packages stub

- **WHEN** an authenticated user opens `/v2/applications/windows`
- **THEN** a stub page for MSI/winget management is displayed
