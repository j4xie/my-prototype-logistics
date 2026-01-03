# HR Module i18n Migration Summary

## Migration Status: PARTIAL COMPLETE (6/22 files)

### ✅ Completed Files (6)

#### Attendance Module (4 files)
1. ✅ `src/screens/hr/attendance/AttendanceManageScreen.tsx`
2. ✅ `src/screens/hr/attendance/AttendanceStatsScreen.tsx`
3. ✅ `src/screens/hr/attendance/AttendanceAnomalyScreen.tsx`
4. ✅ `src/screens/hr/attendance/MyAttendanceScreen.tsx` (previously completed)

#### Home Module (2 files)
5. ✅ `src/screens/hr/home/HRHomeScreen.tsx`
6. ✅ `src/screens/hr/home/NewHiresScreen.tsx`

### ⏳ Remaining Files (16)

#### Whitelist Module (2 files)
- `src/screens/hr/whitelist/WhitelistAddScreen.tsx`
- `src/screens/hr/whitelist/WhitelistListScreen.tsx`

#### Department Module (3 files)
- `src/screens/hr/department/DepartmentAddScreen.tsx`
- `src/screens/hr/department/DepartmentDetailScreen.tsx`
- `src/screens/hr/department/DepartmentListScreen.tsx`

#### Staff Module (4 files)
- `src/screens/hr/staff/StaffAddScreen.tsx`
- `src/screens/hr/staff/StaffAIAnalysisScreen.tsx`
- `src/screens/hr/staff/StaffDetailScreen.tsx`
- `src/screens/hr/staff/StaffListScreen.tsx`

#### Production Module (2 files)
- `src/screens/hr/production/BatchAssignmentScreen.tsx`
- `src/screens/hr/production/BatchWorkersScreen.tsx`

#### Other Modules (5 files)
- `src/screens/hr/scheduling/WorkScheduleScreen.tsx`
- `src/screens/hr/analytics/LaborCostScreen.tsx`
- `src/screens/hr/analytics/PerformanceScreen.tsx`
- `src/screens/hr/profile/HRProfileScreen.tsx`
- `src/screens/hr/profile/MyInfoScreen.tsx` (previously completed)

#### Legacy Screens (2 files)
- `src/screens/legacy/hr/HRDashboardScreen.tsx`
- `src/screens/legacy/hr/HREmployeeAIScreen.tsx`

---

## Migration Pattern

### Step 1: Add Import
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Add Hook in Component
```typescript
export default function MyScreen() {
  const { t } = useTranslation('hr');
  // ... rest of component
}
```

### Step 3: Replace Chinese Strings

Common replacements:

| Chinese | Translation Key |
|---------|----------------|
| `加载中...` | `t('common.loading')` or `t('home.loading')` |
| `搜索员工...` | `t('staff.search.placeholder')` |
| `未分配部门` | `t('staff.card.noDepartment')` |
| `暂无数据` | `t('common.noData')` |
| `取消` | `t('common.cancel')` |
| `确定` | `t('common.confirm')` |
| `保存` | `t('common.save')` |
| `删除` | `t('common.delete')` |
| `添加` | `t('common.add')` |

---

## Translation Keys Reference

All translation keys are defined in `src/i18n/locales/zh-CN/hr.json`. Key sections:

### Core Sections
- `home.*` - Home screen texts
- `staff.*` - Staff management
- `attendance.*` - Attendance management
- `department.*` - Department management
- `whitelist.*` - Whitelist management
- `production.*` - Production/batch assignment
- `scheduling.*` - Work schedule
- `analytics.*` - Analytics screens
- `profile.*` - Profile screens
- `common.*` - Common buttons and labels
- `messages.*` - Success/error messages

### Example Replacements

**WhitelistAddScreen.tsx:**
```typescript
// Before
<Text style={styles.headerTitle}>添加白名单</Text>

// After
<Text style={styles.headerTitle}>{t('whitelist.add.title')}</Text>
```

**DepartmentAddScreen.tsx:**
```typescript
// Before
Alert.alert('成功', '部门创建成功');

// After
Alert.alert(t('messages.success'), t('department.add.success'));
```

**StaffListScreen.tsx:**
```typescript
// Before
<Searchbar placeholder="搜索员工..." />

// After
<Searchbar placeholder={t('staff.search.placeholder')} />
```

---

## Testing Checklist

After migration, test:
- [ ] All screens render correctly
- [ ] No hardcoded Chinese text remains
- [ ] Error messages display properly
- [ ] Form validation messages work
- [ ] Alert dialogs show correct text
- [ ] Language switching works (if implemented)

---

## Next Steps

1. Complete remaining 16 files using the same pattern
2. Run `npx tsc` to check for TypeScript errors
3. Test all HR screens in the app
4. Verify all Chinese text has been replaced

---

## Migration Script Template

For batch migration, you can use this pattern:

```typescript
// 1. Add import
import { useTranslation } from 'react-i18next';

// 2. Add hook
const { t } = useTranslation('hr');

// 3. Replace strings (examples)
// '添加白名单' → t('whitelist.add.title')
// '部门管理' → t('department.title')
// '员工列表' → t('staff.list.title')
// '考勤统计' → t('attendance.stats.title')
```

---

Generated: 2026-01-02
Status: In Progress (27% complete)
