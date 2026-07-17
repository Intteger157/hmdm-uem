# aPuppet: free and open source remote control of Android devices

This is the agent application for sharing the Android device screen, sending the screencast to the server, and playing gestures sent by a person who controls the device.

aPuppet website: https://apuppet.org

The aPuppet project is completely open source, both client and server modules are available. 

## Mobile device management

The aPuppet project is sponsored by [Headwind MDM](https://h-mdm.com), the open source mobile device management system for Android. 

Since you're interested in the remote control of Android devices, consider using Headwind MDM in your company. It is easily installed and makes all your Android devices controllable from a single server.

The aPuppet Premium:

* is seamlessly integrated into Headwind MDM as a module;
* automatically starts by executing a command from the remote server;
* doesn't require user interaction and is suitable for kiosk devices;
* supports any HTTPS certificates.

## Building aPuppet (Intermark / Java 21)

Requires **Android Studio** with **JDK 17 or 21** (Gradle 8.13 + AGP 8.13).

1. Open `plugins/deviceremote/apuppet-android` in Android Studio.
2. **File → Sync Project with Gradle Files**.
3. In `app/build.gradle`, set your remote server defaults:

```gradle
buildConfigField("String", "DEFAULT_SERVER_URL", "\"https://remote.intermark.global/web-admin/\"")
buildConfigField("String", "DEFAULT_SECRET", "\"YOUR_JANUS_SECRET\"")
```

4. Build: **Build → Build Bundle(s) / APK(s) → Build APK(s)** or:

```bash
gradlew.bat assembleRelease
```

APK: `app/build/outputs/apk/release/app-release.apk`

## Building aPuppet (legacy)

## Running the app

The application uses accessibility services to play the remote gestures. Please enable accessibility services when the application prompts.

While sharing the screen, the application displays a flashing green dot in the top left corner. This dot doesn't only display that your screen is casting to a remote peer, it generates a small video traffic stabilizing the picture and keeping the client alive. To enable the dot, allow the aPuppet agent to draw overlays (display on top of other apps).

## Compatibility

aPuppet is using native Android API and is therefore compatible with all Android devices and builds since Android 7 and above. AOSP and custom Android OS are also supported.

The server can be installed on any Linux system (tested on Ubuntu Linux 18.04 and above). The manager application is web-based. It works in any browser supporting WebRTC and doesn't require installation of any desktop software.

More details about the software and purchasing the premium version can be found at https://apuppet.org.