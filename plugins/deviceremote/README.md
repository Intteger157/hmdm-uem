# Device Remote Control plugin (Intermark)

MDM plugin for **unattended remote control** via [Headwind Remote / aPuppet](https://github.com/MrYoda/apuppet-android).

## Architecture

```
Admin UI (deviceremote plugin)
    → REST + MQTT push (configUpdated)
    → Launcher sync hook → RemoteControlHelper
    → com.hmdm.control (aPuppet agent)
    → Headwind Remote server (Janus/WebRTC)
    → Browser viewer (?session=...&pin=...)
```

## Components in this repo

| Path | Purpose |
|------|---------|
| `plugins/deviceremote/` | MDM server plugin (Java + Angular UI) |
| `plugins/deviceremote/apuppet-android/` | Patched Android agent (`com.hmdm.control`) |
| `plugins/deviceremote/h-mdm-remote-control/` | Headwind Remote server (Janus/WebRTC), Ubuntu 22.04/24.04 |
| `android-launcher/` | Launcher patches: `RemoteControlHelper`, sync handling |

## Server deploy

1. Build WAR (includes plugin):

```bash
docker run --rm -v "$(pwd)":/usr/src/mymaven -v "$HOME/.m2":/root/.m2 -w /usr/src/mymaven \
  maven:3.8.6-openjdk-11 mvn clean package -pl server -am -DskipTests
```

2. Deploy WAR to Docker as usual (`down && up`).

3. Enable plugin in **Plugins** (should auto-register via Liquibase).

4. **Plugins → Remote control → Settings**: set aPuppet web-admin URL and secret, e.g.  
   `https://remote.intermark.global/web-admin/`

## Headwind Remote server

Deploy on Ubuntu **22.04 or 24.04** (same host as MDM is OK if ports differ):

```bash
git clone https://github.com/Intteger157/h-mdm-remote-control.git
cd h-mdm-remote-control
# edit config.yaml — see INSTALL-INTERMARK.md (use web_https_port: 9443 if MDM uses 443)
sudo ./install.sh
cat deploy/dist/credentials/janus_api_secret
```

Use the **same secret** in MDM plugin settings and in agent `build.gradle` (`DEFAULT_SECRET`).

## Android apps

### 1. Launcher (required)

Rebuild and roll out your Intermark launcher (`6.36.x-intermark`) — includes remote control integration.

### 2. Remote agent `com.hmdm.control`

Build from `plugins/deviceremote/apuppet-android/`:

```bash
cd plugins/deviceremote/apuppet-android
# set DEFAULT_SERVER_URL and DEFAULT_SECRET in app/build.gradle
gradlew assembleRelease
```

Upload APK to **Applications**, add to configuration (**Install**).

## Usage

1. Configure remote server URL in plugin settings.
2. **Devices** → select device → plugin menu → **Remote control**.
3. Click **Start remote session**.
4. Click **Open viewer** (or copy session/PIN).
5. Device agent starts automatically after sync/push.

## Permissions (Device Owner)

Launcher auto-grants runtime permissions, overlay and accessibility for `com.hmdm.control` when installed as Device Owner.

**MediaProjection** (screen capture): Android may require **one-time** user confirmation on first remote session per device/OS version.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/rest/plugins/deviceremote/private/settings` | Customer settings |
| PUT | `/rest/plugins/deviceremote/private/settings` | Save settings |
| GET | `/rest/plugins/deviceremote/private/status/{deviceId}` | Session status |
| PUT | `/rest/plugins/deviceremote/private/start` | Start session |
| PUT | `/rest/plugins/deviceremote/private/stop` | Stop session |
| POST | `/rest/plugins/deviceremote/public/launch/{number}` | Device confirms agent launch |
| POST | `/rest/plugins/deviceremote/public/status/{number}` | Agent status updates |
| POST | `/rest/plugins/deviceremote/public/stop/{number}` | Device confirms stop |

## Session statuses

- `pending` — waiting for device to start agent
- `launched` — agent started, connecting
- `active` — admin connected / sharing
- `failed` / `stopped` / `idle`
