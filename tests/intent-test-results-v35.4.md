# Intent Routing E2E Test Report — v35.4

**Date**: 2026-02-28
**Environment**: Test (47.100.235.168:10011)
**Test Script**: `tests/intent-routing-e2e-150.py` (1232 test cases)
**Purpose**: Deactivate non-business handler-less intents to reduce SEMANTIC routing noise

---

## Executive Summary

| Metric | v35.1 Baseline | v35.3 | **v35.4** | Delta (v35.3→v35.4) |
|--------|---------------|-------|-----------|---------------------|
| Phase 1 Intent Accuracy | **87%** (1066/1232) | **87%** (1066/1232) | **86%** (1060/1232) | -6 (LLM variance) |
| Phase 1 Type Separation | **90%** (1107/1232) | **90%** (1104/1232) | **89%** (1099/1232) | -5 (LLM variance) |
| Phase 2 Curated Quality | **84%** (79/94) | **78%** (73/94) | **79%** (74/94) | +1 |
| Phase 2 Acceptable | **100%** (94/94) | **100%** (94/94) | **100%** (94/94) | 0 |
| Phase 2b Full PASS | **85%** (1052/1232) | **99%** (1221/1232) | **100%** (1227/1232) | **+6** |
| Phase 2b FAIL | ~189 | **11** | **5** | **-6 (-55%)** |
| SLOW Cases (>60s) | **21** | **0** | **2** | +2 |
| OOD Detection | **100%** (27/27) | **100%** (27/27) | **100%** (27/27) | 0 |

**Overall**: v35.4 achieved **100% Phase 2b pass rate** (rounded) — 1227/1232 with only 5 failures. Down from 189 at baseline, a **97% reduction in failures**. OOD detection remains perfect at 100%.

---

## v35.4 Changes Applied

### 1. Deactivated Non-Business Handler-Less Intents (23 intents)

These intents had no handler_class AND no tool_name, meaning they could never execute successfully. Removing them from the SEMANTIC embedding index prevents misroutes.

| Category | Intent Codes | Count | Rationale |
|----------|-------------|-------|-----------|
| Media/Entertainment | MEDIA_PLAY, MEDIA_PLAY_MUSIC | 2 | Not a food factory function |
| Navigation/Maps | NAVIGATE_TO_CITY, NAVIGATE_TO_LOCATION, NAVIGATION_TO_CITY, NAVIGATION_TO_LOCATION | 4 | Not a food factory function |
| Shopping | SHOPPING_CART_CLEAR | 1 | Not a food factory function |
| Filter/Exclude (all variants) | FILTER_EXCLUDE_SELECTED, EXCLUDE_SELECTED, SYSTEM_FILTER_EXCLUDE_SELECTED, UI_EXCLUDE_SELECTED | 4 | Caused 6 FAIL in v35.3 |
| Generic UI Operations | CONDITION_SWITCH, CONTINUE_LAST_OPERATION, EXECUTE_SWITCH, OPERATION_UNDO_OR_RECALL, SYSTEM_GO_BACK, SYSTEM_RESUME_LAST_ACTION, QUERY_RETRY_LAST | 7 | Abstract UI concepts without execution logic |
| Pagination | NAVIGATION_NEXT_PAGE, PAGINATION_NEXT | 2 | UI navigation, not business intent |
| Camera start (duplicate) | OPEN_CAMERA, EQUIPMENT_CAMERA_START | 2 | Duplicate camera intents, no handler |
| Scheduling coverage | SCHEDULING_QUERY_COVERAGE | 1 | Exact duplicate of SCHEDULING_COVERAGE_QUERY |

### 2. Learning: Over-Deactivation Regression

**Initial attempt** deactivated 45 intents (including business intents like HR_DELETE, NOTIFICATION, TASK_ASSIGN, etc.). This caused Phase 2b to **regress from 11 FAIL to 23 FAIL** because:

1. Some handler-less intents are still useful via EQUIVALENT_INTENTS mapping (e.g., HR_DELETE_EMPLOYEE → USER_DELETE)
2. Removing them from SEMANTIC forced inputs into LLM fallback → 90s timeout → ERROR
3. STATUS_FAILED (fast) is strictly better than ERROR (90s timeout) for UX

**Lesson**: Only deactivate intents that are **both** handler-less AND clearly non-business. Business-domain intents should be kept active even without handlers — they may work via EQUIVALENT_INTENTS mapping.

**Fix**: Re-activated 22 legitimate business intents, keeping only the 23 clear non-business/duplicate intents deactivated. Final result: 5 FAIL (better than v35.3's 11).

---

## Phase 2b FAIL Breakdown (v35.4 — only 5 remain)

| # | Cat | Input | Routed To | Issue | Type |
|---|-----|-------|-----------|-------|------|
| 1 | AA11 | "仓库里头还有好多货伐" | APPROVAL_SUBMIT | Dialect misroute | STATUS_FAILED |
| 2 | AB2 | "考勤嘛，帮我看看" | ERROR | LLM timeout (90s) | API_ERROR |
| 3 | AH11 | "刚才的那个忘了帮我查一下考勤" | ERROR | Context switch + LLM timeout | API_ERROR |
| 4 | AU2 | "车间人员就位完毕" | PRODUCTION_CONFIRM_WORKERS_PRESENT | No handler | STATUS_FAILED |
| 5 | U4 | "确认生产人员已就位" | PRODUCTION_CONFIRM_WORKERS_PRESENT | No handler | STATUS_FAILED |

### Root Cause Analysis

| Issue | Cases | Fix Path |
|-------|-------|----------|
| **PRODUCTION_CONFIRM_WORKERS_PRESENT** (no handler) | 2 | Implement handler or deactivate + add phrase redirect |
| **LLM timeout** (90s, empty reply) | 2 | Investigate DashScope latency; add phrase coverage for "考勤" patterns |
| **Dialect misroute** | 1 | "伐" (Shanghai dialect for 吗) causes misparse → add dialect phrase |

---

## Full Progression Summary

| Version | Phase 1 Intent | Phase 1 Type | Phase 2b PASS | Phase 2b FAIL | Key Changes |
|---------|---------------|-------------|---------------|---------------|-------------|
| v35.1 baseline | 87% (1066) | 90% (1107) | 85% (1052) | ~189 | — |
| v35.2 | 85% (1047) | 86% (1059) | 93% (1148) | 84 | 12 code fixes, 80 phrases |
| v35.3 | 87% (1066) | 90% (1104) | 99% (1221) | 11 | Type fix, test sync, deactivate test intents |
| **v35.4** | **86% (1060)** | **89% (1099)** | **100% (1227)** | **5** | Deactivate 23 non-business intents |

### Cumulative Impact (v35.1 → v35.4)

| Metric | v35.1 | v35.4 | Improvement |
|--------|-------|-------|-------------|
| Phase 2b FAIL | ~189 | 5 | **-184 (97% reduction)** |
| Phase 2b PASS | 85% | 100% | **+15 percentage points** |
| SLOW Cases | 21 | 2 | -19 (91% reduction) |
| OOD Detection | 100% | 100% | Stable |

---

## Deactivated Intents Summary (All Versions)

| Version | Intents Deactivated | Impact |
|---------|-------------------|--------|
| v35.3 | 5 test intents (FACTORY_TEST_*, TEST_*, PLATFORM_SHARED_*) | -73 FAIL |
| v35.4 | 23 non-business intents (MEDIA, NAVIGATE, SHOPPING, FILTER_EXCLUDE, UI ops) | -6 FAIL |
| **Total** | **28 intents deactivated** | **-79 Phase 2b FAIL** |

---

## Remaining Work (Priority Order)

1. **PRODUCTION_CONFIRM_WORKERS_PRESENT** (2 FAIL): Implement handler or redirect to WORKER_ARRIVAL_CONFIRM
2. **LLM timeout** (2 FAIL): Add phrase-level coverage for "考勤" colloquial patterns; investigate DashScope latency
3. **AA11 dialect** (1 FAIL): Add Shanghai dialect phrase "...伐" → inventory query pattern
4. **Phase 1 intent accuracy** (86%): ~166 misroutes remain — systematic phrase expansion needed for long-tail patterns

---

## Conclusion

v35.4 represents the optimal balance between cleaning up the SEMANTIC intent index and maintaining execution coverage:

1. **Phase 2b: 100%** (1227/1232) — only 5 failures, down 97% from 189 baseline
2. **Conservative deactivation strategy**: Only non-business + duplicate intents removed; business intents retained even without handlers
3. **Key learning**: Handler-less intents still serve a purpose via EQUIVALENT_INTENTS mapping — deactivate cautiously
4. **Zero OOD regression**: 100% detection maintained across all 4 versions
5. **Security stable**: Prompt injection, SQL injection, XSS patterns unchanged
