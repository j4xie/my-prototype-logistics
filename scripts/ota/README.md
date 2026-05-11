# OTA operator scripts

These three scripts drive the self-hosted OTA pipeline from a developer
laptop into server 47. They wrap the API documented in
[`docs/superpowers/specs/2026-05-11-self-hosted-ota-spec.md`](../../docs/superpowers/specs/2026-05-11-self-hosted-ota-spec.md)
§7 (push) + §2.3 (admin endpoints) + §16 Q4 (retention).

## Prerequisites

1. **SSH key authentication** to `root@47.100.235.168` (already used by
   `scripts/deploy/deploy-smartbi-python.sh`).
2. **`OTA_ADMIN_TOKEN`** env var in your local shell, sourced from a
   never-committed file:
   ```bash
   # ~/.ota-env (chmod 600)
   export OTA_ADMIN_TOKEN=<hex64 from /www/wwwroot/cretas/.env.ota on server 47>
   ```
   ```bash
   # ~/.bashrc append
   [ -f ~/.ota-env ] && source ~/.ota-env
   ```
   Steve generates the token server-side and shares it out-of-band; it
   does NOT live in this repo.
3. **`jq`** for `app.json` parsing (already used elsewhere in the repo).
4. **Node/npx** with `expo-cli` available (the `expo` dependency in
   `frontend/CretasFoodTrace/package.json` is sufficient).

## `push-bundle.sh` — ship a new OTA bundle

```bash
./scripts/ota/push-bundle.sh [channel] [platform]
```

Defaults: `channel=production`, `platform=android`.

Pipeline (5 steps, ~30-90s depending on bundle size + network):

1. `npx expo export --platform <p>` → `frontend/CretasFoodTrace/dist/`
2. `npx expo config --json` → `dist/expoConfig.json` (spec §7.1 — `expo
   export` does not auto-emit this)
3. `tar -czf` + `scp` to `/tmp/ota-bundle-<ts>.tar.gz`
4. SSH: extract into `<timestamp>.tmp/`, then atomic `mv` to `<timestamp>/`
   (spec §7.2 — no client ever observes a half-written bundle)
5. `POST /api/ota/admin/register` with Bearer token

Exit codes:
- `0`: success
- `2`: bad arguments (channel/platform/missing env)
- `3`: expo export produced incomplete output
- `4`: server `/admin/register` returned non-200

After success, verify with the curl command echoed at the end of the run.

## `rollback.sh` — revert customers to embedded bundle

```bash
./scripts/ota/rollback.sh <runtimeVersion> <channel> <timestamp>
```

Touches a `rollback` marker file inside the target bundle dir. On the next
device poll, server emits `{"type":"rollBackToEmbedded"}` directive; the
device reverts to the JS bundle baked into the APK at build time.

Use this for fast-recovery from a bad OTA push. Re-pushing a corrected
bundle with `push-bundle.sh` then resumes normal OTA delivery.

## `prune-bundles.sh` — bound disk usage

```bash
./scripts/ota/prune-bundles.sh <runtimeVersion> <channel> [N=10]
```

Keeps the newest `N` bundles per `(runtimeVersion, channel)` and deletes
the rest. `N=0` is forced to `1` since the latest must always be retained
(per spec §16 Q4 sign-off).

Recommended schedule: weekly cron on server 47, or after any high-cadence
push session. The bundles directory is the only fast-growing OTA disk
consumer; everything else is fixed-size.

## Local test coverage

The bash scripts ship with Python-side tests in
[`backend/python/ota/tests/test_scripts.py`](../../backend/python/ota/tests/test_scripts.py):

- `bash -n` syntax check on every script
- Regex consistency between bash `SAFE_COMPONENT` and Python
  `ota.services.storage._VALID_PATH_COMPONENT` (catches sister-chat drift)
- Argument-validation behaviour (bad channel / platform / KEEP / path
  traversal in any arg → exit 2)

Tests do NOT exercise the SSH / scp / curl paths — that's Phase 6
emulator E2E scope. Run locally:

```bash
cd backend/python
python -m pytest ota/tests/test_scripts.py -v
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `OTA_ADMIN_TOKEN env var required` | Source `~/.ota-env` or `export OTA_ADMIN_TOKEN=…` |
| `runtime version '...' fails ^[A-Za-z0-9]...` | `app.json:expo.version` contains an invalid char; pick a clean version |
| `/admin/register returned 401` | Stale `OTA_ADMIN_TOKEN` — re-pull from server 47 `.env.ota` |
| `/admin/register returned 404` | Bundle dir didn't land on server — check the SSH+tar step output |
| `expected output dist/metadata.json missing` | `expo export` quietly failed; re-run with `DEBUG=expo:*` |
| ssh permission denied | Key auth to server 47 not set up — see `.claude/rules/server-operations.md` |
