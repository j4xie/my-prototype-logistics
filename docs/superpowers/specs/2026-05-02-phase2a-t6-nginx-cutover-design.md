# Phase 2A T6 — nginx Cutover Design + Runbook

> **Status**: Doc-only spec, gated on Phase 2A 100% in-scope completion. Not for execution until prereq checklist (§9.1) is fully ✅.
>
> **Writing date**: 2026-05-02
> **Author**: Phase 2A standby session (between department PR-B #57 ship and procurement PR-B impl)
> **Doc lineage**: builds on `plans/2026-04-11-nginx-upstream-migration-audit.md` (nginx upstream pattern), `plans/2026-05-01-phase3-ai-migration-rollout.md` (staged rollout + kill-switch pattern), `plans/2026-04-10-phase3-cloud-sg-cutover.md` (Phase 3 SG cutover precedent), `handoff/2026-04-29-phase2a-T5-handoff.md` (Phase 2A T6 deferred from T5 handoff).
>
> **Phase 2A scope lock**: see `docs/superpowers/plans/2026-05-01-phase2a-remaining-endpoints-backlog.md` and memory `project_apr30_tool_skill_stays_java.md`. Only SmartBI analysis/ops endpoints. 337 Tools / 16 Skills / AIIntentService stay Java.

---

## 1. 背景

### 1.1 What T6 is

T6 = the final operational step of Phase 2A. After all Phase 2A in-scope endpoints have shipped to Python with byte-shape parity verified, T6 flips the **nginx gateway upstream** for `/api/mobile/{factoryId}/smart-bi/*` paths from the Java backend (server 47, port 10010) to the Python service (server 47, port 8083).

This is purely an **ops handover** — no code changes, no schema migrations. Just nginx config + reload + canary + monitor.

### 1.2 Why a separate spec

Sister-chat impl PRs (PR-A / PR-B / PR-C per endpoint) each ship Python code that **exists alongside** the Java code, callable via different paths (Java `/api/mobile/.../analysis/...`, Python `/api/smartbi/...`). Until T6, Java is still the production-serving path; Python is dark-shipped infrastructure verified only via direct calls / contract tests / F001 manual smokes.

T6 is the moment **production traffic** moves. That has its own risk profile (5xx spikes during nginx reload, divergent mobile/web client behavior, Java JVM left running but dark) that doesn't belong in any per-endpoint impl PR.

### 1.3 Prereq summary (full list in §9.1)

Before T6 can be triggered:
- All Phase 2A in-scope endpoints (§2.1) shipped to main with PR-A + PR-B + PR-C complete
- Each endpoint passes contract test (F999 byte-shape gate via `_strip_volatile`)
- Each endpoint has at least one F001 manual smoke test logged with `dict_eq` against Java response
- Rule 8 + Rule 9 audit applied to every shipped endpoint
- Java backend stable (no 5xx anomalies in 1-week baseline window)
- Python backend stable (no service restart in 48-hour window pre-T6)

---

## 2. Scope

### 2.1 In-scope routes (cutover Java → Python at T6)

This list reflects the Phase 2A end-state. As of 2026-05-02 not all of these are shipped yet — the right column tracks each endpoint's current ship status. T6 cannot start until **every** endpoint here is ✅.

| # | nginx path | Python module | Ship status (2026-05-02) |
|---|---|---|---|
| 1 | `/api/mobile/{factoryId}/smart-bi/analysis/finance` (composite) | `analysis_finance.py` | ✅ #13 |
| 2 | `/api/mobile/{factoryId}/smart-bi/analysis/finance?analysisType=payable` | `analysis_finance.py` | ✅ #18 |
| 3 | `/api/mobile/{factoryId}/smart-bi/analysis/finance?analysisType=profit` | `analysis_finance.py` | ✅ #21 + #22 |
| 4 | `/api/mobile/{factoryId}/smart-bi/analysis/finance?analysisType=cost` | `analysis_finance.py` | ✅ #25 + #28 |
| 5 | `/api/mobile/{factoryId}/smart-bi/analysis/finance?analysisType=receivable` | `analysis_finance.py` | ✅ #42 + #46 |
| 6 | `/api/mobile/{factoryId}/smart-bi/analysis/finance?analysisType=budget` | `analysis_finance.py` | ✅ #38 + #44 |
| 7 | `/api/mobile/{factoryId}/smart-bi/analysis/finance/budget-achievement` | `analysis_finance.py` | ✅ #32 |
| 8 | `/api/mobile/{factoryId}/smart-bi/analysis/finance/yoy-mom` | `analysis_finance.py` | ✅ #32 |
| 9 | `/api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison` | `analysis_finance.py` | ✅ #32 |
| 10 | `/api/mobile/{factoryId}/smart-bi/analysis/sales` (foundation + 4 modes) | `analysis_sales.py` | ✅ #14/#15/#20 |
| 11 | `/api/mobile/{factoryId}/smart-bi/alerts` | `analysis.py` | ✅ #14 |
| 12 | `/api/mobile/{factoryId}/smart-bi/recommendations` | `analysis.py` | ✅ batch |
| 13 | `/api/mobile/{factoryId}/smart-bi/query-templates` (GET) | `analysis.py` | ✅ batch |
| 14 | `/api/mobile/{factoryId}/smart-bi/query-templates` (POST) | `query_templates_write.py` | ✅ #48 |
| 15 | `/api/mobile/{factoryId}/smart-bi/query-templates/{id}` (PUT/DELETE) | `query_templates_write.py` | ✅ #48 |
| 16 | `/api/mobile/{factoryId}/smart-bi/datasource/list` | `datasource.py` | ✅ batch |
| 17 | `/api/mobile/{factoryId}/smart-bi/datasource/{id}/fields` | `datasource.py` | ✅ #39 |
| 18 | `/api/mobile/{factoryId}/smart-bi/datasource/{id}/history` | `datasource.py` | ✅ #39 |
| 19 | `/api/mobile/{factoryId}/smart-bi/data-date-range` | `dashboard.py` | ✅ batch |
| 20 | `/api/mobile/{factoryId}/smart-bi/incentive-plan/{targetType}/{targetId}` | `incentive_plan.py` | ✅ #43 |
| 21 | `/api/mobile/{factoryId}/smart-bi/analysis/department` (composite) | `analysis_department.py` | ✅ #52 + #57 |
| 22 | `/api/mobile/{factoryId}/smart-bi/analysis/region` (composite + per-type) | `analysis_region.py` | ✅ #56 (PR-A); 🚧 PR-B/C |
| 23 | `/api/mobile/{factoryId}/smart-bi/analysis/inventory` (4 modes) | `analysis_inventory.py` | ✅ #53 + #54; 🚧 PR-C |
| 24 | `/api/mobile/{factoryId}/smart-bi/analysis/procurement` (4 modes) | `analysis_procurement.py` (TBD) | ❌ in-flight (Chat 4 PR-A) |
| 25 | `/api/mobile/{factoryId}/smart-bi/analysis/drill-down` | `analysis_drilldown.py` (TBD) | ❌ Tier 3 |

**Total**: 25 nginx-routable endpoints.

### 2.2 Out-of-scope (stays on Java upstream after T6)

These paths **do not move** to Python. nginx config keeps Java upstream for them:

| # | nginx path | Reason | Decision PR |
|---|---|---|---|
| O1 | `/api/mobile/{factoryId}/smart-bi/analysis/quality` | Java mock-only (LCG-seeded random) | PR #37 |
| O2 | `/api/mobile/{factoryId}/smart-bi/analysis/production` | Java mock-only (LCG-seeded random) | PR #37 |
| O3 | `/api/mobile/{factoryId}/smart-bi/datasource/{id}/preview` | Java stub-only (returns `noChanges` envelope) | PR #45 |
| O4 | `/api/mobile/{factoryId}/smart-bi/datasource/upload` | Java stub-only (3 TODO, no Excel parsing/LLM) | PR #49 |
| O5 | `/api/mobile/{factoryId}/smart-bi/datasource/apply` | Java bookkeeping-stub (TODO core) | PR #50 |
| O6 | `/api/mobile/{factoryId}/smart-bi/query` | NL→SQL, LLM + Tool-Skill coupled, out-of-scope per Phase 2A lock | spec backlog `§3 Tier 4` |
| O7 | `/api/mobile/{factoryId}/smart-bi/dashboard/*` | Dashboard endpoints not in Phase 2A scope (deferred to Phase 2A+1) | backlog `§3 Dashboard` |

**T6 nginx config rule**: anything matching `/api/mobile/{factoryId}/smart-bi/...` not in §2.1 routes to Java. Easiest: `location /api/mobile/.../smart-bi/` defaults to Java, then explicit `location =` blocks for §2.1 paths route to Python.

### 2.3 Out-of-scope but related (no nginx change)

These are not under `/api/mobile/.../smart-bi/` and are unaffected by T6:
- `/api/mobile/{factoryId}/auth/*` (Java)
- `/api/mobile/{factoryId}/sales-order/*`, `/material-batch/*`, etc. (Java business endpoints)
- `/api/smartbi/excel/*` (existing direct Python path, unrelated)
- `/api/ai/intent/match` (Phase 3 AI rollout, see `plans/2026-05-01-phase3-ai-migration-rollout.md`)

---

## 3. Java upstream — current state

### 3.1 nginx config (server 139, baota-managed)

Per `plans/2026-04-11-nginx-upstream-migration-audit.md` Phase A landing:

```nginx
# /www/server/panel/vhost/nginx/_upstream_cretas.conf (auto-loaded globally)
upstream cretas_backend {
    server 47.100.235.168:10010;   # active (10020 was historical green; today 10010)
    keepalive 32;
}

# /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf
location /api/mobile/ {
    proxy_pass http://cretas_backend/api/mobile/;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 60s;
}
```

**Current behavior**: 100% of `/api/mobile/*` traffic terminates at Java port 10010 (or 10020 during blue-green flips).

### 3.2 deploy-backend.sh blue-green awareness

`deploy-backend.sh v5.0` swaps the upstream's `server` line between 10010 (blue) and 10020 (green) during deploys. T6 cutover **must not interfere** with this — see §7.3 rollback compatibility.

---

## 4. Python upstream — target state

### 4.1 Python service location

| Property | Value |
|---|---|
| Server | 47.100.235.168 (same as Java) |
| Port (prod) | 8083 |
| Port (test) | 8084 |
| systemd unit | `cretas-python.service` (prod), nohup-managed (test, pending Phase B-N) |
| Health endpoint | `GET http://47.100.235.168:8083/health` (returns 200 if router stack loaded) |
| Application startup | `uvicorn main:app --host 0.0.0.0 --port 8083` (managed by systemd) |

### 4.2 Path translation

Python's actual route paths use `{factory_id}` (snake_case path param), nginx's incoming path uses `{factoryId}` (camelCase). **They resolve identically** at the nginx layer because the path parameter is a value, not a literal — nginx doesn't care about the placeholder spelling.

Real Python routes (verified via `grep` of `backend/python/smartbi_compat/api/*.py` on 2026-05-02):

```
/api/mobile/{factory_id}/smart-bi/alerts
/api/mobile/{factory_id}/smart-bi/analysis/finance
/api/mobile/{factory_id}/smart-bi/analysis/finance/budget-achievement
/api/mobile/{factory_id}/smart-bi/analysis/finance/category-comparison
/api/mobile/{factory_id}/smart-bi/analysis/finance/yoy-mom
/api/mobile/{factory_id}/smart-bi/analysis/inventory
/api/mobile/{factory_id}/smart-bi/analysis/region
/api/mobile/{factory_id}/smart-bi/analysis/sales
/api/mobile/{factory_id}/smart-bi/data-date-range
/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/fields
/api/mobile/{factory_id}/smart-bi/datasource/{datasource_id}/history
/api/mobile/{factory_id}/smart-bi/datasource/list
/api/mobile/{factory_id}/smart-bi/incentive-plan/{target_type}/{target_id}
/api/mobile/{factory_id}/smart-bi/query-templates
/api/mobile/{factory_id}/smart-bi/query-templates/{template_id}
/api/mobile/{factory_id}/smart-bi/recommendations
```

Plus shipped-during-Phase-2A-completion expected paths (department / procurement / drill-down).

### 4.3 New upstream definition

```nginx
# /www/server/panel/vhost/nginx/_upstream_cretas_python.conf (NEW, auto-loaded globally)
upstream cretas_python {
    server 47.100.235.168:8083;
    keepalive 16;       # half of Java's 32 since Python connection-per-request semantics
}
```

**Note**: Python's uvicorn worker model can saturate easily under high keepalive concurrency. Start with 16 and tune from monitoring data.

---

## 5. nginx server block draft

This is the post-T6 target config for `/api/mobile/{factoryId}/smart-bi/*`. Anything not explicitly matched falls through to Java (default).

```nginx
# /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf
# (or appropriate vhost — confirm with sysadmin which vhost serves /api/mobile/)

# === Phase 2A T6 cutover: SmartBI to Python ===

# Python-routed paths (Phase 2A in-scope, §2.1)
# Use regex location with priority over default /api/mobile/

location ~ ^/api/mobile/[^/]+/smart-bi/(alerts|recommendations|data-date-range)$ {
    proxy_pass http://cretas_python;
    include cretas-python-proxy-defaults.conf;
}

location ~ ^/api/mobile/[^/]+/smart-bi/analysis/(finance|sales|department|region|inventory|procurement|drill-down)(/.*)?$ {
    proxy_pass http://cretas_python;
    include cretas-python-proxy-defaults.conf;
}

location ~ ^/api/mobile/[^/]+/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ {
    proxy_pass http://cretas_python;
    include cretas-python-proxy-defaults.conf;
}

# Java-routed paths (out-of-scope, §2.2 — explicit allow-list to keep on Java)
# These regex patterns match BEFORE the catch-all below.

location ~ ^/api/mobile/[^/]+/smart-bi/analysis/(quality|production)$ {
    proxy_pass http://cretas_backend;
    include cretas-java-proxy-defaults.conf;
}

location ~ ^/api/mobile/[^/]+/smart-bi/datasource/[^/]+/preview$ {
    proxy_pass http://cretas_backend;
    include cretas-java-proxy-defaults.conf;
}

location ~ ^/api/mobile/[^/]+/smart-bi/datasource/(upload|apply)$ {
    proxy_pass http://cretas_backend;
    include cretas-java-proxy-defaults.conf;
}

location ~ ^/api/mobile/[^/]+/smart-bi/(query|dashboard) {
    proxy_pass http://cretas_backend;
    include cretas-java-proxy-defaults.conf;
}

# Catch-all: everything else under /api/mobile/ stays Java
location /api/mobile/ {
    proxy_pass http://cretas_backend;
    include cretas-java-proxy-defaults.conf;
}
```

### 5.1 Proxy defaults includes (NEW, snapshot to repo)

Two include files reduce duplication and let either upstream evolve independently:

```nginx
# cretas-python-proxy-defaults.conf
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header Authorization $http_authorization;
proxy_read_timeout 30s;     # Python is faster but more sensitive to long-tails
proxy_connect_timeout 5s;
proxy_send_timeout 30s;
proxy_buffering off;        # SSE-friendly for future dashboard streams
```

```nginx
# cretas-java-proxy-defaults.conf
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_read_timeout 60s;
```

### 5.2 Snapshot to repo

Before applying on the server, the new vhost + 2 include files MUST be committed to the repo for reproducibility. Suggested location: `scripts/deploy/nginx/`. This is a deviation from current state — currently nginx config is server-only (baota-managed), not version-controlled. Spec-only doc; actual snapshot is a follow-up PR co-located with cutover execution.

---

## 6. Staged rollout plan

Inspired by `plans/2026-05-01-phase3-ai-migration-rollout.md` §3 (Phase 3 AI rollout). 4 stages, 24h soak per stage, GO/NO-GO checkpoint between each.

### Stage T6.1 — Pre-cutover dry-run (0% Python traffic, parallel verify)

**Trigger**: All §9.1 prereqs ✅.

**Action**: Dual-call canary script. For 24h, run a sidecar tool that calls **both** Java and Python paths for a sampled subset of in-scope endpoints (1 sample/min) and `dict_eq` compares responses. nginx config NOT yet changed.

```bash
# Run on 47, output to /var/log/cretas-t6-dryrun.log
bash /www/wwwroot/cretas/scripts/t6-dryrun-compare.sh \
    --duration 24h \
    --endpoints /tmp/t6-in-scope-endpoints.txt \
    --interval 60
```

**GO criteria**:
- ≥99% dict_eq pass across all sampled endpoints
- 0 dict_eq fails for top-5 traffic endpoints (finance composite, sales gold, alerts, dashboard composite, recommendations)
- Python p99 latency ≤ Java p99 + 500ms across the 24h window

**NO-GO**: any dict_eq fail in top-5; >1% fails overall. Investigate — DO NOT proceed.

### Stage T6.2 — Canary 10% (1 factory)

**Trigger**: T6.1 GO.

**Action**: Pick a single low-impact factory (e.g., F999 test factory or a designated low-volume real factory). Apply nginx config that routes ONLY that factory's traffic to Python; all other factories stay on Java.

```nginx
# Inserted ABOVE the regex blocks in §5
location ~ ^/api/mobile/(F999)/smart-bi/(alerts|recommendations|...)$ {
    proxy_pass http://cretas_python;
    include cretas-python-proxy-defaults.conf;
}
# Below this, the §5 regex blocks still target Java for non-F999 factories.
# Hack: easiest is to invert default to Java + explicit Python only for F999.
```

**Soak**: 24h.

**GO criteria**:
- Python error rate < 0.5%
- Python p50 < 200ms / p99 < 2000ms
- Java fallback rate (errors causing client-side retry to Java path): 0
- 0 user-reported issues

**Kill switch**: revert nginx config to pre-T6.2 state, reload. ~30s recovery.

### Stage T6.3 — 50% traffic (multi-factory)

**Trigger**: T6.2 GO.

**Action**: Expand to ~50% of factories. Easiest impl: split factories alphabetically (e.g., F[A-M] → Python, F[N-Z] → Java) using nginx regex.

**Soak**: 24h.

**GO criteria**: same as T6.2 thresholds, applied across the larger sample.

### Stage T6.4 — 100% traffic

**Trigger**: T6.3 GO.

**Action**: Apply final nginx config from §5 — all in-scope routes go to Python, all out-of-scope stay Java. Reload.

**Soak**: 7-day extended observation window.

**GO criteria** (for Java backend decommission step in §9.4):
- 7 days no Python service restarts
- 7 days error rate <0.5%
- 7 days no client-reported regressions
- 0 critical bugs filed

If GO: schedule Java backend decommission for relevant SmartBI service classes (Phase 2A+1 deprecation; out of T6 scope).

---

## 7. Rollback plan

### 7.1 Trigger conditions (any one ⇒ immediate rollback)

| Metric | Threshold | Window | Source |
|---|---|---|---|
| Python error rate | > 2% | 5 min | nginx access log 5xx + Python `intent_match_records` errors |
| Python p99 latency | > 3000ms | 5 min | nginx upstream timing |
| Java fallback (client retry) | > 5% requests | 5 min | nginx access log 502/503 → client retries |
| Python service down | service dead | any | systemctl |
| User-reported critical bug | severity ≥ P1 | any | bug tracker |
| dict_eq divergence | any new occurrence in T6.4 100% stage | any | sampled comparison sidecar |

### 7.2 Rollback procedure

```bash
# On server 139 (nginx gateway)
ssh root@139.196.165.140
cd /www/server/panel/vhost/nginx/

# Restore the pre-T6 vhost config
cp api.cretaceousfuture.com.conf.bak.<pre-t6-timestamp> api.cretaceousfuture.com.conf

# Validate + reload
nginx -t
nginx -s reload

# Verify
curl -s "https://api.cretaceousfuture.com/api/mobile/F001/smart-bi/data-date-range" \
     -H "Authorization: Bearer <token>" \
     | jq '.success'
```

Recovery time: ~5s nginx reload + ~30s for in-flight requests to drain. Total ~35s.

### 7.3 Rollback compatibility with deploy-backend.sh blue-green

`deploy-backend.sh v5.0` may swap the `cretas_backend` upstream's `server` line during a Java deploy. T6 nginx changes touch the **vhost file** (`api.cretaceousfuture.com.conf`), not `_upstream_cretas.conf`. They are independent. A Java deploy mid-T6 does NOT affect the Python routing decisions — both upstreams are referenced by name (`cretas_backend` / `cretas_python`).

**However**: if a Java deploy lands during a T6.x stage, Java side health check should be re-run before continuing — a transient Java 502 from blue-green swap could trigger T6 rollback false-alarm.

### 7.4 Java backend NOT torn down until T6.4 + 7 days

Per §6 stage T6.4 GO criteria, the Java SmartBI services stay running and healthy throughout the 7-day soak. Decommission is a separate later operation.

---

## 8. Monitoring & metrics

### 8.1 Side-by-side dashboard (build BEFORE T6.1)

Mirrors `plans/2026-05-01-phase3-ai-migration-rollout.md` §2.2 dashboard pattern.

| Metric | Java baseline | Python target | Source |
|---|---|---|---|
| Request rate (rpm, in-scope endpoints) | matches T0 baseline | + within 5% | nginx access log |
| p50 latency | per-endpoint baseline | ≤ Java p50 | nginx upstream timing |
| p99 latency | per-endpoint baseline | ≤ Java p99 + 500ms | nginx upstream timing |
| Error rate (5xx) | per-endpoint baseline | ≤ Java baseline | nginx access log |
| Service uptime | systemd cretas-backend | systemd cretas-python | `systemctl is-active` |
| dict_eq divergence rate (T6.1 only) | n/a | 0% in top-5, ≥99% overall | T6.1 dryrun sidecar |

### 8.2 Per-stage metric snapshots

Each T6.x stage END must produce a snapshot doc in `docs/superpowers/handoff/<date>-phase2a-t6-<stage>-snapshot.md` capturing:
- 24h windowed metrics for the GO criteria
- Notable anomalies (spikes, restarts, deploys)
- GO/NO-GO decision + rationale
- Approver name + timestamp

### 8.3 Critical alerts (build BEFORE T6.2)

prometheus alerts (suggestion — exact tooling per ops team):
- `cretas_python_error_rate > 2% for 5m` → page oncall
- `cretas_python_p99 > 3000ms for 5m` → page oncall
- `cretas_python_service_down` → page oncall + auto-rollback if T6.2-T6.4
- `cretas_t6_dict_eq_fail_count > 0 in last 1h during T6.1` → notify oncall

---

## 9. Ops checklist

### 9.1 Pre-cutover (T6.0, before T6.1)

#### 9.1.1 Phase 2A scope completion verification

- [ ] §2.1 list — every endpoint has ✅ ship status (PR-A + PR-B + PR-C complete)
- [ ] No regression: `pytest tests/python/smartbi_compat/` passes 100%
- [ ] Each endpoint has ≥1 contract test (F999 byte-shape gate via `_strip_volatile`)
- [ ] Each endpoint has ≥1 F001 manual smoke test result documented (acceptable: dict_eq pass with stripped volatile keys)
- [ ] Rule 8 + Rule 9 audited per endpoint, baked into impl

#### 9.1.2 Java baseline window

- [ ] 1-week Java upstream metrics captured for §2.1 endpoints (rpm, p50, p99, error rate)
- [ ] No 5xx anomalies (>0.5%) in window
- [ ] No service restarts in last 48h pre-T6

#### 9.1.3 Python production-readiness

- [ ] `cretas-python.service` running, enabled, healthy
- [ ] uvicorn worker count ≥ 4 (default; tune if cpu-bound)
- [ ] asyncpg pool size ≥ 40 per T4 baseline
- [ ] No service restart in 48h pre-T6
- [ ] `/health` endpoint returns 200 in < 100ms

#### 9.1.4 Infrastructure

- [ ] `_upstream_cretas_python.conf` deployed to server 139 + auto-loaded by nginx (verify with `nginx -T | grep upstream`)
- [ ] `cretas-python-proxy-defaults.conf` + `cretas-java-proxy-defaults.conf` deployed
- [ ] vhost backup created: `api.cretaceousfuture.com.conf.bak.<pre-t6-timestamp>`
- [ ] Snapshot of all nginx config files committed to repo at `scripts/deploy/nginx/` for reproducibility
- [ ] T6.1 dryrun sidecar script ready: `scripts/t6-dryrun-compare.sh`
- [ ] Dashboard built (§8.1)
- [ ] Critical alerts configured (§8.3)

### 9.2 During cutover (T6.1 → T6.4)

For each stage:

- [ ] Execute action per §6 stage definition
- [ ] Wait full 24h soak window (or 7d for T6.4)
- [ ] Capture metrics snapshot (§8.2)
- [ ] GO/NO-GO decision documented
- [ ] If GO: proceed to next stage; if NO-GO: rollback per §7

### 9.3 Post-cutover (after T6.4 + 7d soak)

- [ ] No regression confirmed across 7d
- [ ] Final metrics snapshot doc filed
- [ ] Phase 2A backlog map updated: §2.4 deferred items remain on Java; all §2.3 backlog items moved to §2.1 ✅
- [ ] Python `/api/smartbi/*` direct routes DEPRECATED in favor of `/api/mobile/.../smart-bi/*` (single-source-of-truth)
- [ ] Memory updated: `project_phase2a_t6_complete.md`

### 9.4 Java backend decommission (T6+30d, separate task)

NOT part of T6. Tracked separately:
- 30 days of post-T6.4 stable operation
- Then schedule deletion of obsolete Java services (sister to Phase 3.A in `2026-05-01-phase3-ai-migration-rollout.md` §4.1)
- Per-service PR cycle, not bulk
- Final step: remove Java SmartBI controllers + their service classes; keep DB tables + deferred endpoints (§2.2)

---

## 10. Open questions / risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | nginx regex complexity → wrong path routes Python instead of Java | T6.0 ops checklist 9.1.4: snapshot + repo-commit nginx config; T6.1 dryrun sidecar tests every §2.1 + §2.2 path; pre-cutover lint via `nginx -t` |
| R2 | Python uvicorn worker pool exhaustion under prod load | T4 baseline pool size 40 + keepalive 16; canary T6.2 catches before full traffic; rollback if p99 > 3000ms |
| R3 | F001 manual smoke divergence not caught in T6.1 dryrun (sampling rate too low) | Dryrun samples 1/min for 24h ≈ 1440 calls/endpoint; for high-traffic endpoints raise to 1/30s; for low-traffic (<10 calls/day in real prod) flag in §9.1.1 with manual sign-off |
| R4 | Mobile/web client caches old `/api/mobile/...` responses; cache-busting needed? | Verify with frontend team before T6.4. Most Cretas paths use cache-control: no-store (default). Confirm. |
| R5 | Phase 2A in-scope endpoint set drifts during T6.0 (new endpoint shipped after spec frozen) | T6 spec assumes scope freeze date. Any new endpoint shipped after freeze must explicitly extend §2.1 + redo T6.0 dryrun for that path. |
| R6 | Two specs (this + per-endpoint impl PRs) drift in deferred list | §2.2 list IS the source of truth for "stays on Java"; backlog map §2.4 mirrors it. Periodic cross-check during T6.0. |

---

## 11. References

- `plans/2026-04-11-nginx-upstream-migration-audit.md` — nginx upstream pattern (`cretas_backend` named upstream)
- `plans/2026-05-01-phase3-ai-migration-rollout.md` — staged rollout + kill-switch + dashboard pattern (Phase 3 sister)
- `plans/2026-04-10-phase3-cloud-sg-cutover.md` — Phase 3 SG cutover precedent (sub-domain segmentation)
- `plans/2026-05-01-phase2a-remaining-endpoints-backlog.md` — Phase 2A scope tracker (auth source for §2.1 / §2.2 lists)
- `handoff/2026-04-29-phase2a-T5-handoff.md` — Phase 2A original task numbering (T0-T9), where T6 was first defined
- `.claude/rules/server-operations.md` — server 47 / 139 architecture, double env (prod/test), systemd patterns
- `.claude/rules/aliyun-credentials.md` — security group context for cross-server connections (server 139 → 47:8083 direct)
- Memory `project_apr30_tool_skill_stays_java.md` — Phase 2A scope lock (Tools/Skills/AIIntent stay Java)
- Memory `feedback_deploy_pipeline.md` — deploy-backend.sh v5.0 blue-green semantics

---

**Doc status**: Draft for review. Not gated on any in-flight Phase 2A PR; can merge as soon as reviewed since it documents the planned end-state — implementation/execution is unblocked by Phase 2A 100% completion (~5-10 working days estimated).
