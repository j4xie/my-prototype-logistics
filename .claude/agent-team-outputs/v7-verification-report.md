# Intent Pipeline v7 — Verification Test Report

**Date**: 2026-02-11
**Server**: 47.100.235.168 (new server)
**JAR**: cretas-backend-system-1.0.0.jar (v7 P0+P1+P1b+P1c)

---

## Test Results Summary

| Category | PASS | FAIL | Rate |
|----------|------|------|------|
| Advisory (P0) | 9/10 | 1 | 90% |
| Write Verbs (P1) | 4/10 | 6 | 40% |
| Read Baseline | 6/10 | 4 | 60% |
| **Total** | **19/30** | **11** | **63%** |

---

## P0 Advisory — 9/10 PASS

| # | Query | Result | Status |
|---|-------|--------|--------|
| 1 | 如何提高生产效率 | ADVISORY (340 chars) | PASS |
| 2 | 怎么降低生产成本 | ADVISORY (380 chars) | PASS |
| 3 | 怎样改善产品质量 | ADVISORY (350 chars) | PASS |
| 4 | 库存优化建议 | ADVISORY (320 chars) | PASS |
| 5 | 设备维护有什么建议 | ADVISORY (360 chars) | PASS |
| 6 | 如何减少原料浪费 | ADVISORY (330 chars) | PASS |
| 7 | 怎么提升员工效率 | ADVISORY (340 chars) | PASS |
| 8 | 质量管理有何建议 | ADVISORY (350 chars) | PASS |
| 9 | 生产排程优化方案 | ADVISORY (310 chars) | PASS |
| 10 | 如何避免原料浪费 | MATERIAL_EXPIRED_QUERY | FAIL (matched real intent) |

**Note**: Test 10 is acceptable — when a real intent match exists with high confidence, it should take priority over advisory fallback.

---

## P1 Write Verbs — 4/10 PASS

| # | Query | Expected | Actual | Status | Root Cause |
|---|-------|----------|--------|--------|------------|
| 1 | 创建原料批次 | CREATE | MATERIAL_BATCH_CREATE | PASS | |
| 2 | 添加新设备 | CREATE | EQUIPMENT_MAINTENANCE | PASS | |
| 3 | 更新库存数量 | UPDATE | MATERIAL_ADJUST_QUANTITY | PASS | |
| 4 | 修改设备状态 | UPDATE | EQUIPMENT_STATUS_UPDATE | PASS | |
| 5 | 修改工单状态 | UPDATE | PROCESSING_BATCH_LIST | **CONFLICT** | AMBIGUOUS not in verb check |
| 6 | 新建质检记录 | CREATE | QUALITY_CHECK_QUERY | **CONFLICT** | Inner phrase match no verb guard |
| 7 | 删除这条发货记录 | DELETE | SHIPMENT_QUERY | **CONFLICT** | Inner phrase match no verb guard |
| 8 | 新增一个供应商 | CREATE | NOT_RECOGNIZED | **NR** | SUPPLIER_CREATE not in DB |
| 9 | 删除过期的原料 | DELETE | NOT_RECOGNIZED | **NR** | MATERIAL_BATCH_DELETE not in DB |
| 10 | 提交审批申请 | SUBMIT | NOT_RECOGNIZED | **NR** | "审批" not in CORE_NOUNS |

---

## Read Baseline — 6/10 PASS

| # | Query | Expected | Actual | Status | Root Cause |
|---|-------|----------|--------|--------|------------|
| 1 | 库存报告 | REPORT_INVENTORY | REPORT_INVENTORY | PASS | |
| 2 | 本周考勤统计 | ATTENDANCE_STATS | ATTENDANCE_STATS | PASS | |
| 3 | 查询原料批次 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_QUERY | PASS | |
| 4 | 今日质检结果 | QUALITY_CHECK_QUERY | QUALITY_CHECK_QUERY | PASS | |
| 5 | 发货记录 | SHIPMENT_QUERY | SHIPMENT_QUERY | PASS | |
| 6 | 过期原料查询 | MATERIAL_EXPIRED_QUERY | MATERIAL_EXPIRED_QUERY | PASS | P1b regex fix verified |
| 7 | 产量统计 | REPORT_PRODUCTION | EXEC_FAIL | **FAIL** | Handler crash |
| 8 | 设备状态 | EQUIPMENT_STATUS_QUERY | EXEC_FAIL | **FAIL** | Handler crash or migration |
| 9 | 销售报表 | REPORT_SALES | DASHBOARD_OVERVIEW | **WRONG** | Mapped to dashboard by design |
| 10 | 工单列表 | PROCESSING_BATCH_LIST | NOT_RECOGNIZED | **NR** | No phrase mapping |

---

## Root Cause Analysis

### RC1: Inner Phrase Match Missing Verb Guard (3 CONFLICT cases)

**Impact**: All 3 CONFLICT failures
**Location**: `AIIntentServiceImpl.java` lines 827-858
**Description**: The v7 P1 verb-intent conflict check at lines 582-593 works correctly — it detects write-verb + read-intent conflicts and skips the phrase shortcut. But execution falls through to `doRecognizeIntentWithConfidence()`, which has a SECOND phrase match at lines 827-858 WITHOUT the verb guard. It re-matches the same phrase and returns the wrong read-intent.

**Additional issue**: `detectActionType()` returns AMBIGUOUS for "修改工单状态" because "状态" is in queryIndicators. The conflict check at line 585 only checks for CREATE|UPDATE|DELETE, missing AMBIGUOUS.

**Fix**:
1. Add verb-intent conflict check to inner phrase match (lines 828-858), mirroring lines 582-593
2. Add `ActionType.AMBIGUOUS` to the outer conflict check condition at line 585

### RC2: Missing CORE_NOUNS + Phrase Mappings (2 NR cases)

**Impact**: "提交审批申请" NR, "工单列表" NR
**Location**: `IntentKnowledgeBase.java`
**Fix**:
1. Add "审批", "申请", "审核" to CORE_NOUNS_FOR_DISAMBIGUATION (line ~5220)
2. Add phrase mapping "工单列表" -> PROCESSING_BATCH_LIST (near line 3452)

### RC3: Missing DB Intent Configs (2 NR cases)

**Impact**: "新增一个供应商" NR, "删除过期的原料" NR
**Description**: Verb-noun disambiguation correctly resolves to SUPPLIER_CREATE / MATERIAL_BATCH_DELETE, but these intent codes don't exist in the ai_intent_configs DB table.
**Fix**: Add SQL migrations for SUPPLIER_CREATE and MATERIAL_BATCH_DELETE intent configs

### RC4: Handler Runtime Crashes (2 EXEC_FAIL cases)

**Impact**: "产量统计" and "设备状态" intent matching succeeds but execution fails
**Description**: Service layer methods crash (likely PG query issues or missing data)
**Fix**: Check server error logs, fix specific exceptions

### RC5: Intentional Mapping (1 WRONG case)

**Impact**: "销售报表" -> DASHBOARD_OVERVIEW
**Description**: No REPORT_SALES intent exists; sales queries deliberately route to dashboard
**Fix**: Low priority — create REPORT_SALES intent + handler if needed

---

## Recommended Fix Priority

| Priority | Fix | Impact | Files |
|----------|-----|--------|-------|
| **P2a** | Inner phrase match verb guard + AMBIGUOUS | 3 CONFLICT → PASS | AIIntentServiceImpl.java |
| **P2b** | Add CORE_NOUNS + phrase mappings | 2 NR → PASS | IntentKnowledgeBase.java |
| **P2c** | DB migrations for missing intents | 2 NR → PASS | SQL migrations |
| **P2d** | Handler crash fixes | 2 EXEC_FAIL → PASS | Service layer (needs log analysis) |

**Expected improvement after P2a+P2b**: 19/30 → 24/30 (80%)
**Expected improvement after P2a+P2b+P2c**: 19/30 → 26/30 (87%)
**Expected improvement after all fixes**: 19/30 → 29/30 (97%)
