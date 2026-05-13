# Migration plan: cretas-python `venv38` → `venv311`

**Issue:** [#510](https://github.com/stevenj4xie/my-prototype-logistics/issues/510)
**Branch:** `qa/py38-eol-audit-510`
**Author:** chat5 (audit only — no code change yet)
**Date drafted:** 2026-05-13
**Target Python:** 3.11.x (latest stable patch at execution time)
**Scope:** `cretas-python` service on server 47 (`47.100.235.168`),
both `prod` (port 8083, systemd `cretas-python`) and `test` (port
8084, nohup-managed).

This is a **planning document** only. No code, no schema, no server
change is performed by this PR.

---

## 1. TL;DR

The codebase is in **good shape** for Python 3.11. After running the
audits in §2-3 the only **required** code change before cutover is a
one-line tweak to `requirements.txt`:

```diff
- torch==2.4.1 ; python_version == "3.8"
+ torch==2.4.1
```

The cutover itself is a server-side venv rebuild + systemd
`ExecStart` swap, parallel-installable alongside the existing
`venv38`. Estimated total maintenance window: **~30-45 min** for
test env, **~20 min** for prod env (most time is `pip install`).

Trigger to execute (per Issue #510):
1. `cryptography 48.0.0` drops 3.8 → blocks deploy, OR
2. Steve schedules a maintenance window, OR
3. Phase 3+ work needs a 3.9+ feature.

---

## 2. Code-level compatibility audit

Full grep evidence: [`tests/qa-py311-audit/compat-grep.txt`](../../tests/qa-py311-audit/compat-grep.txt)

### Key findings

| Pattern | Hits in service code | 3.11 risk |
|---|---|---|
| `from __future__ import annotations` | 573 files (high coverage) | none — type hints lazy-evaluated |
| PEP 585 builtin generics w/o `__future__` | 6 files (5 tests + 1 admin script) | **none in service**; runtime-safe on 3.11 |
| PEP 604 `X \| Y` unions runtime | 0 real (2 regex/docstring FP) | none |
| `match`/`case` | 1 file (`scripts/b_spec/arbitrate.py`, CLI tool) | works on 3.11; currently dead-on-import on 3.8 |
| `:=` walrus | 0 | none |
| `.removesuffix()` / `.removeprefix()` | 0 (PR #521 swept) | none |
| `asyncio.get_event_loop()` | 17 sites, all in async context | works on 3.11 with no warning; deprecation hardens in 3.12 |
| `asyncio.coroutine` decorator | 0 | none |
| `collections.Mapping/Sequence/...` aliases | 0 | none |
| `imp` module | 0 (grep FP: `importlib.util`) | none |
| `distutils` | 0 | none |

**Verdict.** No required code change for cutover. Two optional hygiene
sweeps recommended as **follow-up PRs** after the venv soak:

- **Optional sweep 1** (low priority): add `from __future__ import
  annotations` to the 5 test files + 1 script. Hygiene only, no
  functional impact.
- **Optional sweep 2** (medium priority, before 3.12 upgrade):
  replace 17 `asyncio.get_event_loop()` call sites with
  `asyncio.get_running_loop()`. Behavior-preserving on 3.11, required
  by 3.12.

Neither sweep blocks the venv38 → venv311 cutover.

---

## 3. Dependency compatibility audit

Full per-package table: [`tests/qa-py311-audit/requirements-audit.md`](../../tests/qa-py311-audit/requirements-audit.md)

### Required change before cutover (1 line)

`backend/python/requirements.txt` line 82:

```diff
-torch==2.4.1 ; python_version == "3.8"
+torch==2.4.1
```

**Why.** The marker `python_version == "3.8"` makes pip **skip torch
entirely on 3.11**. Then `import torch` (4 sites including
`classifier/services/intent_classifier.py:13`) raises
`ModuleNotFoundError` at module load, breaking
`/api/classifier/health` and flooding the Java log per the warning
note already inline at requirements.txt:80-81. PyTorch 2.4.1
supports 3.8-3.12, so the marker is the only thing stopping install.

### Optional changes after cutover soak (3 lines, 1 follow-up PR)

```diff
-pydantic-settings>=2.0.0 ; python_version >= "3.9"
+pydantic-settings>=2.0.0
-prometheus-fastapi-instrumentator>=5.0.0,<6.0.0  # 6.0+ requires Python 3.9+
+prometheus-fastapi-instrumentator>=6.0.0,<8.0.0
```

(`pandas<2.0.0` and `sqlalchemy<2.0.0` caps are **not** Python
compat — they are project conservatism. Do NOT bundle those bumps
into the venv migration. Ship as separate evaluation PRs.)

### Verify on test venv build (1 package)

- `onnxruntime>=1.14.0,<2.0.0` — pin allows 1.14, but 1.14 only ships
  3.8-3.10 wheels. Confirm resolver picks 1.16+ on 3.11:
  ```bash
  venv311/bin/pip install --dry-run -r requirements.txt | grep onnxruntime
  ```
  If <1.16 wins, tighten to `>=1.16.0,<2.0.0` in the cutover PR.

---

## 4. Runtime / framework risk

### asyncio (FastAPI / uvicorn / asyncpg)

- **`asyncio.get_event_loop()`** — see §2. All 17 service-code call
  sites are inside `async def`. On 3.11, returns the running loop,
  zero warnings. Safe.
- **`asyncio.run()` reentry** — no in-tree usage of nested
  `asyncio.run()`. Safe.
- **uvicorn loop policy** — uvicorn 0.20+ auto-detects on 3.11 and
  prefers `uvloop` if installed (we don't install uvloop currently,
  so it stays on the asyncio default — no behavior change).

### ASGI middleware

`backend/python/auth_middleware.py` and
`backend/python/common/middleware/*` follow the modern ASGI 3.0
signature (`async def __call__(self, scope, receive, send)`). No
deprecated `Starlette.Middleware.dispatch` patterns. Safe.

### `smartbi.gold` ETL pipeline

ETL primarily uses `pandas` + `polars` for in-memory work and
`asyncpg` for I/O. All three support 3.11 with current pins. **One
caveat:** `pandas 1.5.x` warns when using `inplace=True` on
chained selections — but this is a 1.x deprecation, not a 3.11
change. No action required for migration.

### gRPC client (embedding-service:9090)

`grpcio>=1.59.0` is 3.11-compatible. The protobuf-generated stubs
under `grpc_stubs/embedding/` are version-pinned to the
`grpcio-tools` used to generate them — if we bump `grpcio` during
the cutover (we don't need to), stubs would need regen. **Plan: keep
grpcio at current pin during cutover.** Pin already supports 3.11.

### subprocess / OS-level

- No usage of removed `os.popen2/3/4` (removed pre-3.0; not at risk).
- No usage of `os.environb` quirks.
- `pathlib.Path.glob()` on Windows-vs-Linux is unchanged.

### LLM router / SSE streaming

`common/llm_router.py` + `common/llm_client.py` use `httpx` +
`aiohttp` for streaming. Both libraries support 3.11 cleanly with
current pins. No SSE / event-stream behavior change between 3.8 and
3.11.

### Phase 2A SmartBI byte-shape parity

`.claude/rules/python-java-port.md` defines a **dict-eq parity gate**
for 50 SmartBI analysis endpoints. The migration must preserve this.

The dict-eq gate is sensitive to:
- `Decimal` arithmetic (Rule 4, 10, 12) — unchanged across 3.8/3.11
- `datetime.isoformat()` (Rule 11) — unchanged across 3.8/3.11
- `dict` insertion order (Rule 8) — preserved since 3.7; unchanged
- `json.dumps` default separators — unchanged
- `decimal.ROUND_HALF_UP` semantics — unchanged

**Conclusion.** No expected change in byte output across the
interpreter bump. Verify by re-running the existing dict-eq replay
suite on test env (8084) after cutover; see §6 step 6.

---

## 5. Cutover plan

### 5.0 Inventory of files / configs that reference `venv38`

(grep'd on `qa/py38-eol-audit-510` worktree — confirm fresh before
execution day)

| File | Lines | Required change |
|---|---|---|
| `scripts/deploy/deploy-smartbi-python.sh` | 179, 188, 190, 194, 261 | `python3.8` → `python3.11`, `venv38` → `venv311` (5 sites) |
| `scripts/etl/restaurant-data-quality-reaudit.sh` | 32, 47 | `venv38/bin/python` → `venv311/bin/python` |
| `/etc/systemd/system/cretas-python.service` (server-side, NOT in repo) | `ExecStart=` line | venv path swap |
| `/www/wwwroot/cretas/restart-test.sh` (server-side) | venv path | `venv38` → `venv311` (or run via systemd from new unit) |
| `/www/wwwroot/cretas/restart-prod.sh` (server-side) | venv path | same |
| `backend/python/requirements.txt` | 82 | drop torch marker (see §3) |

Note: server-side systemd unit + restart scripts are **not** in the
repo. They live at `/etc/systemd/system/cretas-python.service` and
`/www/wwwroot/cretas/restart-*.sh` per
`.claude/rules/server-operations.md`. Capture current content with
`ssh root@47 'cat /etc/systemd/system/cretas-python.service'`
before editing — preserve as a backup file alongside.

### 5.1 Phase 1 — Build venv311 alongside venv38 (no traffic impact)

```bash
ssh root@47.100.235.168
# Install Python 3.11. Alibaba Cloud Linux 3 ships dnf; verify availability:
dnf install -y python3.11 python3.11-devel
# (If 3.11 not in repo, fallback: pyenv install 3.11.10 — needs build deps
#  gcc make zlib-devel openssl-devel libffi-devel bzip2-devel readline-devel
#  sqlite-devel ncurses-devel xz-devel.)

python3.11 --version  # expect 3.11.x

cd /www/wwwroot/cretas/code/backend/python
python3.11 -m venv venv311
source venv311/bin/activate

# CRITICAL: --prefer-binary --timeout 300 per feedback_pip_prefer_binary.md
# to avoid pip 25 hallucinating source builds (e.g. puccinialin).
pip install --upgrade pip
pip install --prefer-binary --timeout 300 -r requirements.txt

# Import smoke (mirrors deploy-smartbi-python.sh:212 gate)
python -c 'import sys; sys.path.insert(0, "."); import main' && echo OK

deactivate
```

If the smoke fails, **do not proceed**. Leave venv38 running, fix
the dep issue (most likely candidates: torch marker, onnxruntime
resolver, pydantic-settings), re-run.

### 5.2 Phase 2 — Cutover test env (8084) first

Per `.claude/rules/server-operations.md` "Test before prod" HARD
rule, **test env must validate before prod**.

```bash
# Stop test env process (nohup-managed, PID on port 8084)
PID=$(ssh root@47 'lsof -ti :8084')
ssh root@47 "kill $PID; sleep 2"

# Backup current restart-test.sh
ssh root@47 'cp /www/wwwroot/cretas/restart-test.sh \
  /www/wwwroot/cretas/restart-test.sh.bak.$(date +%Y%m%d_%H%M%S)'

# Edit restart-test.sh: replace venv38/bin/python with venv311/bin/python
# (or edit deploy-smartbi-python.sh:261 if we are deploying via that path)

# Restart from new venv
ssh root@47 'cd /www/wwwroot/cretas && bash restart-test.sh test'

# Health check
curl -s http://47.100.235.168:8084/health  # expect 200
```

### 5.3 Phase 2.5 — Active E2E on test env (15-30 min)

Per `feedback_active_e2e_replaces_passive_soak.md` HARD rule, **do
not soak passively**. Run real traffic:

1. **SmartBI Phase 2A parity gate** — re-record vs Java prod 10010
   or replay against existing F999/F001 goldens
   (`tests/fixtures/java-smartbi-golden/`):
   ```bash
   # From dev machine
   ./scripts/qa/replay-golden-suite.sh --target http://47.100.235.168:8084
   ```
   Expect dict-eq match rate ≥ 99.945% (T6.1 dryrun baseline).
2. **Revenue report smoke** — `web-admin/revenue-report-smoke.spec.ts`
   against 139:8097 (which proxies test 8084). 3/3 PASS expected.
3. **AI intent classifier health** — `curl http://47.100.235.168:8084/api/classifier/health`
   expect `{"status":"ok"}`. Confirms torch loaded.
4. **gRPC embedding round-trip** —
   `python -c "from ai import embedding; print(embedding.embed_sync('test'))"`
   from the new venv, expect 768-dim vector.
5. **Foreign-object detection (YOLO ONNX)** —
   `curl -X POST http://47.100.235.168:8084/api/foreign-object/detect \
   -F file=@tests/fixtures/sample-frame.jpg`. Confirms `onnxruntime`
   wheel resolved correctly.

If any step fails: **STOP**, revert by editing restart-test.sh back
to `venv38/bin/python`, restart. Investigate, file fix PR.

### 5.4 Phase 3 — Cutover prod env (8083, systemd-managed)

After test env has run ≥ 24h with no observed regression:

```bash
# 1. Backup systemd unit + restart-prod.sh
ssh root@47 'cp /etc/systemd/system/cretas-python.service \
  /etc/systemd/system/cretas-python.service.bak.$(date +%Y%m%d_%H%M%S)'

# 2. Edit /etc/systemd/system/cretas-python.service
#    Change ExecStart= venv path from venv38/bin/uvicorn to venv311/bin/uvicorn
#    Reload
ssh root@47 'systemctl daemon-reload'

# 3. Window: ~5 sec downtime on cutover (uvicorn restart)
ssh root@47 'systemctl restart cretas-python'

# 4. Health check
curl -s http://47.100.235.168:8083/health  # expect 200
ssh root@47 'systemctl status cretas-python --no-pager | head -20'

# 5. Active E2E on prod (per §5.3 but against 8083)
```

If any step fails: edit systemd unit back to `venv38/bin/uvicorn`,
`daemon-reload`, `systemctl restart cretas-python`. Restoration
takes ~10 sec.

### 5.5 Phase 4 — Soak (1 week) + cleanup

- **Soak duration:** 1 week of normal traffic on `venv311`
- **Soak signals:** Java app log `BERT 分类器服务不可达` rate (must
  stay at baseline 0), `cretas-python.log` ERROR rate, latency p95
  on `/api/smartbi/*` endpoints.
- **After soak:** remove old venv38 to free disk:
  ```bash
  ssh root@47 'rm -rf /www/wwwroot/cretas/code/backend/python/venv38'
  ```
  16GB RAM constraint per Issue #510 — venv38 typically uses ~1.5GB
  disk; keep until soak proves green.

### 5.6 Phase 5 — Update repo (single PR, after both envs green)

Bundle these changes into one PR:

1. `requirements.txt` — drop torch marker (required, line 82)
2. `requirements.txt` — drop pydantic-settings marker (optional)
3. `requirements.txt` — lift prometheus-fastapi-instrumentator cap (optional)
4. `scripts/deploy/deploy-smartbi-python.sh` — `python3.8` → `python3.11`, `venv38` → `venv311` (5 sites)
5. `scripts/etl/restaurant-data-quality-reaudit.sh` — `venv38` → `venv311`
6. Header comment in `backend/python/requirements.txt` — `# Compatible with Python 3.8+` → `# Compatible with Python 3.11+`
7. Optionally: drop `torch==2.4.1 ; python_version == "3.8"` line note
   in the file header

After merge, next deploy via `./scripts/deploy/deploy-smartbi-python.sh
--env test` will use `python3.11 -m venv venv311` for any freshly-built
venv — but in practice both envs already have venv311 from §5.1, so
this is purely catching the next clean-rebuild scenario.

---

## 6. Rollback plan

### Rollback during Phase 2 (test env)

```bash
ssh root@47 'lsof -ti :8084 | xargs -r kill; sleep 2'
ssh root@47 'cp /www/wwwroot/cretas/restart-test.sh.bak.<timestamp> \
  /www/wwwroot/cretas/restart-test.sh'
ssh root@47 'cd /www/wwwroot/cretas && bash restart-test.sh test'
```
Recovery: ~10 sec. venv38 untouched, so process spawns from old
interpreter. Test env back to known-good.

### Rollback during Phase 3 (prod env)

```bash
ssh root@47 'cp /etc/systemd/system/cretas-python.service.bak.<timestamp> \
  /etc/systemd/system/cretas-python.service'
ssh root@47 'systemctl daemon-reload && systemctl restart cretas-python'
curl -s http://47.100.235.168:8083/health
```
Recovery: ~10 sec. venv38 untouched, systemd unit swap is atomic.

### Rollback during Phase 4 (soak)

Same as Phase 3 rollback. Old systemd backup file remains on disk
until §5.6 PR merges and a clean redeploy happens — keep it around.

### Hard rollback (worst case)

If `venv311` itself is corrupt (e.g. mid-pip-install OOM, partial
write):

```bash
ssh root@47 'rm -rf /www/wwwroot/cretas/code/backend/python/venv311'
# Restart from venv38 per rollback above. Re-build venv311 from
# scratch per §5.1 after diagnosing root cause.
```

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `torch` wheel not available for 3.11.x on Alibaba Cloud Linux 3 | low | high (BERT classifier down) | Phase 1 `pip install` exercises the wheel; backup plan: install from `torch` CPU index URL `https://download.pytorch.org/whl/cpu` |
| `onnxruntime` resolver picks 1.14 (pre-3.11) | medium | high (YOLO down) | Phase 1 `--dry-run` check; pin tightening if needed |
| pydantic v2 import path changes break `BaseSettings` | low | medium (SmartBI config startup) | `smartbi/config.py:10` already has try/except; on 3.11 the pydantic-settings install succeeds and the latent 3.8 bug is fixed, not broken |
| Phase 2A dict-eq parity drifts after interpreter bump | very low | high (50 endpoints diverge) | §5.3 step 1 explicitly replays the golden suite; rollback per §6 if delta > 0.05% |
| `cryptography` 48.0+ silently picked, breaking unrelated runtime | low | medium | pin is `>=42.0.0` — pip will resolve to current latest. If runtime breaks, tighten to `>=42.0.0,<48.0.0` in cutover PR |
| 16GB RAM exhausted during 2×-venv coexistence | low | medium | each venv ~1.5GB. Free ≥4GB RAM required during pip install. Monitor with `free -h` |
| Active-E2E in §5.3 misses a corner case | medium | medium (regression discovered post-cutover) | Soak (Phase 4) catches gradual issues; rollback plan stays warm for 1 week |
| systemd `daemon-reload` forgotten after unit edit | low | high (cutover doesn't take effect) | Run `systemctl cat cretas-python` after reload to confirm new ExecStart |

---

## 8. Out of scope (deferred)

The following items are NOT part of this migration. Filing as
separate follow-ups recommended:

- pandas 1.x → 2.x bump (separate compat audit; behavior changes
  around `.append()`, `numpy 2.x` interop)
- sqlalchemy 1.4 → 2.x bump (large semantic change to declarative-
  only API, separate spec)
- 3.11 → 3.12 forward planning (would require `imp` audit + 17-site
  `get_running_loop` sweep that this plan defers)
- uvloop adoption for FastAPI throughput improvement
- Hygiene sweep: add `__future__ annotations` to 5 test files + 1
  script (cosmetic only)

---

## 9. Sign-off checklist (pre-execution day)

Before executing the cutover, confirm:

- [ ] Maintenance window scheduled (Steve approved)
- [ ] Active customer count on prod = baseline expectation (or
      cutover during low-traffic window per ops calendar)
- [ ] Server 47 disk free space ≥ 5GB (room for 2x venv during
      coexistence)
- [ ] Server 47 RAM free ≥ 4GB at pip-install kickoff
- [ ] Recent backup of `cretas_prod_db` exists (per
      `feedback_server_cleanup_workflow.md`: triple-backup before
      destructive ops)
- [ ] `tests/fixtures/java-smartbi-golden/` is up to date (recorded
      against current Java prod 10010 within last 7 days)
- [ ] Rollback systemd backup file pattern verified in §5.4
- [ ] `feedback_pip_prefer_binary.md` flags confirmed in commands
      (`--prefer-binary --timeout 300`)
- [ ] On-call has been notified of the maintenance window

---

## 10. References

- Issue [#510](https://github.com/stevenj4xie/my-prototype-logistics/issues/510) — original ticket
- PR [#521](https://github.com/stevenj4xie/my-prototype-logistics/pull/521) — Phase I follow-ups; baseline for "no remaining .removesuffix / builtin-generic" cleanup
- `.claude/rules/server-operations.md` — server architecture, systemd config, "Test before prod" HARD rule
- `.claude/rules/python-services-architecture.md` — single Python process discipline (port 8083/8084, no new ports)
- `.claude/rules/python-java-port.md` — Phase 2A dict-eq parity gate definition
- Memory: `feedback_pip_prefer_binary.md` — pip 25 hallucination workaround
- Memory: `feedback_active_e2e_replaces_passive_soak.md` — HARD rule on cutover validation
- Memory: `feedback_test_before_prod_smartbi.md` — HARD rule on test-env first
- Audit evidence: [`tests/qa-py311-audit/compat-grep.txt`](../../tests/qa-py311-audit/compat-grep.txt)
- Audit evidence: [`tests/qa-py311-audit/requirements-audit.md`](../../tests/qa-py311-audit/requirements-audit.md)
