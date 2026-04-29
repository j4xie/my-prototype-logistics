# Apr 26 Deferred Backlog — Handoff to Fresh Session

**Created**: 2026-04-25 end of mega-arc session
**Predecessor**: `project_apr25_agg_strategy_persistence.md` 12-phase mega-arc (122 commits, ~80 mine)
**Branch**: `e2e/v1-framework` HEAD `346220098` (push synced)
**Why fresh chat**: 5 items remain that prior session deferred; user explicitly disagrees with deferral. Fresh chat starts with cache-warm prompts + uncluttered context.

---

## Pre-flight (read first, ~10 min)

1. **Memory**: `~/.claude/projects/C--Users-Steve-my-prototype-logistics/memory/project_apr25_agg_strategy_persistence.md` — full 12-phase context
2. **MEMORY.md** — Apr 25 12-phase index entry (top of file)
3. **This doc** — execution plan for the 5 items
4. **Branch sync check**:
   ```bash
   cd C:/Users/Steve/my-prototype-logistics && git log --oneline origin/e2e/v1-framework..HEAD | head
   # Expected: empty if local synced. Pull if behind.
   ```

---

## The 5 deferred items

### Item 1 (BIGGEST): SmartBIAnalysis.vue split (6,519 lines, ~3-4h)

**Pre-existing concern**: file at `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` is 6,519 lines, 33 `<script>/<template>/<style>` blocks. Hard to maintain, slow to load, agents struggle to reason about it.

**Approach**:
1. Map current responsibilities (KPI strip, dropdown switcher, chart panels, AI insights stream, drill-down dialog, template grid, error toasts, filter chips, narrative cache UI)
2. Extract logical components to `web-admin/src/views/smart-bi/analysis/` subfolder:
   - `KPIStripPanel.vue` — KPI cards (Phase 10 fix lives here)
   - `UploadSwitcher.vue` — dropdown + idle pre-cache (Phase 6 dropdown switch fix lives here)
   - `EnrichmentChartGrid.vue` — chart cards + skeletons
   - `AIInsightsStream.vue` — SSE stream renderer + 数字 labeling display
   - `TemplateGridPanel.vue` — Week 6 templates
   - `FilterChipsBar.vue` — global filter dimension chips
3. Parent `SmartBIAnalysis.vue` becomes orchestrator (~500 lines)
4. **Critical preservation**:
   - Phase 6 commit `3a60303a6` async race guards (3 sites in `enrichSheet` + `idleEnrichNext` callbacks) — extract WITH the guard logic intact
   - Phase 10 D2.B1 cache-key remap (commit `0bd94bcec`) — preserve in chart fetch component
   - Phase 11 E1a Promise.all (commit `2f1070ed7`) — preserve in chart+insights parallel structure
5. **Tests** to keep passing:
   - `tests/e2e-comprehensive/agg-strategy-realwindow-prod.mjs` (review xlsx 4 cards + POS render)
   - `tests/e2e-comprehensive/pos-4169-isolated-prod.mjs` (no carryover)
   - `tests/e2e-comprehensive/dashboard-audit-prod.mjs` (related, doesn't touch this page)
6. Per-extracted-component commit; final unified commit ties up parent rewrite
7. Deploy + rerun smoke tests after each major commit
8. Estimated 5-8 commits

**Risk**: high. Vue SFC reactive scope, refs across components, prop drilling. Be cautious with pinia store usage if any.

### Item 2: Java aggStrategy String → enum (~1h)

**Pre-existing decision**: Phase 1 code review said SKIP because only 3 callsites and no payoff. User overrides — they want it.

**Approach**:
1. Create `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/postgres/AggStrategy.java`:
   ```java
   public enum AggStrategy {
       SUM("sum"), MEAN("mean"), NONE("none");
       private final String dbValue;
       AggStrategy(String v) { this.dbValue = v; }
       public String getDbValue() { return dbValue; }
       public static AggStrategy fromDb(String v) {
           if (v == null) return SUM;
           for (var s : values()) if (s.dbValue.equals(v)) return s;
           return SUM;
       }
   }
   ```
2. Update `SmartBiPgFieldDefinition.java`:
   ```java
   @Convert(converter = AggStrategyConverter.class)
   private AggStrategy aggStrategy = AggStrategy.SUM;
   ```
3. Add JPA `AttributeConverter<AggStrategy, String>` so DB still stores `"sum"` etc.
4. Update 3 callsites in `DynamicDataPersistenceServiceImpl.java`:
   - `.aggStrategy(AggStrategy.SUM)` instead of `.aggStrategy("sum")`
5. Backwards compat: existing rows have `agg_strategy='sum'/'mean'/'none'` text; converter handles read.
6. mvn compile + Java BG deploy
7. Smoke: any prior-working AIQuery query (Phase 10 D1.C1 fast-path) still works

**Risk**: low. Additive, JPA converter is well-trodden pattern.

### Item 3: Live-mean fallback cleanup (~30min)

**Pre-existing rationale**: Phase 1 hotfix `ce30773d9` added live rating detection in `compute_quick_summary` (insight.py:310-313) as defense-in-depth because statistics column was empty for historical uploads. Phase 11 B3-2 (commit `9652bf60e`) populated statistics for all uploads at upload time. The live fallback became dead code BUT was kept for 2-week observation period.

**Approach**:
1. Verify statistics population worked: query DB to confirm all `smart_bi_pg_field_definitions` rows now have non-NULL `statistics`:
   ```bash
   ssh root@47.100.235.168 "PGPASSWORD=smartbi_secure_password_2025 psql -U smartbi_user -d smartbi_prod_db -h localhost -c \"SELECT COUNT(*) FILTER (WHERE statistics IS NULL), COUNT(*) FROM smart_bi_pg_field_definitions;\""
   ```
2. If any NULL: backfill them via reclassify endpoint, then proceed.
3. If 0 NULL OR after backfill: delete the live-mean fallback in `backend/python/smartbi/api/insight.py:310-313`:
   ```python
   # DELETE these lines:
   if agg_strategy == "sum" and pd.notna(col_mean):
       name_suggests_rating = any(
           col.endswith(s) for s in RATING_NAME_SUFFIXES
       )
       if name_suggests_rating and 1.0 <= float(col_mean) <= 5.0:
           agg_strategy = "mean"
   ```
4. Deploy Python prod
5. Rerun review xlsx 4172 smoke — should still show 4 平均X cards (now sourced ENTIRELY from DB, no live fallback)

**Risk**: medium. If any cached upload missed statistics population, user sees regression (rating col falls back to sum). Verify the COUNT first.

### Item 4: 28 remaining templates spec §4.3 action recs (~3-4h)

**Phase 12 K2 done**: 9 worst-scored templates (dish_sales_top_n, dish_slow_movers, channel_analysis, staff_performance, store_performance, payment_method_mix, monthly_anomaly, period_comparison_trend, member_consumption).

**Remaining 30 of 39** (39 - 9 = 30). List via:
```bash
ls backend/python/smartbi/services/materialized_analytics/templates/*.py | grep -v __init__ | grep -v base.py | grep -v registry.py
```

(Subtract the 9 already done + base.py + registry.py + __init__.py = 30 actual user-facing templates remaining.)

**Approach**:
1. Use Phase 12 K2's `format_action_rec(对象, 收益区间, 前置, 时间)` helper (already in `restaurant/action_rec_formatter.py`)
2. Group templates by domain:
   - **Dish family** (dish_by_table_type / dish_category_breakdown / dish_store_drill / dish_time_slot_matrix / kitchen_dispatch_heatmap / combo_usage_rate / pareto_analysis / category_distribution): action focus = menu engineering
   - **Anomaly/trend** (anomaly_detection / monthly_trend / business_overview_summary): action focus = root cause investigation
   - **Refund/discount** (refund_analysis / promotion_impact / groupon_channel_breakdown / stored_value_card_consumption / payment_method_mix): action focus = revenue protection
   - **Reviews** (reviews_sentiment_summary): action focus = service quality
   - **Member** (member_deep_analytics / member_consumption — already done): defer member_deep_analytics to dish family or its own
   - **Inventory** (purchase_inventory_inflow / reverse_checkout_stats): action focus = supply chain
   - **Finance** (revenue_management_report / profit_loss_statement): action focus = cost discipline
3. For each template: 5-10 lines added per file. Append `format_action_rec(...)` to existing insight_text. Use real data signals (top item, anomaly magnitude, gap from benchmark) for object_target + benefit_range.
4. Per-batch commit (e.g., 1 commit per domain group of 4-6 templates).
5. After each group: re-materialize a representative upload + verify insight_text shape via SQL spot-check.
6. Run full template test suite after each group (`pytest backend/python/smartbi/services/materialized_analytics/tests/ -q`).
7. Estimated 5-8 commits total.

**Risk**: medium. Each template has unique data shape; helper is generic but per-template wiring needs care. Easier than Item 1 because pattern is established.

### Item 5: chart.py auto-detection further tightening (~1h)

**Phase 11 G2 done**: `pd.to_datetime` numeric guard at 2 sites (commit `c5b94bbec`).

**Remaining heuristics in chart.py**:
1. `pd.to_datetime` on string columns may still misclassify ISO-looking numbers like account IDs ("20240315001")
2. Auto-pick yField may grab dimension columns when no clear measure
3. Series detection (`stack-by-X`) may over-trigger on high-cardinality dimensions

**Approach**:
1. Add cardinality guard: if column distinct values > 50% of total rows, NOT a series candidate
2. Add ID-suffix guard: if column name ends in `号/编号/ID`, never time/measure
3. Reuse existing `field_classifier.semantic_type='id'` if persisted
4. Unit tests for each heuristic
5. Deploy Python prod
6. Smoke smartRecommendChart on tricky uploads (large 200K row, lots of ID columns)

**Risk**: low. Heuristic tightening only; can't break less than current.

---

## Execution sequence (recommended order)

Order chosen: low-risk + small first, biggest last.

1. **Item 5** (chart.py tighten, ~1h) — fastest, low risk
2. **Item 3** (live-mean cleanup, ~30min) — quick if statistics populated
3. **Item 2** (Java enum, ~1h) — small, careful with mvn deploy timing
4. **Item 4** (28 templates, ~3-4h, batched per domain) — mechanical, established pattern
5. **Item 1** (Vue split, ~3-4h) — biggest, last when fresh-chat context is depleted gracefully

Total: ~8-10h focused work. Doable in 1-2 long sessions.

---

## Hard constraints (read every time)

1. **Concurrent edit safety** (per `.claude/rules/concurrent-edit-safety.md`): surgical `git add <file>` only, `git status --short` BEFORE every commit, immediately `git restore --staged <other>` if pre-commit hook auto-stages parallel session WIP. Apr 24 + Apr 25 scope-creep incidents happened multiple times — be paranoid.
2. **Verify before fix** (per `feedback_verify_handoff_bug_claims_first.md` memory): before fixing any "bug" claimed in handoff, reproduce + verify on prod first. Apr 24 P0 review cache + Apr 25 B-bonus YELLOW alert both turned out to be already-fixed. Same-session commits often already addressed it.
3. **Java mvn deploy memory**: Java `mvn package` needs ~1GB; Windows pagefile commit was exhausted multiple times this arc. Free Genshin/Cursor/Claude background processes if needed. Or use `--git` mode (server-side build) — pushes branch + server pulls + builds.
4. **Test environment instability**: parallel sessions restart test backend; if test 10011 down, restart with `bash /www/wwwroot/cretas/restart-test.sh` then proceed. Don't assume test env state; verify via `ss -tlnp` first.
5. **Deploy lock**: `/tmp/cretas-backend-deploy.lock` may be held by parallel session. If can't acquire, code commit OK + defer deploy to next regular cycle.
6. **Per-commit deploy**: don't batch many commits without deploys. After each substantial commit, deploy + smoke. Catches regressions early.
7. **TDD for new helpers**: every new function (action_rec extension, enum converter, chart heuristic guard) gets unit tests in same commit.
8. **Memory updates**: after each item, update `~/.claude/projects/C--Users-Steve-my-prototype-logistics/memory/MEMORY.md` index entry + topic file.
9. **Don't touch deferred items in inverted decision**: live-mean fallback, Vue split, etc. all have rationales for deferral. The user's "都完成" approval is for THIS handoff. Don't introduce new "we'll do later" items without explicit user OK.

---

## Key file paths (cheatsheet)

- Branch: `e2e/v1-framework`
- Java entity: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/postgres/SmartBiPgFieldDefinition.java`
- Java service: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/DynamicDataPersistenceServiceImpl.java`
- Python insight: `backend/python/smartbi/api/insight.py`
- Python chart: `backend/python/smartbi/api/chart.py`
- Python templates dir: `backend/python/smartbi/services/materialized_analytics/templates/`
- Python action_rec helper (Phase 12 K2): `backend/python/smartbi/services/materialized_analytics/restaurant/action_rec_formatter.py`
- Vue SmartBIAnalysis: `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` (6,519 lines)

---

## Smoke commands (use after every deploy)

```bash
# 1. Java prod health
ssh root@47.100.235.168 "curl -s http://localhost:10010/api/mobile/health"

# 2. Python prod health
ssh root@47.100.235.168 "curl -s http://localhost:8083/health"

# 3. AIQuery template fast-path (Phase 10 D1.C1 — must remain <300ms after Item 4 changes)
ssh root@47.100.235.168 "TOKEN=\$(curl -sf -X POST http://localhost:10010/api/mobile/auth/unified-login -H 'Content-Type: application/json' -d '{\"username\":\"qhj_prod\",\"password\":\"123456\",\"factoryId\":\"RES_3101_009\"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)[\"data\"][\"accessToken\"])'); time curl -sN -X POST 'http://localhost:8083/api/chat/general-analysis-stream' -H \"Authorization: Bearer \$TOKEN\" -H 'Content-Type: application/json' -d '{\"question\":\"哪家店业绩最好\"}' > /tmp/aiq.out; head -c 500 /tmp/aiq.out"

# 4. Dashboard preWarm cache (Phase 11 H1 — should remain ~5ms warm)
ssh root@47.100.235.168 "TOKEN=...; time curl -s 'http://localhost:10010/api/mobile/dashboard/insights/custom?factoryId=RES_3101_009&startDate=2025-01-01&endDate=2025-12-31&question=营业额怎么样' -H \"Authorization: Bearer \$TOKEN\" > /tmp/d.out"

# 5. Real-window E2E (Phase 8)
cd C:/Users/Steve/my-prototype-logistics && node tests/e2e-comprehensive/agg-strategy-realwindow-prod.mjs
```

---

## Done criteria

For the new chat to claim "都完成":
- [ ] Item 1: SmartBIAnalysis.vue ≤ 800 lines (orchestrator only). Smokes pass.
- [ ] Item 2: Java aggStrategy is enum, JPA converter works, DB unchanged, smokes pass
- [ ] Item 3: insight.py:310-313 deleted. Statistics 100% populated. Review xlsx still shows 4 平均X.
- [ ] Item 4: 30/30 remaining templates have `format_action_rec(...)` in insight_text. Re-materialize verified.
- [ ] Item 5: chart.py heuristics tightened with ID + cardinality guards. Tests added.
- [ ] All commits pushed to `e2e/v1-framework`.
- [ ] Memory updated: append Phase 13 to topic file + update MEMORY.md index.
- [ ] Final summary message to user with before/after table.

---

## Anti-pattern checklist (don't do)

- ❌ Don't run `git add .` or `git add -A` (concurrent-edit-safety rule)
- ❌ Don't use `git commit --amend` on pushed commits
- ❌ Don't skip pre-commit hooks (`--no-verify`)
- ❌ Don't deploy Java without checking deploy lock
- ❌ Don't trust handoff bug claims without reproducing first
- ❌ Don't introduce new "we'll do later" backlog without user OK
- ❌ Don't make insight_text > 400 chars (FE rendering limit observed)
- ❌ Don't break the AIQuery template fast-path (Phase 10 D1.C1) — sacred
- ❌ Don't break the Dashboard preWarm cron (Phase 11 H1) — sacred
- ❌ Don't break the dropdown switch async race guards (Phase 6) — sacred
