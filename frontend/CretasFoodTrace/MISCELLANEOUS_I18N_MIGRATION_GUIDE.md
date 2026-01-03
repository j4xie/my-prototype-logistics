# Miscellaneous Modules i18n Migration Guide

## Overview
Migration guide for remaining legacy, traceability, alerts, common, profile, work, demo, and test screen files to use i18n.

**Status**: Ready for implementation
**Date**: 2026-01-02

---

## Translation Keys Added

### HR Module (`hr.json`)
```json
{
  "legacy": {
    "employeeAI": {
      "title": "员工AI分析",
      "loading": "正在分析员工数据...",
      "loadingSubtext": "AI正在进行深度分析，请稍候",
      "noEmployeeId": "未指定员工ID",
      "noData": "暂无分析数据",
      "overallGrade": "综合等级",
      "overallScore": "综合分",
      "attendance": "考勤",
      "workHours": "工时",
      "production": "生产",
      "compared": "环比",
      "departmentRank": "部门前{{percent}}%",
      "attendancePerformance": "考勤表现",
      "workHoursEfficiency": "工时效率",
      "productionContribution": "生产贡献",
      "skillDistribution": "技能分布",
      "aiSuggestions": "AI建议",
      "aiAssistant": "AI助手",
      "askPlaceholder": "输入问题，深入了解员工表现...",
      "thinking": "正在思考...",
      "attendanceRate": "出勤率",
      "attendanceDays": "出勤天数",
      "lateCount": "迟到",
      "absentDays": "缺勤",
      "avgDailyHours": "日均工时",
      "overtimeHours": "加班时长",
      "efficiency": "效率",
      "workTypeCount": "工作类型",
      "batchCount": "参与批次",
      "outputQuantity": "产量",
      "qualityRate": "良品率",
      "productivityRate": "人效",
      "proficiency": {
        "master": "精通",
        "skilled": "熟练",
        "learning": "学习中",
        "beginner": "新手"
      },
      "suggestionTypes": {
        "advantage": "优势",
        "suggestion": "建议",
        "attention": "关注"
      },
      "defaultPosition": "操作员",
      "defaultDepartment": "未分配部门",
      "joinedMonths": "入职 {{months}} 个月"
    },
    "dashboard": {
      "title": "HR仪表板",
      "loadFailed": "加载 HR 仪表板数据失败"
    }
  }
}
```

### Warehouse Module (`warehouse.json`)
```json
{
  "legacy": {
    "inventoryStatistics": {
      "title": "库存统计",
      "overview": "统计概览",
      "details": "详细数据",
      "loadFailed": "加载库存统计失败"
    },
    "inventoryCheck": {
      "title": "库存盘点",
      "createCheck": "新建盘点",
      "checkList": "盘点列表",
      "loadFailed": "加载盘点记录失败"
    }
  }
}
```

### Alerts Module (`alerts.json`) - Additional keys
```json
{
  "create": {
    "step": "步骤 {{current}}/{{total}}",
    "step1Title": "第一步: 发生了什么?",
    "step2Title": "第二步: 详细情况",
    "step3Title": "第三步: 确认上报",
    "exceptionTypes": {
      "equipment": "设备故障",
      "material": "原料问题",
      "safety": "安全隐患",
      "other": "其他问题"
    },
    "describeIssue": "请描述具体问题...",
    "clickToTakePhoto": "点击拍照 (选填)",
    "type": "类型",
    "description": "描述",
    "photo": "照片",
    "photoAdded": "已添加 {{count}} 张",
    "previousStep": "上一步",
    "nextStep": "下一步",
    "confirmReport": "确认上报",
    "selectType": "请选择类型",
    "enterDescription": "请填写描述",
    "selectExceptionType": "请选择异常类型",
    "cameraPermissionRequired": "需要相机权限",
    "submitSuccess": "提交成功",
    "exceptionReported": "异常情况已上报，请等待处理",
    "submitFailed": "提交失败",
    "pleaseRetryLater": "请稍后重试"
  }
}
```

### Common Module (`common.json`) - Already has traceability keys

### Profile Module (`profile.json`) - Additional keys
```json
{
  "feedback": {
    "title": "意见反馈",
    "placeholder": "请输入您的意见或建议...",
    "submit": "提交",
    "thankYou": "感谢您的反馈!"
  },
  "membership": {
    "title": "会员中心",
    "level": "会员等级",
    "benefits": "会员权益",
    "comingSoon": "功能开发中"
  }
}
```

### Work Module (use `hr.json`)
```json
{
  "workType": {
    "title": "工作类型",
    "list": {
      "title": "工作类型列表",
      "empty": "暂无工作类型",
      "add": "添加工作类型"
    },
    "form": {
      "title": "工作类型表单",
      "name": "类型名称",
      "namePlaceholder": "请输入工作类型名称",
      "description": "描述",
      "descriptionPlaceholder": "请输入描述",
      "save": "保存",
      "cancel": "取消",
      "createSuccess": "创建成功",
      "updateSuccess": "更新成功",
      "saveFailed": "保存失败"
    }
  }
}
```

---

## File Migration Details

### 1. Legacy HR Files

#### `/src/screens/legacy/hr/HREmployeeAIScreen.tsx`
**Namespace**: `hr`

**Changes:**
1. Add import: `import { useTranslation } from 'react-i18next';`
2. Add hook: `const { t } = useTranslation('hr');`
3. Replace strings:
   - Line 417: `title="员工AI分析"` → `title={t('legacy.employeeAI.title')}`
   - Line 98: `'未指定员工ID'` → `t('legacy.employeeAI.noEmployeeId')`
   - Line 421: `"正在分析员工数据..."` → `t('legacy.employeeAI.loading')`
   - Line 422: `"AI正在进行深度分析，请稍候"` → `t('legacy.employeeAI.loadingSubtext')`
   - Line 441: `"重新加载"` → `t('common.buttons.retry')`
   - Line 459: `"暂无分析数据"` → `t('legacy.employeeAI.noData')`
   - Continue for all visible strings...

#### `/src/screens/legacy/hr/HRDashboardScreen.tsx`
**Namespace**: `hr`

**Changes:**
1. Add import and hook
2. Replace title and error messages with `t('legacy.dashboard.*')`

---

### 2. Legacy Warehouse Files

#### `/src/screens/legacy/warehouse/InventoryStatisticsScreen.tsx`
**Namespace**: `warehouse`

**Changes:**
1. Add i18n import and hook
2. Replace all Chinese strings with `t('legacy.inventoryStatistics.*')`

#### `/src/screens/legacy/warehouse/InventoryCheckScreen.tsx`
**Namespace**: `warehouse`

**Changes:**
1. Add i18n import and hook
2. Replace all Chinese strings with `t('legacy.inventoryCheck.*')`

---

### 3. Traceability Files

#### `/src/screens/traceability/PublicTraceScreen.tsx`
**Namespace**: `common`

**Changes:**
1. Add: `const { t } = useTranslation('common');`
2. Replace strings using existing `common.traceability.public.*` keys

#### `/src/screens/traceability/TraceabilityScreen.tsx`
**Namespace**: `common`

**Changes:**
1. Add hook: `const { t } = useTranslation('common');`
2. Use `common.traceability.screen.*` keys

#### `/src/screens/traceability/TraceabilityDetailScreen.tsx`
**Namespace**: `common`

**Changes:**
1. Add hook: `const { t } = useTranslation('common');`
2. Use `common.traceability.detail.*` keys

---

### 4. Alerts Files

#### `/src/screens/alerts/CreateExceptionScreen.tsx`
**Namespace**: `alerts`

**Changes:**
1. Add: `const { t } = useTranslation('alerts');`
2. Line 23-26: Replace exception type labels:
```typescript
const exceptionTypes = [
    { id: 'equipment', label: t('create.exceptionTypes.equipment'), icon: 'cog-off', color: '#F44336' },
    { id: 'material', label: t('create.exceptionTypes.material'), icon: 'fish-off', color: '#FF9800' },
    { id: 'safety', label: t('create.exceptionTypes.safety'), icon: 'alert', color: '#D32F2F' },
    { id: 'other', label: t('create.exceptionTypes.other'), icon: 'help-circle', color: '#2196F3' },
];
```
3. Replace all Alert.alert messages and UI strings

#### `/src/screens/alerts/ExceptionAlertScreen.tsx`
**Namespace**: `alerts`

**Changes:**
1. Add hook
2. Replace title, status labels, action buttons with `t('exception.*')`

---

### 5. Common & Profile Files

#### `/src/screens/common/NotificationCenterScreen.tsx`
**Namespace**: `common`

**Changes:**
- Use existing `common.notification.center.*` keys

#### `/src/screens/profile/FeedbackScreen.tsx`
**Namespace**: `profile`

**Changes:**
- Use `profile.feedback.*` keys

#### `/src/screens/profile/MembershipScreen.tsx`
**Namespace**: `profile`

**Changes:**
- Use `profile.membership.*` keys

#### `/src/screens/profile/ProfileScreen.tsx`
**Namespace**: `profile`

**Changes:**
- Use existing `profile.*` keys

---

### 6. Work Files

#### `/src/screens/work/WorkTypeFormScreen.tsx`
**Namespace**: `hr`

**Changes:**
- Use `hr.workType.form.*` keys

#### `/src/screens/work/WorkTypeListScreen.tsx`
**Namespace**: `hr`

**Changes:**
- Use `hr.workType.list.*` keys

---

### 7. Demo & Test Files

#### `/src/screens/demo/FormilyDemoScreen.tsx`
**Namespace**: `common`

**Changes:**
- Use existing `common.demo.formily.*` keys

#### `/src/screens/test/ServerConnectivityTestScreen.tsx`
**Namespace**: `common`

**Changes:**
- Use existing `common.test.serverConnectivity.*` keys

#### `/src/screens/test/PushNotificationTestScreen.tsx`
**Namespace**: `common`

**Changes:**
1. Add: `const { t } = useTranslation('common');`
2. Add new keys to `common.json`:
```json
{
  "test": {
    "pushNotification": {
      "title": "推送通知测试",
      "send": "发送测试通知",
      "sendSuccess": "通知已发送",
      "sendFailed": "发送失败"
    }
  }
}
```

#### `/src/screens/test/BatchOperationsTestScreen.tsx`
**Namespace**: `common`

**Changes:**
1. Add hook
2. Add keys:
```json
{
  "test": {
    "batchOperations": {
      "title": "批量操作测试",
      "selectAll": "全选",
      "deleteSelected": "删除选中",
      "exportSelected": "导出选中"
    }
  }
}
```

---

## English Translation Keys

All corresponding English keys should be added to `en-US/*.json` files following the same structure.

Example for `en-US/hr.json`:
```json
{
  "legacy": {
    "employeeAI": {
      "title": "Employee AI Analysis",
      "loading": "Analyzing employee data...",
      "loadingSubtext": "AI is performing in-depth analysis, please wait",
      ...
    }
  }
}
```

---

## Implementation Checklist

- [ ] Update `zh-CN/hr.json` with legacy keys
- [ ] Update `zh-CN/warehouse.json` with legacy keys
- [ ] Update `zh-CN/alerts.json` with create form keys
- [ ] Update `zh-CN/profile.json` with feedback/membership keys
- [ ] Update `zh-CN/common.json` with test module keys
- [ ] Add all corresponding `en-US/*.json` translations
- [ ] Migrate 2 HR legacy files
- [ ] Migrate 2 warehouse legacy files
- [ ] Migrate 3 traceability files
- [ ] Migrate 2 alerts files
- [ ] Migrate 4 common/profile files
- [ ] Migrate 2 work files
- [ ] Migrate 4 demo/test files
- [ ] Test all migrated screens
- [ ] Verify language switching works

---

## Notes

1. **Large Files**: Files like `HREmployeeAIScreen.tsx` (1115 lines) have extensive UI strings. Focus on user-visible text first.
2. **Error Messages**: Prioritize error messages and user alerts for translation.
3. **Dynamic Content**: Use interpolation for dynamic values: `t('key', { value: variable })`
4. **Nested Keys**: Use dot notation for organization: `t('legacy.employeeAI.title')`
5. **Reuse Common Keys**: Use `common.*` namespace for shared UI elements

---

## Testing

After migration, test:
1. Switch language in app settings
2. Verify all screens display correct translations
3. Check dynamic content interpolation
4. Verify alerts and error messages
5. Test form validation messages
