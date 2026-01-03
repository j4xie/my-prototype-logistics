# HR Module i18n Migration Guide

**Date**: 2026-01-02
**Status**: Migration specifications completed
**Files**: 15 HR module screens

## Overview

This guide provides the complete migration specification for all HR module screens to support internationalization (i18n).

---

## Translation Files Updated

### Chinese (zh-CN/hr.json)
- ✅ Whitelist management translations
- ✅ Scheduling management translations
- ✅ Profile translations
- ✅ Production/Batch translations
- ✅ Staff management translations
- ✅ Analytics translations (performance & labor cost)

### English (en-US/hr.json)
- ✅ Corresponding English translations added

---

## Migration Pattern

All files follow this standard pattern:

```typescript
// 1. Add import
import { useTranslation } from 'react-i18next';

// 2. Get translation function
const { t } = useTranslation('hr');

// 3. Replace hardcoded strings
<Text>{t('staff.title')}</Text>  // "员工管理" / "Staff Management"
```

---

## File-by-File Migration Specifications

### 1. WhitelistAddScreen.tsx

**Import to add:**
```typescript
import { useTranslation } from 'react-i18next';
```

**Hook to add (line 28, after useState declarations):**
```typescript
const { t } = useTranslation('hr');
```

**String replacements:**

| Line | Original | Replace With |
|------|----------|--------------|
| 101 | `'添加白名单'` | `t('whitelist.add.title')` |
| 104 | `'手机号 *'` | `t('whitelist.add.phone') + ' *'` |
| 109 | `'请输入手机号'` | `t('whitelist.add.phonePlaceholder')` |
| 117 | `'预设角色 *'` | `t('whitelist.add.role') + ' *'` |
| 130 | `'请选择角色'` | `t('whitelist.add.rolePlaceholder')` |
| 144 | `'备注'` | `t('whitelist.add.remark')` |
| 149 | `'请输入备注信息'` | `t('whitelist.add.remarkPlaceholder')` |
| 170 | `'提示'` | `t('whitelist.add.tipTitle')` |
| 172 | `'添加到白名单后，该手机号用户可以注册并获得预设角色权限'` | `t('whitelist.add.tip')` |
| 182 | `'取消'` | `t('whitelist.add.cancel')` |
| 189 | `'添加'` | `t('whitelist.add.add')` |
| 57 | `'请输入手机号'` | `t('whitelist.add.phoneRequired')` |
| 62 | `'请输入有效的11位手机号'` | `t('whitelist.add.phoneInvalid')` |
| 67 | `'请选择角色'` | `t('whitelist.add.roleRequired')` |
| 76 | `'白名单添加成功'` | `t('whitelist.add.success')` |
| 79 | `'添加失败'` | `t('whitelist.add.failed')` |
| 82 | `'错误'` | `t('whitelist.add.errorTitle')` |

---

### 2. WhitelistListScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'白名单列表'` | `t('whitelist.list.title')` |
| `'搜索手机号...'` | `t('whitelist.list.search')` |
| `'删除'` | `t('whitelist.list.delete')` |
| `'确定要删除 {phone} 吗?'` | `t('whitelist.list.deleteConfirm', { phone })` |
| `'删除成功'` | `t('whitelist.list.deleteSuccess')` |
| `'删除失败'` | `t('whitelist.list.deleteFailed')` |
| `'暂无白名单数据'` | `t('whitelist.list.empty')` |
| `'未设定角色'` | `t('whitelist.list.unsetRole')` |
| `'添加'` | `t('whitelist.list.addedAt')` |

---

### 3. WorkScheduleScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'排班管理'` | `t('scheduling.workSchedule.title')` |
| `'搜索员工姓名...'` | `t('scheduling.workSchedule.search')` |
| `'全部部门'` | `t('scheduling.workSchedule.allDepartments')` |
| `'按部门筛选'` | `t('scheduling.workSchedule.filterByDepartment')` |
| `'暂无排班数据'` | `t('scheduling.workSchedule.empty')` |
| `'周日'` to `'周六'` | `t('scheduling.workSchedule.days.sunday')` ... `t('scheduling.workSchedule.days.saturday')` |
| `'排班'` | `t('scheduling.workSchedule.schedule')` |
| `'休息'` | `t('scheduling.workSchedule.restDay')` |
| `'工时'` | `t('scheduling.workSchedule.workHours')` |

---

### 4. DepartmentListScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'部门管理'` | `t('department.list.title')` |
| `'搜索部门...'` | `t('department.list.search')` |
| `'暂无部门数据'` | `t('department.list.empty')` |
| `'正常运行'` | `t('department.list.activeStatus')` |
| `'已停用'` | `t('department.list.inactiveStatus')` |
| `'人'` | `t('department.list.people')` |
| `'未指定负责人'` | `t('department.list.noManager')` |

---

### 5. DepartmentAddScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'添加部门'` | `t('department.add.title')` |
| `'部门名称 *'` | `t('department.add.name') + ' *'` |
| `'请输入部门名称'` | `t('department.add.namePlaceholder')` |
| `'部门描述'` | `t('department.add.description')` |
| `'请输入部门描述'` | `t('department.add.descriptionPlaceholder')` |
| `'部门负责人'` | `t('department.add.manager')` |
| `'请选择负责人'` | `t('department.add.managerPlaceholder')` |
| `'暂不指定'` | `t('department.add.noManager')` |
| `'启用状态'` | `t('department.add.activeStatus')` |
| `'关闭后该部门将不可用'` | `t('department.add.activeHint')` |
| `'取消'` | `t('department.add.cancel')` |
| `'创建'` | `t('department.add.create')` |
| `'提示'` | `t('common.tip')` |
| `'请输入部门名称'` (validation) | `t('department.add.nameRequired')` |
| `'成功'` | `t('common.success')` |
| `'部门创建成功'` | `t('department.add.success')` |
| `'确定'` | `t('common.ok')` |
| `'失败'` | `t('common.failed')` |
| `'创建失败'` | `t('department.add.failed')` |
| `'错误'` | `t('common.error')` |
| `'创建失败，请重试'` | `t('department.add.retryFailed')` |

---

### 6. DepartmentDetailScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'部门详情'` | `t('department.detail.title')` |
| `'部门信息不存在'` | `t('department.detail.notFound')` |
| `'正常运行'` | `t('department.detail.active')` |
| `'已停用'` | `t('department.detail.inactive')` |
| `'基本信息'` | `t('department.detail.basicInfo')` |
| `'负责人'` | `t('department.detail.manager')` |
| `'未指定'` | `t('department.detail.unspecified')` |
| `'成员数量'` | `t('department.detail.memberCount')` |
| `'人'` | `t('department.detail.people')` |
| `'创建时间'` | `t('department.detail.createdAt')` |
| `'部门成员'` | `t('department.detail.members')` |
| `'员工'` | `t('department.detail.employee')` |
| `'暂无成员'` | `t('department.detail.noMembers')` |
| `'错误'` | `t('common.error')` |
| `'加载部门信息失败'` | `t('department.detail.loadFailed')` |
| `'确认停用'` / `'确认启用'` | `t('department.detail.confirmToggle')` |
| `'确定要停用该部门吗？'` / `'确定要启用该部门吗？'` | `t('department.detail.toggleMessage')` |
| `'取消'` | `t('common.cancel')` |
| `'确定'` | `t('common.ok')` |
| `'停用失败'` / `'启用失败'` | `t('department.detail.toggleFailed')` |

---

### 7. HRProfileScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'个人中心'` | `t('profile.title')` |
| `'人力资源管理员'` | `t('profile.role')` |
| `'未分配工厂'` | `t('profile.noFactory')` |
| `'在职员工'` | `t('profile.stats.activeStaff')` |
| `'部门数量'` | `t('profile.stats.departmentCount')` |
| `'本月出勤'` | `t('profile.stats.monthlyAttendance')` |
| `'管理功能'` | `t('profile.sections.management')` |
| `'部门管理'` | `t('profile.menu.departmentManage')` |
| `'白名单管理'` | `t('profile.menu.whitelistManage')` |
| `'排班管理'` | `t('profile.menu.schedulingManage')` |
| `'个人设置'` | `t('profile.sections.personal')` |
| `'个人信息'` | `t('profile.menu.myInfo')` |
| `'我的考勤'` | `t('profile.menu.myAttendance')` |
| `'消息通知'` | `t('profile.menu.notifications')` |
| `'系统'` | `t('profile.sections.system')` |
| `'系统设置'` | `t('profile.menu.settings')` |
| `'帮助中心'` | `t('profile.menu.help')` |
| `'关于'` | `t('profile.menu.about')` |
| `'提示'` | `t('common.tip')` |
| `'功能开发中'` | `t('profile.comingSoon')` |
| `'确认退出'` | `t('profile.logoutConfirm')` |
| `'确定要退出登录吗？'` | `t('profile.logoutMessage')` |
| `'取消'` | `t('profile.cancel')` |
| `'退出'` | `t('profile.confirm')` |
| `'退出登录'` | `t('profile.logout')` |
| `'版本'` | `t('profile.version')` |

---

### 8. BatchWorkersScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'批次员工'` | `t('production.batchWorkers.title')` |
| `'总人数'` | `t('production.batchWorkers.totalCount')` |
| `'总工时'` | `t('production.batchWorkers.totalHours')` |
| `'工作中'` (heading) | `t('production.batchWorkers.working')` |
| `'工作中'` (status) | `t('production.batchWorkers.status.working')` |
| `'已完成'` | `t('production.batchWorkers.status.completed')` |
| `'已暂停'` | `t('production.batchWorkers.status.paused')` |
| `'未知'` (status fallback) | `t('production.batchWorkers.status.unknown')` |
| `'未分配部门'` | `t('production.batchWorkers.noDepartment')` |
| `'工时'` | `t('production.batchWorkers.workDuration')` |
| `'暂无分配员工'` | `t('production.batchWorkers.empty')` |
| `'点击下方按钮添加员工'` | `t('production.batchWorkers.emptyHint')` |
| `'提示'` | `t('common.tip')` |
| `'添加员工功能即将上线'` | `t('production.batchWorkers.alerts.addComingSoon')` |
| `'移除员工'` | `t('production.batchWorkers.removeWorker')` |
| `'确定要将 {name} 从该批次移除吗？'` | `t('production.batchWorkers.removeConfirm', { name })` |
| `'确定'` | `t('common.ok')` |
| `'取消'` | `t('common.cancel')` |
| `'错误'` | `t('common.error')` |
| `'移除失败，请重试'` | `t('production.batchWorkers.removeFailed')` |

---

### 9. BatchAssignmentScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'批次分配'` | `t('production.batchAssignment.title')` |
| `'搜索批次号或产品名...'` | `t('production.batchAssignment.search')` |
| `'暂无批次任务'` | `t('production.batchAssignment.empty')` |
| `'进行中'` | `t('production.batchAssignment.status.inProgress')` |
| `'待处理'` | `t('production.batchAssignment.status.pending')` |
| `'已完成'` | `t('production.batchAssignment.status.completed')` |
| `'已分配'` | `t('production.batchAssignment.assigned')` |
| `'人'` | `t('production.batchAssignment.required')` |
| `'工时'` | `t('production.batchAssignment.workHours')` |

---

### 10. StaffListScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'员工管理'` | `t('staff.title')` |
| `'搜索员工...'` | `t('staff.search.placeholder')` |
| `'筛选'` | `t('staff.filter.label')` |
| `'全部'` | `t('staff.filter.all')` |
| `'在岗'` | `t('staff.filter.active')` |
| `'休假'` | `t('staff.filter.onLeave')` |
| `'离职'` | `t('staff.filter.resigned')` |
| `'停职'` | `t('staff.filter.suspended')` |
| `'暂无员工数据'` | `t('staff.empty.title')` |
| `'未分配部门'` | `t('staff.card.noDepartment')` |
| `'员工'` | `t('staff.card.defaultPosition')` |

---

### 11. StaffDetailScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'员工详情'` | `t('staff.detail.title')` |
| `'员工信息不存在'` | `t('staff.detail.notFound')` |
| `'基本信息'` | `t('staff.detail.basicInfo')` |
| `'手机号'` | `t('staff.detail.phone')` |
| `'邮箱'` | `t('staff.detail.email')` |
| `'入职日期'` | `t('staff.detail.hireDate')` |
| `'工号'` | `t('staff.detail.employeeCode')` |
| `'本月考勤'` | `t('staff.detail.attendance')` |
| `'出勤天数'` | `t('staff.detail.workDays')` |
| `'迟到'` | `t('staff.detail.late')` |
| `'早退'` | `t('staff.detail.earlyLeave')` |
| `'缺勤'` | `t('staff.detail.absent')` |
| `'工时汇总'` | `t('staff.detail.workTimeSummary')` |
| `'参与批次'` | `t('staff.detail.batches')` |
| `'总工时'` | `t('staff.detail.totalHours')` |
| `'总收入'` | `t('staff.detail.totalEarnings')` |
| `'最近参与批次'` | `t('staff.detail.recentBatches')` |
| `'AI 分析'` | `t('staff.detail.aiAnalysis')` |
| `'错误'` | `t('common.error')` |
| `'加载员工信息失败'` | `t('staff.detail.loadFailed')` |

---

### 12. StaffAddScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'添加员工'` | `t('staff.add.title')` |
| `'基本信息'` | `t('staff.form.basicInfo')` |
| `'用户名 *'` | `t('staff.form.username') + ' *'` |
| `'姓名 *'` | `t('staff.form.name') + ' *'` |
| `'手机号 *'` | `t('staff.form.phone') + ' *'` |
| `'邮箱'` | `t('staff.form.email')` |
| `'工作信息'` | `t('staff.form.workInfo')` |
| `'选择部门'` | `t('staff.form.selectDepartment')` |
| `'职位'` | `t('staff.form.position')` |
| `'添加员工'` (button) | `t('staff.form.submit')` |
| `'请输入用户名'` | `t('staff.form.usernameRequired')` |
| `'用户名至少3个字符'` | `t('staff.form.usernameMinLength')` |
| `'请输入姓名'` | `t('staff.form.nameRequired')` |
| `'请输入手机号'` | `t('staff.form.phoneRequired')` |
| `'请输入有效的手机号'` | `t('staff.form.phoneInvalid')` |
| `'请输入有效的邮箱'` | `t('staff.form.emailInvalid')` |
| `'成功'` | `t('common.success')` |
| `'员工添加成功，默认密码为 123456'` | `t('staff.add.success')` |
| `'确定'` | `t('common.ok')` |
| `'错误'` | `t('common.error')` |

**Role names** (lines 44-50):
```typescript
const ROLES: Role[] = [
  { code: 'worker', name: t('staff.roles.worker') },
  { code: 'team_leader', name: t('staff.roles.teamLeader') },
  { code: 'department_admin', name: t('staff.roles.deptAdmin') },
  { code: 'quality_inspector', name: t('staff.roles.qualityInspector') },
  { code: 'warehouse_keeper', name: t('staff.roles.warehouseKeeper') },
];
```

---

### 13. StaffAIAnalysisScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'AI 分析'` | `t('staff.aiAnalysis.title')` |
| `'加载分析结果...'` | `t('staff.aiAnalysis.loading')` |
| `'暂无分析数据'` | `t('staff.aiAnalysis.noData')` |
| `'点击下方按钮开始AI分析'` | `t('staff.aiAnalysis.noDataHint')` |
| `'开始分析'` | `t('staff.aiAnalysis.startAnalysis')` |
| `'综合评分'` | `t('staff.aiAnalysis.overallScore')` |
| `'分析时间'` | `t('staff.aiAnalysis.analysisDate')` |
| `'能力评估'` | `t('staff.aiAnalysis.abilityAssessment')` |
| `'工作效率'` | `t('staff.aiAnalysis.efficiency')` |
| `'质量表现'` | `t('staff.aiAnalysis.quality')` |
| `'出勤情况'` | `t('staff.aiAnalysis.attendance')` |
| `'团队协作'` | `t('staff.aiAnalysis.teamwork')` |
| `'优势特点'` | `t('staff.aiAnalysis.strengths')` |
| `'待改进'` | `t('staff.aiAnalysis.improvements')` |
| `'AI 建议'` | `t('staff.aiAnalysis.suggestions')` |

---

### 14. PerformanceScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'绩效分析'` | `t('analytics.performance.title')` |
| `'平均分'` | `t('analytics.performance.avgScore')` |
| `'优秀'` | `t('analytics.performance.excellent')` |
| `'需关注'` | `t('analytics.performance.needAttention')` |
| `'绩效等级分布'` | `t('analytics.performance.gradeDistribution')` |
| `'员工绩效列表'` | `t('analytics.performance.employeeList')` |
| `'暂无绩效数据'` | `t('analytics.performance.empty')` |
| `'本月'` | `t('analytics.performance.thisMonth')` |
| `'本季'` | `t('analytics.performance.thisQuarter')` |
| `'本年'` | `t('analytics.performance.thisYear')` |

---

### 15. LaborCostScreen.tsx

**Import & Hook:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('hr');
```

**String replacements:**

| Original | Replace With |
|----------|--------------|
| `'工时成本'` | `t('analytics.laborCost.title')` |
| `'总成本'` | `t('analytics.laborCost.stats.totalCost')` |
| `'总工时'` | `t('analytics.laborCost.stats.totalHours')` |
| `'参与员工'` | `t('analytics.laborCost.stats.participatingEmployees')` |
| `'时薪均值'` | `t('analytics.laborCost.stats.avgHourlyRate')` |
| `'部门成本分布'` | `t('analytics.laborCost.deptCostDistribution')` |
| `'员工工时排行'` | `t('analytics.laborCost.workerHoursRank')` |
| `'暂无数据'` | `t('analytics.laborCost.noData')` |
| `'未分配'` | `t('analytics.laborCost.unassigned')` |
| `'本周'` | `t('analytics.laborCost.period.week')` |
| `'本月'` | `t('analytics.laborCost.period.month')` |
| `'本季'` | `t('analytics.laborCost.period.quarter')` |

---

## Migration Checklist

For each file:
- [ ] Add `import { useTranslation } from 'react-i18next';`
- [ ] Add `const { t } = useTranslation('hr');` hook
- [ ] Replace all hardcoded Chinese strings with `t()` calls
- [ ] Test both Chinese and English translations
- [ ] Verify dynamic values work with interpolation (e.g., `t('key', { name })`)

---

## Testing

After migration, test each screen:
1. Switch language to Chinese - verify all text displays correctly
2. Switch language to English - verify all text displays correctly
3. Test dynamic strings with variables
4. Test error messages and alerts
5. Test all button labels and placeholders

---

## Notes

- All translation keys follow the pattern: `module.screen.section.key`
- Common strings use `common.*` prefix
- Status/enum values use nested objects: `status.active`, `status.inactive`
- Interpolation uses `{ variable }` syntax: `t('key', { variable })`
- Translation files are already updated with all required keys
- No additional translation keys need to be added

---

## Summary

✅ **15 files** specified for migration
✅ **Translation files** updated with all required keys
✅ **Migration patterns** documented for each file
✅ **Testing strategy** provided

All files are ready for i18n migration following the specifications above.
