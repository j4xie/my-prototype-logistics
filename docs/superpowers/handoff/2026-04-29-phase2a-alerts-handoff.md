# Phase 2A `/alerts` Marathon — Final Handoff

| Field | Value |
|---|---|
| **Status** | Marathon complete (2026-04-29 → 2026-04-30) |
| **Branch** | `phase2a/t5-poc` (NOT yet pushed origin) |
| **Worktree** | `C:\Users\Steve\my-prototype-logistics\.worktrees\phase2a-t5-poc` |
| **Total wall-clock** | ~5.5 hours across 3 chat sessions |
| **Total commits** | 18 |
| **Phase 2A counter** | 3/50 → 4/50 endpoints (alerts is 1 endpoint with 4 entry points; counted as 1) |

---

## Commit history (18 commits, oldest → newest)

| SHA | Phase | Description | Lines |
|---|---|---|---|
| `38f4c1ccf` | Kickoff | spec | 499 |
| `41f41fe2e` | Kickoff | plan | 2445 |
| `8451d6407` | Kickoff | handoff | ~150 |
| `90208d24c` | A1 | F999 migration + smart_bi seed copy + Spring placeholder config | 253 |
| `6ca93ff51` | A3 | bundle alert_thresholds.json + CI parity guard | 151 |
| `fb1fcafb2` | A2 | TreeMap-supplied groupingBy for stable sort + 2 Java unit tests | 175 |
| `40e079d65` | A4 | Python alert_thresholds loader + 4 tests | 189 |
| `517f4692a` | A5 | DateRange.by_period(month) + 7 tests | 113 |
| `4a86d05f6` | B1 | sales generator port (3 alert types + helpers) + 13 tests | 405 |
| `58af128e0` | B2 | sales route + contract test + 2 sales goldens | 272 |
| `f84101d53` | B2 bonus | 54 calibration F999 goldens (analysis-*, dashboard-*, etc.) | 11806 |
| `9c733c05e` | B3 | F999 ADR | 107 |
| `b169fb0f0` | C0 | V20260430_02 trip-rows migration + 15-key Alert dict fix | 99 |
| `e6fcc1839` | C0 | re-record 56 F999 goldens (post-trip-rows) | 456 |
| `8aa9e953b` | C1+D1+E1 | finance + dept + aggregator generators + 14 tests | 485 |
| `788d83e08` | C2+D2+E2 | 3 contract tests with stripped-volatile compare + 2 new goldens | 301 |
| `e01c2f4c7` | C0 redo | re-record 56 F999 goldens (post-TreeMap-fix actually deployed) | 261 |
| `<this commit>` | E3 | calibration writeback + handoff doc | TBD |

---

## Final Phase 2A counter writeback

- **Pre-marathon**: 3/50 endpoints shipped (data-date-range PoC + query-templates + datasource-list)
- **Post-marathon**: 4/50 endpoints shipped (`/alerts` adds 1 with 4 entry points: default/sales/finance/department)
- **Bonus**: 56 F999 calibration goldens preempt much of recording work for remaining 46 endpoints

---

## Lessons learned

### 1. Plan-driven execution dominates ad-hoc

Marathon kickoff committed spec (499 lines) + plan (2445 lines) before any code. Every subsequent task had **full code snippets** in the plan — implementation was mechanical, no design decisions in flight. **5.5 hours total wall-clock vs T0 estimate of 1 week (40 hours) = 7.3× faster**.

### 2. F999 synthetic test factory is the highest-leverage artifact

1 migration + 1 recorder run = 56 calibration goldens. Each future analysis-subdomain endpoint just monkey-patches its seam + strips volatile fields + compares. **Estimated savings: ~30 hours across remaining 9 endpoints**.

### 3. Spring `${VAR:DEFAULT}` edge case with `$`-containing values

When env var contains `$` characters (bcrypt `$2b$12$...`), Spring's substitution stored literal `DISABLED` fallback instead of env var value. Workaround: manual UPDATE post-deploy. Logged in `feedback_spring_placeholder_dollar_chars.md` memory + ADR Negative consequences.

### 4. javap class-file inspection is the ground truth

Deploy script reported "✅ 部署完成!" while uploading a stale jar (from wrong worktree). Symptom: dept alerts non-deterministic order across requests despite source having TreeMap fix. Diagnosis: `javap -p -v` showed no `java/util/TreeMap` reference in deployed class file. Local class hash 8ac0a38da didn't match deployed f7e8efbcb.

**Root cause**: Bash `cwd reset` between commands meant some deploy invocations ran from main repo (`C:/Users/Steve/my-prototype-logistics`, branch `e2e/v1-framework`) instead of the phase2a worktree. The main repo's source didn't have my A2 sort fix, so deploy compiled stale code despite "success" output.

**Mitigation for future deploys**:
- `pwd` check before deploy (always)
- After deploy, `unzip -p .jar BOOT-INF/classes/X.class | sha256sum` and compare to local `target/classes/X.class` SHA
- Don't trust "deploy success" without verifying class file hash

### 5. 15-key Alert byte-shape vs 13-key spec

Plan/spec said Alert.java has 13 declared fields. Reality: 13 fields + 2 derived getters (`getLevelName`, `isUrgent`) = 15 keys in Jackson serialization. Discovered during golden recording. Fix: extend `_new_alert_dict` with `levelName=level` + `urgent=(level in RED|CRITICAL)`. Updated tests.

### 6. Deploy lock leaks need explicit cleanup

`/tmp/cretas-backend-deploy.lock` lingered from killed background processes. Pattern recurred 3× in this marathon. Workaround: `kill <PID> && rm /tmp/cretas-backend-deploy.lock` before re-deploy. Long-term: deploy script should detect stale locks (PID dead) and self-clean.

### 7. F001 source for F999 (DEMO_FACTORY orphan discovery)

Spec assumed F999 seeds from DEMO_FACTORY (Java's `V2026_01_18_02__smart_bi_sample_data.sql`). Reality: that migration is in `db/migration-pg-converted/` which is **never scanned by Flyway** (active is `classpath:db/flyway`). So DEMO_FACTORY data never existed on any environment. F_DEMO is a separate orphaned constant in `SmartBIPublicDemoController` with no `factories` row. Pivoted F999 to seed from F001. Documented in ADR.

### 8. Sales alerts on F999 (~90% completion) = empty

F001 data has well-balanced ~90% completion rate, no thresholds trip. F999 = F001 clone has same characteristic. Sales contract test golden = `data:[]` (still valid byte-shape parity, just no alert content to verify). For finance/department, V20260430_02 trip-rows migration injects deliberate threshold-tripping rows.

---

## Next-up endpoint candidates (ranked by foundation reuse)

### Highest reuse (use F999 + alert_thresholds + DateRange + 15-key Alert + monkey-patch contract pattern)

1. **`/recommendations`** (~6 hours) — Same `RecommendationServiceImpl` as alerts. Different generator method (`generateAllRecommendations`). Reuses F999 + thresholds + Decimal helpers + JSON envelope.

### High reuse (use F999 + DashboardResponse pattern from §4 sister endpoints)

2. **`/analysis/sales`** (~5 hours) — DashboardResponse with kpiCards + rankings + charts. F999 has sales data already.
3. **`/analysis/finance`** (~5 hours) — Same shape, F999 has finance data.
4. **`/analysis/department`** (~5 hours) — Same shape, F999 has dept data (but only 6 rows from F001 + 3 trip-rows).

### Medium reuse (need DashboardResponse port + new monkey-patched fixtures)

5. **`/analysis/production`**, **`/analysis/quality`**, **`/analysis/inventory`** (~5-7 hours each) — Same DashboardResponse pattern but F999 has no data for these tables. Either record empty goldens or add per-endpoint trip-rows migrations.
6. **`/analysis/procurement`**, **`/analysis/region`** (~8 hours each) — Larger services (1144 LOC + 1209 LOC) but same shape.

### Bridge pattern (needs ADR first)

7. **`/analysis/finance/budget-achievement`**, **`/analysis/finance/yoy-mom`**, **`/analysis/finance/category-comparison`** (~12 hours total) — GET→POST bridge to existing Python POST routes. Each ~4 hours after bridge ADR documented.

**Total refined estimate** for remaining 9-10 analysis subdomain endpoints: **~60-70 hours** (vs T0 ~10 weeks = 400 hours). **6× faster than T0 estimate.**

---

## Acceptance criteria — final status

- [x] All 4 entry points (`/alerts`, `?category=sales|finance|department`) return Java-shape responses
- [x] All 4 contract tests pass against recorded goldens
- [x] Sales / finance / department / aggregator unit tests cover threshold boundaries + edge cases (27 tests in test_alerts_logic.py + 8 contract tests in test_alerts_contract.py)
- [x] Java sort fix shipped + 2 Java unit tests pass
- [x] CI diff guard for `alert_thresholds.json` in place + green
- [x] F999 migration deployed to test env; F999 ADR committed
- [x] Phase 2A counter updated: 3 → 4 of 50
- [x] Calibration data point written into deferred plan §4 (actual hours vs T0 estimate)

---

## Test counts

- **Python smartbi_compat**: **64 tests pass** (was 18 baseline pre-marathon, +46 new)
  - test_alert_thresholds.py: 4
  - test_date_range.py: 7
  - test_alerts_logic.py: 27 (sales 13 + finance 6 + dept 4 + aggregator 2 + seam tests)
  - test_alerts_contract.py: 8 (route + envelope + 4 stripped-volatile golden compares + 401/403 auth)
  - test_alias_aggregation.py: 6 (existing)
  - test_contract_compat.py: 8 (existing)
  - test_jwt_middleware.py: 4 (existing)
- **Java RecommendationServiceImplTest**: 2 unit tests (sales sort + dept sort)

---

## Cross-references

- Spec: `docs/superpowers/specs/2026-04-29-alerts-full-port-design.md`
- Plan: `docs/superpowers/plans/2026-04-29-alerts-full-port.md`
- Deferred plan §4 (with calibration writeback): `docs/superpowers/plans/2026-04-29-phase2a-batch-deferred-endpoints.md`
- F999 ADR: `docs/adr/2026-04-29-phase2a-synthetic-test-factory-f999.md`
- Kickoff handoff: `docs/superpowers/handoff/2026-04-29-phase2a-alerts-spec-plan-handoff.md`
- Memory: `project_apr29_phase2a_alerts_chat2_shipped.md` + `feedback_spring_placeholder_dollar_chars.md`

---

## Marathon close — branch state

`phase2a/t5-poc` is **stable + ready for next analysis-subdomain port** (e.g. `/recommendations` reusing F999 + thresholds + Decimal helpers).

Decision options for chat 4:
1. Push `phase2a/t5-poc` to origin + create PR (full marathon as 1 review unit)
2. Continue on same branch with next endpoint (recommendations or analysis/sales)
3. Cherry-pick foundation commits (Phase A only) to a separate branch for fast review, leave `/alerts` for later PR
