# Dispatcher Module i18n Migration Status

## Overview
Migration of dispatcher module files to use internationalization (i18n) with react-i18next.

**Translation Files:**
- `src/i18n/locales/zh-CN/dispatcher.json` (Chinese)
- `src/i18n/locales/en-US/dispatcher.json` (English)

---

## Migration Status

### ✅ Completed Files

1. **WorkshopStatusScreen.tsx** ✓
   - Added `useTranslation` hook
   - Migrated all UI strings to use `t()` function
   - Translation keys: `workshop.status.*`

2. **PlanCreateScreen.tsx** ⚠️ Partial
   - Added `useTranslation` hook
   - Migrated validation messages and submit alerts
   - **TODO**: Migrate remaining UI labels (section titles, placeholders, etc.)
   - Translation keys: `planCreate.*`

3. **PlanDetailScreen.tsx** ⚠️ Partial
   - Added `useTranslation` hook
   - **TODO**: Migrate all UI strings
   - Translation keys: `planDetail.*`

### ⏳ Pending Files (Require Migration)

**Plan Screens (9 files):**
- [ ] ResourceOverviewScreen.tsx
- [ ] ApprovalListScreen.tsx
- [ ] BatchWorkersScreen.tsx
- [ ] TaskAssignmentScreen.tsx
- [ ] MixedBatchScreen.tsx
- [ ] PlanListScreen.tsx
- [ ] PlanGanttScreen.tsx

**Profile Screens (2 files):**
- [ ] DSStatisticsScreen.tsx
- [ ] DSProfileScreen.tsx

**AI Screens (4 files):**
- [ ] AIWorkerOptimizeScreen.tsx
- [ ] AIScheduleGenerateScreen.tsx
- [ ] AICompletionProbScreen.tsx
- [ ] AIScheduleScreen.tsx

**Personnel Screens (5 files):**
- [ ] PersonnelDetailScreen.tsx
- [ ] PersonnelTransferScreen.tsx
- [ ] PersonnelListScreen.tsx
- [ ] PersonnelScheduleScreen.tsx
- [ ] PersonnelAttendanceScreen.tsx

---

## Migration Pattern

### Step 1: Add Import
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Add Hook in Component
```typescript
export function MyScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('dispatcher'); // ← Add this line
  // ...
}
```

### Step 3: Replace Chinese Strings

**Before:**
```typescript
<Text>生产计划</Text>
Alert.alert('成功', '操作成功');
```

**After:**
```typescript
<Text>{t('planList.title')}</Text>
Alert.alert(t('common.success'), t('messages.operationSuccess'));
```

---

## Translation Key Structure

```
dispatcher.json
├── home.*              # DSHomeScreen
├── planList.*          # PlanListScreen
├── planCreate.*        # PlanCreateScreen
├── planDetail.*        # PlanDetailScreen
├── resource.*          # ResourceOverviewScreen
├── urgentInsert.*      # UrgentInsertScreen
├── ai.schedule.*       # AI Scheduling screens
├── ai.completionProb.* # Completion Probability
├── ai.workerOptimize.* # Worker Optimization
├── personnel.*         # Personnel screens
├── profile.*           # Profile screens
├── workshop.status.*   # Workshop Status
├── messages.*          # Common messages
└── common.*            # Common UI elements
```

---

## Common Translation Keys Reference

### Common Actions
```typescript
t('common.confirm')        // 确认
t('common.cancel')         // 取消
t('common.save')           // 保存
t('common.delete')         // 删除
t('common.edit')           // 编辑
t('common.back')           // 返回
t('common.loading')        // 加载中...
t('common.success')        // 成功
t('common.failed')         // 失败
t('common.error')          // 错误
```

### Status Labels
```typescript
t('planList.status.pending')      // 待开始
t('planList.status.inProgress')   // 进行中
t('planList.status.completed')    // 已完成
```

### Priority Levels
```typescript
t('planDetail.priority.high')     // 高
t('planDetail.priority.medium')   // 中
t('planDetail.priority.low')      // 低
```

---

## Example: Complete Migration

### Before Migration
```typescript
import React from 'react';
import { View, Text, Alert } from 'react-native';

export function ExampleScreen() {
  const handleSubmit = () => {
    Alert.alert('成功', '操作成功');
  };

  return (
    <View>
      <Text>生产计划列表</Text>
      <Text>待开始</Text>
      <Button title="保存" onPress={handleSubmit} />
    </View>
  );
}
```

### After Migration
```typescript
import React from 'react';
import { View, Text, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

export function ExampleScreen() {
  const { t } = useTranslation('dispatcher');

  const handleSubmit = () => {
    Alert.alert(t('common.success'), t('messages.operationSuccess'));
  };

  return (
    <View>
      <Text>{t('planList.title')}</Text>
      <Text>{t('planList.status.pending')}</Text>
      <Button title={t('common.save')} onPress={handleSubmit} />
    </View>
  );
}
```

---

## Testing After Migration

1. **Switch language in app settings**
2. **Verify all text displays correctly in both languages**
3. **Check for missing translation keys** (will show key name if missing)
4. **Test dynamic values** (e.g., `t('key', { count: 5 })`)

---

## Migration Checklist (Per File)

- [ ] Add `useTranslation` import
- [ ] Add `const { t } = useTranslation('dispatcher')` hook
- [ ] Replace hardcoded Chinese text with `t()` calls
- [ ] Test in Chinese (zh-CN)
- [ ] Test in English (en-US)
- [ ] Check for console warnings about missing keys
- [ ] Verify interpolated values work correctly
- [ ] Remove any commented Chinese text

---

## Automated Migration Helper

A partial migration script is available at:
`./migrate-dispatcher-i18n.sh`

**What it does:**
- Adds imports
- Adds hooks
- Creates backups (.bak files)

**What it doesn't do:**
- Replace Chinese text with `t()` calls (must be done manually)

---

## Progress Summary

- **Completed:** 1/21 files (5%)
- **Partial:** 2/21 files (10%)
- **Remaining:** 18/21 files (85%)

**Estimated time to complete:** 4-6 hours (manual text replacement required for quality)

---

## Notes

1. **Do NOT use `as any`** - Use proper TypeScript types
2. **Preserve existing functionality** - Only change text, not logic
3. **Test thoroughly** - Switching languages should work seamlessly
4. **Consistent keys** - Follow existing key naming patterns
5. **No emojis** - Keep all text in translation files

---

## Next Steps

1. Complete PlanCreateScreen.tsx migration
2. Complete PlanDetailScreen.tsx migration
3. Migrate remaining plan screens (highest priority)
4. Migrate AI screens
5. Migrate personnel screens
6. Migrate profile screens
7. Final testing and QA

---

**Last Updated:** 2026-01-02
**Migrated By:** Claude Opus 4.5
