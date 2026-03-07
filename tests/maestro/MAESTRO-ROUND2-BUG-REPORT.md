# Maestro Round 2 — Deep E2E Bug Report

**Date**: 2026-03-02
**Test Coverage**: 6 roles, 26 Maestro YAML tests, **152 screenshots**
**Method**: Maestro E2E sequential execution + 5-agent parallel screenshot analysis
**Tests Passed**: 11/14 new tests (14,15,16,17,19,20,21,22,23,24,25-partial)
**Tests Failed**: 18 (QI records crash), 25 (emulator OOM), 26 (not run)

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **P0 Critical** | 3 | App crash (QI records), weight=0 (WM), contradictory stats (WM outbound) |
| **P1 Functional** | 13 | Missing order lists, wrong scan page, broken Gantt, navigation failures |
| **P2 Data/Display** | 16 | Hardcoded data, mixed language, empty states, stale data |
| **P3 i18n/UX** | 12 | Language mixing, minor cosmetics |
| **Total** | **44** | |

---

## P0 — Critical Bugs

### P0-01: QI Records Tab Crash — App Exits to Android Home
**Role**: Quality Inspector
**Evidence**: `18-qi-crash-evidence.png`, `18-qi-debug-fail.png`, `18-qi-debug-fail2.png`
**Symptom**: Tapping 记录 tab, then scrolling, causes complete app crash. App exits to Android launcher. 100% reproducible.
**Root Cause (code investigation)**:
1. `QIRecordsScreen.tsx` uses `formatDateTime()` from `qualityInspector.ts:376` which calls `date.toLocaleString('zh-CN', {...})` — **Hermes engine crashes on toLocaleString**
2. `item.inspector.name` (line 160) — no null guard, crash if `inspector` is null
3. `GRADE_COLORS[item.grade]` (line 144) — undefined style value crash if grade is unexpected

**Fix**: Use Hermes-safe formatter from `src/utils/formatters.ts`, add null guards, add error boundary.

### P0-02: WM Outbound Weight Always Shows 0 kg
**Role**: Warehouse Manager
**Evidence**: `16-wm-outbound-list.png`
**Symptom**: Stats show 25 orders + 98% on-time rate but "出货重量(kg): 0"
**Root Cause**: Java `BigDecimal` serialized as string `"25.00"`, JS `reduce()` does string concatenation
**Status**: Fix applied in code (`Number(i.quantity || 0)`) but **not deployed to APK**

### P0-03: WM Outbound Order List Completely Empty
**Role**: Warehouse Manager
**Evidence**: `16-wm-outbound-list.png`, `16-wm-pending-pack.png`
**Symptom**: "All(25)" tab shows 25 orders in stats but zero order cards rendered below. Entire list area is blank white space.
**Root Cause**: Likely related to BigDecimal type mismatch affecting list rendering.

---

## P1 — Functional Bugs

### P1-01: WM Scan Outbound Shows Inbound Title
**Evidence**: `16-wm-scan-outbound.png`
**Symptom**: Navigating from Outbound → "扫码出库" opens a page titled "扫码入库" (Scan Inbound) with text "扫描后自动入库确认" (auto-confirm inbound). Wrong scan page entirely.
**Impact**: Scanning from this screen would create inbound records instead of outbound confirmations.

### P1-02: WM Loading — "Confirm Loading" Enabled for Empty Trucks
**Evidence**: `16-wm-loading-mgmt.png`
**Symptom**: Trucks 沪A12345 and 沪B67890 show "0/5000 kg" and "0/8000 kg" — zero items loaded — but "Confirm Loading" button is active/green.
**Fix**: Disable button when `loadedWeight === 0`.

### P1-03: WM Inventory — Stocktake Shows Detail Page Instead of Stocktake UI
**Evidence**: `15-wm-stocktake.png`
**Symptom**: "Stocktake" button navigates to the same item detail page instead of a dedicated stocktake form.
**Expected**: Should show count entry form, variance display, confirmation flow.

### P1-04: WM Inventory — Severe EN/CN Mixing
**Evidence**: `15-wm-inventory-list.png`
**Symptom**: Quick actions use EN ("Stocktake", "Transfer", "Location", "Expiry") + CN ("库存预警"). Item badges say "Frozen" (EN). Header uses CN ("库存管理").

### P1-05: QI Stats Show Dashes Instead of Numbers
**Evidence**: `17-qi-home.png`
**Symptom**: Pending, Passed, Failed cards show "-" instead of 0. In Progress showed hardcoded "1".
**Status**: Fix applied in code (`?? 0` instead of `?? '-'`) but **not deployed to APK**.

### P1-06: HR Whitelist — "whitelist.list.noRole" Literal Key Shown
**Evidence**: `21-hr-whitelist-list.png`, `21-hr-whitelist-scroll.png`
**Symptom**: All whitelist entries show raw i18n key `whitelist.list.noRole` instead of "未设定角色".
**Status**: Fix applied in code (added key to both locale files) but **not deployed to APK**.

### P1-07: DP Personnel Transfer Page Entirely in English
**Evidence**: `23-dp-personnel-transfer.png`
**Symptom**: Full page in English ("Personnel Transfer", "Transfer Configuration", "Source Workshop", "Target Workshop", "Submit Transfer Request") while rest of app is Chinese.

### P1-08: DP Gantt Chart Almost Empty Despite 6 Tasks
**Evidence**: `22-dp-gantt.png`
**Symptom**: Summary bar shows 6 planned tasks, 2 in progress, 1 delayed. But chart body shows only 1 production line with no visible task bars. Time axis shows narrow 17:00-21:00 range.

### P1-09: DP Plan List Shows 0 Plans, Gantt Shows 6
**Evidence**: `22-dp-plan-list.png` vs `22-dp-gantt.png`
**Symptom**: "今日计划 (0个)" and "暂无计划" but Gantt chart for same date shows 6 tasks.

### P1-10: FA Dashboard All KPIs Zero
**Evidence**: `25-debug-fail.png`, `24-fa-employees.png`
**Symptom**: Quality Rate 0.0%, Unit Cost ¥0.0, Avg Cycle 0.0h, Output 0 kg, Batches 0. AI Insight says "Quality rate is low today" — misleading when data is simply absent.

### P1-11: FA Reports Tab — All Metrics Zero
**Evidence**: `25-fa-reports-tab.png`, `25-fa-reports-scroll.png`
**Symptom**: Production batches=0, completed=0, quality inspections=0, pass rate=0.0%, total cost=¥0. Only exception: Equipment OEE = 75.0% (suspected hardcoded).

### P1-12: FA Navigation Failures — App Crashes to Launcher
**Evidence**: `24-fa-suppliers.png` (shows Android launcher, not suppliers page)
**Symptom**: Tapping Suppliers/Employees/Products on Management tab crashes app or navigates to wrong screen.

### P1-13: HR Staff Count Mismatch — 45 vs 31
**Evidence**: `21-hr-profile.png` vs `20-hr-search-result.png`
**Symptom**: Profile shows "45 Active Staff" while dashboard shows "Total Staff 31".

---

## P2 — Data/Display Issues

### P2-01: WM Inbound Detail — Missing Production Date (dash)
**Evidence**: `14-wm-inbound-detail.png`

### P2-02: WM Inbound Detail — All Logistics Fields Empty
**Evidence**: `14-wm-inbound-detail.png`
Vehicle No., Driver, Phone all show "-" for completed inbound.

### P2-03: WM Inbound — Status Language Mismatch
**Evidence**: `14-wm-inbound-list.png` vs `14-wm-inbound-detail.png`
List shows "Completed" (EN), detail shows "已入库" (CN) for same record.

### P2-04: WM Inventory — All 8 Items Same Material (带鱼)
**Evidence**: `15-wm-inventory-list.png`
Test data has zero material diversity.

### P2-05: WM Inventory Detail — Mixed EN/CN Values
**Evidence**: `15-wm-item-detail.png`
"Shelf Life" label (EN) + "90天" value (CN), "Safety Stock" (EN) + "充足" (CN).

### P2-06: QI Hardcoded Avg Inspection Time (8.5 min)
**Evidence**: `17-qi-home.png`
`QIHomeScreen.tsx:230` — static `8.5` and `12%` improvement, not from API.

### P2-07: QI Wait Times 500+ Hours — No Day Format
**Evidence**: `19-qi-inspect-list.png`
Shows "等待 563小时9分钟" instead of "23天15小时".

### P2-08: QI QR Scan Page in English
**Evidence**: `19-qi-inspect-form.png`
"Place QR code within frame to scan automatically", "Flashlight", "Manual Input" all EN.

### P2-09: DP Urgent Order Placeholder Date in Past (2025-12-29)
**Evidence**: `22-dp-urgent-order.png`

### P2-10: DP Create Plan Date in English Format
**Evidence**: `22-dp-create-plan.png`
Shows "March 3, 2026" instead of "2026-03-03" or "2026年3月3日".

### P2-11: DP AI Schedule Shows 0 Batches Despite Active Plans
**Evidence**: `23-dp-ai-schedule-tab.png`

### P2-12: FA Equipment OEE 75% While Everything Else Is 0%
**Evidence**: `25-fa-reports-tab.png`
Hardcoded default? OEE requires production data to calculate.

### P2-13: FA SmartBI KPIs Appear Static/Demo
**Evidence**: `25-fa-smart-tab.png`
Revenue ¥862.5万, margin 6.8%, yield 96.5% — suspiciously clean numbers disconnected from system.

### P2-14: FA AI Insight Text in English
**Evidence**: `25-debug-fail.png`
"Quality rate is low today, please check QC" — should be Chinese.

### P2-15: HR Dashboard All KPIs Zero
**Evidence**: `20-hr-search-result.png`
0 On Site, 0 Late, 0 Pending Whitelist, 0.0% Attendance despite 31 staff.

### P2-16: HR "No Department" in English
**Evidence**: `20-hr-staff-list.png`
Shows "No Department" instead of "未分配部门".

---

## P3 — i18n / UX Issues

### P3-01: WM New Inbound Form — Quantity Defaults to 0 (zero-kg risk)
### P3-02: QI Inspect List — 15 Hardcoded CN Strings Bypass i18n
### P3-03: QI Home — "0/0 batches passed" Empty State
### P3-04: DP AI Schedule Tabs May Not Switch (identical screenshots)
### P3-05: DP Mixed Batch All Zeros — Test Data Gap
### P3-06: DP Bottom Tab Labels Compressed
### P3-07: DP SmartBI KPIs Possibly Hardcoded
### P3-08: FA Dashboard Mixed EN/CN Labels
### P3-09: FA Management Tab Mixed EN/CN Section Headers
### P3-10: FA SmartBI Low-Contrast Trend Text
### P3-11: FA Greeting "Good evening" in English + Raw Username
### P3-12: HR Profile All English Menus

---

## Test Execution Summary (Round 2)

| Test | Role | Status | Screenshots | New Bugs Found |
|------|------|--------|-------------|----------------|
| 14-wm-inbound-workflow | WM | **PASS** | 4/4 | P2-01,02,03 |
| 15-wm-inventory-ops | WM | **PASS** | 5/6 | P1-03,04, P2-04,05 |
| 16-wm-outbound-workflow | WM | **PASS** | 4/4 | P0-02,03, P1-01,02 |
| 17-qi-inspection-flow | QI | **PASS** | 3/3 | P1-05, P2-06 |
| 18-qi-records-analysis | QI | **CRASH** | 2/5 | **P0-01** |
| 19-qi-inspect-list-search | QI | **PASS** | 4/4 | P2-07,08 |
| 20-hr-staff-management | HR | **PASS** (partial) | 4/4 | P1-13, P2-15,16 |
| 21-hr-whitelist-crud | HR | **PASS** | 5/5 | P1-06 |
| 22-dp-plan-scheduling | DP | **PASS** | 5/5 | P1-08,09, P2-09,10 |
| 23-dp-ai-analysis | DP | **PASS** | 5/5 | P1-07, P2-11 |
| 24-fa-management-deep | FA | **PASS** (with warnings) | 6/6 | P1-12 |
| 25-fa-reports-deep | FA | **PARTIAL** | 5/7 | P1-10,11, P2-12,13,14 |
| 26-all-roles-refresh | FA | NOT RUN | 0 | — |
| explore-qi-deep (re-run) | QI | NOT RUN | 0 | — |

---

## Cumulative Bug Count (Round 1 + Round 2)

| | Round 1 | Round 2 NEW | Total Unique |
|---|---------|-------------|-------------|
| P0 | 2 | +1 (QI crash) | **3** |
| P1 | 4 | +9 | **13** |
| P2 | 5 | +11 | **16** |
| P3 | 4 | +8 | **12** |
| **Total** | **15** | **+29** | **44** |

---

## Fix Priority Recommendations

### Fix Now (P0 — Data Corruption / Crash)
| Bug | Fix | Effort |
|-----|-----|--------|
| P0-01 QI Records crash | Replace `toLocaleString` with Hermes-safe formatter + null guards | Small |
| P0-02 Outbound weight=0 | **Already fixed in code** — rebuild APK | Deploy |
| P0-03 Outbound list empty | Investigate FlatList rendering with BigDecimal strings | Medium |

### Fix Before Release (P1 — Functional)
| Bug | Fix | Effort |
|-----|-----|--------|
| P1-01 Scan outbound→inbound | Fix navigation route in outbound management | Small |
| P1-02 Confirm loading at 0kg | Add `disabled={loaded === 0}` | Tiny |
| P1-03 Stocktake missing | Implement/connect stocktake UI | Medium |
| P1-05 QI dashes | **Already fixed** — rebuild APK | Deploy |
| P1-06 HR noRole | **Already fixed** — rebuild APK | Deploy |
| P1-07 DP Transfer all-EN | Add i18n translations | Small |
| P1-08 Gantt empty | Fix time axis scaling + multi-line rendering | Medium |
| P1-09 Plan List 0 vs Gantt 6 | Fix Plan List query/filter | Medium |
| P1-10,11 FA all zeros | Seed test data or fix API queries | Medium |

### Deploy Code Fixes Already Made
3 bugs have code fixes that just need an APK rebuild:
- P0-02: `WHOutboundListScreen.tsx` + `WHInboundListScreen.tsx` — `Number()` fix
- P1-05: `QIHomeScreen.tsx` — `?? 0` instead of `?? '-'`
- P1-06: `hr.json` (zh-CN + en-US) — `noRole` + `deleteMessage` keys
