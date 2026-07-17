## ADDED Requirements

### Requirement: Isolated consent activity

The agent SHALL request MediaProjection user consent through a dedicated `ScreenCaptureConsentActivity` rather than `MainActivity`, so that OEM app-selector flows cannot cancel the consent callback via `singleTask` relaunch.

#### Scenario: Consent launched when admin connects

- **WHEN** the sharing engine reaches CONNECTED state and screen capture consent is required
- **THEN** the agent SHALL start `ScreenCaptureConsentActivity` to launch `MediaProjectionManager.createScreenCaptureIntent()`
- **AND** `MainActivity` SHALL NOT call `startActivityForResult` for screen capture directly

#### Scenario: Consent activity lifecycle

- **WHEN** `ScreenCaptureConsentActivity` receives consent result from the system
- **THEN** it SHALL broadcast the result to the app process and finish immediately
- **AND** it SHALL NOT remain on the activity back stack after finishing

### Requirement: Session stability during consent

The agent SHALL NOT disconnect or reconnect the Janus remote session while MediaProjection consent is pending.

#### Scenario: LAUNCHER intent during chooser

- **WHEN** `MainActivity.onNewIntent` receives an `ACTION_MAIN` / `CATEGORY_LAUNCHER` intent while consent is pending or an active session exists
- **THEN** the agent SHALL NOT call `connectRemoteSession()`
- **AND** the existing WebRTC session SHALL remain in its current state

#### Scenario: Consent UI overlay

- **WHEN** SystemUI displays `MediaProjectionPermissionActivity` or `MediaProjectionAppSelectorActivity`
- **THEN** the Janus TextRoom connection SHALL stay established (no explicit disconnect triggered by the agent)

### Requirement: Consent result propagation

The agent SHALL deliver a granted MediaProjection consent result to `ScreenSharingService` so screen sharing can start.

#### Scenario: User grants consent

- **WHEN** the user completes the system consent flow with `RESULT_OK`
- **THEN** the agent SHALL store the consent token (`resultCode` + `resultData` Intent)
- **AND** SHALL invoke `ScreenSharingHelper.startSharing()` with the stored consent
- **AND** `ScreenSharingService` SHALL start the mediaProjection foreground service only after obtaining `MediaProjection`

#### Scenario: User denies consent

- **WHEN** the user explicitly denies screen capture consent
- **THEN** the agent SHALL show the existing denial toast
- **AND** SHALL stop any partial sharing setup without reconnecting the Janus session

### Requirement: Chooser cancellation retry

The agent SHALL retry consent once when the system returns `resultCode=0` due to OEM chooser relaunch rather than explicit user denial.

#### Scenario: Transient cancel from app selector

- **WHEN** consent returns `resultCode=0` within 3 seconds of launch and the remote session is still active
- **THEN** the agent SHALL automatically re-launch `ScreenCaptureConsentActivity` once
- **AND** SHALL NOT disconnect the Janus session

#### Scenario: Explicit denial

- **WHEN** consent returns `resultCode=0` after retry or outside the retry window
- **THEN** the agent SHALL treat consent as denied and SHALL NOT retry again

### Requirement: Version increment

Each agent build that includes this fix SHALL increment the application version.

#### Scenario: Release version

- **WHEN** this change is built for release
- **THEN** `versionCode` SHALL be 35 and `versionName` SHALL be `1.16.20-intermark`
