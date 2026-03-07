# Maestro Deep Explore Bug Report

**Date**: 2026-03-02
**Test Coverage**: 6 roles (FA, WS, WM, DP, HR, QI) — 21 Maestro YAML tests, 90+ screenshots
**Method**: Maestro deep explore + 5-agent parallel code investigation

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **P0 Critical** | 2 | Data corruption (weight=0), navigation crash |
| **P1 Functional** | 4 | Display bugs, missing translations |
| **P2 Data/Display** | 5 | Stale data, stat conflicts, empty states |
| **P3 i18n/UX** | 4 | Mixed language across ~35 screens |
| **Total** | **15** | |

---

## P0 — Critical Bugs

### BUG-01: WM Outbound/Inbound Weight Always Shows 0
**Role**: Warehouse Manager (WM)
**Screenshot**: `explore-wm-outbound-tab.png`
**Symptom**: "出货重量(kg) = 0" despite 25 orders; header "今日出库 0 kg"

**Root Cause**: Java `BigDecimal quantity` serializes as string `"25.00"` in JSON. Frontend `reduce((sum, i) => sum + i.quantity, 0)` performs string concatenation instead of addition: `0 + "25.00" = "025.00"`.

**Files**:
- `frontend/.../screens/warehouse/outbound/WHOutboundListScreen.tsx:160` — buggy reduce
- `frontend/.../screens/warehouse/inbound/WHInboundListScreen.tsx` — **same bug**
- `backend/.../entity/ShipmentRecord.java:42` — `BigDecimal quantity`
- `frontend/.../services/api/shipmentApiClient.ts:20` — type expects `number`

**Fix**: `sum + Number(i.quantity)` or add backend `@JsonSerialize(using = ToStringSerializer.class)` + frontend `parseFloat()`.

---

### BUG-02: QI Deep Explore Navigation Crash
**Role**: Quality Inspector (QI)
**Screenshot**: Missing `explore-qi-analysis-tab.png`, `explore-qi-analysis-scroll.png`, `explore-qi-profile-tab.png`
**Symptom**: Test stops after "Start Inspection" — cannot navigate to analysis or profile tabs.

**Root Cause**: Cross-tab navigation issue. `QIHomeScreen.handleStartInspection()` navigates to `QIForm` which is in `InspectStack` (different tab). After pressing back from QIForm, user lands on `QIInspectList` (still on InspectTab), not back on HomeTab. Subsequent tab taps may fail because the navigator state is confused.

**Files**:
- `frontend/.../navigation/QualityInspectorNavigator.tsx:113-163` — InspectStack
- `frontend/.../screens/quality-inspector/QIHomeScreen.tsx:89-98` — cross-tab navigate
- `frontend/.../screens/quality-inspector/QIFormScreen.tsx`

**Fix**: Either navigate within HomeStack (add QIForm to HomeStack) or use `navigation.navigate('QIInspectTab', { screen: 'QIForm', params: {...} })` for explicit cross-tab navigation, then Maestro test should tap "首页" tab to return.

---

## P1 — Functional Bugs

### BUG-03: DP Personnel "Temp0" Display Bug
**Role**: Dispatcher (DP)
**Screenshot**: `explore-dp-personnel-tab.png`
**Symptom**: Shows "31 总人数 Temp0" and "1 工作中 Temp0" — "Temp0" should not appear.

**Root Cause**: Missing space between i18n translation and number value.
```typescript
// Line 554 — no space between translation and value
<Text>{t('personnelListScreen.temp')}{stats.tempWorkers}</Text>
// Renders as: "Temp" + 0 = "Temp0"
```

**File**: `frontend/.../screens/dispatcher/personnel/PersonnelListScreen.tsx:554,559`

**Fix**: Add space: `{t('personnelListScreen.temp')} {stats.tempWorkers}` or use interpolation.

---

### BUG-04: HR Whitelist "whitelist.list.noRole" Not Translated
**Role**: HR Administrator
**Screenshot**: `explore-hr-whitelist.png`
**Symptom**: All whitelist entries show literal text `whitelist.list.noRole` instead of "未设定角色".

**Root Cause**: Translation key `whitelist.list.noRole` missing from both language files. `whitelist.list.unsetRole` exists but the component uses the wrong key name.

**Files**:
- `frontend/.../screens/hr/whitelist/WhitelistListScreen.tsx:95` — uses `t('whitelist.list.noRole')`
- `frontend/.../i18n/locales/zh-CN/hr.json:449` — has `unsetRole`, missing `noRole`
- `frontend/.../i18n/locales/en-US/hr.json:449` — same

**Also Missing**: `whitelist.list.deleteMessage` key (line 69 of component).

**Fix**: Add `"noRole": "未设定角色"` / `"noRole": "No role set"` to both language files. Or rename component reference to `unsetRole`.

---

### BUG-05: QI Stats Show Dashes Instead of Numbers
**Role**: Quality Inspector (QI)
**Screenshot**: `explore-qi-start-inspect.png`
**Symptom**: Pending, Passed, Failed stats all show "-" instead of 0.

**Likely Cause**: Conditional rendering showing "-" when value is 0 or null/undefined. Should show "0" instead.

---

### BUG-06: WM Outbound Order List Empty
**Role**: Warehouse Manager (WM)
**Screenshot**: `explore-wm-outbound-scroll.png`
**Symptom**: Stats show "全部(25)" but the list area below is completely empty — no order cards rendered.

**Likely Cause**: Related to BUG-01 — the data mapping issue may also affect list rendering, or the list component has a rendering bug when data types don't match expected format.

---

## P2 — Data/Display Issues

### BUG-07: QI Stale Test Data — 562+ Hour Wait Times
**Role**: Quality Inspector (QI)
**Screenshot**: `explore-qi-inspect-scroll.png`
**Symptom**: Batches show "等待 562小时19分钟" / "586小时19分钟" (23-24 days waiting).

**Cause**: Test data batches (PB-20260207-*) are from Feb 7, 2026 — almost a month old. The wait time calculation is correct but the data is stale.

**Recommendation**: Refresh test data with recent dates, or add date-relative test data generation.

---

### BUG-08: WM Stock Alerts = 1241 Items
**Role**: Warehouse Manager (WM)
**Screenshot**: `explore-wm-home.png`
**Symptom**: "Stock Alerts: 1241 items" — unrealistically high for test data.

**Cause**: Likely counting all inventory items or using wrong alert threshold. Should only show items below safety stock or near expiry.

---

### BUG-09: WM Home Stats Conflict
**Role**: Warehouse Manager (WM)
**Screenshot**: `explore-wm-home.png`
**Symptom**: "Today Inbound: 0 kg" + "Outbound Tasks (0)" but inbound tab shows 8 completed entries with 1524.5 kg total.

**Cause**: Home stats may be filtering by today's date only, while the inbound list shows all records. Or the "Today" filter logic is wrong (timezone issue / date boundary).

---

### BUG-10: DP Plan Tab Completely Empty
**Role**: Dispatcher (DP)
**Screenshot**: `explore-dp-plan-tab.png`
**Symptom**: "今日计划 (0个)" — "暂无计划". No plans at all.

**Cause**: Test data may not include production plans for the current date.

---

### BUG-11: HR Staff "No Department" for Multiple Users
**Role**: HR Administrator
**Screenshot**: `explore-hr-staff-list.png`
**Symptom**: Several staff members show "No Department" (E2E测试用户, AI创建用户, dispatcher1).

**Cause**: Test-created users were not assigned to departments during creation. Department field may be optional in user creation flow.

---

## P3 — i18n / UX Issues

### BUG-12: Mixed EN/CN Language Across ~35 Screens
**All Roles**
**Symptom**: Screens inconsistently mix English and Chinese text. Examples:
- WM inventory: English buttons ("Stocktake", "Transfer") + Chinese labels ("库存预警", "搜索物料名称")
- QI home: English stats ("Pending", "In Progress", "Today's Pass Rate") + Chinese header ("质检工作台")
- HR profile: English menus ("Department Management", "My Info") + Chinese name ("HR经理小陈")
- HR attendance: "Attendance Management" header, "No attendance records" in English

**Root Cause**: Full i18n system (i18next) exists with 14 namespaces × 2 languages (zh-CN + en-US), but:
1. ~35 screen components have **hardcoded Chinese strings mixed with i18n calls**
2. Error handlers use hardcoded Chinese: `setError('加载失败')`
3. Some screens import `useTranslation` but don't use it consistently

**Files**: Translation files are complete in `frontend/.../i18n/locales/`. The bug is in screen components not using `t()` for all strings.

**Recommendation**: Systematic audit to replace all hardcoded strings with `t()` calls. Priority: error messages, empty states, labels.

---

### BUG-13: WM Inventory Detail Mixed Language
**Screenshot**: `explore-wm-inventory-detail.png`
**Symptom**: "Inventory Details" (EN), "Transfer"/"Expiry Handling" (EN), but "充足"/"90天"/"冻品" (CN)

---

### BUG-14: QI Home Quick Actions Mixed Language
**Screenshot**: `explore-qi-home-scroll.png`
**Symptom**: Quick Actions in English ("Scan QR", "Voice Input", "Records", "Analysis") but header "质检工作台" in Chinese.

---

### BUG-15: HR Profile All English Menus
**Screenshot**: `explore-hr-profile-tab.png`
**Symptom**: "Profile", "Management", "Department Management", "Whitelist Management", "Scheduling Management", "Personal", "My Info", "My Attendance" — all in English while user name is Chinese.

---

## Test Execution Summary

| Test File | Role | Status | Screenshots | Issues Found |
|-----------|------|--------|-------------|--------------|
| explore-wm-deep.yaml | Warehouse Mgr | PASS | 7/7 | BUG-01,06,08,09,13 |
| explore-dp-deep.yaml | Dispatcher | PASS | 5/5 | BUG-03,10 |
| explore-hr-deep.yaml | HR Admin | PASS | 5/5 | BUG-04,11,15 |
| explore-qi-deep.yaml | QI Inspector | **PARTIAL** | 3/6 | BUG-02,05,07,12,14 |

---

## Fix Priority Recommendation

| Priority | Bug IDs | Effort | Impact |
|----------|---------|--------|--------|
| **Fix Now** | BUG-01 (weight=0), BUG-03 (Temp0), BUG-04 (noRole) | Small | High - user-facing data bugs |
| **Fix Soon** | BUG-02 (QI nav), BUG-05 (dashes), BUG-06 (empty list) | Medium | Medium - navigation/display |
| **Backlog** | BUG-07-11 (data issues) | Medium | Low - test data quality |
| **Systematic** | BUG-12-15 (i18n) | Large | Medium - consistency |
