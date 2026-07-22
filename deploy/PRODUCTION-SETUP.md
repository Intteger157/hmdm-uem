# Production setup: test-dev-mdm.intteger.uk

Guide for enrolling Android devices. Supports two layouts:

- **A. Same host** — nginx + certbot on the MDM server (`192.168.31.247`)
- **B. Edge proxy** — nginx + certbot on a **separate** server; MDM host only runs Docker

Use config **B** if your reverse proxy and certbot live on another machine (your case).

## Is everything ready?

| Component | Status |
|-----------|--------|
| Java MDM backend (custom WAR + plugins) | Ready after `./deploy/install.sh` on Linux |
| frontend-v2 UI + `/rest` gateway | Ready (Docker `gateway` service) |
| Public QR page `/qr/...` | Ready |
| HTTPS for Android enrollment | **Edge or host nginx + certbot** |
| DNS | **A record → proxy server public IP** (layout B) |
| MQTT push port `31000` | Proxy must forward TCP 31000 → MDM host (layout B) |

The repo is **functionally ready**, but Android enrollment will fail without:

1. Stack running on the server (`deploy/install.sh`)
2. `deploy/.env` with your public hostname and `PROTOCOL=https`
3. Valid TLS certificate on `test-dev-mdm.intteger.uk`
4. A **Configuration** with enrollment QR in the MDM console
5. Factory-reset Android device (or work profile flow) to scan QR

---

## Layout B — nginx + certbot on a separate proxy server (recommended for you)

```
Phone / Internet
      │
      ▼
DNS test-dev-mdm.intteger.uk  →  PROXY SERVER (public IP)
      │                              :443  TLS (certbot here)
      │                              :31000 MQTT (TCP stream)
      ▼
192.168.31.247:8080   ← Docker gateway (frontend-v2 + /rest)
192.168.31.247:31000  ← hmdm MQTT push
```

### On the MDM host (`192.168.31.247`) only

1. **No** host nginx, **no** certbot on this machine.
2. `deploy/.env`:
   ```env
   BASE_DOMAIN=test-dev-mdm.intteger.uk
   LOCAL_IP=192.168.31.247
   PROTOCOL=https
   GATEWAY_PORT=8080
   ```
3. Docker binds gateway on `0.0.0.0:8080` and MQTT on `0.0.0.0:31000` (default in compose).
4. **Firewall** on MDM host — allow **only from proxy server IP**:
   - `8080/tcp`
   - `31000/tcp`
5. Check locally:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
   ```

### On the PROXY server (nginx + certbot)

1. DNS **A** record: `test-dev-mdm.intteger.uk` → **proxy public IP** (not 192.168.31.247 unless that is your proxy).
2. Copy [`deploy/nginx/edge-reverse-proxy.conf.example`](nginx/edge-reverse-proxy.conf.example) → `/etc/nginx/sites-available/`
3. Enable MQTT TCP proxy: [`deploy/nginx/edge-stream-mqtt.conf.example`](nginx/edge-stream-mqtt.conf.example)  
   Devices connect to `test-dev-mdm.intteger.uk:31000` — that port must listen on the **proxy** and forward to `192.168.31.247:31000`.
4. Certbot **only on proxy**:
   ```bash
   sudo certbot certonly --webroot -w /var/www/certbot \
     -d test-dev-mdm.intteger.uk \
     --email admin@intteger.uk --agree-tos --no-eff-email
   ```
5. Test from internet:
   ```bash
   curl -I https://test-dev-mdm.intteger.uk/
   nc -vz test-dev-mdm.intteger.uk 31000
   ```

Network between proxy and MDM host must allow proxy → `192.168.31.247:8080` and `:31000` (VPN, LAN, or routed subnet).

---

## Layout A — nginx on the same host as Docker

See [`deploy/nginx/host-reverse-proxy.conf.example`](nginx/host-reverse-proxy.conf.example) — upstream `127.0.0.1:8080`.

---

## 1. DNS and network

### Layout B (separate proxy)

1. **A record:** `test-dev-mdm.intteger.uk` → **proxy server public IP**
2. Proxy listens on **80, 443, 31000** (no need to expose 8080 on MDM to the internet)
3. MDM host firewall: proxy IP → `8080`, `31000`

### Layout A (same host)

1. **A record** → MDM host public IP  
2. Router forwards **80, 443, 31000** → `192.168.31.247`

---

## 2. Docker stack

On the Linux host (`192.168.31.247`):

```bash
git clone https://github.com/Intteger157/hmdm-uem.git
cd hmdm-uem
cp deploy/.env.example deploy/.env
```

Edit `deploy/.env`:

```env
BASE_DOMAIN=test-dev-mdm.intteger.uk
LOCAL_IP=192.168.31.247
PROTOCOL=https
ADMIN_EMAIL=admin@your-domain.com
GATEWAY_PORT=8080
SQL_PASS=<strong-password>
SHARED_SECRET=<random-secret>
```

Install and start:

```bash
./deploy/install.sh
```

Check:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/rest/public/sync/info
```

---

## 3. TLS (certbot)

Run certbot on the machine that terminates HTTPS (layout **B** = proxy server only).

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
```

Issue certificate (on proxy):

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d test-dev-mdm.intteger.uk \
  --email admin@intteger.uk \
  --agree-tos \
  --no-eff-email
```

Or with nginx plugin after HTTP site is in place:

```bash
sudo certbot --nginx -d test-dev-mdm.intteger.uk \
  --email admin@intteger.uk --agree-tos --no-eff-email --redirect
```

Renewal: `sudo certbot renew --dry-run` (on proxy only).

---

## 4. MDM server URL

After TLS works, open:

- `https://test-dev-mdm.intteger.uk/`

Log in (default from first boot — check container logs if needed).

In **Settings → Common**, set server URL to:

`https://test-dev-mdm.intteger.uk`

Restart if devices cannot sync:

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml restart hmdm gateway
```

---

## 5. Enroll Android

1. Create a **Configuration** (applications, policies).
2. **Devices → Add device** (or bulk) and assign the configuration.
3. Open device **QR code** — enrollment page: `https://test-dev-mdm.intteger.uk/qr/<key>`
4. Factory-reset the phone (or use QR provisioning on Android 7+).
5. On welcome screen, tap 6 times / connect Wi‑Fi → scan QR.

If enrollment stalls, check:

- HTTPS certificate is trusted (not self-signed)
- Port `31000` reachable from the phone
- `BASE_DOMAIN` / server URL in MDM settings matches the public hostname

---

## 6. Optional: Remote control (aPuppet)

Remote control needs a **second** hostname (e.g. `remote.intteger.uk`) and extra ports. See root `README.md` — section “MDM + Remote on one server (HAProxy)”. Not required for basic enrollment.
