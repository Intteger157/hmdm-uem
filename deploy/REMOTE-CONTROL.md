# Remote control (aPuppet / Headwind Remote)

Android **Remote control** in the MDM console uses the `deviceremote` Java plugin and a separate **Headwind Remote** server (Janus WebRTC + web-admin viewer).

Source: git submodule `plugins/deviceremote/h-mdm-remote-control` (fork of [Intteger157/h-mdm-remote-control](https://github.com/Intteger157/h-mdm-remote-control)).

## Architecture

```
MDM console (frontend-v2)
    │  PUT /rest/plugins/deviceremote/private/start
    ▼
Java MDM (deviceremote plugin)
    │  reads plugin_deviceremote_settings (PostgreSQL)
    │  push → Android agent (com.hmdm.control)
    ▼
Headwind Remote (host Docker: nginx + Janus, network_mode: host)
    │  web-admin viewer + WebRTC
    ▼
Browser opens {serverUrl}?session=…&pin=…
```

The remote stack **does not run inside** `deploy/docker-compose.yml`. Janus needs **host networking** and UDP ports `10000–10500` for WebRTC media.

## Quick start (dedicated remote host or same VPS)

1. Initialize the submodule:

   ```bash
   git submodule update --init plugins/deviceremote/h-mdm-remote-control
   ```

2. Add variables to `deploy/.env` (see checklist below).

3. Install MDM as usual:

   ```bash
   ./deploy/install.sh
   ```

4. Install remote control on the **Linux host** (requires root for Ansible):

   ```bash
   sudo bash deploy/scripts/install-remote-control.sh
   ```

   If `./deploy/scripts/install-remote-control.sh` fails with `command not found`, the script
   likely has Windows line endings — run `sed -i 's/\r$//' deploy/scripts/*.sh && chmod +x deploy/scripts/*.sh`
   or `git pull` after the `.gitattributes` fix in this repo.

   This writes `config.yaml`, runs upstream `install.sh`, saves `REMOTE_SERVER_SECRET` to `.env`, and syncs PostgreSQL.

5. Start or restart remote containers:

   ```bash
   ./deploy/scripts/start-remote-control.sh
   ```

6. In the console: **Plugins → Remote control** — verify URL and secret match `.env`.

7. On the device: Headwind launcher + `com.hmdm.control` APK with the **same Janus secret** as the server.

## `.env` checklist

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `REMOTE_DOMAIN` | Yes (for install script) | `remote.example.com` | DNS hostname for TLS and viewer |
| `REMOTE_CERTBOT_EMAIL` | Yes | `admin@example.com` | Let's Encrypt (defaults to `ADMIN_EMAIL`; must be an **email**, not a domain) |
| `REMOTE_SERVER_URL` | Optional | `https://remote.example.com/web-admin/` | Plugin `serverUrl` (auto-built from domain if empty) |
| `REMOTE_SERVER_SECRET` | After install | `(from janus_api_secret)` | Plugin `serverSecret`; must match Android agent |
| `REMOTE_HTTPS_PORT` | Optional | `9443` or `443` | nginx HTTPS listen port on host |
| `REMOTE_HTTP_LISTEN` | Optional | `127.0.0.1:8081` | ACME/HTTP when something else owns `:80` (avoid `8080` — MDM gateway uses it) |
| `REMOTE_PUBLIC_IP` | If behind NAT | `203.0.113.10` | Janus ICE candidate |
| `REMOTE_NAT` | Optional | `true` | Set `true` when server is behind NAT |
| `REMOTE_CERTBOT_ENABLED` | Layout B | `false` | Set `false` when TLS/certbot run on edge nginx, not on fleet-vm |
| `REMOTE_CUSTOMER_ID` | Optional | `1` | PostgreSQL `customerId` for settings row |
| `BASE_DOMAIN` | For co-host hint | `mdm.example.com` | MDM hostname (single-port setup) |
| `PUBLIC_PROTOCOL` | Optional | `https` | Used when building `REMOTE_SERVER_URL` |

**Minimal example** (remote on its own subdomain, port 443):

```env
REMOTE_DOMAIN=remote.example.com
REMOTE_CERTBOT_EMAIL=admin@example.com
REMOTE_HTTPS_PORT=443
REMOTE_NAT=false
```

**Same VPS as MDM** (remote on `:9443`, MDM on gateway `:8080` or `:443` via edge nginx):

```env
BASE_DOMAIN=mdm.example.com
REMOTE_DOMAIN=remote.example.com
REMOTE_CERTBOT_EMAIL=admin@example.com
REMOTE_HTTPS_PORT=9443
REMOTE_HTTP_LISTEN=127.0.0.1:8081
REMOTE_NAT=true
REMOTE_PUBLIC_IP=203.0.113.10
```

After remote install, `REMOTE_SERVER_SECRET` is appended automatically. Re-sync anytime:

```bash
./deploy/scripts/sync-deviceremote-settings.sh
```

**`.env` format:** use `#` comments on separate lines only. Do not write `REMOTE_DOMAIN=host  # comment` — put the comment above the variable.

## Layout B — edge nginx + certbot on a separate proxy (your setup)

MDM already uses a **public reverse proxy**; `:80`/`:443` are **not** on `fleet-vm`. Do **not** run certbot on the MDM/remote host.

On `fleet-vm` `deploy/.env`:

```env
REMOTE_DOMAIN=remote-dev-mdm.intteger.uk
REMOTE_CERTBOT_ENABLED=false
REMOTE_HTTPS_PORT=9443
REMOTE_SERVER_URL=https://remote-dev-mdm.intteger.uk/web-admin/
REMOTE_CERTBOT_EMAIL=admin@intteger.uk
REMOTE_NAT=true
REMOTE_PUBLIC_IP=94.143.43.204
```

Then:

```bash
sudo bash deploy/scripts/install-remote-control.sh
./deploy/scripts/start-remote-control.sh
./deploy/scripts/sync-deviceremote-settings.sh
```

On the **edge proxy** server:

1. Add vhost from [`deploy/nginx/edge-remote-reverse-proxy.conf.example`](nginx/edge-remote-reverse-proxy.conf.example)
2. `certbot certonly --webroot … -d remote-dev-mdm.intteger.uk` on the **proxy** (where `:80` is public)
3. Allow proxy → `192.168.31.247:9443` (HTTP backend), plus `8089`, `8989`, UDP `10000–10500` for Janus/WebRTC

Remote nginx listens **HTTP** on `:9443` locally; the browser uses **HTTPS** on the edge `:443`.

## Firewall / security group

Open on the **remote host** (or forward from edge):

| Port | Protocol | Service |
|------|----------|---------|
| `443` or `REMOTE_HTTPS_PORT` | TCP | web-admin viewer (nginx) |
| `8089` | TCP | Janus REST API (HTTPS) |
| `8989` | TCP | Janus WebSocket (WSS) |
| `10000–10500` | **UDP** | WebRTC RTP media |

## Single public `:443` (MDM + Remote on one VPS)

Use HAProxy SNI routing from the submodule:

```bash
cp plugins/deviceremote/h-mdm-remote-control/scripts/single-port/config.env.example \
   plugins/deviceremote/h-mdm-remote-control/scripts/single-port/config.env
# Edit REMOTE_DOMAIN, MDM_DOMAIN, paths
sudo plugins/deviceremote/h-mdm-remote-control/scripts/single-port/setup-single-port.sh
```

See `plugins/deviceremote/h-mdm-remote-control/scripts/single-port/README.md`.

## Frontend flow (already implemented)

- Device **Actions → Remote control** opens `DeviceRemoteDialog`.
- **Start** calls `PUT /rest/plugins/deviceremote/private/start`.
- When agent status is `ready` or `sharing`, **Open viewer** opens `{serverUrl}?session=…&pin=…` in a new tab.
- Settings UI: **Plugins → Remote control** (`/plugins/remote-control`).

Requires console user with **high** access level (RBAC).

## Java backend

No extra Tomcat environment variables. The plugin reads:

- `serverUrl` — base URL of web-admin (trailing slash optional)
- `serverSecret` — contents of `deploy/dist/credentials/janus_api_secret` on the remote server

REST endpoints:

- `GET/PUT /rest/plugins/deviceremote/private/settings`
- `GET /rest/plugins/deviceremote/private/status/{deviceId}`
- `PUT /rest/plugins/deviceremote/private/start` / `stop`

## Android agent secret

The control APK must use the same secret as `REMOTE_SERVER_SECRET`. In the upstream repo this is typically `DEFAULT_SECRET` in `apuppet-android/app/build.gradle` — rebuild and deploy via MDM **Applications** if you change the server secret.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Start succeeds but no viewer | `plugin_deviceremote_settings.serverUrl` empty → run sync script |
| Agent stays offline | Device has control APK + launcher; push/MQTT working |
| Black screen / no video | UDP `10000–10500` open; `REMOTE_NAT` / `REMOTE_PUBLIC_IP` correct |
| TLS errors | DNS → remote host; certbot logs in remote compose |

```bash
docker compose -f plugins/deviceremote/h-mdm-remote-control/docker-compose.yaml ps
docker compose -f plugins/deviceremote/h-mdm-remote-control/docker-compose.yaml logs -f nginx janus
```
