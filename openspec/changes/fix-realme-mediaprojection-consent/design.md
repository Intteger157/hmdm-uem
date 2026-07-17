## Context

The HMDM remote control Android agent (`com.hmdm.control`) uses Janus WebRTC for signaling and `MediaProjection` for screen capture. On Android 14+, screen sharing requires a foreground service with type `mediaProjection`, which must start only after user consent.

Current flow: `MainActivity` calls `startActivityForResult(createScreenCaptureIntent())` directly. `MainActivity` is declared with `android:launchMode="singleTask"`.

**Observed failure on Realme RMX3636 / Android 15** (from logs 2026-07-16):

1. Janus TextRoom connects successfully (`WebRTC is up!`, ICE CONNECTED).
2. `MainActivity` requests MediaProjection → SystemUI opens `MediaProjectionPermissionActivity`, then `MediaProjectionAppSelectorActivity`.
3. User selects `com.hmdm.control` in the chooser.
4. SystemUI delivers `LAUNCHER` intent (`flg=0x11000000`) to `MainActivity` → `onNewIntent` → `connectRemoteSession()` logs **"Reconnecting remote session, state=2"** and disconnects the active session.
5. Pending consent completes with `resultCode=0` → **"MediaProjection consent denied or cancelled"**.
6. Reconnect attempt yields ICE DISCONNECTED; admin UI shows Disconnected.

Root cause: OEM app selector re-launches the consent-hosting activity via `LAUNCHER` + `singleTask`, which cancels the in-flight `startActivityForResult` and triggers session teardown in `onNewIntent`.

## Goals / Non-Goals

**Goals:**

- MediaProjection consent succeeds on Realme/Oplus Android 15 when user selects the app in the system chooser.
- Active Janus/WebRTC session MUST remain connected during the consent UI flow.
- Consent result MUST reliably reach `ScreenSharingService` to start capture.
- Agent version incremented to `1.16.21-intermark` (versionCode 36).

**Non-Goals:**

- Bypassing MediaProjection user consent (not possible on non-rooted devices).
- Fixing unrelated accessibility-settings navigation during first-run setup.
- Supporting pre-Android 14 devices differently (existing flow remains compatible).

## Decisions

### 1. Dedicated `ScreenCaptureConsentActivity`

**Decision:** Create a transparent, no-history activity (`Theme.Translucent.NoTitleBar`, `launchMode="standard"`, `excludeFromRecents="true"`, `taskAffinity=""`) that exclusively handles `createScreenCaptureIntent()` + `onActivityResult`.

**Rationale:** Consent must not run on `MainActivity` because `singleTask` + OEM `LAUNCHER` relaunch cancels the result callback. A short-lived standard activity stays on the consent task stack and survives the chooser interaction.

**Alternatives considered:**
- Change `MainActivity` to `singleTop` — breaks remote-control deep-link / intent handling assumptions.
- Use `ActivityResultLauncher` on `MainActivity` only — same `singleTask` cancellation problem.
- Device-owner silent grant — not available on all deployments.

### 2. Consent result delivery via LocalBroadcast

**Decision:** `ScreenCaptureConsentActivity` broadcasts `ACTION_SCREEN_CAPTURE_CONSENT_RESULT` with `resultCode` and `data` Intent extras. `MainActivity` (already registered for sharing events) consumes it and calls `ScreenSharingHelper.startSharing()`.

**Rationale:** `MainActivity` may be paused/stopped during consent; broadcast decouples consent activity lifecycle from sharing start. Matches existing `LocalBroadcastManager` pattern in the app.

### 3. Guard session reconnect during consent

**Decision:** In `MainActivity.onNewIntent`:
- If `screenCaptureRequestPending` or consent activity is in progress → skip `connectRemoteSession()`.
- If intent is `ACTION_MAIN` + `CATEGORY_LAUNCHER` and an active session exists (state CONNECTED or SHARING) → treat as chooser side-effect, not a reconnect trigger.

**Rationale:** Logs show the spurious reconnect is the direct cause of ICE failure. Guard is minimal and targeted.

### 4. Single automatic retry on resultCode=0

**Decision:** If consent returns `resultCode=0` within 3 seconds of launch and no explicit user back-navigation, retry consent once via `ScreenCaptureConsentActivity`.

**Rationale:** Some OEM flows deliver a transient cancel before the real result; one retry covers chooser race without looping.

### 5. Foreground service before MediaProjection (Android 14+)

**Decision:** In `ScreenSharingService.startSharing()`, call `ensureForeground()` with `FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION` **before** `getMediaProjection()`. Android 14+ throws `SecurityException` if projection is acquired while the service is not yet a typed foreground service.

**Rationale:** Realme RMX3636 logs (1.16.20) showed consent succeeding but crash at `getMediaProjection()` because FGS was started after projection acquisition.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Extra activity visible in task switcher briefly | `excludeFromRecents`, translucent theme, finish immediately after result |
| Retry could show consent twice | Limit to 1 retry; only when session is still active and admin is connected |
| Other OEMs with similar chooser behavior | Standard launch mode activity is the Android-recommended pattern for projection consent |
| Broadcast missed if MainActivity destroyed | Persist consent result in SharedPreferences briefly; check on `onResume` |

## Migration Plan

1. Implement and test on Realme RMX3636.
2. Build release APK with versionCode 35 / 1.16.20-intermark.
3. Deploy via HMDM application update policy.
4. Rollback: redeploy 1.16.19 if regression; no server-side changes required.

## Open Questions

- Should consent be requested proactively before admin joins (already partially implemented)? **Keep existing proactive prep; dedicated activity handles both proactive and on-demand paths.**
