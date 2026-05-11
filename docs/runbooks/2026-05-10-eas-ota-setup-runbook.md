# EAS OTA Setup Runbook (B6 fix follow-up — Option B)

**Created**: 2026-05-10
**Context**: PR #287/#289 B6 finding — `expo-updates` package missing, `eas.json` has no `update` channel, `app.json` has no `runtimeVersion`/`updates.url`, and `extra.eas.projectId = "com.cretas.foodtrace"` is the Android package name, NOT a real EAS UUID. Without OTA delivery, every backend-incompatible fix requires customers to manually reinstall the APK.

**Steve directive 2026-05-10**: Choose **Option B (long-term fix)** — install OTA infra, ship ONE APK with `expo-updates` runtime, then future fixes are OTA-deliverable.

**This PR**: Infrastructure configuration only (config files + package). All Expo-account-bound operations (`eas login`, `eas init`, `eas build`, `eas update`) require Steve's interactive credentials and are documented below.

---

## What this PR shipped

| Change | File | Status |
|--------|------|--------|
| Added `expo-updates@~0.28.18` | `frontend/CretasFoodTrace/package.json` + `yarn.lock` + `package-lock.json` | done |
| Added `runtimeVersion` (policy: `appVersion`) | `frontend/CretasFoodTrace/app.json` | done |
| Added `updates.url` (PLACEHOLDER) | `frontend/CretasFoodTrace/app.json` | done |
| Added `update` profiles (production / staging) | `frontend/CretasFoodTrace/eas.json` | done |
| Added `channel` to all build profiles | `frontend/CretasFoodTrace/eas.json` | done |

**Bare workflow note**: `android/` and `ios/` folders are committed (continuous native generation / CNG bare workflow). `android/app/src/main/AndroidManifest.xml` already has `expo.modules.updates.*` meta-data placeholders from a previous prebuild run — currently `ENABLED=false`. After `expo-updates` is installed and `expo prebuild` (or EAS Build cloud build) runs, this flag flips to `true` automatically. **No manual AndroidManifest.xml / MainApplication.kt edits required.**

---

## What Steve needs to do MANUALLY

### Step 1: `eas login` (Steve credentials required)

```bash
cd frontend/CretasFoodTrace
npx eas-cli login
# Interactive: enter Expo account username + password
```

If you have an existing Expo account, use that; otherwise create one at https://expo.dev/signup.

### Step 2: `eas init` — get real EAS Project UUID

```bash
cd frontend/CretasFoodTrace
npx eas-cli init
# Interactive prompt: choose existing project or create new
# It auto-updates app.json:expo.extra.eas.projectId with a real UUID
# Format: "11111111-2222-3333-4444-555555555555"
```

**IMPORTANT — fix `updates.url`** after `eas init`:
- Open `app.json`
- Find `"url": "https://u.expo.dev/PLACEHOLDER-EAS-PROJECT-ID"`
- Replace `PLACEHOLDER-EAS-PROJECT-ID` with the same UUID `eas init` wrote into `extra.eas.projectId`
- Commit this single-line change to main

### Step 3: Build new APK (containing `expo-updates` runtime)

```bash
cd frontend/CretasFoodTrace
npx eas-cli build --platform android --profile production
```

- Wait 10-30 min for EAS cloud build
- EAS dashboard shows progress at https://expo.dev/accounts/<you>/projects/<slug>/builds
- When done, capture the APK download URL from the dashboard

**This is the ONE-TIME APK rebuild**. After this, fixes can ship via OTA (Step 5) without rebuilding.

### Step 4: Distribute APK to customer

- Send APK download URL (from EAS dashboard) to customer via WeChat
- Customer installs replacing old App
  - **Data preserved** if same `applicationId` (`com.cretas.foodtrace`) AND same signing key
  - **Data lost** if signing key differs — confirm signing config matches existing APK before distributing
- This is the last manual reinstall — future fixes via Step 5 OTA

### Step 5: Future OTA push (the actual B6-style fix delivery)

When you need to ship a JS-only fix (no native code change):

```bash
cd frontend/CretasFoodTrace
# Make your code changes, commit to main
npx eas-cli update --branch production --message "fix: <short description>"
```

- Bundle uploads to EAS Update servers in ~30-60 seconds
- Customer's App auto-detects on next launch (`checkAutomatically: ON_LOAD`)
- New JS bundle downloads in ~5 sec (fallback after 5s timeout per `fallbackToCacheTimeout`)
- Customer sees fixed behavior after one app-restart

### Step 6: Verify delivery

```bash
npx eas-cli update:list --branch production
# Shows recent update bundles + delivery telemetry
```

Or check https://expo.dev/accounts/<you>/projects/<slug>/updates for per-update analytics.

---

## Runtime version policy explanation

We chose `"policy": "appVersion"` in `app.json`. This means:

- `expo-updates` matches OTA bundle compatibility against the APK's `version` field (`"1.0.0"`)
- **Same version** (e.g. `1.0.0` → `1.0.0`): OTA delivery works
- **Version bump** (e.g. `1.0.0` → `1.1.0`): customer needs NEW APK; old APK ignores `1.1.0` OTA bundles (safe fallback)

Rule of thumb:
- **Pure JS/RN fix** (component bug, API call fix, copy change) → bump nothing, push OTA
- **Native module added** (e.g. add a new `expo-*` package with native code) → bump `version` to `1.1.0`, rebuild APK, redistribute

For B6-style issues (frontend handling of backend response), OTA is sufficient. No native module added.

---

## Channel mapping

| Build profile | OTA channel | Use case |
|---------------|-------------|----------|
| `production` | `production` | Customer-facing APK |
| `preview` | `staging` | Internal QA before customer release |
| `development` | `development` | Dev client builds (Expo Go alternative) |

When you `eas update --branch production`, only customers with the `production`-channel APK receive it. Staging APKs don't get production updates and vice versa.

---

## Rollback (if a bad OTA bundle ships)

```bash
npx eas-cli update:republish --branch production --update-id <previous-known-good-id>
# Or roll back via the EAS dashboard "Republish" button
```

Customer's App fetches the republished older bundle on next launch.

---

## Notes for this PR

### Pre-existing version drift (NOT introduced by this PR)

`npx expo install --check` reports 3 packages with version mismatches vs SDK 53 expected:
- `expo-image-manipulator@13.0.6` vs expected `~13.1.7`
- `expo-print@55.0.8` vs expected `~14.1.4`
- `eslint-config-expo@10.0.0` vs expected `~9.2.0`

These are pre-existing drifts from before this PR. None block `expo-updates` installation or OTA delivery. Recommend tracking as separate cleanup ticket — `npx expo install expo-image-manipulator expo-print eslint-config-expo` would resolve.

### Why we chose `expo install` (yarn) but also updated package-lock.json

`npx expo install expo-updates` chose yarn (yarn.lock pre-existed). The build script `build-android-apk.bat` uses `npm install`, so both lockfiles must stay in sync. After `expo install`, ran `npm install --package-lock-only --ignore-scripts` to refresh `package-lock.json` without touching node_modules.

### EAS Project ID is currently a placeholder

`app.json:expo.extra.eas.projectId` is still the old wrong value `"com.cretas.foodtrace"` (Android package name, not UUID). `eas init` (Step 2 above) auto-fixes this. The `updates.url` similarly has a `PLACEHOLDER-EAS-PROJECT-ID` literal — fix both after `eas init`.

---

## References

- `expo-updates` docs: https://docs.expo.dev/versions/latest/sdk/updates/
- EAS Update docs: https://docs.expo.dev/eas-update/introduction/
- Runtime versions: https://docs.expo.dev/eas-update/runtime-versions/
- PR #287/#289 B6 investigation: the original report identifying OTA gap
- `frontend/CretasFoodTrace/src/services/api/apiClient.ts:88-100` — existing 410 handler that needs OTA delivery to reach customers
