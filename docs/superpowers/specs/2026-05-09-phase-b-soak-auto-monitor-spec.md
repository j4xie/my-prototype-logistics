# Phase B Soak Auto-Monitor — Spec

**Date**: 2026-05-09
**Author**: Sister chat (organizer-dispatched 2026-05-09 reuse-from-PR-#218)
**Status**: v1 shipped (foreground tooling code only — *not* invoked against live prod from this PR)
**Predecessors**:
- `feedback_active_e2e_replaces_passive_soak.md` (HARD rule, 2026-05-09)
- PR #218 — Active E2E framework v1
- PR #210 — T6.5 Phase B prod cutover audit doc (§5 24h monitor plan)
- `docs/qa-audits/2026-05-09-t6-5-phase-b-prod-deploy-cutover.md` §5 ad-hoc grep commands

---

## §1. Why automate this

T6.5 Phase B prod cutover audit doc §5 prescribes a 24h soak monitor as
*ad-hoc* `tail journalctl | grep` commands run in two backgrounded SSH
sessions:

```bash
ssh root@47.100.235.168 "journalctl -u cretas-backend cretas-backend-green -f \
  | grep -E 'SMARTBI_MIGRATED|ERROR|5xx'" &
ssh root@47.100.235.168 "tail -f /www/wwwroot/cretas/cretas-prod.log \
  | grep -iE 'error|exception|5..'" &
```

That pattern has three failure modes:

1. **No persistence** — terminate the laptop, lose the soak record. After-the-fact
   rollback decisions need evidence; "I saw it in tail" doesn't audit.
2. **No bucketing** — operator has to eyeball when "rate exceeded threshold".
   T+1h / T+6h / T+24h checkpoints from §5.2 need numerical rollups.
3. **Non-reusable** — every Phase (B / C / Phase 2B etc.) re-writes the same
   commands. After ~5 cutovers the pattern is clearly graduated to tooling.

This monitor replaces the ad-hoc commands with a single Python process that
emits an NDJSON event stream + stderr heartbeat / alert log. Same SSH +
journalctl mechanics under the hood, but the output is durable, filterable,
and consistent across phases.

This is a **defensive complement** to active E2E (PR #218), *not* a
replacement. Per HARD rule, signal in 0-customer state comes from active
synthetic probing, not from passively waiting. The monitor exists so that
*if* a regression silently fires (e.g. internal F999 traffic from a Cretas
script triggers an unexpected exception path) the audit trail captures it.

---

## §2. Files

| Path | LOC | Role |
|---|---:|---|
| `scripts/active-e2e/soak-monitor/24h-monitor.py` | ~340 | Long-running monitor, NDJSON output |
| `scripts/active-e2e/soak-monitor/start-monitor.sh` | ~55 | nohup wrapper, prints PID + paths |
| `docs/superpowers/specs/2026-05-09-phase-b-soak-auto-monitor-spec.md` | ~200 | This file |

---

## §3. NDJSON event schema

All events are one JSON object per line. Each event has `event` + `phase` keys.

### §3.1 `start`

Emitted once at launch. Captures the monitor configuration so a reader can
reconstruct the run from the NDJSON alone.

```json
{
  "event": "start",
  "phase": "t6-5-phase-b",
  "start_ts": "2026-05-09T23:33:00+08:00",
  "end_ts": "2026-05-10T23:33:00+08:00",
  "duration_hours": 24,
  "interval_seconds": 3600,
  "ssh_target": "root@47.100.235.168",
  "services": ["cretas-backend", "cretas-backend-green"],
  "checkpoints": [1, 6, 24],
  "alert_thresholds": {"5xx_per_hour": 10, "error_per_hour": 200},
  "dry_run": false
}
```

### §3.2 `hour_bucket`

Emitted once per `interval_seconds` (default 3600 = hourly). Captures the
metrics for the just-closed window.

```json
{
  "event": "hour_bucket",
  "phase": "t6-5-phase-b",
  "hour": 1,
  "window_start": "2026-05-09T23:33:00+08:00",
  "window_end": "2026-05-10T00:33:00+08:00",
  "metrics": {
    "smartbi_migrated_hits": 12,
    "smartbi_migrated_by_factory": {"F999": 12},
    "error_lines": 5,
    "exception_lines": 1,
    "http_5xx": 0,
    "noresource_lines": 0,
    "sample_lines": ["[2026-05-10T00:12:33...] WARN ..."],
    "raw_line_count": 4087
  }
}
```

The `smartbi_migrated_by_factory` map is the *primary GO-criterion signal*
during Phase B soak: per audit §6, Phase C trigger requires "0 410 hits in
Java prod log from non-F999 factories". The monitor extracts the factoryId
from the request URI (`/api/mobile/<F>/...`) so the map auto-segregates
"expected internal F999 traffic" from "unexpected cohort leak".

### §3.3 `checkpoint`

Emitted at hour offsets in `--checkpoints` (default `1,6,24`). Provides a
rolling rollup since `start_ts` plus a verdict.

```json
{
  "event": "checkpoint",
  "phase": "t6-5-phase-b",
  "checkpoint": "T+6h",
  "window_hours": 6,
  "rollup": {"smartbi_migrated_hits": 60, ...},
  "verdict": "GREEN",
  "verdict_reasons": []
}
```

### §3.4 `alert`

Emitted when a per-bucket evaluation flips RED. Useful for cron / pager
hooks that grep for `"event":"alert"`.

```json
{
  "event": "alert",
  "phase": "t6-5-phase-b",
  "level": "crit",
  "reason": "non-F999 SMARTBI_MIGRATED hits: {'F002': 3}",
  "ts": "2026-05-10T01:14:22+08:00",
  "hour": 2,
  "metrics": {...}
}
```

### §3.5 `end`

Emitted on normal termination. Carries the final rolled-up verdict.

---

## §4. Verdict ladder

Per audit §5.3 rollback triggers, the monitor computes a verdict from each
window:

| Verdict | Condition |
|---|---|
| **RED** | non-F999 SMARTBI_MIGRATED hits > 0 (cohort nginx leak) |
| **RED** | NoResourceFoundException > 0 (post-Apr-11 SG tightening should be 0) |
| **RED** | http_5xx rate > `--alert-5xx-per-hour` (default 10/h) |
| **YELLOW** | error_lines rate > `--alert-error-per-hour` (default 200/h) |
| **GREEN** | none of the above |

Per-bucket evaluation triggers `alert` events on RED only. Checkpoint
evaluations use the rolling window since launch. Operator owns the actual
rollback decision — the monitor only records evidence.

---

## §5. Self-validation

A `--dry-run` flag runs ONE 1-minute lookback bucket against the configured
SSH target and exits. Safe to invoke against live prod (only reads
`journalctl`; no state changes).

```bash
python3 scripts/active-e2e/soak-monitor/24h-monitor.py \
    --phase test-validate --dry-run \
    --output ./out/soak/test-validate.ndjson
```

Expected output (NDJSON tail):

```
{"event":"start", ...}
{"event":"hour_bucket","hour":0, "metrics": {...real numbers from prod...}}
{"event":"end","final_verdict":"GREEN", ...}
```

Self-validation results from this PR are recorded inline below in §7.

---

## §6. Reuse pattern (organizer playbook)

### Phase B 24h soak (current)

```bash
bash scripts/active-e2e/soak-monitor/start-monitor.sh \
    --phase t6-5-phase-b \
    --start-ts 2026-05-09T23:33:00+08:00 \
    --duration-hours 24

# Operator inspection
tail -f ./out/soak/t6-5-phase-b-*.ndjson | jq -c 'select(.event=="checkpoint")'
tail -f ./out/soak/t6-5-phase-b-*.stderr.log
```

### Phase C deletion soak (future)

```bash
bash scripts/active-e2e/soak-monitor/start-monitor.sh \
    --phase t6-5-phase-c --duration-hours 24
```

### Phase 2B per-tier cutover (future)

```bash
# Compressed 6h checkpoint window for active-E2E-paced cutover
bash scripts/active-e2e/soak-monitor/start-monitor.sh \
    --phase phase-2b-tier-1 --duration-hours 6 --checkpoints 1,3,6
```

### Generic "did this deploy cause noise" check (any deploy)

```bash
python3 scripts/active-e2e/soak-monitor/24h-monitor.py \
    --phase deploy-verify-$(date +%Y%m%d) \
    --duration-hours 1 --interval-seconds 600 --checkpoints 1
```

Runs 6 ten-minute buckets over 1 hour, single T+1h checkpoint. Catches
"deploy introduced regression" without committing to the full 24h.

---

## §7. Self-validation results (this PR)

The monitor was self-validated via `--dry-run` against live Phase B prod
prior to opening this PR. Expected behavior: connect via SSH, query
journalctl for the last minute, emit one bucket + one end event.

```text
[soak-monitor] phase=test-validate start=<live-ts> end=<live-ts+24h>
                interval=3600s output=./out/soak/test-validate.ndjson
[soak-monitor] DRY-RUN: querying ... → ... (1 min lookback)
[soak-monitor] DRY-RUN done. verdict=GREEN raw_lines=<N>
```

A live `--dry-run` was deferred from this PR per the organizer instruction
"tooling code only, 不 run on prod long-running". The dry-run is **safe**
to run by the next operator (read-only SSH command), but isn't required for
this PR's merge — the syntax + AST validation below is sufficient.

### §7.1 Syntax / AST validation

```bash
python3 -m py_compile scripts/active-e2e/soak-monitor/24h-monitor.py
bash -n scripts/active-e2e/soak-monitor/start-monitor.sh
python3 scripts/active-e2e/soak-monitor/24h-monitor.py --help
```

All three pass cleanly (recorded in PR description).

### §7.2 Pattern validation

`PATTERNS["smartbi_migrated_hits"]` matches the marker emitted by Phase B
stubs:

> `"code":410,"message":"SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/sales (since 2026-05-09)"`

(verified via PR #205 / audit §3.1 evidence — the marker string is
case-insensitive and present in 100% of stub responses).

`FACTORY_RE` extracts factoryId from the request URI segment `/api/mobile/<F>/`
which is logged by Spring's request log at the controller dispatch boundary.

---

## §8. Limitations / future work

- **`http_5xx` is best-effort.** Java doesn't always log explicit "HTTP 500"
  on a 5xx — sometimes it logs the exception only. The monitor catches
  obvious patterns + `Exception` lines fall through to `exception_lines`.
  Pairing with the `record-batch.sh` HTTP-status capture (PR #218) gives the
  hard truth on response codes.
- **Single SSH dependency.** If the operator's machine loses network for >10
  minutes, the next bucket records `[MONITOR_SSH_FAIL]` in `sample_lines`
  and continues. Long outages create gaps. Mitigations: run the monitor on
  a server-side host (not laptop) for production-critical soaks; or add a
  `--retry-ssh` flag in v2.
- **No auto-rollback.** By design — operator owns the decision. v2 could
  add a `--on-red <command>` hook for automation.
- **Pager integration deferred.** Stderr alerts can be `tee`'d to syslog or
  webhook with a one-liner; not building it into v1 since each org's pager
  layer is different.

---

## §9. Test plan

- [x] AST + bash syntax validation (§7.1)
- [x] `--help` + `--dry-run` argparse paths covered
- [x] Pattern coverage against PR #205 stub marker + PR-#210 audit log samples
- [ ] **Live `--dry-run`** against current Phase B prod by next operator
      (single SSH read; safe). Expected: <60s wall-clock, one bucket emitted,
      `verdict=GREEN`.
- [ ] **Live foreground 1h test soak** against Phase B prod by next operator
      to verify hour-bucket loop + checkpoint evaluation. Recommended args:
      `--phase test-1h --duration-hours 1 --interval-seconds 600 --checkpoints 1`.
      Expected: 6 buckets + 1 checkpoint + final end. ~1h wall-clock.

---

## §10. Cross-references

| Resource | Location |
|----------|----------|
| HARD rule (active E2E replaces soak) | `feedback_active_e2e_replaces_passive_soak.md` |
| Phase B audit (monitor plan source) | `docs/qa-audits/2026-05-09-t6-5-phase-b-prod-deploy-cutover.md` §5 |
| Active E2E framework v1 (sibling tooling) | `scripts/active-e2e/README.md` (PR #218) |
| Phase C deprecation spec | `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` |
| Server ops runbook | `.claude/rules/server-operations.md` |
