# Permission Control Tests Report - v10.0 Intent Recognition

**Test Date:** 2026-01-22 22:16 - 22:20 (UTC+8)
**Test Category:** 03-permission-control
**Total Test Cases:** 30
**Endpoint:** `/api/mobile/F001/ai-intents/execute`

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Tests | 30 |
| Passed | 5 |
| Failed | 22 |
| Skipped | 3 |
| **Pass Rate** | **16.7%** |

### Key Findings

1. **Permission Control Works Partially:** The system uses `NO_PERMISSION` status to block unauthorized access, but many requests bypass this check and go to `NEED_CLARIFICATION` instead.

2. **APPROVAL_REQUIRED Not Implemented:** None of the approval-required tests passed. The system does not trigger approval workflows for sensitive operations.

3. **Role Mismatch Issue:** factory_admin1 (factory_super_admin role) is being blocked from operations that require factory_super_admin, suggesting a role name mismatch in the intent configuration.

4. **Missing Status Codes:** The system does not implement:
   - `PERMISSION_DENIED` (uses `NO_PERMISSION` instead)
   - `APPROVAL_REQUIRED`
   - `CONFIRMATION_REQUIRED`
   - `REJECTED`

---

## Detailed Test Results

### Permission Denied Tests (P001-P015)

| ID | User | Role | Input | Expected | Actual | Result |
|----|------|------|-------|----------|--------|--------|
| P001 | quality_insp1 | quality_inspector | 帮我删除这条质检记录 | PERMISSION_DENIED | NO_PERMISSION | **PASS** |
| P002 | worker1 | - | 修改一下今天的排产计划 | PERMISSION_DENIED | SKIPPED | SKIP |
| P003 | warehouse_mgr1 | warehouse_manager | 帮我创建一个新用户账号 | PERMISSION_DENIED | NEED_CLARIFICATION | FAIL |
| P004 | dispatcher1 | dispatcher | 删除这个供应商的所有数据 | PERMISSION_DENIED | NO_PERMISSION | **PASS** |
| P005 | hr_admin1 | hr_admin | 查看生产线的实时数据 | PERMISSION_DENIED | SUCCESS | FAIL |
| P006 | quality_insp1 | quality_inspector | 批准这批货的降级使用 | PERMISSION_DENIED | NEED_CLARIFICATION | FAIL |
| P007 | worker1 | - | 导出全厂员工的工资明细 | PERMISSION_DENIED | SKIPPED | SKIP |
| P008 | dispatcher1 | dispatcher | 修改系统参数配置 | PERMISSION_DENIED | NEED_CLARIFICATION | FAIL |
| P009 | warehouse_mgr1 | warehouse_manager | 强制通过这批不合格品 | PERMISSION_DENIED | NEED_CLARIFICATION | FAIL |
| P010 | hr_admin1 | hr_admin | 调整产品定价 | PERMISSION_DENIED | NO_PERMISSION | **PASS** |
| P011 | quality_insp1 | quality_inspector | 取消已发出的发货单 | PERMISSION_DENIED | NEED_CLARIFICATION | FAIL |
| P012 | worker1 | - | 查看其他员工的绩效考核详情 | PERMISSION_DENIED | SKIPPED | SKIP |
| P013 | dispatcher1 | dispatcher | 删除设备维护记录 | PERMISSION_DENIED | NO_PERMISSION | **PASS** |
| P014 | warehouse_mgr1 | warehouse_manager | 修改已入账的财务数据 | PERMISSION_DENIED | FAILED | FAIL |
| P015 | hr_admin1 | hr_admin | 访问客户的联系方式和订单历史 | PERMISSION_DENIED | NO_PERMISSION | **PASS** |

**Summary:** 5 PASS, 7 FAIL, 3 SKIP

---

### Approval Required Tests (P016-P027, P029)

| ID | User | Input | Expected | Actual | Intent | Result |
|----|------|-------|----------|--------|--------|--------|
| P016 | factory_admin1 | 批量更新500条原料记录的状态 | APPROVAL_REQUIRED | SUCCESS | BATCH_UPDATE | FAIL |
| P017 | factory_admin1 | 删除三个月前的所有考勤异常记录 | APPROVAL_REQUIRED | NO_PERMISSION | ATTENDANCE_ANOMALY | FAIL |
| P018 | factory_admin1 | 修改全厂的安全库存阈值 | APPROVAL_REQUIRED | NEED_CLARIFICATION | MATERIAL_BATCH_QUERY | FAIL |
| P019 | factory_admin1 | 强制将这批不合格品改为合格 | APPROVAL_REQUIRED | NEED_CLARIFICATION | QUALITY_DISPOSITION_EXECUTE | FAIL |
| P020 | factory_admin1 | 重置供应商评分系统 | APPROVAL_REQUIRED | NO_PERMISSION | RULE_CONFIG | FAIL |
| P021 | factory_admin1 | 批量调整上个月所有员工的工资 | APPROVAL_REQUIRED | NEED_CLARIFICATION | ATTENDANCE_ANOMALY | FAIL |
| P022 | factory_admin1 | 导出全部客户数据到Excel | APPROVAL_REQUIRED | NO_PERMISSION | CUSTOMER_LIST | FAIL |
| P023 | factory_admin1 | 修改质检标准参数 | APPROVAL_REQUIRED | NO_PERMISSION | QUALITY_CHECK_QUERY | FAIL |
| P024 | factory_admin1 | 取消进行中的生产订单 | APPROVAL_REQUIRED | SUCCESS | PROCESSING_BATCH_LIST | FAIL |
| P025 | factory_admin1 | 批量作废本月的质检报告 | APPROVAL_REQUIRED | NO_PERMISSION | QUALITY_STATS | FAIL |
| P026 | factory_admin1 | 修改已完成发货单的数量 | APPROVAL_REQUIRED | NEED_CLARIFICATION | SHIPMENT_UPDATE | FAIL |
| P027 | factory_admin1 | 删除设备的校准历史记录 | APPROVAL_REQUIRED | NO_PERMISSION | SCALE_DELETE_DEVICE | FAIL |
| P029 | factory_admin1 | 修改核心BOM配方数据 | APPROVAL_REQUIRED | NEED_CLARIFICATION | BATCH_UPDATE | FAIL |

**Summary:** 0 PASS, 13 FAIL

---

### Confirmation/Rejected Tests (P028, P030)

| ID | User | Input | Expected | Actual | Intent | Result |
|----|------|-------|----------|--------|--------|--------|
| P028 | factory_admin1 | 批量创建200个新的原料批次 | CONFIRMATION_REQUIRED | NO_PERMISSION | MATERIAL_BATCH_QUERY | FAIL |
| P030 | factory_admin1 | 清空测试环境的所有数据 | REJECTED | FAILED | BATCH_UPDATE | FAIL |

**Summary:** 0 PASS, 2 FAIL

---

## Issues Identified

### 1. Role Permission Mismatch (Critical)

**Problem:** factory_admin1 has role `factory_super_admin` in JWT but is blocked by intents requiring `["factory_super_admin"]`.

**Evidence:**
- P017: "需要角色: [\"factory_super_admin\", \"department_admin\"]" - blocked
- P020: "需要角色: [\"factory_super_admin\"]" - blocked
- P025: "需要角色: [\"factory_super_admin\", \"quality_inspector\", \"department_admin\"]" - blocked

**Recommendation:** Check role string comparison - possible case sensitivity or format mismatch issue.

### 2. Approval Flow Not Implemented

**Problem:** No sensitive operations trigger approval workflow.

**Expected Behavior:**
- Bulk operations (>100 records) should require approval
- Delete operations on critical data should require approval
- Configuration changes should require approval

**Actual Behavior:**
- Operations either succeed directly or fail with NO_PERMISSION
- `requiresApproval` is always `null` in responses

### 3. Intent Recognition Bypassing Permission Check

**Problem:** Many unauthorized requests go to NEED_CLARIFICATION instead of NO_PERMISSION.

**Examples:**
- P003: warehouse_mgr1 creating users -> NEED_CLARIFICATION (should be blocked)
- P006: quality_insp1 approving dispositions -> NEED_CLARIFICATION (should be blocked)
- P008: dispatcher1 modifying system params -> NEED_CLARIFICATION (should be blocked)

**Recommendation:** Permission check should happen BEFORE intent clarification prompts.

### 4. Missing worker1 Account

**Problem:** Test account `worker1` does not exist in the system.

**Affected Tests:** P002, P007, P012

**Recommendation:** Create worker1 test account or update test cases.

---

## Recommendations

### Immediate Actions

1. **Fix Role Permission Check**
   - Verify role string format consistency
   - Check case sensitivity in role comparison
   - Review `allowedRoles` configuration in AIIntentConfig

2. **Implement Approval Workflow**
   - Add sensitivity level checks before execution
   - Implement `requiresApproval` flag logic
   - Create approval request entities and flow

3. **Reorder Permission Checking**
   - Check permissions before intent recognition/clarification
   - Return NO_PERMISSION immediately for unauthorized users

### Test Account Setup

Create `worker1` account:
```sql
INSERT INTO users (username, password, role, factory_id)
VALUES ('worker1', '加密后的123456', 'operator', 'F001');
```

---

## Test Execution Notes

- **Login Status:**
  - quality_insp1: OK
  - warehouse_mgr1: OK
  - dispatcher1: OK
  - hr_admin1: OK
  - factory_admin1: OK
  - worker1: FAILED (account not found)

- **Server Stability:** Intermittent connection issues observed during testing

- **Test Duration:** Approximately 5 minutes for all 30 tests

---

## Appendix: Response Status Mapping

| System Status | Test Expected | Match |
|---------------|---------------|-------|
| NO_PERMISSION | PERMISSION_DENIED | Acceptable |
| NEED_CLARIFICATION | * | No direct mapping |
| SUCCESS | - | N/A |
| FAILED | - | N/A |
| (none) | APPROVAL_REQUIRED | Not implemented |
| (none) | CONFIRMATION_REQUIRED | Not implemented |
| (none) | REJECTED | Not implemented |

---

*Report generated by Claude Code v10.0 Intent Test Runner*
