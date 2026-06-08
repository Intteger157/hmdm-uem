# Inventory Helper APK (Android)

The server plugin stores application lists uploaded by a small helper app on each device.
You do **not** need to fork [hmdm-android](https://github.com/h-mdm/hmdm-android) for this.

**Ready-to-build project:** `android-helper/` — see [android-helper/README.md](android-helper/README.md).

## Package

`com.hmdm.inventory`

## What it should do

1. On boot and every 6 hours (AlarmManager), scan installed packages via `PackageManager`.
2. Build JSON payload:

```json
{
  "deviceId": "<device number from Headwind launcher>",
  "hash": "MD5(deviceId + hash.secret)",
  "applications": [
    {"pkg": "com.whatsapp", "name": "WhatsApp", "version": "2.23.1", "system": false}
  ]
}
```

3. `POST https://<server>/rest/plugins/deviceinventory/public/upload`
4. Listen for MQTT push `inventoryScan` and run scan immediately.

## Getting device ID and hash secret

- Device number: same as Headwind launcher (`deviceId` in shared prefs / MDM config).
- `hash.secret`: must match server `ROOT.xml` / `SHARED_SECRET` (MD5 of `deviceId + secret`).

## Deploy via MDM

1. Build/sign APK.
2. Upload to Headwind MDM panel → Applications.
3. Assign to broker configuration.
4. Flags: **Show icon** = hide, **Run at boot** = yes.

## Optional: fork hmdm-android later

To avoid a second APK, add full inventory to `DeviceInfoProvider` in a fork of hmdm-android.
That is phase 2 — not required for the first release.
