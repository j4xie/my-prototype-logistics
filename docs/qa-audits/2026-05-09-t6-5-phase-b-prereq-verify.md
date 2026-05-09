# T6.5 Phase B — Prereq Verify (2026-05-09)

**Author**: organizer prep chat (Phase B prep, dispatched ahead of F999 T-72h notification + 3-day soak per HARD active-E2E-replaces-passive-soak rule).
**Predecessors verified**: PR #178 audit + PR #182 spec amend (Decision 4B) + PR #181 MO draft + PR #185 datasource Python impl + PR #186 deploy SG fix — **all admin-merged** into `main` at HEAD `0452e52948` as of 2026-05-09 ~11:09 CST.
**Companion artifact**: this PR also renames `docs/superpowers/dispatch/2026-05-15-t6-5-phase-b-stub-marching-order.md` → `2026-05-09-…` per Phase B trigger date convention.

---

## ⚠️ Critical finding — Prod Python service running on stale code

**Empirical**: PR #185 code is **on disk** at `/www/wwwroot/cretas/code/backend/python/smartbi_compat/api/datasource.py` (md5 byte-identical to `main` HEAD), but the **live `cretas-python.service` process (PID 2111052, started 2026-05-09 06:08:07 CST) was started before the file landed and has NOT been reloaded**, so its registered FastAPI routes do not include the 3 PR #185 stub endpoints (`POST /datasource/upload`, `GET /datasource/{id}/preview`, `POST /datasource/apply`).

| Probe | Result | Source of truth |
|---|---|---|
| `md5sum` server `datasource.py` | `f4857218bbc29e526846003377c18098` | matches local `main` worktree byte-for-byte |
| `systemctl status cretas-python` | `Active: active (running) since Sat 2026-05-09 06:08:07 CST; 5h 2min ago` | uptime predates file mtime `2026-05-09 10:05:11` |
| Prod `8083` `/openapi.json` `datasource` paths | 3 routes only (`list`, `{id}/fields`, `{id}/history`) | PR #185 stubs missing from running process |
| Test `8084` `/openapi.json` `datasource` paths | 6 routes (3 GET + 3 PR #185 stubs: `upload` POST, `{id}/preview` GET, `apply` POST) | proves on-disk code does register correctly when the process is fresh |

**Why it matters for Phase B**: T6.5 Phase B stubs the 22 Java analysis controller methods + 23rd Dashboard `/data-date-range` to return 410. Customer factories (75) hit nginx → Python for routes nginx-rewrites to `:8083`, which per `audit/nginx-python-coverage` PR #184 includes datasource paths. If Phase B fires while prod Python's running process is missing those 3 routes, customer requests to those paths get FastAPI default 404 instead of the noChanges / autoApplicable envelope expected.

**Remediation (single command)**:

```bash
ssh root@47.100.235.168 "systemctl restart cretas-python"
# Then re-probe:
ssh root@47.100.235.168 "curl -s --max-time 5 http://localhost:8083/openapi.json | python3 -c \
  \"import json,sys;d=json.load(sys.stdin);print('\\\\n'.join(p for p in d['paths'] if 'datasource' in p))\""
# Expected: 6 datasource paths (3 GET + 3 stub POST/GET) all present.
```

This is **organizer-gated** per `feedback_pause_before_deploy_or_push.md`. Do **not** restart from this prep chat — file ticket and let organizer + Steve decide whether to restart immediately or batch with PR #186 redeploy.

---

## §1 — PR #185 + PR #186 prod verify commands & evidence

### PR #186 — `deploy-smartbi-python.sh` health-check via SSH curl localhost (SG Phase 3)

```bash
ssh root@47.100.235.168 'curl -s -o /tmp/health_out -w "HTTP %{http_code} size=%{size_download}b\n" \
  --connect-timeout 3 --max-time 5 http://localhost:8083/health && cat /tmp/health_out'
```

Output 2026-05-09 11:09 CST:

```
HTTP 200 size=338b
{"status":"healthy","service":"python-services","version":"2.0.0","timestamp":"2026-05-09T11:09:25.782711","modules":["smartbi","client_requirement","completeness_calculator","efficiency_recognition","scene_intelligence","food_knowledge_base","food_kb_feedback","foreign_object_detection","ai_intent","llm_router"],"postgres":"connected"}
```

Test env (port 8084) also returns HTTP 200 size=338b (probed concurrently). PR #186's `wait_for_health_via_ssh` pattern (lines 237-263 of `deploy-smartbi-python.sh`) confirmed working — bypasses SG Phase 3 restriction by routing the curl through `ssh ${SERVER}` instead of curling `47.100.235.168:8083` from the developer host (which would be rejected by SG since 2026-04-11 nginx-only allowlist).

**Result**: ✅ PR #186 fix is correct, deployed, and the canonical pattern for future deploy-script health gates.

### PR #185 — 3 datasource stub endpoints ported to Python

```bash
ssh root@47.100.235.168 'curl -s --max-time 8 http://localhost:8084/openapi.json -o /tmp/openapi_test.json && \
  python3 -c "import json; d=json.load(open(\"/tmp/openapi_test.json\")); \
    paths=[p for p in d.get(\"paths\",{}) if \"datasource\" in p]; \
    print(chr(10).join(sorted(p+\" \"+\",\".join(sorted(d[\"paths\"][p].keys())).upper() for p in paths)))"'
```

Test env (`8084`) output:

```
/api/mobile/{factory_id}/smart-bi/datasource/apply POST
/api/mobile/{factory_id}/smart-bi/datasource/list GET
/api/mobile/{factory_id}/smart-bi/datasource/upload POST
/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/fields GET
/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/history GET
/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/preview GET
```

All 3 PR #185 stub routes registered: `apply` POST, `upload` POST, `{id}/preview` GET. Plus the 3 pre-existing GET routes (`list`, `{id}/fields`, `{id}/history`).

Prod (`8083`) output for the same probe:

```
/api/mobile/{factory_id}/smart-bi/datasource/list GET
/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/fields GET
/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/history GET
```

3 routes only — see Critical Finding above. **Code is correct on disk, process needs restart.**

**MO trial command divergence note**: the original Phase B prep MO suggested `curl -s localhost:8084/api/mobile/F999/smart-bi/datasource/F999_DS_001/preview`. Two reasons that command would not have produced a meaningful verify even on a healthy service:

1. Python `datasource_id` is typed `int` (FastAPI path-param coercion) — passing the string `F999_DS_001` returns FastAPI 422 Unprocessable Entity, not the noChanges envelope.
2. The route is gated by `verify_jwt_and_factory` — anonymous curl returns 401 before the route handler executes.

The openapi-json approach above sidesteps both issues and verifies route registration directly, which is the actual question the prep needs to answer.

---

## §2 — F999 T-72h notification status

| Item | Status | Owner |
|---|---|---|
| Cretas internal Slack notification (#cretas-internal or equivalent) | **TODO** | Steve / organizer |
| Cretas internal email broadcast | **TODO** | Steve / organizer |
| Notification body (per spec §3.3 + audit §6.1): "F999 SmartBI Analysis paths will return 410 Gone starting `<Phase B start date>`. Migrate any F999 internal scripts/tools to `/api/smartbi/analysis/*` direct or stop using." | not drafted | Steve / organizer |
| 72h dead-time clock to start | not started | gated by notification dispatch |

**Note on HARD rule alignment** (`feedback_active_e2e_replaces_passive_soak.md`):

The original spec §3.3 + audit §6.1 prescribe a 72h passive notification window. Under the HARD rule "active E2E replaces passive soak" (graduated 2026-05-09), the 72h window is interpreted as a **technical-readiness anchor** for F999 internal team to read & action the notification, **not** a dead-time soak gate. Phase B can fire as soon as:

1. Notification is sent (any time).
2. Active E2E probe of F999 SmartBI Analysis paths confirms either (a) zero traffic from F999 internal team in the last 24h, OR (b) the F999 team has explicitly acked migration via Slack thread.

If 0 customers are actively using SmartBI Analysis (the current pre-customer-return state per memory `project_2026_05_09_phase_2a_complete.md`), active probe is the verification — no dead-time clock required.

---

## §3 — Phase B GO criteria summary

| Gate | Status (2026-05-09 11:30 CST) | Block / Note |
|---|---|---|
| PR #178 audit merged into `main` | ✅ commit `bd8e8afa79` | satisfied |
| PR #182 spec amend (Decision 4B) merged into `main` | ✅ commit `b8c3579ed6` | satisfied |
| PR #181 MO draft merged into `main` | ✅ commit `6e65eedc98` | renamed to `2026-05-09-…` in this PR |
| PR #185 datasource stubs merged + on disk | ✅ commit `44ebf6976c` + md5 byte-identical to local `main` | satisfied |
| **PR #185 datasource stubs LIVE in prod Python `8083` process** | ❌ openapi missing 3 routes | **BLOCKER** — `systemctl restart cretas-python` needed |
| PR #186 deploy SG-fix merged | ✅ commit `bffa144c83` | satisfied |
| PR #186 health-check pattern verified working | ✅ HTTP 200 on both 8083 + 8084 via SSH curl | satisfied |
| T6.4 5-stage cascade complete | ✅ per memory `project_2026_05_09_phase_2a_complete.md` 06:34 CST | satisfied |
| F999 T-72h notification dispatched | ⏳ TODO (Steve / organizer) | gates Phase B fire |
| F999 active-E2E probe (or 24h zero-traffic confirm) | ⏳ TODO post-notification | gates Phase B fire |
| No P1 customer reports against SmartBI Analysis paths | ✅ per memory + on-call review | satisfied |

**Net status**: 2 prereqs not green — (1) **prod Python restart to pick up PR #185** + (2) F999 T-72h notification + active-E2E probe. Both organizer-owned. Once both green, Phase B impl chat can fire per the renamed MO at `docs/superpowers/dispatch/2026-05-09-t6-5-phase-b-stub-marching-order.md`.

---

## Reference

| Resource | Location |
|---|---|
| Renamed Phase B MO | `docs/superpowers/dispatch/2026-05-09-t6-5-phase-b-stub-marching-order.md` |
| Phase A audit | `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates.md` |
| Cross-verify | `docs/qa-audits/2026-05-09-t6-5-phase-a-deletion-candidates-cross-verify.md` |
| Spec (Decision 4B) | `docs/superpowers/specs/2026-05-15-t6-5-java-smartbi-deprecation-spec.md` (path retained — spec file not renamed) |
| nginx-Python coverage audit | `docs/qa-audits/2026-05-09-nginx-python-coverage-cross-check.md` |
| Memory: pause-before-deploy | `feedback_pause_before_deploy_or_push.md` |
| Memory: active-E2E replaces passive-soak | `feedback_active_e2e_replaces_passive_soak.md` |
| Memory: dispatch on technical readiness | `feedback_dispatch_on_technical_readiness.md` |
