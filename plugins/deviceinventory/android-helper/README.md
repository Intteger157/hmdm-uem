# Inventory Helper APK (`com.hmdm.inventory`)

Сканирует установленные приложения на устройстве и отправляет список на сервер
(`POST /rest/plugins/deviceinventory/public/upload`). Слушает MQTT push `inventoryScan`.

## Требования

- Android Studio Ladybug+ или JDK 17 + Android SDK 34
- Headwind MDM launcher на устройстве (для device ID и URL сервера)
- Библиотека **hmdm-1.1.8.aar** — прямая ссылка (каталог `/files/` в браузере отдаёт 403, это нормально):
  - https://h-mdm.com/files/hmdm-1.1.8.aar → `app/libs/hmdm-1.1.8.aar`
  - запасной вариант: скопировать `hmdm-1.0.6.aar` из [hmdm-plugin-apn](https://github.com/h-mdm/hmdm-plugin-apn) и в `app/build.gradle` заменить версию на `1.0.6`

## Быстрый старт

### 1. Скопировать Gradle Wrapper (один раз)

Из любого Android-проекта Headwind, например:

**Linux/Mac:**
```bash
git clone https://github.com/h-mdm/hmdm-plugin-apn.git /tmp/hmdm-plugin-apn
cp -r /tmp/hmdm-plugin-apn/gradle android-helper/
cp /tmp/hmdm-plugin-apn/gradlew android-helper/
cp /tmp/hmdm-plugin-apn/gradlew.bat android-helper/
chmod +x android-helper/gradlew
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/h-mdm/hmdm-plugin-apn.git D:\tmp\hmdm-plugin-apn
Copy-Item -Recurse D:\tmp\hmdm-plugin-apn\gradle .
Copy-Item D:\tmp\hmdm-plugin-apn\gradlew* .
# chmod не нужен — запускайте .\gradlew.bat
```

Или откройте папку `android-helper` в Android Studio — IDE создаст wrapper сама.

### 2. Скачать hmdm.aar

```powershell
cd plugins/deviceinventory/android-helper/app/libs
Invoke-WebRequest -Uri "https://h-mdm.com/files/hmdm-1.1.8.aar" -OutFile "hmdm-1.1.8.aar"
# или: Copy-Item D:\tmp\hmdm-plugin-apn\app\libs\hmdm-1.0.6.aar .
```

### 3. Указать hash.secret сервера

В `app/build.gradle` замените `REQUEST_SIGNATURE` на значение из `ROOT.xml` / `.env`:

```gradle
buildConfigField "String", "REQUEST_SIGNATURE", "\"changeme-C3z9vi54\""
```

Должно совпадать с `hash.secret` на сервере.

### 4. Собрать APK

```bash
cd plugins/deviceinventory/android-helper
./gradlew assembleRelease
```

APK: `app/build/outputs/apk/release/app-release.apk`

Для подписи release создайте `local.properties` (по образцу hmdm-plugin-apn) или соберите debug:

```bash
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

## Установка через MDM

1. **Applications** → загрузить APK (`com.hmdm.inventory`)
2. Добавить в конфигурацию брокеров
3. Флаги:
   - **Show icon** — скрыть (рекомендуется)
   - **Run at boot** — да
   - **Ignore battery optimizations** — да (если есть)
4. Дождаться синхронизации устройства

## Проверка

1. В панели: Devices → ⋯ → **Installed Apps** → **Request scan**
2. Через 1–2 минуты нажать **Refresh** — должен появиться список приложений

Логи на устройстве:

```bash
adb logcat -s com.hmdm.inventory
```

## API key (опционально)

Если в конфигурации лаунчера задан API key, укажите его в `Const.API_KEY` в `Const.java`.
Для базовых операций (device ID, server URL) ключ не обязателен.
