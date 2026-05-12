# OTA Self-Hosted Migration — Phase 0-6 Completeness Audit

**Date:** 2026-05-12 (after #382 merge / before customer cutover)
**Chat:** chat5
**Trigger:** Steve dispatch Track B — verify Phase 0-6 全部 deliverables, identify pre-customer-rollout gaps

---

## TL;DR

OTA self-hosted Phase 0-6 全部 **code shipped + tests GREEN + 7/7 PRs MERGED** on `origin/main`. Server-side Phase 1+2+P0+systemd integration **prod LIVE** on 47 since 2026-05-12. **But two install-time ops steps have NOT been executed yet:**

| Severity | Gap | Owner | ETA |
|---|---|---|---|
| 🔴 **BLOCKER** for end-to-end customer flow | `install-nginx-ota.sh` 还未在 139 跑 — vhost conf 不存在,external `https://ota.cretaceousfuture.com/api/ota/health` 不可达 | Steve | 2 min from operator laptop |
| 🟡 cascading on #1 | `.env.ota:OTA_HOSTNAME` 还是 `http://47.100.235.168:8083` (IP direct),manifest emit 的 asset URL 客户端不可达 | Steve | install 脚本自动打印一键 sed + systemctl restart 命令 |

**Acceptance for OTA "really LIVE":** Steve runs the two ops steps → external probe `https://ota.cretaceousfuture.com/api/ota/health` returns 200 → chat5 runs Track A E2E.

---

## Phase-by-phase deliverables matrix

Status columns:
- **Shipped** = code present on `origin/main`
- **Tested** = CI / local pytest GREEN at merge
- **Prod live** = actual server-side artifact present + serving
- **Smoke verified** = real prod request-response observed end-to-end (not TestClient mock)

### Phase 0 — Spec (#363)

| Deliverable | Shipped | Tested | Prod live | Smoke verified |
|---|---|---|---|---|
| `docs/superpowers/specs/2026-05-11-self-hosted-ota-spec.md` (803 lines, §1-§16) | ✅ | n/a (doc) | n/a | n/a |
| §16 Q1-Q6 resolved + Q1 amended 2026-05-12 for ota.* subdomain | ✅ | n/a | n/a | n/a |

### Phase 1 — Python OTA module (#363)

| Deliverable | Shipped | Tested | Prod live | Smoke verified |
|---|---|---|---|---|
| `backend/python/ota/{__init__,config,models}.py` | ✅ | (covered via integration) | ✅ imports OK on 47 venv38 | ✅ `curl http://localhost:8083/api/ota/health` returns 200 from server-internal |
| `backend/python/ota/services/{storage,signing,manifest_builder,multipart,directives}.py` | ✅ | 35 tests | ✅ all 5 importable in prod | ✅ health endpoint exercises load_private_key_cached |
| `backend/python/ota/api/endpoints.py` (6 endpoints: health/manifest/assets/admin{register,rollback,list}) | ✅ | 31 tests | ✅ router mounted via `main.py:app.include_router(prefix='/api/ota')` (#364) | ✅ /health 200, /manifest 400 w/o headers (expected) |
| Test count: 49 → 92 (chat2 audit C1+C2+ImpA-C+def D-E) → 96 (D/E/F sweep) | ✅ | ✅ all GREEN | n/a | n/a |

### Phase 2 — X.509 cert + .env.ota + systemd integration (#363)

| Deliverable | Shipped | Tested | Prod live | Smoke verified |
|---|---|---|---|---|
| `frontend/CretasFoodTrace/ota_cert.pem` (X.509 self-signed, RSA-2048, valid 2026-05-11 → 2031-05-10) | ✅ | n/a | n/a (bundled into APK when built) | n/a until Phase 5 |
| `scripts/ota/.env.ota.template` (placeholder + ops comment) | ✅ | n/a | ✅ template referenced; real `.env.ota` on 47 chmod 600 root:root | ✅ `grep OTA_HOSTNAME` returns expected key |
| `scripts/ota/install-systemd-env-ota.sh` (adds `EnvironmentFile=.env.ota` to cretas-python.service) | ✅ | bash -n OK | ✅ **ran on 47** — `/etc/systemd/system/cretas-python.service` now has `EnvironmentFile=/www/wwwroot/cretas/.env.ota` | ✅ Python service picks up OTA_* env vars |
| `/www/wwwroot/cretas/ota/{ota_private.pem,ota_public.pem,ota_cert.pem}` chmod 600 root:root for private | n/a (server-only) | n/a | ✅ all 3 files present, private key 0600 | ✅ signing.load_private_key_cached works |
| `/www/wwwroot/ota/updates/` bundle storage root | n/a | n/a | ✅ created, empty (no bundle pushed yet) | n/a |

### Router register (#364)

| Deliverable | Shipped | Tested | Prod live | Smoke verified |
|---|---|---|---|---|
| `backend/python/main.py` adds `app.include_router(ota_endpoints.router, prefix='/api/ota')` | ✅ | (covered by health response) | ✅ | ✅ /api/ota/health resolves through main.py routing |

### Phase 3 — Operator scripts (#373)

| Deliverable | Shipped | Tested | Prod live | Smoke verified |
|---|---|---|---|---|
| `scripts/ota/push-bundle.sh` (`expo export` + tar/scp + atomic mv + POST /admin/register) | ✅ | bash -n + arg validation tests | ✅ in repo | ❌ **never run against prod** |
| `scripts/ota/rollback.sh` | ✅ | bash -n + path-traversal rejection tests | ✅ in repo | ❌ **never run against prod** |
| `scripts/ota/prune-bundles.sh` (rolling N=10) | ✅ | bash -n + arg validation tests | ✅ in repo | ❌ **never run against prod** |
| `scripts/ota/README.md` (operator quick-ref) | ✅ | n/a | n/a | n/a |
| `backend/python/ota/tests/test_scripts.py` (12 tests: syntax / regex consistency / arg validation) | ✅ | ✅ 12 GREEN | n/a | n/a |

### P0 fix (#375)

| Deliverable | Shipped | Tested | Prod live | Smoke verified |
|---|---|---|---|---|
| `backend/python/requirements.txt` `cryptography>=42.0.0` | ✅ | n/a | ✅ `cryptography 47.0.0` in venv38 | ✅ ota.services.signing imports successfully |
| `backend/python/auth_middleware.py` `PUBLIC_PREFIXES += "/api/ota/"` | ✅ | 5 JWT exempt tests | ✅ verified by `grep` in prod source tree | ✅ /api/ota/health 200 without JWT |
| `backend/python/tests/test_imports.py` (3 tests) | ✅ | ✅ all GREEN | n/a | n/a |
| `backend/python/ota/tests/test_ota_jwt_exempt.py` (5 tests) | ✅ | ✅ all GREEN | n/a | n/a |
| `scripts/deploy/deploy-smartbi-python.sh` pre-restart `python -c 'import main'` smoke gate | ✅ | n/a | ✅ in repo, used on most-recent deploy | ⚠️ **deploy that triggered P0 fix did NOT run the gate** (gate was part of the same PR; first effective deploy was the re-deploy where Steve `git pull` first) |

### Phase 4 — Nginx subdomain (#380)

| Deliverable | Shipped | Tested | Prod live | Smoke verified |
|---|---|---|---|---|
| DNS A record `ota.cretaceousfuture.com → 139.196.165.140` | n/a (DNS) | n/a | ✅ account C alidns, RecordId 2053952913076417536 | ✅ Python aliyunsdk-alidns AddDomainRecord returned OK |
| Let's Encrypt ECC cert via acme.sh DNS-01 | n/a | n/a | ✅ `/www/server/panel/vhost/cert/ota.cretaceousfuture.com.{pem,key}` installed 2026-05-12 | ✅ openssl x509 valid 2026-05-11 → 2026-08-09 |
| acme.sh auto-renew cron registered | n/a | n/a | ✅ inside `/root/.acme.sh/` (verified at acquisition time) | ⏳ next renewal trigger ~Jul 10 |
| `nginx/ota.cretaceousfuture.com.conf` (independent vhost: 80→443 + 443 SSL + `/api/ota/` proxy w/ inline directives) | ✅ | nginx -t passed via remote dry-run | ❌ **NOT installed on 139** — only the prefix-0 logging-formats `0.site_total_log_format.conf` is present in `/www/server/panel/vhost/nginx/` | ❌ external `https://ota.cretaceousfuture.com/api/ota/health` returns HTTP 000 (no nginx vhost serving it) |
| `scripts/ota/install-nginx-ota.sh` (idempotent installer + nginx -t + reload + external health probe + `OTA_HOSTNAME` flip command print) | ✅ | bash -n OK | ✅ in repo | ❌ **never executed** |

**This is the BLOCKER.** Phase 4 cert/DNS are LIVE but the vhost install command was never run.

### Phase 5 — Build runbook + app.json (#381)

| Deliverable | Shipped | Tested | Prod live | Smoke verified |
|---|---|---|---|---|
| `docs/runbooks/2026-05-12-self-hosted-ota-build-runbook.md` (10 sections incl. keystore gen, gradle config, aapt verify, customer distribution caveats) | ✅ | n/a | n/a (doc) | n/a |
| `frontend/CretasFoodTrace/app.json` `updates.url` → `https://ota.cretaceousfuture.com/api/ota/manifest` + `codeSigningCertificate` + `codeSigningMetadata` + `requestHeaders.expo-channel-name` | ✅ | JSON validity verified pre-merge | n/a (forward-looking — affects future APK builds, not existing customer APKs) | n/a until next APK build |
| `extra.eas` removed, `extra.router={}` placeholder kept | ✅ | n/a | n/a | n/a |

### Phase 6 — E2E smoke + emulator runbook (#382)

| Deliverable | Shipped | Tested | Prod live | Smoke verified |
|---|---|---|---|---|
| `scripts/ota/smoke-e2e.sh` (6 assertions in ~10s, safe against prod using dedicated rv=0.0.0-smoke + channel=staging) | ✅ | bash -n OK | ✅ in repo | ❌ **never executed against prod** |
| `backend/python/ota/tests/test_full_cycle_e2e.py` (3 tests: full happy-path + rollback + URL self-consistency) | ✅ | ✅ 3 GREEN | n/a | n/a |
| `docs/runbooks/2026-05-12-self-hosted-ota-emulator-demo-runbook.md` (6-step acceptance demo incl. server-side smoke → APK build → install → push → observe pickup → rollback drill) | ✅ | n/a | n/a (doc) | n/a |

### P0 follow-up (Steve organizer-side, retro)

| Item | Status |
|---|---|
| 2026-05-11 17:55 Wave 5 stale-deploy incident (local main 5 commits behind origin/main → first deploy shipped pre-#375 Python, `/api/ota/health` 401) | Recovered via `git pull` + re-deploy. Recorded in `feedback_organizer_must_git_pull_before_deploy.md ## Incidents`. |
| Pre-check rule existed (`scripts/deploy/deploy-smartbi-python.sh [0/4] Git sync pre-check`) | Existed, but warn-able. Operator missed/overrode warning. Memory note flags this as **enforcement gap** vs **rule gap**. |

---

## Gap table — sorted by severity

| # | Severity | Gap | Owner | Action |
|---|---|---|---|---|
| 1 | 🔴 BLOCKER | Phase 4 install-nginx-ota.sh 没在 139 跑过,vhost conf 不存在 | Steve | `./scripts/ota/install-nginx-ota.sh` from repo root (idempotent + scp + nginx -t auto-rollback + reload + external probe) |
| 2 | 🟡 cascading | `.env.ota:OTA_HOSTNAME` 仍 IP direct,manifest emit 的 asset URL 客户端不可达 | Steve | install 脚本完成时**自动打印**一键 sed 命令(see `scripts/ota/install-nginx-ota.sh` line 86-94) |
| 3 | 🟢 ops backlog | push-bundle.sh / rollback.sh / prune-bundles.sh 从未对 prod 跑过 | chat5 (Track A) | `bash scripts/ota/smoke-e2e.sh` 验证 6 个 assertion — 同时覆盖 push (synthetic) + 不直接覆盖 rollback/prune,但 emulator runbook §6 涵盖 rollback |
| 4 | 🟢 ops backlog | Phase 6 smoke-e2e.sh 从未对 prod 真跑 | chat5 (Track A) | 等 Steve 跑完 #1 + #2 触发 |
| 5 | 🟢 future | APK 还没构建 + 客户没 cutover | Steve (per spec §16 Q6) | Phase 5 runbook §1-§6 顺序执行 |
| 6 | ⚠ tech debt (separate concern) | Python 3.8 EOL, cryptography 47.0.0 已警告下个版本不支持 3.8 | future ticket | venv38 → venv311 升级 — 不阻塞 OTA |
| 7 | ⚠ rule enforcement | git-pull pre-check 当前 warn-only,operator 可绕开 | governance | 考虑改 main-branch deploy 为 hard-block (per `feedback_organizer_must_git_pull_before_deploy.md ## Incidents` 末段的 mitigation idea) |

---

## Server-side state evidence (collected 2026-05-12)

### Server 47 (Python + filesystem)

```
$ ssh root@47.100.235.168 'systemctl is-active cretas-python'
active

$ grep ^EnvironmentFile /etc/systemd/system/cretas-python.service
EnvironmentFile=/www/wwwroot/cretas/.env.prod
EnvironmentFile=/www/wwwroot/cretas/.env.ota

$ ls -la /www/wwwroot/cretas/ota/
-rw-r--r--  1 root root 1261 May 12 04:01 ota_cert.pem
-rw-------  1 root root 1675 May 12 04:01 ota_private.pem
-rw-r--r--  1 root root  451 May 12 04:01 ota_public.pem

$ sed 's|\(OTA_ADMIN_TOKEN=\).*|\1[REDACTED]|' /www/wwwroot/cretas/.env.ota
OTA_BASE_PATH=/www/wwwroot/ota
OTA_PRIVATE_KEY_PATH=/www/wwwroot/cretas/ota/ota_private.pem
OTA_ADMIN_TOKEN=[REDACTED]
OTA_HOSTNAME=http://47.100.235.168:8083    ← still IP-direct, flip pending
OTA_DEFAULT_CHANNEL=production

$ curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8083/api/ota/health
200    ← server-internal direct works

$ python -c "from ota.services import signing, storage, manifest_builder, multipart, directives; from ota.api import endpoints; import cryptography; print(cryptography.__version__)"
47.0.0    ← (with Python 3.8 deprecation warning — tech debt note #6)

$ grep '/api/ota/' /www/wwwroot/cretas/code/backend/python/auth_middleware.py
"/api/ota/",    ← JWT exempt LIVE per PR #375
```

### Server 139 (nginx gateway)

```
$ ls /www/server/panel/vhost/nginx/ | grep -i ota
0.site_total_log_format.conf    ← prefix-0 logging include, NOT the OTA vhost
                                  (NO ota.cretaceousfuture.com.conf present)

$ ls -la /www/server/panel/vhost/cert/ota.cretaceousfuture.com.*
-rw-------  227 May 12 05:39 .key
-rw-r--r-- 2881 May 12 05:39 .pem    ← cert + key installed, but no vhost to use them

$ systemctl is-active nginx
active

$ curl -s -m 10 -w 'HTTP %{http_code}\n' https://ota.cretaceousfuture.com/api/ota/health
HTTP 000    ← TLS handshake doesn't even start (no server block listening on ota.*)
```

---

## Track A trigger checklist

After Steve runs steps 1+2 below, Track A E2E becomes executable.

- [ ] **Step 1**: From repo root,`./scripts/ota/install-nginx-ota.sh`
  - Expected: scp vhost + nginx -t + reload + external probe → HTTP 200 + script prints the OTA_HOSTNAME flip command
- [ ] **Step 2**: Copy-paste the printed command:
  ```bash
  ssh root@47.100.235.168 "sed -i \
    's|^OTA_HOSTNAME=.*|OTA_HOSTNAME=https://ota.cretaceousfuture.com|' \
    /www/wwwroot/cretas/.env.ota && systemctl restart cretas-python"
  ```
- [ ] **Step 3**: Verify external probe `curl https://ota.cretaceousfuture.com/api/ota/health` returns 200 with `{"status":"ok","privateKeyLoaded":true,"writable":true}`

When these 3 boxes are checked, ping chat5 for Track A E2E run.

---

## Track A scope (deferred until trigger)

Once trigger checklist above is green, chat5 runs:

1. **`scripts/ota/smoke-e2e.sh`** — 6 assertions, ~10s. Tests: health / synthesize bundle / scp / register / manifest fetch / asset fetch / no-update directive. Auto-cleans on exit.

2. **Android emulator E2E** (per `docs/runbooks/2026-05-12-self-hosted-ota-emulator-demo-runbook.md`):
   - Build APK locally (Phase 5 runbook §3)
   - `aapt` verify ENABLED=true + URL=ota.cretaceousfuture.com + cert (Phase 5 §4)
   - Install on emulator, watch `adb logcat -s expo-updates:V`
   - First-launch trace: `noUpdateAvailable` signature-verified
   - Push visible JS change via `./scripts/ota/push-bundle.sh production android`
   - Background + foreground app → logcat shows download + apply
   - Force-close + re-launch → visible change LIVE on device
   - **Rollback drill**: `./scripts/ota/rollback.sh` → device reverts to baked bundle

3. **Production push/rollback/prune actual exercise** (concurrent with #2):
   - Tested via emulator E2E above (steps 6 covers push, step 9 covers rollback)
   - `prune-bundles.sh` standalone test — push 11+ synthetic bundles via smoke-e2e (modified) → run prune N=10 → verify oldest removed

4. **Report**: ALL GREEN OR P0 bugs filed.

---

## Acceptance for Track B (this audit)

- [x] Phase 0-6 deliverables enumerated
- [x] Each deliverable status assessed across Shipped / Tested / Prod live / Smoke verified
- [x] Gaps identified with severity + owner + action
- [x] Server-side evidence captured verbatim
- [x] Track A trigger checklist defined

---

## References

- Spec: `docs/superpowers/specs/2026-05-11-self-hosted-ota-spec.md`
- Phase 5 build runbook: `docs/runbooks/2026-05-12-self-hosted-ota-build-runbook.md`
- Phase 6 emulator demo runbook: `docs/runbooks/2026-05-12-self-hosted-ota-emulator-demo-runbook.md`
- PRs: #363 (Phase 0+1+2), #364 (router register), #373 (Phase 3 scripts), #375 (P0 fix), #380 (Phase 4 nginx), #381 (Phase 5 build runbook), #382 (Phase 6 emulator)
- Memory rules: `feedback_immutable_client_url_dedicated_subdomain.md` (HARD, 2026-05-12), `feedback_organizer_must_git_pull_before_deploy.md ## Incidents` (May-11 stale-deploy log)
