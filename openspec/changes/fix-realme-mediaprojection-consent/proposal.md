## Why

On Realme/Oplus devices running Android 15 (e.g. RMX3636), remote screen sharing fails after the user grants MediaProjection consent. The system shows `MediaProjectionPermissionActivity` and `MediaProjectionAppSelectorActivity`, but selecting the app re-launches `MainActivity` via a `LAUNCHER` intent. Because `MainActivity` uses `singleTask`, the pending `startActivityForResult` is cancelled (`resultCode=0`), and `onNewIntent` triggers an unnecessary Janus session reconnect that drops the active WebRTC connection (ICE DISCONNECTED in admin UI).

## What Changes

- Add a dedicated transparent `ScreenCaptureConsentActivity` to own the MediaProjection consent flow, isolated from `MainActivity`'s `singleTask` lifecycle.
- Route all MediaProjection consent requests from `MainActivity` through the new activity; deliver consent result back via `LocalBroadcastManager` or activity result contract.
- Guard `MainActivity.onNewIntent` and session reconnect logic so `LAUNCHER` intents during a pending consent flow do not call `connectRemoteSession()`.
- Preserve the active Janus/WebRTC session while the user interacts with the Oplus/Realme app selector.
- Retry consent once when `resultCode=0` but the user did not explicitly deny (chooser relaunch artifact).
- Bump agent version to `1.16.20-intermark` (versionCode 35).

## Capabilities

### New Capabilities

- `screen-capture-consent`: Isolated MediaProjection consent flow on Android 14+ OEM devices that use an app selector chooser (Realme/Oplus/ColorOS).

### Modified Capabilities

- (none — no existing main specs in this repo)

## Impact

- **Android agent**: `plugins/deviceremote/apuppet-android/`
  - New: `ScreenCaptureConsentActivity.java`
  - Modified: `MainActivity.java`, `AndroidManifest.xml`, `build.gradle`
- **Runtime behavior**: MediaProjection consent no longer tied to `MainActivity` activity stack; remote session stays connected during consent UI.
- **Testing**: Manual verification on Realme RMX3636 Android 15; regression on stock Android 14+ devices.
