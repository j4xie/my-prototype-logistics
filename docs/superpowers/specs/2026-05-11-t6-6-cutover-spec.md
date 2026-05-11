# T6.6 Cutover Spec — `/analysis/production` + `/analysis/quality` nginx Traffic Shift

**Status**: ⛔ DRAFT — Doc-only cutover plan. No nginx mutation, no deploy, no code. Dispatch input for downstream T6.6.1-4 stage MOs.
**Spec date**: 2026-05-11
**Author**: chat1 (T6.6 cutover spec writer, post chat-A1/chat1 PR #350 + #360 ship)
**Branch**: `spec/t6-6-cutover`
**Worktree**: `.worktrees/t6-6-cutover-spec`
**Base SHA**: `4503a74223` → fast-forward HEAD `d5cd41802a` (PR #360 merge)
**Audience**: organizer (review) → downstream T6.6.x stage MO chats (execute)
**Trigger**: organizer dispatch 2026-05-11 — "T6.6 cutover spec — analysis_production + analysis_quality 端 nginx 流量切换计划"

---

## 0. TL;DR

After T6.6 cutover, nginx (server 139) routes `/api/mobile/{factoryId}/smart-bi/analysis/(production|quality)` to Python (47:8083) for restaurant tenants, with Java (47:10010) as the fallback for factory tenants. This is the polymorphic Option A endpoint (per Q-DEC-8) finally exposed to live traffic.

| Item | This spec |
|---|---|
| Endpoints in scope | `/api/mobile/{factoryId}/smart-bi/analysis/production` + `/analysis/quality` |
| Out-of-scope §2.2 reversal | `2026-05-02-phase2a-t6-nginx-cutover-design.md §2.2` explicitly KEPT these on Java because they were Java-mock-only at that time. T6.6 reverses that decision **for restaurant tenants only**: PR #350/#352/#354/#360 land Python impl behind the same URL. Factory tenants stay on Java until Phase 2D ships factory Silver schema. |
| Tenant-typed dispatch | nginx routes by factory_id prefix heuristic (per-stage explicit whitelist). Authoritative tenant detection happens server-side in Python `smartbi_compat.tenant.get_tenant_type` (mirrors Java `SmartBIServiceImpl.isRestaurantTenant`). |
| Stage gates | T6.6.1 dryrun (parity gate ≥ 99.5%) → T6.6.2 canary (R_TEST_MOCK only) → T6.6.3 cascade (R_ILTEATRO_REAL → R_QINGHUAJIAO_REAL → all restaurants) → T6.6.4 cleanup (Java deprecation warning header) |
| Effort | Each cascade stage ≤ 1pd; chat3 parity gate harness (PR #359) reused for T6.6.1 |
| Customer-facing risk | Low — restaurant tenants currently have 0 paying customers using these endpoints (per active-E2E rule context). Cutover blip < 2 min (nginx graceful reload). |
| Active-E2E gate | Replaces 30-day passive soak per HARD `feedback_active_e2e_replaces_passive_soak.md` — per stage runs 15-30 min smoke covering customer-facing surface. |

⛔ **HOLD blocks**:

- Spec only. No nginx vhost mutation, no `nginx -s reload`, no deploy script invocation, no DB writes.
- T6.6.1 dispatch BLOCKED until chat4's restaurant `/analysis/quality` impl PR (mirror of chat-A2 PR #352 for the quality side) merges. Until then, Python `/analysis/quality` for restaurant tenants raises `NotImplementedError` → routing restaurants there guarantees 500.
- T6.6.2 canary uses `R_TEST_MOCK` (chat3 mock data factory_id from PR #359), NOT F999. F999 is a factory tenant; routing it to Python would 500 because chat-A1 PR #350 deferred factory branch to Phase 2D.
- T6.6.3 cascade gates each require active-E2E pass before progressing per HARD `feedback_active_e2e_replaces_passive_soak.md`.
- STOP-and-ping organizer BEFORE pushing this spec per HARD `feedback_pause_before_deploy_or_push.md`.
- No customer comms drafted yet for restaurant pilots — comms plan template §6 references T6.4 customer comms structure but per-customer fill-in is out-of-scope for chat1.

---

## 1. Background

### 1.1 What T6.6 is

T6.6 is the polymorphic-endpoint extension of the original Phase 2A T6 nginx cutover, completing the `/analysis/production` + `/analysis/quality` Java→Python migration for the restaurant-tenant branch only.

| T6.x stage | Scope | Status |
|---|---|---|
| **T6.1-T6.4** (original Phase 2A) | 25 nginx-routable SmartBI alias endpoints (finance / sales / inventory / region / department / procurement / drill-down) | LIVE prod since 2026-05-10 (T6.3 + T6.4 cascade complete) |
| **T6.5** | Java-side dead code sweep + KEEP list maintenance | LIVE (chats 1-9 PR sweep, see memory `project_2026_05_09_t6_5_phase_a_close.md`) |
| **T6.6** (this spec) | `/analysis/production` + `/analysis/quality` polymorphic Option A — restaurant tenant Python branch | spec draft 2026-05-11 |

### 1.2 What changed since `2026-05-02-phase2a-t6-nginx-cutover-design.md §2.2`

The original T6 design **explicitly excluded** `/analysis/production` + `/analysis/quality` from Phase 2A cutover scope:

> | O1 | `/api/mobile/{factoryId}/smart-bi/analysis/quality` | Java mock-only (LCG-seeded random) | PR #37 |
> | O2 | `/api/mobile/{factoryId}/smart-bi/analysis/production` | Java mock-only (LCG-seeded random) | PR #37 |

The rationale at that time: Java side was mock-only LCG random, so byte-shape parity was impossible. T6.6 reverses this **for restaurant tenants only** because PR chain #350 → #352 → #354 → #360 landed Python impl with real-DB-backed restaurant semantics (per Q-DEC-4/5 Option B restaurant redefine, PR #330 §1):

| PR | What landed | Tenant scope |
|---|---|---|
| #350 (chat-A1) | `tenant.py` shared module + `analysis_production.py` skeleton + Option B factory defer | Both branches `NotImplementedError` |
| #352 (chat-A2) | Restaurant `/analysis/production` M1+M2+M3 LIVE (KITCHEN_STATION_UTILIZATION / AVG_PREP_TIME / TABLE_TURNOVER_RATE proxy) | Restaurant branch LIVE; factory branch still deferred |
| #354 (chat-B1) | `analysis_quality.py` skeleton both branches `NotImplementedError` | Both branches deferred |
| #360 (chat1) | `main.py` register routers + Java `PythonSmartBIClient.callAnalysisProduction` / `callAnalysisQuality` + `PythonSmartBIConfig` endpoint constants | Routing wired; no traffic yet |
| (pending) chat4 | Restaurant `/analysis/quality` N1-N4 impl (mirror of PR #352 for quality side) | **PREREQ for T6.6.1** |

### 1.3 Why a separate cutover spec

`2026-05-02-phase2a-t6-nginx-cutover-design.md` is the structural blueprint (upstream definitions, vhost regex patterns, rollback procedure, blue-green compatibility). T6.6 is mechanically similar but introduces three new dimensions that warrant their own spec:

1. **Polymorphic dispatch by factory_id**: previous T6 stages routed by URL path only (path-based cutover). T6.6 routes by `{factoryId}` path-param prefix — nginx must inspect the path's first capture group. The pattern was hinted in `2026-05-02 §6 Stage T6.2 canary` (F999-only regex) but never executed at production scale; T6.6.2-3 productionizes it.
2. **Tenant-typed Python branch behavior**: Python factory branch raises `NotImplementedError` for both endpoints; routing factory tenants to Python guarantees 500. The previous T6.1-4 cutover had no equivalent constraint because all 25 endpoints had full Python impl.
3. **Two-endpoint atomic cutover**: T6.6 ships `/analysis/production` + `/analysis/quality` together to keep the nginx rule simple (one regex per stage covers both paths). Splitting them into T6.6a + T6.6b would double the nginx mutation count without operational benefit.

---

## 2. Cutover scope

### 2.1 In-scope routes (cutover Java → Python at T6.6.4)

| # | nginx path | Python module | Java side after T6.6.4 | Restaurant tenant action | Factory tenant action |
|---|---|---|---|---|---|
| 1 | `/api/mobile/{factoryId}/smart-bi/analysis/production` | `smartbi_compat.api.analysis_production` (PR #350 + #352) | KEEP (factory tenant fallback) + deprecation warning header per T6.6.4 | → Python (PR #352 restaurant M1+M2+M3 LIVE) | → Java (Python factory branch raises NotImplementedError until Phase 2D Silver migration) |
| 2 | `/api/mobile/{factoryId}/smart-bi/analysis/quality` | `smartbi_compat.api.analysis_quality` (PR #354 skeleton + chat4 restaurant impl pending) | KEEP (factory tenant fallback) + deprecation warning header per T6.6.4 | → Python (after chat4 restaurant impl PR merges) | → Java (Python factory branch raises NotImplementedError until Phase 2D Silver migration) |

### 2.2 Out-of-scope (stays Java fully)

Everything else under `/api/mobile/{factoryId}/smart-bi/*` is **unaffected**. T6.1-T6.4 already shipped Python migration for those paths; their nginx routing is independent of T6.6.

Factory-tenant `/analysis/production` + `/analysis/quality` stay on Java **indefinitely** until Phase 2D ships:

- `V20260XYZ_NN__t6_6_factory_production_silver.sql` (NEW migration creating `fact_production_batch`, `fact_equipment_event`, `fact_quality_inspection` tables)
- Python factory branch impl replacing the `NotImplementedError` stub in `_factory_production_dispatch` / `_factory_quality_dispatch`

When Phase 2D ships, a follow-up T6.7 cutover spec will flip factory tenants to Python.

### 2.3 Authoritative tenant detection

nginx routes by factory_id **prefix heuristic** (per-stage explicit whitelist regex). The authoritative tenant detection happens in Python:

```python
# backend/python/smartbi_compat/tenant.py (PR #350)
async def get_tenant_type(factory_id: str, conn) -> TenantType:
    row = await conn.fetchrow(
        "SELECT type FROM factories WHERE factory_id = $1",
        factory_id,
    )
    if row is None:
        return TenantType.FACTORY
    return TenantType.from_db_value(row["type"])
```

`TenantType.RESTAURANT` / `TenantType.BRANCH` → restaurant dispatcher. `TenantType.FACTORY` / `HEADQUARTERS` / `CENTRAL_KITCHEN` → factory dispatcher (raises `NotImplementedError` in chat-A1 Option B).

If nginx mis-routes a factory tenant to Python, Python correctly identifies it via DB query and raises `NotImplementedError` → 500. This is a safety net but should not be relied on at scale; per-stage regex must be accurate.

---

## 3. Stage gates

Inspired by `2026-05-02-phase2a-t6-nginx-cutover-design.md §6` + `2026-05-08-t6-4-real-customers-cutover-runbook.md` Strategy B staggered timing.

### 3.1 T6.6.1 — Pre-cutover parity dry-run (0% live traffic shift)

**Trigger**: chat4's restaurant `/analysis/quality` PR merged + chat3 parity-gate harness (PR #359) available + R_ILTEATRO_REAL + R_QINGHUAJIAO_REAL Silver seed data present in `smartbi_prod_db`.

**Action**: Run chat3's `scripts/parity-gate/compare.py` against Java (10010) and Python (8083) for both endpoints across the cascade tenant list. Compare with `dict-eq` semantics per `python-java-port.md` Rule 4. nginx config NOT yet changed; this is parallel verification only.

```bash
# T6.6.1 parity dry-run — 4 factory × 2 endpoint × 4 analysisType combos = 32 comparisons
for FACTORY in R_TEST_MOCK R_ILTEATRO_REAL R_QINGHUAJIAO_REAL F999; do
  for ENDPOINT in production quality; do
    for ATYPE in oee efficiency equipment overview; do  # quality uses fpy/defect/rework/overview
      python scripts/parity-gate/compare.py \
        --factory "$FACTORY" \
        --endpoint "/api/mobile/{factory_id}/smart-bi/analysis/$ENDPOINT" \
        --params "analysisType=$ATYPE&startDate=2026-01-01&endDate=2026-01-31" \
        --java-base http://47.100.235.168:10010 \
        --python-base http://47.100.235.168:8083 \
        --output "reports/t6-6-1/$FACTORY-$ENDPOINT-$ATYPE.json"
    done
  done
done
```

**Expected divergence categories** (acceptable per Phase 2A dict-eq gate):

- F999 (factory tenant) — Python raises `NotImplementedError` → 500 vs Java mock envelope. **NOT a regression** — Java side is mock-LCG; Python deferral is explicit per PR #350. Skip F999 from match-rate calculation, document as Phase 2D pending.
- R_TEST_MOCK — Java side returns mock envelope (LCG-seeded); Python side returns real envelope from chat3 mock-data seed. **Will diverge by construction** — used as a routing smoke, not parity gate. Document as expected.
- R_ILTEATRO_REAL + R_QINGHUAJIAO_REAL — Both Java (mock) and Python (real-DB) produce envelopes. Java is mock-LCG so they will diverge. **Phase 2A dict-eq gate does NOT apply** — there's no "Java truth" for restaurant tenant. Use these comparisons to validate Python envelope shape (Rule 8 / 9 fields/order/null) but not for go/no-go decisions.

**GO criteria** (relaxed vs T6.1 dryrun bar of 99.945%):

- chat3 harness completes 32/32 comparisons without crash
- Python response time p99 < 2000 ms across all 32 comparisons
- Python error rate < 1% (excluding the F999 deferred 500s, which are expected)
- Restaurant-tenant Python envelopes pass Rule 8 (Map.of key order) + Rule 9 (Lombok null emit) self-validation via chat3's `_strip_volatile` + `dict_eq` audit
- No 5xx from Python that aren't the documented F999 NotImplementedError

**NO-GO**: any non-F999 Python crash; any Rule 8/9 envelope shape regression. Investigate — DO NOT proceed to T6.6.2.

**Duration**: ~30 min to run, ~30 min to review. Run during low-traffic window OR alongside chat3 harness self-test.

### 3.2 T6.6.2 — Canary on R_TEST_MOCK (mock restaurant only)

**Trigger**: T6.6.1 GO + organizer explicit sign-off.

**Action**: Apply nginx config that routes ONLY `R_TEST_MOCK` traffic for both endpoints to Python; all other factories stay on Java.

⚠️ **MO clarification baked-in**: original dispatch listed F999 as the canary first stop. chat1 spec writer flagged this as a tenant-type mismatch (F999 is factory-tenant; Python factory branch is Phase 2D deferred). **Recommendation**: replace F999 canary with `R_TEST_MOCK` canary. F999 stays on Java throughout T6.6.x because there is no Python factory branch to canary against. Organizer reviews this on PR.

**Soak**: **Active-E2E** session per HARD `feedback_active_e2e_replaces_passive_soak.md` — 15-30 min smoke covering:

- `R_TEST_MOCK` `/analysis/production` `?analysisType=oee` → expect Python real envelope with M1/M2/M3 markers
- `R_TEST_MOCK` `/analysis/production` `?analysisType=overview` → expect Python overview envelope
- `R_TEST_MOCK` `/analysis/quality` `?analysisType=fpy` → expect Python N1-N4 envelope (chat4 impl)
- `R_TEST_MOCK` `/analysis/quality` `?analysisType=overview` → expect Python overview envelope
- 1 deliberate factory-tenant request via the same nginx rule (F001) → expect Java response (nginx whitelist excludes F001)

Active-E2E replaces 24h passive soak. Smoke uses real browser-issued JWT (factory_super_admin role) hitting the nginx endpoint, not direct Python curl.

**GO criteria**:

- 5 / 5 smoke cases return 200
- Python `R_TEST_MOCK` response shape matches Rule 9 envelope contract (chat3 harness re-verify, ~5 min)
- nginx access log shows F001 request hit Java upstream (not Python) — confirms factor-tenant negative case
- nginx error log: 0 5xx for `R_TEST_MOCK` Python responses

**Kill switch**: revert nginx vhost file backup, `nginx -t && nginx -s reload`. ~30s recovery (per `2026-05-02 §7.2` precedent).

### 3.3 T6.6.3 — Cascade real-restaurant pilots

**Trigger**: T6.6.2 GO + organizer explicit sign-off + customer comms sent per §6.

Three sub-stages, each adding one factory_id to the nginx Python whitelist. Each sub-stage runs active-E2E gate before advancing.

#### T6.6.3a — R_ILTEATRO_REAL (西餐 pilot, Q-DEC-4 reference factory)

**Action**: nginx whitelist becomes `(R_TEST_MOCK|R_ILTEATRO_REAL)`.

**Active-E2E**: 15-30 min smoke per §3.2 but using IL TEATRO real customer data.

- Verify M3 TABLE_TURNOVER_RATE proxy returns real `bills_per_store_per_day` value (not null)
- Verify N2 dish return rate returns chat4 real impl (not stub)
- Verify Java fallback for any non-restaurant tenant unchanged
- 0 user-reported issues for 60 min post-cutover

**GO criteria**: same as T6.6.2 + IL TEATRO real-data envelope validates against frontend rendering (web-admin dashboard page renders without 5xx / blank panels).

#### T6.6.3b — R_QINGHUAJIAO_REAL (川菜 pilot, Q-DEC-5 reference factory)

**Action**: nginx whitelist becomes `(R_TEST_MOCK|R_ILTEATRO_REAL|R_QINGHUAJIAO_REAL)`.

**Active-E2E**: 15-30 min smoke with 青花椒 customer data. Specifically validate that `R_QINGHUAJIAO_REAL` does NOT collide with `RES_3101_009` (青花椒 staging seed, separate factory_id per `2026-05-09-t6-6-q1-real-db-amendment.md §4.3` footnote).

**GO criteria**: same as T6.6.3a + collision verification (different responses for `R_QINGHUAJIAO_REAL` vs `RES_3101_009`).

#### T6.6.3c — All restaurant tenants (full cascade)

**Action**: nginx rule shifts from explicit factory_id whitelist to tenant-type heuristic regex. See §4 for the rule choices.

**Active-E2E**: 30 min smoke covering at least 5 restaurant tenants (mix of `R_*` / `RES_*` / `R001` naming variants) + 2 factory tenants (F001, F006) for negative validation.

**GO criteria**:

- All 7 smoke cases return correct dispatch (restaurant → Python, factory → Java)
- nginx access log shows correct upstream selection per request
- 0 5xx across all restaurant tenant calls for 60 min post-cutover

### 3.4 T6.6.4 — Cleanup + Java deprecation header

**Trigger**: T6.6.3c GO + 24-72h observation window.

**Action**:

1. nginx Java upstream for `/analysis/(production|quality)` adds response header `X-SmartBI-Deprecated: T6.6 — restaurant tenants moved to Python. Factory tenant impl deferred to Phase 2D.` This signals to downstream consumers (frontends, monitoring) that the Java path is in deprecated-fallback mode.
2. Java `SmartBIAnalysisController` annotates the two endpoint methods with `@Deprecated` Javadoc pointing to the Python module for restaurant tenants.
3. `PythonSmartBIClient.callAnalysisProduction` / `callAnalysisQuality` (added by PR #360) become the canonical Java→Python forwarding pair for any Java-side call that needs the polymorphic envelope.

**GO criteria**: Code changes pass `mvn compile` + Vue tsc + existing unit tests; deprecation header visible in nginx access log via `curl -I`.

**Note**: Java backend is NOT decommissioned at T6.6.4 because factory-tenant traffic continues to use Java until Phase 2D. T6.7 (post-Phase 2D) will revisit decommission.

---

## 4. nginx rule diff (target post-T6.6.3c)

### 4.1 Target vhost diff (server 139, baota-managed)

The diff is **additive** — inserted ABOVE the catch-all `/api/mobile/` block in `api.cretaceousfuture.com.conf`. Pattern follows `2026-05-02 §5` block structure.

```nginx
# === T6.6 cutover: restaurant tenants → Python for /analysis/(production|quality) ===
# Effective T6.6.3c (full cascade). Prior stages use explicit factory_id whitelist (§4.2).
#
# Tenant heuristic: factory_id starting with R_*, RES_*, or matching R\d+ is treated as
# restaurant. Authoritative tenant detection happens server-side in Python
# (smartbi_compat.tenant.get_tenant_type queries cretas_db.factories.type, mirroring
# Java SmartBIServiceImpl.isRestaurantTenant). nginx prefix routing is a proxy
# heuristic; mis-classification yields a Python `NotImplementedError` → 500 at the
# dispatcher (chat-A1 PR #350 Option B), which is a safe-failure mode but should not
# happen at scale.

location ~ ^/api/mobile/(R_[^/]+|RES_[^/]+|R[0-9]+)/smart-bi/analysis/(production|quality)$ {
    proxy_pass http://cretas_python;
    include cretas-python-proxy-defaults.conf;
}

# Factory tenants for the same endpoints stay on Java (default fallback).
# T6.6.4 adds X-SmartBI-Deprecated response header on this path.
location ~ ^/api/mobile/(F[^/]+|HQ_[^/]+|CK_[^/]+)/smart-bi/analysis/(production|quality)$ {
    proxy_pass http://cretas_backend;
    include cretas-java-proxy-defaults.conf;
    # T6.6.4 only:
    add_header X-SmartBI-Deprecated "T6.6 — restaurant tenants on Python; factory tenants stay on Java pending Phase 2D";
}

# Catch-all unchanged from 2026-05-02 §5 — anything else under /api/mobile/ goes Java.
location /api/mobile/ {
    proxy_pass http://cretas_backend;
    include cretas-java-proxy-defaults.conf;
}
```

### 4.2 Per-stage explicit whitelist (T6.6.2 / T6.6.3a-b)

For staged rollout, the regex narrows to an explicit factory_id alternation:

```nginx
# T6.6.2 canary:
location ~ ^/api/mobile/(R_TEST_MOCK)/smart-bi/analysis/(production|quality)$ {
    proxy_pass http://cretas_python;
    include cretas-python-proxy-defaults.conf;
}

# T6.6.3a:
location ~ ^/api/mobile/(R_TEST_MOCK|R_ILTEATRO_REAL)/smart-bi/analysis/(production|quality)$ { ... }

# T6.6.3b:
location ~ ^/api/mobile/(R_TEST_MOCK|R_ILTEATRO_REAL|R_QINGHUAJIAO_REAL)/smart-bi/analysis/(production|quality)$ { ... }
```

This pattern mirrors T6.3 Strategy B (61 factories regex per memory `project_2026_05_08_t6_3_cutover_live.md`) and supports atomic rollback by reverting to the prior stage's regex.

### 4.3 Upstream definitions

Reuse existing `cretas_backend` (Java 10010) and `cretas_python` (Python 8083) upstreams from `/www/server/panel/vhost/nginx/_upstream_cretas*.conf`. No upstream changes needed.

### 4.4 Why factory_id regex, not URL path

T6.1-T6.4 used path-based regex because the endpoint URL itself distinguished routing target. T6.6 cannot — both restaurant and factory tenants share the same URL pattern, differentiated only by `{factoryId}`. nginx must extract the factory_id capture group and match against a tenant heuristic.

Alternative considered: nginx `map` directive translating factory_id → upstream. Rejected because:

- `map` requires the variable scope (`$factory_id`) to be set before `proxy_pass`, which requires `set $factory_id $1;` per location — same complexity as inline regex
- `map` configs live in `http {}` block (not per-vhost), making rollback harder
- The whitelist regex is grep-able and self-documenting; `map` adds indirection

### 4.5 nginx config snapshot to repo

Same as `2026-05-02 §5.2`: before applying on server, the new vhost file MUST be snapshotted to `scripts/deploy/nginx/api.cretaceousfuture.com.conf` (or similar) for version control. This is the only repo-tracked artifact of T6.6 outside of code; chat dispatched to execute T6.6.x stages owns the snapshot.

---

## 5. Rollback plan

Mirrors `2026-05-02 §7` with T6.6-specific adaptations.

### 5.1 Trigger conditions

Any one ⇒ immediate rollback:

| Metric | Threshold | Window | Source |
|---|---|---|---|
| Python error rate (restaurant tenant routes only) | > 2% | 5 min | nginx access log 5xx + Python `intent_match_records` errors |
| Python p99 latency | > 3000ms | 5 min | nginx upstream timing |
| Python `NotImplementedError` from restaurant tenant | any occurrence | any | Python error log — restaurant impl gap, NOT factory deferral |
| User-reported critical bug from cascade pilot customer | severity ≥ P1 | any | bug tracker / Steve direct ping |
| Parity gate dict_eq divergence | new structural divergence vs T6.6.1 baseline | any | chat3 harness sampled rerun |

**Note**: Java fallback rate is NOT a rollback trigger for T6.6 because factory-tenant traffic should ALWAYS hit Java (by design). Counting Java requests as fallback would false-alarm.

### 5.2 Rollback procedure

```bash
ssh root@139.196.165.140
cd /www/server/panel/vhost/nginx/

# Restore prior stage's vhost config (each stage commits a backup)
cp api.cretaceousfuture.com.conf.bak.t6.6.<prior_stage>-<timestamp> api.cretaceousfuture.com.conf
nginx -t
nginx -s reload

# Verify rollback
curl -s -H "Authorization: Bearer <token>" \
  "https://api.cretaceousfuture.com/api/mobile/R_ILTEATRO_REAL/smart-bi/analysis/production?startDate=2026-01-01&endDate=2026-01-31&analysisType=overview" \
  -o /dev/null -w "%{http_code} upstream=%{header}\n"
# Expect: pre-rollback restaurant tenant goes back to Java; Java responds with mock envelope.
```

Recovery time: ~5s nginx reload + ~30s in-flight drain ≈ 35s. Identical to T6.4 rollback envelope.

### 5.3 Per-stage rollback granularity

T6.6.3 cascade has 3 sub-stages — each `bak.t6.6.3a-<timestamp>` / `bak.t6.6.3b-<timestamp>` / `bak.t6.6.3c-<timestamp>` backup snapshots its predecessor state. Rollback to ANY prior sub-stage is `cp` + reload.

T6.6.4 deprecation-header addition rolls back by removing the `add_header` line (no factory_id rerouting reverts because T6.6.4 doesn't change upstream selection).

### 5.4 Blue-green compatibility

Same as `2026-05-02 §7.3`: T6.6 nginx changes touch the vhost file, not `_upstream_cretas.conf`. Java blue-green deploys (10010 ↔ 10020 swap) are independent.

**Caveat**: deploy-backend.sh v4.2 defensive ping (per `feedback_deploy_pipeline.md`) treats both upstream files as orthogonal. If a Java deploy lands mid-T6.6 stage, run health check before advancing stage gate.

---

## 6. Customer communications plan

Reuses `2026-05-08-t6-4-customer-comms-plan.md` structure with T6.6-specific scope.

### 6.1 Customer roster (placeholder per non-leak policy)

| # | Factory ID | Customer alias | Stage | Sales 对接人 |
|---|---|---|---|---|
| 1 | `R_ILTEATRO_REAL` | `<customer_alias_ilteatro>` | T6.6.3a | TBD |
| 2 | `R_QINGHUAJIAO_REAL` | `<customer_alias_qhj>` | T6.6.3b | TBD |
| 3+ | other restaurant factory_ids per `2026-05-11-t6-6-etl-infra-design-spec.md §1.5` table | various | T6.6.3c | TBD |

⚠️ **Customer alias convention**: sales team owns `<customer_alias>` mapping; not committed to repo.

### 6.2 Stage-to-customer mapping

Per cascade (§3.3):

| Stage | Day | Cutover window (CST) | Customer | Comms load |
|---|---|---|---|---|
| **T6.6.2** | Day 0 | 14:00-15:00 (R_TEST_MOCK, no customer comms) | (mock data) | 0 customer notices |
| **T6.6.3a** | Day 1 | 14:00-15:00 | IL TEATRO | 1 pre-notice, 1 post-confirm |
| **T6.6.3b** | Day 2 | 14:00-15:00 | 青花椒 | 1 pre-notice, 1 post-confirm |
| **T6.6.3c** | Day 3 | 14:00-15:00 | All restaurant tenants | 1 batch pre-notice, 1 batch post-confirm |
| **T6.6.4** | Day 4-5 | any window | (no customer comms — internal deprecation header only) | 0 |

**Window rationale**: 14:00-15:00 CST follows T6.4 override (per `2026-05-08-t6-4-customer-comms-plan.md §2.2`) for full-daytime operator alertness during current pre-customer-return state. Post-customer-return, future T6.7+ cutovers may revert to 03:00-05:00 default.

### 6.3 Bilingual / Chinese-first template (reusable per T6.4 §3)

```
[预通知 / Pre-notice — sent T-24h]

主题: <customer_alias> 系统升级通知 — 生产分析 + 质量分析模块

亲爱的 <customer_contact>：

我们计划于 <YYYY-MM-DD HH:MM CST> 升级"生产分析"和"质量分析"模块的后端服务，
预计停机时间小于 2 分钟。期间您的仪表盘可能短暂刷新。

无需您的任何操作。如遇任何问题，请通过 <sales_contact_channel> 联系我们。

— 白垩纪食品溯源团队
```

```
[Post-confirm — sent T+30m]

主题: <customer_alias> 系统升级完成 — 生产分析 + 质量分析模块

亲爱的 <customer_contact>：

"生产分析"和"质量分析"模块升级已完成。我们将持续监控系统状态。
如遇任何异常，请立即通过 <sales_contact_channel> 联系我们。

— 白垩纪食品溯源团队
```

### 6.4 P1 escalation timeline

Per T6.4 §4 — adapted ack SLAs:

| Severity | Ack window | Resolution target | Escalation |
|---|---|---|---|
| P0 (system down for customer) | 10 min | 1h (rollback to Java) | Steve + organizer |
| P1 (incorrect data / 5xx > 5%) | 30 min | 4h (rollback or hotfix) | organizer |
| P2 (cosmetic / non-blocking) | 4h | next business day | sales relay |

### 6.5 Per-customer customization checklist

Sales fills before T6.6.3a-c MO:

- [ ] Confirm customer business hours (verify 14:00-15:00 CST is not their peak)
- [ ] Note any 24h ordering / batch jobs that might overlap
- [ ] Confirm preferred channel (微信 / 电话 / 邮件)
- [ ] Lock in `<customer_contact>` name + `<sales_contact_channel>`

---

## 7. Active-E2E gate (replaces passive soak)

Per HARD `feedback_active_e2e_replaces_passive_soak.md`: with 0 customers currently using the product in pre-customer-return state, passive 24h soak is useless (no real traffic to observe). Each stage runs **active E2E** instead.

### 7.1 Active E2E definition for T6.6.x

15-30 min session per stage covering:

1. **Web-admin dashboard render**: log in as `factory_super_admin` for the stage's target factory_id; navigate to /smartbi → "生产分析" page → verify M1/M2/M3 cards render. Repeat for "质量分析" page → verify N1/N2/N3/N4 cards (once chat4 ships).
2. **Endpoint smoke**: 4 analysisType variants per endpoint via authenticated curl. Validate response shape against Rule 9 envelope.
3. **Cross-tenant negative**: 1 factory tenant (F001) request → expect Java response (nginx whitelist excludes F001).
4. **Edge cases**: empty-date-range request, null tenant_id request (defensive — should 401 from `verify_jwt_and_factory`), invalid factory_id.

### 7.2 Active-E2E pass criteria

- 100% of cases return expected HTTP status (200 for valid; 401 for missing auth; 500 ONLY for F999 factory tenant on Python — documented expected Phase 2D deferral)
- Web-admin renders no blank panels / no console errors
- nginx access log shows correct upstream selection (Python for restaurant, Java for factory)
- 0 user-visible regressions

### 7.3 Active-E2E vs passive soak comparison

| Aspect | Passive 30-day soak | Active E2E |
|---|---|---|
| Coverage | Whatever real traffic happens to hit | Deliberate + customer-facing surface |
| Time | 30 days × stage | 30 min × stage |
| Detection sensitivity | Low if 0 customers actively use product | High — every code path manually traversed |
| Customer return readiness | Useless when 0 customers | Validates upon return |
| Pre-customer-return fit | Poor | Excellent |

Cross-reference: `project_2026_05_09_phase_2a_complete.md` notes active-E2E replaced 5-day plan → 40 min on T6.4 cascade.

---

## 8. Sign-off checklist

### 8.1 Pre-dispatch (organizer)

- [ ] PR #360 (chat1 router wiring) merged ✅ (verified post-fetch: HEAD `d5cd41802a`)
- [ ] PR #350 (chat-A1 tenant.py + production skeleton) merged ✅ (per chat3 PR #359 README cross-ref)
- [ ] PR #352 (chat-A2 restaurant production M1+M2+M3) merged ✅ (per `1dd31e26f0` mergeCommit)
- [ ] PR #354 (chat-B1 quality skeleton) merged ✅ (per `67ddae1bbb` mergeCommit)
- [ ] chat4 restaurant `/analysis/quality` N1-N4 impl PR — **BLOCKING**, must merge before T6.6.1 dispatch
- [ ] PR #359 (chat3 parity-gate harness) merged ✅ (per `ce20c42ba3`)
- [ ] Sub-ETL fact_pos_transaction seed for R_ILTEATRO_REAL + R_QINGHUAJIAO_REAL present in smartbi_prod_db — verify via `SELECT COUNT(*) FROM fact_pos_transaction WHERE factory_id IN (...)`
- [ ] Customer sales contacts confirmed for IL TEATRO + 青花椒 (per §6.5)

### 8.2 Per-stage (T6.6.x dispatch MO chat)

- [ ] Worktree off `origin/main` HEAD (not stale; fetch + verify before nginx mutation)
- [ ] nginx vhost backup `*.conf.bak.t6.6.<stage>-<timestamp>` taken BEFORE apply
- [ ] `nginx -t` clean before `nginx -s reload`
- [ ] Active-E2E gate passed for the stage's factory_id scope (§7.1)
- [ ] STOP-and-ping organizer before advancing to next stage

### 8.3 T6.6 close

- [ ] T6.6.3c full cascade live ≥ 24h with 0 P1 issues
- [ ] T6.6.4 deprecation header observable on Java fallback path
- [ ] Phase 2D unblocked for `_factory_production_dispatch` / `_factory_quality_dispatch` impl + factory Silver migration

---

## 9. ⛔ HOLD blocks

- ⛔ **This is a doc-only cutover spec.** Zero nginx mutations, zero DB writes, zero deploys, zero Java code edits, zero Python code edits.
- ⛔ **chat4 restaurant `/analysis/quality` impl PR is a HARD PREREQ.** Until merged, T6.6.1 dryrun would show 100% divergence on quality side (Python raises `NotImplementedError`). Hold T6.6.1 dispatch.
- ⛔ **R_TEST_MOCK seed required.** chat3 mock_data_generator.py (PR #359) must be applied to smartbi_prod_db before T6.6.2 canary. If not applied, R_TEST_MOCK request returns empty restaurant envelope (no SQL data) — not a bug but expected null-payload behavior.
- ⛔ **Factory-tenant Python branch raises `NotImplementedError` until Phase 2D.** Any nginx mis-classification that routes a factory_id to Python yields 500. Whitelist regex must be exhaustive.
- ⛔ **STOP-and-ping organizer BEFORE pushing this spec** per HARD `feedback_pause_before_deploy_or_push.md`.
- ⛔ **MO F999 canary placeholder is a tenant-type mismatch.** This spec recommends `R_TEST_MOCK` canary instead. Organizer reviews recommendation on PR.

---

## 10. Cross-references

| Doc | Path | Relation |
|---|---|---|
| Original T6 nginx cutover design | `docs/superpowers/specs/2026-05-02-phase2a-t6-nginx-cutover-design.md` | Structural blueprint — upstream defs, vhost regex pattern, rollback procedure |
| T6.4 real-customers cutover runbook | `docs/superpowers/runbooks/2026-05-08-t6-4-real-customers-cutover-runbook.md` | Cascade pattern + stage gate template |
| T6.4 customer comms plan | `docs/superpowers/runbooks/2026-05-08-t6-4-customer-comms-plan.md` | Customer template + 14:00-15:00 window override rationale |
| T6.3 50% cutover runbook | `docs/superpowers/runbooks/2026-05-07-t6-3-50pct-factories-cutover-runbook.md` | Strategy B regex precedent |
| Sub-A impl spec | `docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md` (PR #345) | Underlying Python module shape + factory branch defer rationale |
| Q4/Q5 module shape | `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` (PR #337) | Restaurant envelope contract |
| Q4/Q5 decision ratification | `docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md` (PR #330) | Q-DEC-1..10 source of truth |
| Q1 real-DB amendment | `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` | Restaurant factory_id roster + `_JavaRandom` drop |
| ETL infra design | `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` | Silver layer pipeline + 14-chain seed table |
| chat3 parity-gate harness | `scripts/parity-gate/README.md` (PR #359) | T6.6.1 dryrun tooling |
| Java client + config | `backend/java/cretas-api/src/main/java/com/cretas/aims/client/PythonSmartBIClient.java` + `.../config/smartbi/PythonSmartBIConfig.java` | T6.6.4 deprecation header touch points |
| Python tenant module | `backend/python/smartbi_compat/tenant.py` | Authoritative tenant detection (mirrors Java predicate) |
| Active-E2E HARD rule | memory `feedback_active_e2e_replaces_passive_soak.md` | §7 rationale |
| Pause-before-push HARD | memory `feedback_pause_before_deploy_or_push.md` | §8 sign-off gate |
| concurrent-edit safety Rule 5b | `.claude/rules/concurrent-edit-safety.md` | Commit-time scope guard for downstream MO chats |

---

## 11. Predecessor chain

- T6.1-T6.4 (Phase 2A 50 endpoints) — LIVE prod since 2026-05-10
- T6.5 Phase A/B/C — Java-side dead code sweep
- T6.6 main spec — `docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md` (PR #196)
- T6.6 production-port detail — `docs/superpowers/specs/2026-05-09-t6-6-production-port-detail.md` (PR #199)
- T6.6 Phase B pre-flight audit — `docs/qa-audits/2026-05-11-t6-6-phase-b-pre-flight-blockers.md` (PR #298)
- T6.6 ETL infra design — PR #316
- T6.6 Q-DEC ratification — PR #330
- T6.6 Q4/Q5 module-shape — PR #337
- T6.6 Sub-A impl spec — PR #345
- T6.6 Sub-A1 skeleton (chat-A1 / chat1) — PR #350
- T6.6 Sub-A2 restaurant impl (chat-A2) — PR #352
- T6.6 Sub-B1 quality skeleton (chat-B1) — PR #354
- T6.6 chat3 parity-gate harness — PR #359
- T6.6 router-wiring (chat1) — PR #360
- T6.6 Sub-B restaurant quality impl (chat4) — **IN FLIGHT**
- **This spec** — chat1 T6.6 cutover plan

This spec is the cutover-stage operational sibling of PR #345 (impl spec) and PR #337 (module-shape spec). Downstream T6.6.1-4 stage MO chats consume this doc for execution.

---

**End of T6.6 Cutover Spec — `/analysis/production` + `/analysis/quality`.**

*Author: chat1 (T6.6 cutover spec dispatch, 2026-05-11 post chat-A1 PR #350 + router-wiring PR #360 ship).*
*Per HARD `feedback_pause_before_deploy_or_push.md` + `feedback_organizer_verbal_signoff_must_amend_spec.md`: STOP-and-ping organizer BEFORE push.*
