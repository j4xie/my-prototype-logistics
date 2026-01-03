# Miscellaneous i18n Migration - Quick Start

## 🚀 Quick Reference for Developers

### Files to Migrate (19 total)

```
Legacy HR (2)
├── screens/legacy/hr/HREmployeeAIScreen.tsx → Use 'hr' namespace
└── screens/legacy/hr/HRDashboardScreen.tsx → Use 'hr' namespace

Legacy Warehouse (2)
├── screens/legacy/warehouse/InventoryStatisticsScreen.tsx → Use 'warehouse' namespace
└── screens/legacy/warehouse/InventoryCheckScreen.tsx → Use 'warehouse' namespace

Traceability (3)
├── screens/traceability/PublicTraceScreen.tsx → Use 'common' namespace
├── screens/traceability/TraceabilityScreen.tsx → Use 'common' namespace
└── screens/traceability/TraceabilityDetailScreen.tsx → Use 'common' namespace

Alerts (2)
├── screens/alerts/CreateExceptionScreen.tsx → Use 'alerts' namespace
└── screens/alerts/ExceptionAlertScreen.tsx → Use 'alerts' namespace

Profile & Common (4)
├── screens/common/NotificationCenterScreen.tsx → Use 'common' namespace
├── screens/profile/FeedbackScreen.tsx → Use 'profile' namespace
├── screens/profile/MembershipScreen.tsx → Use 'profile' namespace
└── screens/profile/ProfileScreen.tsx → Use 'profile' namespace

Work (2)
├── screens/work/WorkTypeFormScreen.tsx → Use 'hr' namespace
└── screens/work/WorkTypeListScreen.tsx → Use 'hr' namespace

Demo & Test (4)
├── screens/demo/FormilyDemoScreen.tsx → Use 'common' namespace
├── screens/test/ServerConnectivityTestScreen.tsx → Use 'common' namespace
├── screens/test/PushNotificationTestScreen.tsx → Use 'common' namespace
└── screens/test/BatchOperationsTestScreen.tsx → Use 'common' namespace
```

---

## 📝 Migration Steps (Copy-Paste Template)

### Step 1: Add Import
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Add Hook in Component
```typescript
export default function YourScreen() {
  const { t } = useTranslation('namespace'); // 'hr', 'warehouse', 'common', 'alerts', or 'profile'
  // ... rest of code
}
```

### Step 3: Replace Strings

#### Basic String
```typescript
// Before:
<Text>"员工AI分析"</Text>

// After:
<Text>{t('legacy.employeeAI.title')}</Text>
```

#### Alert Messages
```typescript
// Before:
Alert.alert('提示', '请选择类型');

// After:
Alert.alert(t('common.messages.tip'), t('create.selectType'));
```

#### With Interpolation
```typescript
// Before:
<Text>`入职 ${months} 个月`</Text>

// After:
<Text>{t('legacy.employeeAI.joinedMonths', { months })}</Text>
```

#### Arrays with Labels
```typescript
// Before:
const types = [
  { id: 'equipment', label: '设备故障', icon: 'cog-off' },
  { id: 'material', label: '原料问题', icon: 'fish-off' },
];

// After:
const types = [
  { id: 'equipment', label: t('create.exceptionTypes.equipment'), icon: 'cog-off' },
  { id: 'material', label: t('create.exceptionTypes.material'), icon: 'fish-off' },
];
```

---

## 🔑 Key Translation Paths

### HR Files
```typescript
t('legacy.employeeAI.title')                    // "员工AI分析"
t('legacy.employeeAI.loading')                  // "正在分析员工数据..."
t('legacy.employeeAI.askPlaceholder')           // "输入问题，深入了解员工表现..."
t('legacy.employeeAI.proficiency.master')       // "精通"
t('legacy.dashboard.title')                     // "HR仪表板"
t('workType.form.title')                        // "工作类型表单"
t('workType.list.add')                          // "添加工作类型"
```

### Warehouse Files
```typescript
t('legacy.inventoryStatistics.title')           // "库存统计"
t('legacy.inventoryCheck.createCheck')          // "新建盘点"
```

### Alerts Files
```typescript
t('create.title')                               // "异常上报"
t('create.step', { current: 1, total: 3 })     // "步骤 1/3"
t('create.exceptionTypes.equipment')            // "设备故障"
t('create.submitSuccess')                       // "提交成功"
t('exception.title')                            // "异常预警"
```

### Traceability Files
```typescript
t('traceability.public.title')                  // "公开溯源查询"
t('traceability.screen.title')                  // "溯源查询"
t('traceability.detail.title')                  // "溯源详情"
```

### Profile Files
```typescript
t('feedback.title')                             // "意见反馈"
t('feedback.placeholder')                       // "请输入您的意见或建议..."
t('membership.title')                           // "会员中心"
t('membership.comingSoon')                      // "功能开发中"
```

### Common/Test Files
```typescript
t('notification.center.title')                  // "通知中心"
t('demo.formily.title')                         // "Formily 动态表单演示"
t('test.serverConnectivity.title')              // "服务器连接测试"
t('test.pushNotification.send')                 // "发送测试通知"
t('test.batchOperations.selectAll')             // "全选"
```

### Shared Common Keys
```typescript
t('common.buttons.save')                        // "保存"
t('common.buttons.cancel')                      // "取消"
t('common.status.loading')                      // "加载中..."
t('common.status.noData')                       // "暂无数据"
t('common.error.loadFailed')                    // "加载失败"
```

---

## ✅ Checklist for Each File

- [ ] Import `useTranslation` from 'react-i18next'
- [ ] Add `const { t } = useTranslation('namespace')` hook
- [ ] Replace all hardcoded Chinese strings
- [ ] Replace all Alert.alert() messages
- [ ] Update placeholder text
- [ ] Convert arrays with labels
- [ ] Test language switching
- [ ] Verify interpolation works

---

## 🔍 Common Patterns

### Conditional Text
```typescript
// Before:
{loading ? '加载中...' : '暂无数据'}

// After:
{loading ? t('common.status.loading') : t('common.status.noData')}
```

### Button Text
```typescript
// Before:
<Button>保存</Button>

// After:
<Button>{t('common.buttons.save')}</Button>
```

### Error Handling
```typescript
// Before:
catch (error) {
  Alert.alert('错误', '加载失败');
}

// After:
catch (error) {
  Alert.alert(t('common.error.general'), t('common.error.loadFailed'));
}
```

### Form Validation
```typescript
// Before:
if (!value) return Alert.alert('提示', '请输入内容');

// After:
if (!value) return Alert.alert(
  t('common.messages.tip'),
  t('common.validation.required')
);
```

---

## 📚 Documentation Links

- **Full Guide**: `MISCELLANEOUS_I18N_MIGRATION_GUIDE.md`
- **Summary**: `MISCELLANEOUS_I18N_MIGRATION_SUMMARY.md`
- **Translation Files**:
  - `src/i18n/locales/zh-CN/hr.json`
  - `src/i18n/locales/zh-CN/warehouse.json`
  - `src/i18n/locales/zh-CN/alerts.json`
  - `src/i18n/locales/zh-CN/common.json`
  - `src/i18n/locales/zh-CN/profile.json`

---

## 🎯 Priority Order

1. **High Priority** (User-facing):
   - Alert screens (CreateExceptionScreen, ExceptionAlertScreen)
   - Profile screens (FeedbackScreen, ProfileScreen)
   - Traceability screens (PublicTraceScreen)

2. **Medium Priority**:
   - HR AI screen (HREmployeeAIScreen)
   - Warehouse screens
   - Work type screens

3. **Low Priority** (Internal/Testing):
   - Demo screens
   - Test screens

---

## 💡 Tips

1. **Use namespace prefix**: Always specify namespace in useTranslation()
2. **Check existing keys**: Many common keys already exist in `common.json`
3. **Interpolation**: Use `{{variable}}` in translation files
4. **Nested keys**: Use dot notation like `legacy.employeeAI.title`
5. **Fallback**: Missing translations will show key path in development

---

## 🧪 Testing

```bash
# Change language in app
Settings → Language → English/中文

# Verify on each screen:
1. Title displays correctly
2. Button labels are translated
3. Error messages show in correct language
4. Dynamic content (numbers, dates) formats correctly
5. Alert dialogs appear in correct language
```

---

**Last Updated**: 2026-01-02
**Status**: Ready for implementation
