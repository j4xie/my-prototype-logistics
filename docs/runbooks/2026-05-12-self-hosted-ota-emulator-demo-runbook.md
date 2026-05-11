# Self-Hosted OTA — Emulator E2E Demo Runbook

**Date:** 2026-05-12
**Phase:** 6 of the self-hosted OTA roadmap ([spec §14 acceptance Phase 6](../superpowers/specs/2026-05-11-self-hosted-ota-spec.md))
**Audience:** Steve (acceptance demo BEFORE customer rollout)

This is the proof-of-life demo that validates the entire self-hosted OTA
pipeline end-to-end on an Android emulator, before WeChat-distributing the
APK to F006 / customers. ~15 minutes if all prerequisites are met.

---

## Prerequisites

- [ ] **All OTA PRs merged**: #363 (server), #364 (router register), #373 (scripts), #375 (P0 fix + JWT exempt), #380 (nginx), #381 (build runbook + app.json), and this PR (#382-ish)
- [ ] **Server-side cutover done** (per Phase 5 runbook merge ordering §)
  - cretas-python redeployed with `cryptography` in requirements
  - nginx `/api/ota/` location LIVE on 139 — `curl https://ota.cretaceousfuture.com/api/ota/health` → 200
  - `OTA_HOSTNAME=https://ota.cretaceousfuture.com` in `/www/wwwroot/cretas/.env.ota`
- [ ] **Local toolchain ready** per Phase 5 runbook §0 (Android Studio, JDK 21, SDK 34, keytool)
- [ ] **Signing keystore generated** per Phase 5 runbook §1 (one-time, with backups)
- [ ] **OTA_ADMIN_TOKEN sourced** in your shell (from `~/.ota-env`)

---

## Step 1: Server-side smoke (~30s)

Before touching the device, confirm the server pipeline works from your laptop:

```bash
./scripts/ota/smoke-e2e.sh
```

Expected output:
```
=== Phase 6 E2E smoke — rv=0.0.0-smoke channel=staging ts=<millis> ===
[smoke] 0/6 /api/ota/health
  PASS — {"status":"ok","privateKeyLoaded":true,"writable":true}
[smoke] 1/6 synthesizing test bundle
[smoke] 2/6 uploading to root@47.100.235.168:/www/wwwroot/ota/updates/...
[smoke] 3/6 POST /api/ota/admin/register
  PASS
[smoke] 4/6 GET /api/ota/manifest
  PASS — id=<uuid>
[smoke] 5/6 GET /api/ota/assets (binary fetch)
  PASS
[smoke] 6/6 GET /api/ota/manifest (with current-update-id=<uuid>)
  PASS
=== ALL 6 ASSERTIONS GREEN — Phase 6 E2E smoke COMPLETE ===
```

If any step fails, stop — Phase 6 emulator demo cannot succeed if the
server-side pipeline doesn't pass first. The smoke script self-cleans
its test bundle on exit.

---

## Step 2: Build the APK following Phase 5 runbook (~5 min)

```bash
cd frontend/CretasFoodTrace
npx expo prebuild --platform android --clean
cd android
./gradlew clean assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

Verify expo-updates wired in (per Phase 5 §4):
```bash
aapt dump xmltree android/app/build/outputs/apk/release/app-release.apk AndroidManifest.xml | grep expo.modules.updates
# Must see ENABLED=true + URL = https://ota.cretaceousfuture.com/api/ota/manifest
```

---

## Step 3: Launch emulator + install APK (~2 min)

```bash
$ANDROID_HOME/emulator/emulator -avd Pixel_7_API_34 -no-snapshot-load &
sleep 30   # wait for boot

# Verify device visible
adb devices
# emulator-5554   device

adb install android/app/build/outputs/apk/release/app-release.apk

# Open the app
adb shell am start -n com.cretas.foodtrace/.MainActivity
```

In a second terminal, start watching expo-updates logs:
```bash
adb logcat -v time -s expo-updates:V expo-modules:V
```

Expected first-launch trace:
```
expo-updates: Checking for update at https://ota.cretaceousfuture.com/api/ota/manifest
expo-updates: Verifying response signature with keyid=main alg=rsa-v1_5-sha256
expo-updates: No update available (server returned noUpdateAvailable directive)
```

The signature-verify line is the key proof that the X.509 cert in the APK
+ the RSA private key on server 47 match. If you see
`signature verification failed`, the cert in `frontend/CretasFoodTrace/ota_cert.pem`
does NOT match the private key at `/www/wwwroot/cretas/ota/ota_private.pem`
— **stop, do not distribute**.

---

## Step 4: Push a visible OTA change (~2 min)

In the dev laptop terminal:

```bash
# Make a visible JS-only change — e.g. tweak a button color or title text.
# Then:
cd /c/Users/Steve/my-prototype-logistics  # repo root
./scripts/ota/push-bundle.sh production android
# expect: bundle live: rv=1.0.0 channel=production ts=<millis>
```

---

## Step 5: Observe the device pick up the OTA (~30s)

On the emulator:

1. Background the app: `adb shell input keyevent KEYCODE_HOME`
2. Bring it back: `adb shell am start -n com.cretas.foodtrace/.MainActivity`

Logcat should now show:
```
expo-updates: Update available: <id>
expo-updates: Verifying response signature ... OK
expo-updates: Downloaded 1 asset
expo-updates: Update ready, applying on next launch
```

3. Force-close the app: `adb shell am force-stop com.cretas.foodtrace`
4. Re-launch: `adb shell am start -n com.cretas.foodtrace/.MainActivity`

**The visible JS-only change you pushed in Step 4 should now be live on
the device — no reinstall.** That's the entire proof.

---

## Step 6: Rollback drill (~1 min)

Validate the rollback path too — important before customer cutover:

```bash
# Get the timestamp of the bundle we just pushed:
curl -s -H "Authorization: Bearer $OTA_ADMIN_TOKEN" \
     "https://ota.cretaceousfuture.com/api/ota/admin/list?runtimeVersion=1.0.0&channel=production" | jq

# Roll back the newest entry:
./scripts/ota/rollback.sh 1.0.0 production <newest-timestamp>
```

On the emulator, background + foreground the app again. Logcat:
```
expo-updates: Server returned rollBackToEmbedded directive
expo-updates: Reverting to embedded bundle
```

Force-close + re-launch → the device is now showing the APK-baked JS, NOT
the bundle you pushed in Step 4. **That's the rollback proof.**

To resume normal OTA delivery, re-push the bundle:
```bash
./scripts/ota/push-bundle.sh production android
```

---

## Acceptance checklist

If all of these are GREEN, Phase 6 is complete and customer cutover (§6 of
the build runbook) can proceed.

- [ ] Step 1 server-side smoke: 6/6 GREEN
- [ ] Step 2 APK built; `aapt` shows ENABLED=true + correct URL + cert
- [ ] Step 3 APK installs cleanly + first-launch logcat shows
      `noUpdateAvailable` signature-verified
- [ ] Step 4 push-bundle.sh exits 0
- [ ] Step 5 device-side log shows download + apply; visible JS change
      visible after force-close + re-launch
- [ ] Step 6 rollback drill: device reverts to embedded bundle; re-push
      restores OTA delivery

---

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `curl /api/ota/health` returns 401 | JWT middleware not exempted | PR #375 not merged or Python not redeployed |
| `curl /api/ota/health` returns 404 | nginx location not installed | run `./scripts/ota/install-nginx-ota.sh` |
| `signature verification failed` on device | cert in APK ≠ key on server | re-build APK with current `frontend/CretasFoodTrace/ota_cert.pem` |
| `expo-updates: Manifest fetch error` (DNS) | `ota.cretaceousfuture.com` not resolving | confirm DNS A record on aliyun account C points at 139.196.165.140 |
| `unable to verify the first certificate` | TLS cert chain broken on 139 | `openssl s_client -connect ota.cretaceousfuture.com:443 -showcerts` |
| device sees old JS after push + relaunch | runtimeVersion mismatch | check app.json `expo.version` vs the runtimeVersion in `push-bundle.sh` output |
| smoke-e2e.sh fails step 5 (asset fetch) | URL-encoding drift | run `pytest backend/python/ota/tests/test_full_cycle_e2e.py` — that catches the drift in CI |

---

## What this runbook does NOT cover

- iOS device builds — Android-only customer base
- Multi-device customer cutover orchestration — that's a Steve-manual WeChat
  rollout (Phase 5 build runbook §6) not a chat5 deliverable
- Cron-scheduled prune-bundles.sh — ops choice (recommend weekly)
- HTTPS cert renewal on 139 — existing cert already provisioned

---

## References

- [Self-hosted OTA spec](../superpowers/specs/2026-05-11-self-hosted-ota-spec.md) §14 Phase 6 acceptance
- [Build runbook](2026-05-12-self-hosted-ota-build-runbook.md) Phase 5
- [`scripts/ota/README.md`](../../scripts/ota/README.md) — push/rollback/prune operator scripts
