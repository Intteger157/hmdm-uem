## ADDED Requirements

### Requirement: English and Russian locales

The application SHALL support exactly two locales in MVP: `en` (default) and `ru`.

#### Scenario: Default language

- **WHEN** a first-time visitor loads the app
- **THEN** UI strings render in English

### Requirement: Language switcher persists choice

The user SHALL be able to switch language; the choice SHALL persist in `localStorage`.

#### Scenario: Switch to Russian

- **WHEN** the user selects Russian from the language switcher
- **THEN** UI strings update to Russian and remain Russian after page reload

### Requirement: Login and shell strings are translated

MVP translated surfaces SHALL include login page labels, navigation items, and common actions (login, logout, dashboard).

#### Scenario: Russian login button

- **WHEN** locale is `ru` and the user views the login page
- **THEN** the submit button label is displayed in Russian
