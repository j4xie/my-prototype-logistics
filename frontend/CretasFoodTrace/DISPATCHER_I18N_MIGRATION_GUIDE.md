# Dispatcher Directory i18n Migration Guide

## Overview

This guide provides a systematic approach to migrate all 23 .tsx files in the `screens/dispatcher/` directory to use i18n translations.

## Translation Files Created

✅ **zh-CN**: `/src/i18n/locales/zh-CN/dispatcher.json` (Complete - 440+ translation keys)
✅ **en-US**: `/src/i18n/locales/en-US/dispatcher.json` (Complete - 440+ translation keys)

## Files to Migrate (23 total)

### home/ (2 files)
- [x] DSHomeScreen.tsx (Partially migrated - needs completion)
- [ ] WorkshopStatusScreen.tsx

### ai/ (4 files)
- [ ] AIScheduleScreen.tsx
- [ ] AIScheduleGenerateScreen.tsx
- [ ] AIWorkerOptimizeScreen.tsx
- [ ] AICompletionProbScreen.tsx

### plan/ (11 files)
- [ ] PlanListScreen.tsx
- [ ] PlanCreateScreen.tsx
- [ ] PlanDetailScreen.tsx
- [ ] PlanGanttScreen.tsx
- [ ] ApprovalListScreen.tsx
- [ ] BatchWorkersScreen.tsx
- [ ] MixedBatchScreen.tsx
- [ ] ResourceOverviewScreen.tsx
- [ ] TaskAssignmentScreen.tsx
- [ ] UrgentInsertScreen.tsx

### personnel/ (5 files)
- [ ] PersonnelListScreen.tsx
- [ ] PersonnelDetailScreen.tsx
- [ ] PersonnelAttendanceScreen.tsx
- [ ] PersonnelScheduleScreen.tsx
- [ ] PersonnelTransferScreen.tsx

### profile/ (2 files)
- [ ] DSProfileScreen.tsx
- [ ] DSStatisticsScreen.tsx

## Migration Pattern

### Step 1: Add imports

```typescript
// Add at the top of the file
import { useTranslation } from 'react-i18next';
```

### Step 2: Add hook in component

```typescript
export default function YourScreen() {
  const { t } = useTranslation('dispatcher');
  // ... rest of component
}
```

### Step 3: Replace hardcoded Chinese text

#### Example 1: Simple Text Replacement

**Before:**
```typescript
<Text style={styles.title}>调度工作台</Text>
```

**After:**
```typescript
<Text style={styles.title}>{t('home.title')}</Text>
```

#### Example 2: Text with Variables

**Before:**
```typescript
<Text>检测到 {count} 个批次完成概率低于70%</Text>
```

**After:**
```typescript
<Text>{t('home.aiRisk.description', { count })}</Text>
```

#### Example 3: Alert Messages

**Before:**
```typescript
Alert.alert('成功', '生产计划创建成功');
```

**After:**
```typescript
Alert.alert(t('planCreate.submit.success'), t('planCreate.submit.successMessage'));
```

#### Example 4: Conditional Text

**Before:**
```typescript
<Text>{priority === 10 ? '最高' : priority === 8 ? '高' : priority === 5 ? '中' : '低'}</Text>
```

**After:**
```typescript
<Text>
  {priority === 10 ? t('planCreate.priority.highest') :
   priority === 8 ? t('planCreate.priority.high') :
   priority === 5 ? t('planCreate.priority.medium') :
   t('planCreate.priority.low')}
</Text>
```

#### Example 5: Array of Options

**Before:**
```typescript
const filters = [
  { key: 'all', label: '全部' },
  { key: 'slicing', label: '切片' },
  { key: 'packaging', label: '包装' },
];
```

**After:**
```typescript
const filters = [
  { key: 'all', label: t('planList.filters.all') },
  { key: 'slicing', label: t('home.workshops.slicing') },
  { key: 'packaging', label: t('home.workshops.packaging') },
];
```

#### Example 6: Error Messages

**Before:**
```typescript
catch (error) {
  console.error('加载调度首页数据失败:', error);
  Alert.alert('错误', '加载失败，请检查网络');
}
```

**After:**
```typescript
catch (error) {
  console.error(t('messages.loadFailed'), error);
  Alert.alert(t('common.error'), t('common.networkError'));
}
```

## Translation Key Naming Convention

### Structure
```
{section}.{subsection}.{key}
```

### Examples

| Chinese Text | Translation Key | Section |
|--------------|----------------|---------|
| 调度工作台 | `home.title` | Home |
| AI 智能调度中心 | `home.aiCenter.title` | Home - AI Center |
| 待排产批次 | `ai.schedule.batches.title` | AI - Schedule - Batches |
| 新建生产计划 | `planCreate.title` | Plan Create |
| 人员管理 | `personnel.list.title` | Personnel |
| 加载中... | `common.loading` | Common |

## Key Translation Sections in dispatcher.json

### 1. home
- `home.title`, `home.role`, `home.aiCenter.*`
- `home.aiRisk.*`, `home.pendingTasks.*`
- `home.workshop.*`, `home.personnel.*`
- `home.approval.*`, `home.workshops.*`
- `home.status.*`, `home.taskStatus.*`
- `home.sections.*`, `home.equipment.*`

### 2. planList
- `planList.title`, `planList.create`
- `planList.filters.*` (14 filter options)
- `planList.search.*`, `planList.quickEntry.*`
- `planList.section.*`, `planList.card.*`
- `planList.status.*`, `planList.crLevel.*`
- `planList.tags.*`, `planList.approval.*` (14 approval-related keys)

### 3. planCreate
- `planCreate.title`
- `planCreate.source.*` (includes descriptions for 5 source types)
- `planCreate.planType.*`, `planCreate.product.*`
- `planCreate.quantity.*`, `planCreate.priority.*` (4 levels)
- `planCreate.date.*` (includes CR levels)
- `planCreate.mixedBatch.*`, `planCreate.customerOrder.*`
- `planCreate.notes.*`, `planCreate.submit.*`
- `planCreate.validation.*` (4 validation messages)

### 4. ai.schedule
- `ai.schedule.title`, `ai.schedule.subtitle`
- `ai.schedule.mode.*` (batch/plan)
- `ai.schedule.dateRange.*`, `ai.schedule.config.*` (includes shift types and hours)
- `ai.schedule.batches.*` (11 keys)
- `ai.schedule.plans.*` (9 keys)
- `ai.schedule.start.*`, `ai.schedule.analyzing.*`
- `ai.schedule.result.*` (includes completionProb, lineAssignment, workerOptimization, actions)
- `ai.schedule.success.*`, `ai.schedule.error.*`

### 5. ai.completionProb
- `ai.completionProb.title`, `ai.completionProb.description`

### 6. ai.workerOptimize
- `ai.workerOptimize.title`, `ai.workerOptimize.description`

### 7. personnel
- `personnel.list.title`, `personnel.detail.title`
- `personnel.attendance.title`, `personnel.schedule.title`
- `personnel.transfer.title`

### 8. profile
- `profile.title`, `profile.statistics.title`

### 9. messages
- `messages.loadFailed`, `messages.loadPlansFailed`
- `messages.usingDefaultThreshold`, `messages.refreshing`

### 10. common
18 common keys for reusable UI text:
- `common.confirm`, `common.cancel`, `common.save`, `common.delete`
- `common.edit`, `common.back`, `common.loading`, `common.submitting`
- `common.success`, `common.failed`, `common.error`, `common.warning`
- `common.info`, `common.retry`, `common.refresh`, `common.search`
- `common.filter`, `common.all`, `common.more`, `common.viewAll`
- `common.viewDetail`, `common.selectAll`, `common.deselectAll`
- `common.noData`, `common.networkError`

## Migration Checklist for Each File

For each .tsx file:

1. [ ] Add `import { useTranslation } from 'react-i18next';`
2. [ ] Add `const { t } = useTranslation('dispatcher');` in component
3. [ ] Replace all hardcoded Chinese text with `t()` calls
4. [ ] Test the file to ensure all text displays correctly
5. [ ] Verify both zh-CN and en-US work by changing language
6. [ ] Check for any missing translation keys and add them to dispatcher.json

## Priority Order for Migration

### High Priority (Core Screens - Complete these first)
1. DSHomeScreen.tsx (Partially done - finish it)
2. AIScheduleScreen.tsx (Most complex AI screen)
3. PlanListScreen.tsx (Main plan list)
4. PlanCreateScreen.tsx (Plan creation)

### Medium Priority (Feature Screens)
5. WorkshopStatusScreen.tsx
6. AIWorkerOptimizeScreen.tsx
7. AICompletionProbScreen.tsx
8. PlanDetailScreen.tsx
9. ApprovalListScreen.tsx
10. UrgentInsertScreen.tsx

### Low Priority (Remaining Screens)
11-23. All other screens

## Testing

After migration:

1. **Visual Test**: Run the app and navigate to each screen
2. **Language Switch Test**: Toggle between zh-CN and en-US
3. **Variable Test**: Ensure dynamic content (counts, names, dates) display correctly
4. **Error Test**: Trigger error messages to verify they're translated

## Common Pitfalls to Avoid

1. ❌ Don't forget to import `useTranslation`
2. ❌ Don't use `as any` to bypass TypeScript errors - fix the type properly
3. ❌ Don't hardcode any Chinese text - all must use `t()`
4. ❌ Don't use string concatenation - use interpolation: `t('key', { variable })`
5. ❌ Don't forget to handle plural forms if needed
6. ❌ Don't mix translation keys with hardcoded text

## Example: Complete File Migration

See `DSHomeScreen.tsx` (partially migrated) for reference:

**Key changes made:**
1. Added import: `import { useTranslation } from 'react-i18next';`
2. Added hook: `const { t } = useTranslation('dispatcher');`
3. Next steps: Replace all Chinese text with t() calls

## Statistics

- **Total translation keys**: 440+
- **Total files to migrate**: 23
- **Estimated time per file**: 15-30 minutes
- **Total estimated time**: 6-12 hours

## Support

If you encounter missing translation keys:

1. Add them to both `zh-CN/dispatcher.json` and `en-US/dispatcher.json`
2. Follow the naming convention: `{section}.{subsection}.{key}`
3. Keep keys consistent between zh-CN and en-US (only values differ)

## Completion Report Format

After completing migration, update this document with:

```markdown
## Migration Status: COMPLETED

- Files migrated: 23/23 (100%)
- Translation keys used: 440+
- Test status: ✅ All tests passed
- Language toggle: ✅ Working correctly
```

---

**Last Updated**: 2026-01-01
**Created By**: Claude Code Assistant
**Status**: Translation files complete, migration in progress (1/23 files started)
