# OTA Track A E2E — Prod Verification Results

**Date**: 2026-05-12
**Operator**: organizer (chat-A, worktree `qa/ota-track-a-e2e`)
**Scope**: smoke-e2e.sh + push-bundle.sh + rollback.sh + prune-bundles.sh against prod (`https://ota.cretaceousfuture.com`)
**Pre-flight context**: Track A nginx install + `OTA_HOSTNAME` flip + cretas-python restart completed earlier today (organizer side). External probe already returned 200 + `privateKeyLoaded:true` post-flip.

---

## TL;DR

| Phase | Outcome | Notes |
|---|---|---|
| **A — smoke-e2e** | ✅ GREEN | All 6 marching-order assertions PASS. Script's internal 6 assertions also all PASS. |
| **B — push-bundle** | ✅ GREEN (with 2 bugs filed) | Push succeeded after working around 2 pre-existing bugs (BUG-1, BUG-2 below). End-state: manifest 200, all asset URLs use `ota.cretaceousfuture.com`. |
| **C — rollback + prune** | ✅ GREEN | rollback marker → `rollBackToEmbedded` directive emitted. prune --keep-last 3 correctly retained newest 3 of 5 bundles. |
| Optional Android emulator | ⏭️ Out of scope | No local Android emulator available; documented as **Phase 7 customer-rollout playbook scope**. |

**Two bugs found in `push-bundle.sh` that block Windows operators end-to-end** (no impact on Linux operators or on already-pushed prod bundles). Detailed below in §Findings.

---

## Pre-flight Verification

### TLS cert & hostname

```
subject=CN=ota.cretaceousfuture.com
issuer=C=US, O=Let's Encrypt, CN=E7
notBefore=May 11 20:41:09 2026 GMT
notAfter=Aug  9 20:41:08 2026 GMT
X509v3 Subject Alternative Name: DNS:ota.cretaceousfuture.com
```

Cert valid (Let's Encrypt ECC E7, expires Aug 9 2026), CN + SAN both match.

### Public health probe

```
GET https://ota.cretaceousfuture.com/api/ota/health
→ 200 OK
{"status":"ok","privateKeyLoaded":true,"writable":true}
```

### Direct IP backend probe (sanity)

```
GET http://47.100.235.168:8083/api/ota/health
→ Connection timed out
```

Expected per `.claude/rules/server-operations.md` — port 8083 SG tightened to `139.196.165.140/32`. All external traffic must traverse the nginx vhost on 139 → upstream 47:8083. ✅

---

## Phase A — `smoke-e2e.sh` (10 min)

### Command

```bash
OTA_ADMIN_TOKEN=<hex64> \
OTA_SERVER_API=https://ota.cretaceousfuture.com \
bash scripts/ota/smoke-e2e.sh
```

Override forces the script's API calls through the **public HTTPS vhost** rather than the default `http://47.100.235.168:8083`, giving an end-to-end test of nginx → upstream + cert + flipped hostname.

### Script-internal 6/6 PASS

```
[smoke] 0/6 /api/ota/health                                                 PASS
[smoke] 1/6 synthesizing test bundle                                        staged 1.0K
[smoke] 2/6 uploading to root@47.100.235.168:/www/wwwroot/ota/updates/...   ok
[smoke] 3/6 POST /api/ota/admin/register                                    PASS
[smoke] 4/6 GET /api/ota/manifest                                           PASS — id=1aa3688a-b06e-c485-7887-b328bf17b274
[smoke] 5/6 GET /api/ota/assets (binary fetch)                              PASS
[smoke] 6/6 GET /api/ota/manifest (with current-update-id)                  PASS — noUpdateAvailable
=== ALL 6 ASSERTIONS GREEN — Phase 6 E2E smoke COMPLETE ===
```

### Marching-order 6/6 PASS

| # | Assertion | Evidence | Result |
|---|---|---|---|
| 1 | `/api/ota/health` 200 + `privateKeyLoaded:true` | `evidence/ota-smoke-health.json` body `{"status":"ok","privateKeyLoaded":true,"writable":true}` | ✅ |
| 2 | `/api/ota/manifest` 200 + manifest has `id` + `assets[]` | `evidence/ota-smoke-manifest.bin` — `id=1aa3688a-b06e-c485-7887-b328bf17b274`, `assets:[{...}]` with one entry | ✅ |
| 3 | Asset URL returns 200 with right content-type | `evidence/ota-smoke-asset.bin` — body `marker-1778602773381` ✓ matches synthesized content | ✅ |
| 4 | Cert valid (HTTPS handshake OK) | Pre-flight openssl s_client output (above) | ✅ |
| 5 | Asset URL host = `ota.cretaceousfuture.com` (not IP) | Manifest body — both `assets[0].url` and `launchAsset.url` use `https://ota.cretaceousfuture.com/...` | ✅ |
| 6 | Other manifest-emitted URL consistency | Same host on both assets and launchAsset; no IP literals anywhere | ✅ |

### Sample of manifest body emitted by server (smoke run)

```json
"assets":[{
  "hash":"_dalJu7wdo_AXlcxlH84Hhird0OwD2Fj20Z2N7d_I1A",
  "key":"41ea69646ffd857dac84a4489df3a159",
  "fileExtension":".txt",
  "contentType":"text/plain",
  "url":"https://ota.cretaceousfuture.com/api/ota/assets?asset=updates%2F0.0.0-smoke%2Fstaging%2F1778602773381%2Fassets%2Fmarker.txt&runtimeVersion=0.0.0-smoke&platform=android"
}],
"launchAsset":{
  ...
  "url":"https://ota.cretaceousfuture.com/api/ota/assets?asset=updates%2F0.0.0-smoke%2Fstaging%2F1778602773381%2Fbundles%2Findex-smoke.hbc&runtimeVersion=0.0.0-smoke&platform=android"
}
```

Cleanup ran via the script's `trap`. Bundle dir under `0.0.0-smoke/staging` confirmed removed post-run.

---

## Phase B — `push-bundle.sh` (real prod push)

### Pre-condition issues (two pre-existing bugs)

Before push-bundle could even reach the OTA server, the local environment surfaced **two pre-existing codebase/script bugs** that block Windows operators from pushing OTA bundles end-to-end. Both documented as findings below (BUG-1, BUG-2). I worked around them transiently to complete Phase B verification.

#### BUG-1: `.gitignore temp*` collides with `Template*.tsx` on Windows

```
$ git check-ignore -v frontend/CretasFoodTrace/src/components/ai/TemplateCommandSheet.tsx
.gitignore:51:temp*	frontend/CretasFoodTrace/src/components/ai/TemplateCommandSheet.tsx
```

On Windows (case-insensitive filesystem, `core.ignoreCase=true`), the gitignore glob `temp*` matches **any path starting with `temp`/`Temp`/`TEMP`/etc.**, including:

- `frontend/CretasFoodTrace/src/components/ai/TemplateCommandSheet.tsx`
- `frontend/CretasFoodTrace/src/__tests__/unit/components/TemplateCommandSheet.test.ts`

These two files exist on the operator's local main worktree but are silently untracked. A fresh clone (e.g. CI, new dev box, this E2E worktree) will be **missing them entirely**, breaking `expo export` immediately:

```
Android Bundling failed
Error: Unable to resolve module ../../../components/ai/TemplateCommandSheet
  from src/screens/factory-admin/ai-analysis/AIChatScreen.tsx
```

The current `AIChatScreen.tsx` (committed on `main`) imports `TemplateCommandSheet`, so the codebase as it lives on `origin/main` **does not produce a buildable Expo export**.

The `.gitignore` already has explicit `!` overrides for `Template*.vue` (web-admin) but not for RN frontend. See `.gitignore:51-60`:

```gitignore
# 临时文件
tmp/
temp/
temp*
!backend/python/smartbi/shared/temporal_comparator.py
!backend/python/smartbi/services/restaurant/sections/temporal_comparison.py
...
!web-admin/src/views/smart-bi/components/Template*.vue
```

**Workaround applied**: I `cp`d both files from the main worktree into this worktree just long enough to run push-bundle, then removed them again so the audit worktree stays clean. Both files remain in `.gitignore` after this PR.

#### BUG-2: `npx expo export` on Windows writes backslashes into `metadata.json` asset paths

The first push run produced `metadata.json` with Windows-native path separators inside JSON string values:

```json
{"path":"assets\\778ffc9fe8773a878e9c30a6304784de","ext":"png"}
```

(After JSON parse: `assets\778ffc...` — backslash separator.)

On the Linux server, the OTA Python service tried to resolve these asset paths and returned:

```
GET /api/ota/manifest → 500 Internal Server Error
{"error":"Bundle metadata corrupted on server"}
```

I patched `metadata.json` server-side via `sed` (replacing backslashes with forward slashes) and re-fetched the manifest — it then returned 200 with all paths correctly resolved. Confirms the metadata content is structurally fine; only the path-separator encoding is wrong.

**Root cause**: Metro bundler / `expo export` on Windows uses `path.join()` (native separator) when serializing `assets[].path` in `metadata.json`. The OTA server expects forward slashes per Expo spec.

**Recommended fix**: After step 2 in `push-bundle.sh` (after `expo config --json`), normalize `metadata.json` before the tar/scp step:

```bash
# Normalize Windows path separators in metadata.json (mirrors Linux output)
if [[ -f frontend/CretasFoodTrace/dist/metadata.json ]]; then
    python3 -c "import json,sys; p='frontend/CretasFoodTrace/dist/metadata.json';
d=json.load(open(p));
def fix(x):
    if isinstance(x,dict): return {k:fix(v) for k,v in x.items()}
    if isinstance(x,list): return [fix(v) for v in x]
    if isinstance(x,str): return x.replace('\\\\','/')
    return x
json.dump(fix(d),open(p,'w'),separators=(',',':'),ensure_ascii=False)"
fi
```

(Equivalent inline `sed` works too but JSON-aware normalization is safer.) Server-side defense-in-depth would also help — see open-question §F-1.

### Push command + result

```bash
OTA_ADMIN_TOKEN=<hex64> \
OTA_SERVER_API=https://ota.cretaceousfuture.com \
bash scripts/ota/push-bundle.sh production android
```

After workaround for BUG-1:

```
[push-bundle] runtimeVersion=1.0.0 channel=production platform=android timestamp=1778603319107
[push-bundle] 1/5 npx expo export --platform android
  → Android Bundling complete (2887 modules)
[push-bundle] 2/5 npx expo config --json > dist/expoConfig.json
[push-bundle] 3/5 packaging /tmp/ota-bundle-1778603319107.tar.gz
[push-bundle] 4/5 uploading + atomic-extracting to root@47.100.235.168:/www/wwwroot/ota/updates/1.0.0/production/1778603319107
[push-bundle] 5/5 POST https://ota.cretaceousfuture.com/api/ota/admin/register
[push-bundle] ✓ bundle live: rv=1.0.0 channel=production ts=1778603319107
```

Bundle dir on server: 19 MB, contains `metadata.json`, `expoConfig.json`, `assets/`, `_expo/`, `index.html`.

### Verification before/after

**Before** (no bundles on prod):

```
GET /api/ota/admin/list?runtimeVersion=1.0.0&channel=production
→ {"bundles":[]}

GET /api/ota/manifest (with rv=1.0.0 channel=production headers)
→ 404 {"error":"No bundle for runtime_version='1.0.0' channel='production'"}
```

**After push + BUG-2 server-side metadata patch**:

```
GET /api/ota/admin/list?runtimeVersion=1.0.0&channel=production
→ {"bundles":[{"timestamp":"1778603319107","isRollback":false}]}

GET /api/ota/manifest
→ 200 multipart/mixed (16143 bytes)
  manifest.id = 696a94de-9cce-498c-a104-786a68651362
  assets[]: 40 entries (PNG sprites + TTF fonts) — all URLs use https://ota.cretaceousfuture.com/api/ota/assets?...
  launchAsset.url: https://ota.cretaceousfuture.com/api/ota/assets?asset=updates%2F1.0.0%2Fproduction%2F1778603319107%2F_expo%2Fstatic%2Fjs%2Fandroid%2Findex-0f63d5fa0f223a6054277185af6c069a.hbc&runtimeVersion=1.0.0&platform=android

GET <launchAsset.url>
→ 200 application/octet-stream, 14.7 MB Hermes JavaScript bytecode (file confirms "Hermes JavaScript bytecode, version 96")

GET <sample assets[i].url>
→ 200 application/octet-stream, real PNG bytes
```

Evidence: `evidence/phase-b-before.txt`, `evidence/phase-b-after.txt`, `evidence/phase-b-manifest.bin`, `evidence/phase-b-push.log`.

### Phase B acceptance

| Criterion | Result |
|---|---|
| New bundle uploaded to 47 OTA store | ✅ `/www/wwwroot/ota/updates/1.0.0/production/1778603319107/` (19 MB, 2887 modules) |
| `/api/ota/manifest` returns the new bundle ID | ✅ `696a94de-9cce-498c-a104-786a68651362` |
| Asset URLs still point to `ota.cretaceousfuture.com` | ✅ All 41 URLs (40 assets + 1 launchAsset) use the public hostname |
| Manifest before/after snapshots captured | ✅ See `evidence/` |

**Caveat**: BUG-2 required a one-shot server-side `sed` patch on `metadata.json` to make the manifest readable. Until BUG-2 is fixed in `push-bundle.sh`, every Windows-operator push will produce a broken bundle that needs the same manual patch. Treat Phase B as "works with intervention from Windows; needs verification from Linux operator OR push-bundle.sh patch before production-ready for Windows."

---

## Phase C — rollback + prune

### C-1: Rollback

```bash
OTA_ADMIN_TOKEN=<hex64> \
OTA_SERVER_API=https://ota.cretaceousfuture.com \
bash scripts/ota/rollback.sh 1.0.0 production 1778603319107
```

```
[rollback] ✓ marker set: rv=1.0.0 channel=production ts=1778603319107
[rollback]   next client poll → rollBackToEmbedded directive → device reverts to baked bundle
```

Manifest after rollback marker is in place — the server requires the `expo-embedded-update-id` header (per Expo OTA spec) to emit the rollback directive:

```
GET /api/ota/manifest
  -H "expo-embedded-update-id: 00000000-0000-0000-0000-000000000001"
→ 200 multipart/mixed
  Content-Disposition: form-data; name="directive"
  {"type":"rollBackToEmbedded","parameters":{"commitTime":"2026-05-12T16:37:58.720Z"}}
```

Evidence: `evidence/phase-c-rollback.log`, `evidence/phase-c-manifest-rollback.bin`.

✅ Rollback marker file created server-side; manifest emits `rollBackToEmbedded` directive with `commitTime` matching the marker file's mtime. Client devices will fall back to their embedded bundle on next poll.

Without the header, the server returns `400 {"error":"Rollback requires expo-embedded-update-id header"}` — this is correct per OTA spec (server can't issue rollback unless it knows which embedded version the client has).

### C-2: Prune

To verify pruning actually deletes bundles, I created 4 dummy historical timestamp dirs (older than the real `1778603319107`) so that prune --keep-last 3 would have something to remove. Dummies were empty `mkdir` + a `dummy.txt` marker.

```
Before prune (5 bundles, newest first):
  1778603319107  (real, rollback marker)
  1778603319106  (dummy)
  1778603319105  (dummy)
  1778603319100  (dummy)
  1778603319000  (dummy)
```

```bash
bash scripts/ota/prune-bundles.sh 1.0.0 production 3
```

```
[prune] found 5 bundles for 1.0.0/production; keeping newest 3
[prune] deleting /www/wwwroot/ota/updates/1.0.0/production/1778603319100
[prune] deleting /www/wwwroot/ota/updates/1.0.0/production/1778603319000
[prune] ✓ kept newest 3, removed 2
```

```
After prune (3 bundles):
  1778603319107
  1778603319106
  1778603319105
```

`admin/list` confirms — and the `isRollback:true` flag on the real bundle survived prune:

```json
{"bundles":[
  {"timestamp":"1778603319107","isRollback":true},
  {"timestamp":"1778603319106","isRollback":false},
  {"timestamp":"1778603319105","isRollback":false}
]}
```

Evidence: `evidence/phase-c-prune-before.txt`, `evidence/phase-c-prune-after.txt`, `evidence/phase-c-prune.log`.

✅ Prune correctly retained newest 3, removed 2 oldest. Rollback marker preserved.

**Post-cleanup**: I removed the 2 dummy bundles (`1778603319106`, `1778603319105`) since they were synthetic; only the real `1778603319107` (with `isRollback:true`) remains on prod. Steve can decide whether to delete that final bundle too — see open question §F-2.

---

## Optional — Android emulator demo

**Skipped.** No local Android Studio / emulator on this dev box. Recommend executing this as the first item of **Phase 7 customer-rollout playbook** with a real APK build:

1. Build APK from `main` with `eas build` or local Gradle.
2. Install on emulator/device.
3. First launch should hit `/api/ota/manifest` and download the production bundle.
4. Push a 2nd bundle with a string change → verify device picks it up on next app-foreground after polling.
5. Trigger rollback → verify device reverts to embedded.

Track this as a separate ticket; OTA infrastructure (Phases A/B/C) is verified independently.

---

## Findings & Follow-ups

### BUG-1 — Windows-case-insensitive gitignore misses `Template*.tsx` (P2)

**Owner**: frontend / repo hygiene
**Impact**: Codebase on `origin/main` does not produce a buildable Expo export from a clean Windows checkout. Affects any new dev box, CI, and OTA push-bundle.
**Files affected**:
- `frontend/CretasFoodTrace/src/components/ai/TemplateCommandSheet.tsx`
- `frontend/CretasFoodTrace/src/__tests__/unit/components/TemplateCommandSheet.test.ts`

**Recommended fix**: Add an explicit allow override to `.gitignore` and commit the 2 missing files:

```diff
 !backend/python/tests/test_template_status.py
+!frontend/CretasFoodTrace/src/components/ai/Template*.tsx
+!frontend/CretasFoodTrace/src/__tests__/unit/components/Template*.test.ts
```

Then `git add -f frontend/CretasFoodTrace/src/components/ai/TemplateCommandSheet.tsx` + the test file, and commit.

**Long-term**: Audit `.gitignore` for other broad-glob patterns (`temp*`, `tmp*`, `log*`, etc.) that could collide with intentional source files on case-insensitive filesystems. Consider narrowing to `temp*.log` / `temp*.txt` / similar.

### BUG-2 — `push-bundle.sh` emits Windows path separators in `metadata.json` (P1 for Windows operators)

**Owner**: OTA scripts
**Impact**: Every Windows-operator push currently produces an unreadable bundle on the server (500 "metadata corrupted") until manually patched. No impact on already-pushed Linux-operator bundles. No customer impact today (0 active customers).
**Fix**: Add a `metadata.json` normalization step in `scripts/ota/push-bundle.sh` between steps 2 and 3 (after `expo config --json`, before tar). See suggested snippet in §Phase B above.

**Defense-in-depth (optional)**: server-side `backend/python/ota/services/storage.py` (or wherever metadata.json is read) could `.replace("\\", "/")` paths when consuming them, catching this class of issue regardless of operator OS.

### Open question F-1 — Where in OTA backend does "Bundle metadata corrupted" originate?

I didn't dig into the Python OTA service code to find the exact site that emits `{"error":"Bundle metadata corrupted on server"}`. Worth pinning down for BUG-2 defense-in-depth — likely a path-validation regex that fails on backslash.

### Open question F-2 — Disposition of bundle `1778603319107`

After Phase B + C, prod has **one real bundle** with `isRollback:true` set:

```
/www/wwwroot/ota/updates/1.0.0/production/1778603319107/  (rollback marker)
```

Options for Steve:
- **Keep it**: serves as a known-good "anything-poll → rollBackToEmbedded" demo bundle. No customer impact (0 active customers).
- **Delete it**: clean slate before first real customer rollout. `rm -rf` the dir + skip rollback marker; first real `push-bundle.sh` from a Linux operator (or Windows w/ BUG-2 fixed) is then a fresh-state Phase 7 demo.

I left it in place pending decision.

### Operator UX nice-to-have

- `push-bundle.sh` could `chown -R cretas:cretas` on the server side after extraction (uploaded files are currently owned by UID 197609, the Windows operator's UID, with no name mapping). Cosmetic but mildly confusing in `ls -la`.

---

## Appendix — Commands run

```bash
# Worktree
git worktree add C:/Users/Steve/cretas-ota-track-a-e2e -b qa/ota-track-a-e2e origin/main

# Pre-flight
echo | openssl s_client -servername ota.cretaceousfuture.com -connect ota.cretaceousfuture.com:443 \
    | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
curl -sS https://ota.cretaceousfuture.com/api/ota/health
ssh root@47.100.235.168 "cat /www/wwwroot/cretas/.env.ota | grep ^OTA_"

# Phase A
OTA_ADMIN_TOKEN=<hex64> OTA_SERVER_API=https://ota.cretaceousfuture.com \
    bash scripts/ota/smoke-e2e.sh

# Phase B (after BUG-1 workaround: cp Template*.tsx from main worktree)
OTA_ADMIN_TOKEN=<hex64> OTA_SERVER_API=https://ota.cretaceousfuture.com \
    bash scripts/ota/push-bundle.sh production android
# BUG-2 workaround:
ssh root@47.100.235.168 'sed -i "s|\\\\\\\\|/|g" /www/wwwroot/ota/updates/1.0.0/production/1778603319107/metadata.json'

# Phase C-1
OTA_ADMIN_TOKEN=<hex64> OTA_SERVER_API=https://ota.cretaceousfuture.com \
    bash scripts/ota/rollback.sh 1.0.0 production 1778603319107

# Phase C-2 (after creating 4 dummy historical timestamps)
ssh root@47.100.235.168 "for ts in 1778603319000 1778603319100 1778603319105 1778603319106; do
    mkdir -p /www/wwwroot/ota/updates/1.0.0/production/\$ts; done"
bash scripts/ota/prune-bundles.sh 1.0.0 production 3

# Cleanup
ssh root@47.100.235.168 "rm -rf /www/wwwroot/ota/updates/1.0.0/production/{1778603319105,1778603319106}"
```

## Appendix — Evidence files

All under `evidence/`:

| File | Phase | Contents |
|---|---|---|
| `ota-smoke-health.json` | A | `/api/ota/health` JSON body |
| `ota-smoke-manifest.bin` | A | Full multipart manifest body (synthetic smoke bundle) |
| `ota-smoke-asset.bin` | A | Downloaded asset bytes (`marker-1778602773381`) |
| `ota-smoke-noupdate.bin` | A | manifest body for "no update" case |
| `ota-smoke-register.json` | A | admin/register response |
| `smoke-e2e.log.txt` | A | Full smoke-e2e.sh stdout (`.txt` suffix to bypass `*.log` gitignore) |
| `phase-b-before.txt` | B | admin/list + manifest 404 before push |
| `phase-b-push.log.txt` | B | push-bundle.sh full stdout |
| `phase-b-after.txt` | B | admin/list + manifest body sample + URL host check |
| `phase-b-manifest.bin` | B | Full 16k production manifest body |
| `phase-c-rollback.log.txt` | C | rollback.sh stdout |
| `phase-c-manifest-rollback.bin` | C | manifest body with `rollBackToEmbedded` directive |
| `phase-c-prune-before.txt` | C | admin/list with 5 bundles |
| `phase-c-prune.log.txt` | C | prune-bundles.sh stdout |
| `phase-c-prune-after.txt` | C | admin/list with 3 bundles post-prune |
