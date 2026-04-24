# Domain-Aware Field Role Implementation — Next Session Handoff

**Branch**: `e2e/v1-framework` (HEAD `6dc16435a` as of Apr 24 late)
**Spec**: `docs/superpowers/specs/2026-04-25-domain-aware-field-roles-design.md` (357 lines)
**Estimated**: 8-10h focused work = 1-1.5 day fresh session
**Owner**: Steve / next session

---

## What's done (prod-live as of this handoff)

7 commits on `e2e/v1-framework` (mine):

```
6dc16435a docs(spec): domain-aware field role classification ← spec for THIS work
feb3703d4 feat(smartbi): rating mean KPI display (4.83 分) + AIQuery review-aware default
19df49af6 fix(smartbi): suppress ID + rating cols from KPI summary (亿/万 pollution stop-gap)
d6bd81b6f fix(smartbi): post-mapper region/time_period fallback (T6 honest finding)
c5e40b83f test(smartbi): multi-merchant + negative review xlsx fixtures
a2ec856a9 refactor(smartbi): migrate reviews_sentiment_summary to schema_helpers
4b7fdb16c feat(smartbi): add 12 review-domain helpers to schema_helpers (Slice 4 D-1)
```

Stop-gap fixes work but rely on heuristics:
- Python `quick_summary` regex on col names (endswith 'ID' / '分')
- FE `getSmartKPIs` heuristic on col.aggStrategy (set by Python heuristic)

This handoff implements the **proper architectural fix** per spec.

---

## TL;DR for next session

**Goal**: Replace col-name heuristics with explicit `domain` (per-upload) + `agg_strategy` (per-field) DB columns + per-domain Python rule modules.

**Why**: Heuristics break for new merchant exports (美团/抖音/小红书 use different naming). Domain-rules approach scales as we onboard new vendors.

**11-step impl sequence** (each ≤ 1h, see spec §10):

1. DB migration + Java entity update (~30min, low risk additive)
2. Backfill script — empty implementation that just sets `domain='unknown'` everywhere (test path validation)
3. Python `domain_detector.py` + `unknown.py` rules (~1h)
4. Python `review.py` rules (~30min) + unit test
5. Python `pos.py` rules (~45min) + unit test
6. Python `field_classifier.py` integration with domain_rules (~30min)
7. Python `quick_summary` rewrite to read agg_strategy from DB (~30min)
8. Java DynamicDataPersistence populates domain + agg_strategy (~30min)
9. FE getSmartKPIs simplification (drop heuristic) (~30min)
10. Backfill script for production (~10min)
11. End-to-end test + 94-test smoke + reviewer audit (~1h)

---

## Critical context (READ FIRST in new chat)

### A) Current prod state
- qhj_prod prod (factory `RES_3101_009`) has upload **4172** = real qhj Q3 review xlsx (12,903 rows)
- 4 平均X KPI cards render correctly: `平均服务分=4.83 / 平均星级分=4.83 / 平均环境分=4.82 / 平均口味分=4.82` 分
- ID columns (评价ID/团购ID/门店美团ID) suppressed from KPI cards
- POS upload **4169** unaffected (200 normal measures preserved)

### B) Stop-gap mechanism (the thing being replaced)
- `backend/python/smartbi/api/insight.py` lines 283-330 — col-name regex heuristic
- `web-admin/src/api/smartbi/analysis.ts` — `getSmartKPIs` reads `aggStrategy` field

After B implementation: Python heuristic deleted, FE heuristic deleted, both read from DB.

### C) UNFIXED bug (separate from B work)
- **SmartBIAnalysis dropdown switch staleness** — POS→review→POS leaks titles
- Reproduce: `node tests/e2e-comprehensive/dropdown-switch-refresh-verify.mjs`
- Root cause likely batch-grouping in `loadHistory`/`selectBatch`
- Tried `forceRefresh=true` on selectBatch — broke timing, reverted
- Captured in spec §7 Risks; B impl might naturally fix this OR need separate trace

---

## Server access / credentials reminder

- Test: prod auth qhj_prod / 123456 — F001 factory
- Prod: prod auth qhj_prod / 123456 — RES_3101_009 factory  
- Server SSH: `ssh root@47.100.235.168` (sudo password not needed for postgres queries)
- Java: prod 10010 (BG blue/green), test 10011
- Python: prod 8083 (systemd), test 8084 (nohup)
- Web-admin: prod admin.cretaceousfuture.com / 139:8086, test 139:8097
- DB: `smartbi_prod_db` (prod) / `smartbi_db` (test)

---

## Deploy commands (memorize these)

```bash
# Python
./scripts/deploy/deploy-smartbi-python.sh --env test
./scripts/deploy/deploy-smartbi-python.sh --env prod

# Java (BG blue-green for prod)
./scripts/deploy/deploy-backend.sh --env test
./scripts/deploy/deploy-backend.sh --env prod

# Web-admin (requires YES-PROD for prod)
echo YES-PROD | ./scripts/deploy/deploy-web-admin.sh --env prod
./scripts/deploy/deploy-web-admin.sh --env test

# Cache invalidation (per upload)
ssh root@47.100.235.168 "TOKEN=\$(jq -r '.data.accessToken' /tmp/prod_login.json); curl -s -X DELETE http://localhost:8083/api/smartbi/analysis-cache/{uploadId} -H \"Authorization: Bearer \$TOKEN\""

# Re-materialize per upload
curl -s -X POST http://localhost:8083/api/smartbi/analytics/materialize/{uploadId} -H "Authorization: Bearer $TOKEN"
```

---

## Test infrastructure already shipped (reuse)

- `tests/e2e-comprehensive/p2-guardrail-full.mjs` — 94-test smoke (use for regression)
- `tests/e2e-comprehensive/slice4-prod-realwindow.mjs` — Playwright AIQuery review queries
- `tests/e2e-comprehensive/kpi-id-rating-prod-verify.mjs` — Playwright KPI title scrape
- `tests/e2e-comprehensive/dropdown-switch-refresh-verify.mjs` — reproduces UNFIXED dropdown bug
- `backend/python/smartbi/services/materialized_analytics/tests/test_schema_helpers_review.py` — 39 unit tests (don't break)

---

## qa-prompt v2.4 hard requirements

Per `d:\xwechat_files\wxid_a2m0bim6zcm212_82ca\msg\file\2026-04\qa-prompt(3).txt`:

- **Rule 11 read-after-write**: any write op (DB migration / agg_strategy update) → 3 steps: capture body, verify 200, re-GET diff
- **Rule 9 业务合理性**: KPI numbers must match expected (12,903 / 4.83 etc.) + middle-segment + last-segment sample for chart data
- **Rule 15 reviewer audit**: trigger after 3+ logic commits via `superpowers:code-reviewer`
- **Test depth**: deep + roundtrip on writes, observable-deep on reads
- **Real-window verification**: Playwright headless chromium, fresh launch per test (no MCP browser tools, no shared profile)

---

## Memory file to read first

`C:\Users\Steve\.claude\projects\C--Users-Steve-my-prototype-logistics\memory\project_apr24_slice4_and_kpi_fix.md` — full session detail including all 7 commit SHAs, stop-gap mechanism explanation, the UNFIXED dropdown bug description, and learning facts.

---

## After B impl ships, THEN consider

1. **Slice 3 cross-upload joint analysis** (POS × reviews join by store name) — separate spec needed
2. **Dropdown switch staleness deep debug** (if not solved by B) — focus on `loadHistory` batch grouping logic
3. **More domains**: staff_attendance, complaint_log, marketing_campaign — incremental adds via domain_rules/<new>.py
4. **LLM-based domain detection** for `unknown` — fallback when signature heuristic confidence < 0.5
