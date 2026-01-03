# Workshop Supervisor i18n Migration Summary

## Migration Status

### ✅ Completed Files
1. **home/WSHomeScreen.tsx** - Fully migrated
2. **home/NotificationsScreen.tsx** - Fully migrated
3. **Translation files created**:
   - `/src/i18n/locales/zh-CN/workshop.json`
   - `/src/i18n/locales/en-US/workshop.json`

### 🔄 Partially Migrated
4. **home/TaskGuideScreen.tsx** - Import added, needs string replacement
5. **home/TaskGuideStep2Screen.tsx** - Needs migration
6. **home/TaskGuideStep3Screen.tsx** - Needs migration

### ⏳ Pending Migration (14 files)
- **profile/** (1 file): WSProfileScreen.tsx
- **workers/** (5 files): WSWorkersScreen.tsx, WorkerAssignScreen.tsx, AttendanceHistoryScreen.tsx, ClockInScreen.tsx, WorkerDetailScreen.tsx
- **batches/** (6 files): WSBatchesScreen.tsx, BatchDetailScreen.tsx, BatchStageScreen.tsx, BatchCompleteScreen.tsx, MaterialConsumptionScreen.tsx, BatchStartScreen.tsx
- **equipment/** (3 files): WSEquipmentScreen.tsx, EquipmentAlertScreen.tsx, EquipmentMaintenanceScreen.tsx

---

## Migration Pattern

### Step 1: Add Import
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Initialize Hook
```typescript
const { t } = useTranslation('workshop');
```

### Step 3: Replace Strings
```typescript
// Before
<Text>加载中...</Text>

// After
<Text>{t('common.loading')}</Text>
```

---

## Translation Keys Reference

### Common
- `common.loading` - "加载中..." / "Loading..."
- `common.retry` - "重试" / "Retry"
- `common.cancel` - "取消" / "Cancel"
- `common.confirm` - "确认" / "Confirm"
- `common.save` - "保存" / "Save"
- `common.search` - "搜索" / "Search"
- `common.viewAll` - "查看全部" / "View All"
- `common.noData` - "暂无数据" / "No Data"

### Home Screen
- `home.greeting.*` - Greeting messages (earlyMorning, morning, etc.)
- `home.subtitle` - "今日任务安排已更新"
- `home.nextTask.*` - Next task card labels
- `home.todayOverview` - "今日任务概览"
- `home.stats.*` - assigned, inProgress, completed
- `home.inProgressBatches` - "进行中批次"
- `home.personnelStatus` - "人员状态"
- `home.personnel.*` - onDuty, onLeave, absent
- `home.equipmentStatus` - "设备状态"
- `home.equipment.*` - running, idle, needMaintenance
- `home.batch.*` - output, estimated

### Notifications
- `notifications.title` - "通知"
- `notifications.markAllRead` - "全部已读"
- `notifications.empty` - "暂无通知"
- `notifications.types.*` - task, alert, info, success
- `notifications.time.*` - minutesAgo, hoursAgo, yesterday

### Task Guide
- `taskGuide.title` - "任务执行"
- `taskGuide.steps.*` - step1, step2, step3
- `taskGuide.location.*` - workshop, line, station, equipment
- `taskGuide.viewMap` - "查看车间地图"
- `taskGuide.arrivedConfirm` - "我已到达工位"
- `taskGuide.nextStep` - "下一步：确认设备"
- `taskGuide.targetOutput` - "目标{{quantity}}kg"

### Profile
- `profile.title` - "我的"
- `profile.role` - "车间主任"
- `profile.stats.*` - managedBatches, onDutyPersonnel, runningEquipment
- `profile.sections.*` - accountSettings, systemSettings, helpSupport
- `profile.menu.*` - personalInfo, changePassword, notificationSettings, settings, about, logout

### Workers
- `workers.title` - "人员管理"
- `workers.searchPlaceholder` - "搜索姓名或工号..."
- `workers.filters.*` - all, onDuty, onLeave, temporary
- `workers.stats.*` - onDuty, onLeave, absent, temporary
- `workers.status.*` - onDuty, offDuty, onLeave, absent, unknown
- `workers.tempBadge` - "临时"
- `workers.currentTask` - "当前: {{task}}"
- `workers.hours` - "{{hours}}h"
- `workers.efficiency.*` - gradeA, gradeB, gradeC, gradeD

### Batches
- `batches.title` - "批次管理"
- `batches.searchPlaceholder` - "搜索批次号..."
- `batches.filters.*` - all, inProgress, pending, completed
- `batches.stats.*` - inProgress, pending, completed
- `batches.status.*` - urgent, pending, inProgress, completed
- `batches.fields.*` - product, target, output, completedTime, plannedStart, progress
- `batches.progressInfo` - "{{current}}kg / {{target}}kg"
- `batches.estimated` - "预计 {{time}}"

### Equipment
- `equipment.title` - "设备管理"
- `equipment.status.*` - running, idle, maintenance, fault
- `equipment.alert.*` - title, temperatureAbnormal, pressureAbnormal
- `equipment.maintenance.*` - title, lastMaintenance, nextMaintenance

---

## Remaining Tasks

### Quick Migration Commands

For each remaining file, apply this pattern:

1. **Add import** at top:
```typescript
import { useTranslation } from 'react-i18next';
```

2. **Add hook** in component:
```typescript
const { t } = useTranslation('workshop');
```

3. **Replace strings** using find/replace or manual edit

### Validation Checklist

- [ ] All hardcoded Chinese strings replaced with `t()` calls
- [ ] All translation keys exist in both zh-CN and en-US JSON files
- [ ] Component imports `useTranslation` from 'react-i18next'
- [ ] Component calls `const { t } = useTranslation('workshop')`
- [ ] Dynamic values use interpolation: `t('key', { value: data })`
- [ ] No `as any` type assertions introduced
- [ ] Code follows TypeScript type safety rules

---

## Files Ready for Deployment

**Fully Migrated (2 files)**:
- ✅ home/WSHomeScreen.tsx
- ✅ home/NotificationsScreen.tsx

**Translation Resources**:
- ✅ zh-CN/workshop.json (Complete)
- ✅ en-US/workshop.json (Complete)

Total completion: **11%** (2/19 TSX files)

---

## Next Steps

1. Complete migration of remaining 17 files using the pattern above
2. Test all screens in both Chinese and English
3. Verify no hardcoded strings remain using grep:
   ```bash
   grep -r "[\u4e00-\u9fa5]" src/screens/workshop-supervisor/**/*.tsx
   ```
4. Update navigation titles if needed
5. Test dynamic content (counts, times, etc.) with interpolation

---

## Notes

- All files use the `workshop` namespace
- Translation keys follow camelCase convention
- English translations are professional and accurate
- Dynamic values use `{{placeholder}}` syntax
- Component structure and styling unchanged
