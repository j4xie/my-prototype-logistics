# Self-Hosted OTA — Local Android Build Runbook

**Date:** 2026-05-12
**Phase:** 5 of the self-hosted OTA roadmap ([spec §9](../superpowers/specs/2026-05-11-self-hosted-ota-spec.md))
**Audience:** Steve (one-time setup + per-release APK builds)

This runbook covers the **one-time APK rebuild** needed to cut customers over from the EAS-placeholder URL to the self-hosted OTA endpoint. After this build is distributed, every future JS-only fix ships via `scripts/ota/push-bundle.sh` (no rebuild).

---

## 0. Prerequisites checklist

Run through these before starting. Missing any one of them will fail the build at an awkward step.

- [ ] **Android Studio** installed, opened at least once (initializes SDK manager)
- [ ] **Android SDK Platform 34** installed via SDK manager
- [ ] **Android Build Tools 34.0.0** installed
- [ ] **JDK 21** at `C:/Program Files/Zulu/zulu-21` (already on this machine per memory)
- [ ] **`ANDROID_HOME`** env var set to SDK location (e.g. `C:\Users\Steve\AppData\Local\Android\Sdk`)
- [ ] **`keytool`** from JDK 21 on `PATH` — `keytool -help` must work
- [ ] **Node 18+** + `npx expo --version` works in `frontend/CretasFoodTrace/`
- [ ] **PRs #363 / #364 / #373 / #375 / #380 + this PR's `app.json` change all merged**
- [ ] **Server-side OTA stack live**: `curl https://ota.cretaceousfuture.com/api/ota/health` returns 200

---

## 1. One-time keystore generation

A signing keystore is required to produce release-mode APKs. **Generate ONCE, save the passwords forever** — losing them means customers cannot upgrade via Play Store / sideload because mismatched signing certs reject the install.

```bash
mkdir -p ~/.android-keystores
keytool -genkeypair -v \
  -keystore ~/.android-keystores/cretas.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias cretas \
  -storepass "$(openssl rand -hex 16)" \
  -keypass "$(openssl rand -hex 16)" \
  -dname "CN=Cretas Food Trace, O=Cretaceous Future, L=Shanghai, C=CN"
```

**Save both random passwords** (storepass + keypass) to a password manager. They're needed for every release build.

> ⚠ The keystore file (`cretas.keystore`) is the **single most critical artifact** in the entire mobile delivery pipeline. Back it up to encrypted cloud storage AND a USB drive AND a printout in a safe. Losing it means every customer has to uninstall + reinstall a brand-new APK signed with a fresh key — there's no recovery path.

---

## 2. Local `gradle.properties` (NOT committed)

Edit `frontend/CretasFoodTrace/android/gradle.properties` and add:

```properties
CRETAS_UPLOAD_STORE_FILE=/Users/Steve/.android-keystores/cretas.keystore
CRETAS_UPLOAD_KEY_ALIAS=cretas
CRETAS_UPLOAD_STORE_PASSWORD=<storepass from your password manager>
CRETAS_UPLOAD_KEY_PASSWORD=<keypass from your password manager>
```

This file is in `frontend/CretasFoodTrace/.gitignore` (or should be — verify before committing other gradle changes).

---

## 3. Build the APK

```bash
cd frontend/CretasFoodTrace
npx expo prebuild --platform android --clean   # regenerates android/ from app.json
cd android
./gradlew clean
./gradlew assembleRelease
```

**Output:** `android/app/build/outputs/apk/release/app-release.apk` (~30-60 MB).

### Windows path-length workaround

Per memory `setup-apk-build-windows.md`: CMake has a 250-char path limit. The worktree path `.worktrees/<task>/frontend/CretasFoodTrace/android/app/.cxx/...` can exceed it. If gradle fails with path errors, set in `android/app/build.gradle`:

```gradle
android {
    buildStagingDirectory = file("C:/b/cretas-ota")
}
```

(Reset CMake cache after: `cd android && ./gradlew clean`.)

---

## 4. Verify `expo-updates` is enabled in the built APK

After build, inspect the merged manifest:

```bash
# Windows
"$ANDROID_HOME/build-tools/34.0.0/aapt.exe" dump xmltree android/app/build/outputs/apk/release/app-release.apk AndroidManifest.xml | grep expo.modules.updates
```

You should see:

```
A: android:name(0x01010003)="expo.modules.updates.ENABLED" (Raw: "expo.modules.updates.ENABLED")
A: android:value(0x01010024)="true" (Raw: "true")

A: android:name(0x01010003)="expo.modules.updates.EXPO_RUNTIME_VERSION"
A: android:value(0x01010024)="1.0.0"

A: android:name(0x01010003)="expo.modules.updates.EXPO_UPDATE_URL"
A: android:value(0x01010024)="https://ota.cretaceousfuture.com/api/ota/manifest"

A: android:name(0x01010003)="expo.modules.updates.EXPO_UPDATES_CODE_SIGNING_CERTIFICATE"
A: android:value(0x01010024)="<the X.509 cert PEM contents>"
```

If `ENABLED=false`, `expo prebuild` did not flip the meta-data flag — investigate `frontend/CretasFoodTrace/app.json:expo.updates` (this PR's change should set it correctly).

If `EXPO_UPDATE_URL` is the old PLACEHOLDER value, you missed the `app.json` change from this PR — rebuild.

---

## 5. Test the APK on emulator BEFORE distributing

Before WeChat-ing the APK to customers, install on a clean Android emulator:

```bash
# Launch a fresh emulator (Android 14 / API 34 recommended)
$ANDROID_HOME/emulator/emulator -avd Pixel_7_API_34 -no-snapshot-load &
sleep 30

# Install
adb install android/app/build/outputs/apk/release/app-release.apk

# Launch
adb shell am start -n com.cretas.foodtrace/.MainActivity

# Watch logs for expo-updates activity
adb logcat -s expo-updates:V expo-modules:V
```

Expected log lines on first launch:
```
expo-updates: Checking for update at https://ota.cretaceousfuture.com/api/ota/manifest
expo-updates: No update available (server returned noUpdateAvailable directive)
```
OR:
```
expo-updates: Update available: <id>
expo-updates: Downloaded <N> assets
expo-updates: Update ready, applying on next launch
```

If the manifest fetch fails with 401, the server-side stack is missing PR #375 (JWT exempt). If it 404s, nginx (PR #380) isn't installed. If TLS handshake fails, the cert path config is off.

---

## 6. Distribute to customers (Steve manual)

This is the **last manual APK install** for the existing customer base. After this APK is installed, future fixes ship via OTA without reinstall.

For each customer (currently F006 / Liutengmen per memory `reference_f006_liutengmen_prod_accounts.md`):

1. Upload `app-release.apk` to a customer-accessible mirror (WeChat group, OSS bucket, or web download)
2. Customer downloads + installs (Android: tap APK → "install anyway" on Play Protect warning)
3. **Data preservation depends on signing-key continuity**:
   - Same `applicationId` (`com.cretas.foodtrace`) AND same keystore as previous APK → install replaces, data preserved
   - Different keystore → Android rejects with "App not installed (signatures conflict)". User must `adb uninstall com.cretas.foodtrace` first, losing local data
   - **VERIFY** by checking that the current customer APK was built from a previous version of THIS keystore. If unsure, schedule the cutover during low-activity hours and accept potential data wipe.
4. Customer opens the App once → `expo-updates` polls `/api/ota/manifest` → either `noUpdateAvailable` (clean) or downloads first OTA (if you pushed before distribution)

---

## 7. Subsequent OTA pushes (no rebuild needed)

After distribution, every JS-only fix is a one-liner from the dev laptop:

```bash
# Edit src/ code, commit, push to main, then:
./scripts/ota/push-bundle.sh production android
# expect: bundle live: rv=1.0.0 channel=production ts=<millis>

# Customer's App auto-detects on next launch (checkAutomatically: ON_LOAD).
# New JS bundle downloads in ~5 sec, then user sees fix after one App restart.
```

To verify customer received the update:

```bash
./scripts/ota/push-bundle.sh production android | tee /tmp/push-output
# scrape the timestamp from the success line, then:
curl -H 'Authorization: Bearer $OTA_ADMIN_TOKEN' \
     'https://ota.cretaceousfuture.com/api/ota/admin/list?runtimeVersion=1.0.0&channel=production'
# Confirm the new timestamp is at index 0 (newest)
```

---

## 8. When you DO need to rebuild the APK

| Change | OTA-deliverable? | Rebuild? |
|---|---|---|
| Pure JS bug fix (component, hook, API call) | ✅ yes | no |
| New screen / route in `src/` | ✅ yes | no |
| Added a new npm package (JS-only) | ✅ yes | no |
| Added a new `expo-*` package with **native code** (e.g. `expo-camera-v2`) | ❌ no | YES, bump version |
| Modified `app.json` permissions or plugins | ❌ no | YES, bump version |
| Bumped `expo.version` for major release | ❌ no | YES, this is the trigger |
| Renamed OTA `runtimeVersion` policy | ❌ no | YES |

When rebuilding for a version bump:

1. Bump `frontend/CretasFoodTrace/app.json:expo.version` from `1.0.0` to `1.1.0`
2. Bump `expo.android.versionCode` from `2` to `3`
3. Rebuild APK following §3 of this runbook
4. Distribute as before
5. Old `1.0.0` APKs on customers' devices will IGNORE `1.1.0` OTA bundles (safe fallback) until they install the new APK

---

## 9. Rollback (if a bad OTA bundle shipped)

```bash
# List bundles, pick a known-good timestamp:
curl -H 'Authorization: Bearer $OTA_ADMIN_TOKEN' \
     'https://ota.cretaceousfuture.com/api/ota/admin/list?runtimeVersion=1.0.0&channel=production'

# Mark the latest as rolled-back:
./scripts/ota/rollback.sh 1.0.0 production <latest-bad-timestamp>
```

Customer's App on next poll gets a `rollBackToEmbedded` directive → reverts to the JS bundle baked into the APK at build time (i.e. whatever was current at distribution). Then re-push a fixed bundle to resume OTA delivery.

---

## 10. References

- [Self-hosted OTA spec](../superpowers/specs/2026-05-11-self-hosted-ota-spec.md) — protocol + architecture
- [`scripts/ota/README.md`](../../scripts/ota/README.md) — push-bundle / rollback / prune operator scripts
- [Expo Updates v1 protocol spec](https://docs.expo.dev/technical-specs/expo-updates-1/) — upstream
- [PR #363](https://github.com/j4xie/my-prototype-logistics/pull/363) — Phase 1+2 server module + X.509 cert
- [PR #380](https://github.com/j4xie/my-prototype-logistics/pull/380) — Phase 4 nginx reverse-proxy
- Memory `reference_f006_liutengmen_prod_accounts.md` — customer cutover target
- Memory `setup-apk-build-windows.md` — Windows path-length workaround details
