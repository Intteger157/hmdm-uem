# Production setup: test-dev-mdm.intteger.uk

Guide for enrolling Android devices against the Docker stack on `192.168.31.247`.

## Is everything ready?

| Component | Status |
|-----------|--------|
| Java MDM backend (custom WAR + plugins) | Ready after `./deploy/install.sh` on Linux |
| frontend-v2 UI + `/rest` gateway | Ready (Docker `gateway` service) |
| Public QR page `/qr/...` | Ready |
| HTTPS for Android enrollment | **You must configure** (host nginx + certbot) |
| DNS + port forwarding | **You must configure** |
| MQTT push port `31000` | Exposed by compose; open on firewall/router if devices are outside LAN |

The repo is **functionally ready**, but Android enrollment will fail without:

1. Stack running on the server (`deploy/install.sh`)
2. `deploy/.env` with your public hostname and `PROTOCOL=https`
3. Valid TLS certificate on `test-dev-mdm.intteger.uk`
4. A **Configuration** with enrollment QR in the MDM console
5. Factory-reset Android device (or work profile flow) to scan QR

---

## 1. DNS and network

1. Create an **A record**:
   - `test-dev-mdm.intteger.uk` → your **public** IP (the one seen from the internet)
2. On the router, forward to `192.168.31.247`:
   - `80/tcp` → `192.168.31.247:80`
   - `443/tcp` → `192.168.31.247:443`
   - `31000/tcp` → `192.168.31.247:31000` (push/MQTT; required for reliable device sync)
3. Verify from outside your LAN:
   ```bash
   dig +short test-dev-mdm.intteger.uk
   curl -I http://test-dev-mdm.intteger.uk
   ```

Let's Encrypt will **not** issue a certificate if the domain does not resolve to this server on port 80.

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

## 3. Host nginx + Let's Encrypt (certbot)

Install on Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
```

### Option A — certbot with webroot (recommended for first issue)

**Before** enabling the HTTPS server block, use a temporary HTTP-only config or comment out the `return 301` redirect and the entire `listen 443` server in the example file.

```bash
sudo cp deploy/nginx/host-reverse-proxy.conf.example /etc/nginx/sites-available/test-dev-mdm.intteger.uk
# Edit: comment out the 443 server block and the HTTP→HTTPS redirect for the first run
sudo ln -sf /etc/nginx/sites-available/test-dev-mdm.intteger.uk /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Issue certificate:

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d test-dev-mdm.intteger.uk \
  --email admin@intteger.uk \
  --agree-tos \
  --no-eff-email
```

Generate DH params (once):

```bash
sudo certbot install --cert-name test-dev-mdm.intteger.uk 2>/dev/null || true
sudo openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
```

Uncomment the HTTPS server block and HTTP redirect in the site config, then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Option B — certbot nginx plugin (simpler if HTTP proxy already works)

```bash
sudo certbot --nginx \
  -d test-dev-mdm.intteger.uk \
  --email admin@intteger.uk \
  --agree-tos \
  --no-eff-email \
  --redirect
```

Renewal is automatic via `certbot.timer`:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

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
