## 1. ScreenCaptureConsentActivity

- [x] 1.1 Create `ScreenCaptureConsentActivity.java` — transparent theme, `launchMode=standard`, handles `createScreenCaptureIntent()` + `onActivityResult`
- [x] 1.2 Add activity to `AndroidManifest.xml` with `excludeFromRecents`, `taskAffinity=""`, `noHistory=true`
- [x] 1.3 Add `Const.ACTION_SCREEN_CAPTURE_CONSENT_RESULT` broadcast action and extras for resultCode/data
- [x] 1.4 Broadcast consent result via `LocalBroadcastManager` and call `finish()` immediately after

## 2. MainActivity integration

- [x] 2.1 Replace direct `startActivityForResult` in `launchScreenCaptureConsent()` with start of `ScreenCaptureConsentActivity`
- [x] 2.2 Register broadcast receiver for `ACTION_SCREEN_CAPTURE_CONSENT_RESULT`; on grant call `ScreenSharingHelper.startSharing()`, on deny show toast
- [x] 2.3 Guard `onNewIntent`: skip `connectRemoteSession()` when `screenCaptureRequestPending` or intent is spurious `LAUNCHER` during active session
- [x] 2.4 Implement single retry: if `resultCode=0` within 3s and session still active, re-launch consent activity once
- [x] 2.5 Remove or simplify `onActivityResult` handling for `REQUEST_SCREEN_SHARE` (consent moved to dedicated activity)

## 3. Version and verification

- [x] 3.1 Bump `versionCode` to 35 and `versionName` to `1.16.20-intermark` in `app/build.gradle`
- [x] 3.1b Fix `ScreenSharingService`: call `ensureForeground()` before `getMediaProjection()`; bump to versionCode 36 / `1.16.21-intermark`
- [ ] 3.2 Build release APK and verify on Realme RMX3636: consent chooser → grant → screen share starts, admin sees video
- [ ] 3.3 Verify logs: no "Reconnecting remote session" during consent flow; no `resultCode=0` after user selects app
- [ ] 3.4 Regression check on non-Oplus Android 14+ device (consent dialog still works)
