# Production migration: legacy hmdm-docker → hmdm-uem stack (HAProxy single :443)

For servers like **msk-1-vm-ijmy** with:

- `~/hmdm-docker` — MDM + PostgreSQL 12, Tomcat `:8443`
- `~/h-mdm-remote-control` — Remote / Janus `:9443`
- **HAProxy** — `mdm.example.com` → MDM, `remote.example.com` → Remote

Goal: **frontend-v2 + gateway + server-windows (Go)** like test `fleet-vm`, **keep all Android devices**.

Devices live in **PostgreSQL** — migrate with `pg_dump` / `pg_restore`, not a fresh DB.

---

## Architecture change

| Before | After |
|--------|--------|
| HAProxy → `127.0.0.1:8443` (Tomcat HTTPS) | HAProxy → `127.0.0.1:8080` (nginx **gateway** HTTP) |
| Legacy Angular UI in WAR | **frontend-v2** (React) |
| Java only | Java `/rest/` + **Go** `/rest/windows/` |
| `hmdm-docker/docker-compose.yaml` | `hmdm-uem/deploy/docker-compose.yml` |

**Remote (`h-mdm-remote-control`)** — leave as-is; HAProxy `be_remote` → `:9443` unchanged.

---

## Prerequisites

- Ubuntu 22.04/24.04, Docker, git
- Maintenance window (~30–60 min)
- Domains unchanged (e.g. `mdm.intermark.global`)

---

## Step 0 — Backup (mandatory)

```bash
cd ~/hmdm-docker

docker compose exec -T postgresql pg_dump -U hmdm hmdm | gzip > ~/backup-hmdm-$(date +%F).sql.gz

tar czf ~/backup-hmdm-docker-$(date +%F).tgz .env volumes/
```

Copy backups off the VPS.

---

## Step 1 — Clone unified repo

```bash
cd ~
git clone https://github.com/Intteger157/hmdm-uem.git
cd hmdm-uem
git submodule update --init plugins/deviceremote/h-mdm-remote-control
```

---

## Step 2 — Create `deploy/.env` from old settings

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Map from `~/hmdm-docker/.env`:

```env
BASE_DOMAIN=mdm.intermark.global
PROTOCOL=http
PUBLIC_PROTOCOL=https
PUBLIC_BASE_URL=https://mdm.intermark.global
GATEWAY_PORT=8080

# Same DB credentials as before
SQL_USER=hmdm
SQL_PASS=<from old .env>
SQL_BASE=hmdm

SHARED_SECRET=<from old .env — do not change>
ADMIN_EMAIL=<from old .env>

# Copy jwt.secretkey from old ROOT.xml into JWT_SECRET
JWT_SECRET=<from volumes/hmdm-config/ROOT.xml>

FORCE_RECONFIGURE=false
HMDM_VARIANT=os
```

Remote plugin (after remote is running):

```env
REMOTE_DOMAIN=remote.intermark.global
REMOTE_CERTBOT_ENABLED=false
REMOTE_SERVER_URL=https://remote.intermark.global/web-admin/
REMOTE_HTTPS_PORT=9443
```

---

## Step 3 — Copy file volumes

```bash
mkdir -p ~/hmdm-uem/deploy/volumes/files
rsync -a ~/hmdm-docker/volumes/files/ ~/hmdm-uem/deploy/volumes/files/

# Optional: reuse Tomcat config snippets
mkdir -p ~/hmdm-uem/deploy/volumes/hmdm-config
rsync -a ~/hmdm-docker/volumes/hmdm-config/ ~/hmdm-uem/deploy/volumes/hmdm-config/
```

---

## Step 4 — Stop old stack (releases DB for migration)

```bash
cd ~/hmdm-docker
docker compose down
# Do NOT run remove-all.sh or delete volumes/
```

---

## Step 5 — Start PostgreSQL 16 and restore data

```bash
cd ~/hmdm-uem/deploy

# Gateway only on localhost (HAProxy is the public edge)
# Edit docker-compose.yml gateway ports temporarily if needed:
#   - "127.0.0.1:8080:80"

docker compose --env-file .env up -d postgresql

# wait until healthy
gunzip -c ~/backup-hmdm-*.sql.gz | docker compose --env-file .env exec -T postgresql \
  psql -U hmdm -d hmdm
```

If `psql` restore errors on `CREATE DATABASE`, dump was plain data — use:

```bash
gunzip -c ~/backup-hmdm-*.sql.gz | docker compose --env-file .env exec -T postgresql \
  psql -U hmdm -d hmdm -v ON_ERROR_STOP=0
```

---

## Step 6 — Build and start full stack

```bash
cd ~/hmdm-uem
./deploy/install.sh
```

Or step-by-step:

```bash
./deploy/install.sh --skip-docker
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

Verify locally:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/rest/public/sync/info
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/rest/windows/health
```

---

## Step 7 — Switch HAProxy (critical)

Edit `/etc/haproxy/haproxy.cfg` — **backend be_mdm**:

**Before:**

```haproxy
server mdm 127.0.0.1:8443 ssl verify none sni str(mdm.intermark.global) ...
```

**After (TLS ends at HAProxy; gateway speaks HTTP):**

```haproxy
backend be_mdm
    mode http
    option http-server-close
    http-response set-header Strict-Transport-Security "max-age=31536000"
    server mdm 127.0.0.1:8080 check inter 10s fall 3 rise 2
```

```bash
sudo haproxy -c -f /etc/haproxy/haproxy.cfg
sudo systemctl reload haproxy
```

Test:

```bash
curl -I https://mdm.intermark.global/
curl -I https://mdm.intermark.global/rest/public/sync/info
```

---

## Step 8 — Post-migration scripts

```bash
cd ~/hmdm-uem
./deploy/scripts/fix-hmdm-base-url.sh
./deploy/scripts/sync-jwt-secret.sh
./deploy/scripts/sync-deviceremote-settings.sh
```

Console: **Devices** — all phones should appear. Check 2–3 devices online.

---

## Step 9 — Remote control

`~/h-mdm-remote-control` unchanged. If using edge Janus patch on intermark:

```bash
bash ~/hmdm-uem/deploy/scripts/patch-remote-edge-janus.sh
cd ~/h-mdm-remote-control && docker compose restart nginx
```

---

## Rollback

1. `docker compose down` in `~/hmdm-uem/deploy`
2. Restore HAProxy `be_mdm` → `127.0.0.1:8443`
3. `cd ~/hmdm-docker && docker compose up -d`
4. If DB was corrupted: restore from `backup-hmdm-*.sql.gz`

---

## Security after migration

- Do **not** publish PostgreSQL `:5432` to `0.0.0.0` (remove port mapping from old compose; new compose has no public PG port)
- Bind gateway to `127.0.0.1:8080` only
- Keep MQTT `:31000` if phones use push

---

## Optional cleanup (only after 1–2 weeks stable)

```bash
mv ~/hmdm-docker ~/hmdm-docker.old
# keep ~/hmdm-server if you build from hmdm-uem only
```

---

## Checklist

- [ ] `pg_dump` backup stored off-server
- [ ] `BASE_DOMAIN` / `SHARED_SECRET` unchanged
- [ ] HAProxy points to `:8080` not `:8443`
- [ ] Devices visible in new UI
- [ ] Android QR / `/files/` APK download works
- [ ] MQTT / push (`31000`) works
- [ ] Remote control settings in Plugins
