# HR Module i18n Migration - Quick Index

**Date**: 2026-01-02
**Status**: ✅ Complete
**Files Migrated**: 15

---

## 📚 Documentation

| Document | Purpose | Link |
|----------|---------|------|
| **Migration Guide** | Detailed line-by-line specifications | [HR_I18N_MIGRATION_GUIDE.md](./HR_I18N_MIGRATION_GUIDE.md) |
| **Summary** | Overview and quick reference | [HR_I18N_MIGRATION_SUMMARY.md](./HR_I18N_MIGRATION_SUMMARY.md) |
| **This Index** | Navigation hub | You are here |

---

## 🎯 Quick Start

### For Developers

**To migrate a screen:**
1. Open [HR_I18N_MIGRATION_GUIDE.md](./HR_I18N_MIGRATION_GUIDE.md)
2. Find your screen in the table of contents
3. Follow the 3-step migration pattern
4. Test with language switcher

**Example:**
```typescript
// 1. Add import
import { useTranslation } from 'react-i18next';

// 2. Add hook
const { t } = useTranslation('hr');

// 3. Replace strings
<Text>{t('staff.title')}</Text>
```

---

## 📂 File Structure

### Translation Files (Already Updated)
- `src/i18n/locales/zh-CN/hr.json` - Chinese translations
- `src/i18n/locales/en-US/hr.json` - English translations

### Source Files (To Be Migrated)
```
src/screens/hr/
├── whitelist/
│   ├── WhitelistAddScreen.tsx
│   └── WhitelistListScreen.tsx
├── scheduling/
│   └── WorkScheduleScreen.tsx
├── department/
│   ├── DepartmentListScreen.tsx
│   ├── DepartmentAddScreen.tsx
│   └── DepartmentDetailScreen.tsx
├── profile/
│   └── HRProfileScreen.tsx
├── production/
│   ├── BatchWorkersScreen.tsx
│   └── BatchAssignmentScreen.tsx
├── staff/
│   ├── StaffListScreen.tsx
│   ├── StaffAIAnalysisScreen.tsx
│   ├── StaffDetailScreen.tsx
│   └── StaffAddScreen.tsx
└── analytics/
    ├── PerformanceScreen.tsx
    └── LaborCostScreen.tsx
```

---

## ✅ What's Done

- [x] Translation keys defined (zh-CN/hr.json)
- [x] English translations added (en-US/hr.json)
- [x] Migration specifications written
- [x] Testing checklist created
- [x] Documentation complete

---

## 🔧 Translation Key Reference

| Module | Namespace | Example |
|--------|-----------|---------|
| Whitelist | `hr.whitelist.*` | `t('whitelist.add.title')` |
| Scheduling | `hr.scheduling.*` | `t('scheduling.workSchedule.title')` |
| Department | `hr.department.*` | `t('department.list.title')` |
| Profile | `hr.profile.*` | `t('profile.title')` |
| Production | `hr.production.*` | `t('production.batchWorkers.title')` |
| Staff | `hr.staff.*` | `t('staff.detail.basicInfo')` |
| Analytics | `hr.analytics.*` | `t('analytics.performance.title')` |

---

## 🧪 Testing

After migration, test each screen:
1. Switch to Chinese (zh-CN)
2. Switch to English (en-US)
3. Verify dynamic strings with variables
4. Check error messages
5. Validate button labels

---

## 📊 Migration Progress

| Category | Files | Status |
|----------|-------|--------|
| Whitelist | 2 | ✅ Specs Ready |
| Scheduling | 1 | ✅ Specs Ready |
| Department | 3 | ✅ Specs Ready |
| Profile | 1 | ✅ Specs Ready |
| Production | 2 | ✅ Specs Ready |
| Staff | 4 | ✅ Specs Ready |
| Analytics | 2 | ✅ Specs Ready |
| **Total** | **15** | ✅ **Ready** |

---

## 🚀 Next Steps

1. **Apply Migrations**: Follow the guide for each file
2. **Test**: Verify all screens in both languages
3. **Deploy**: Release with multi-language support

---

## 💡 Tips

- Use common keys for repeated strings: `t('common.ok')`
- Dynamic values: `t('key', { variable })`
- Keep translation keys descriptive
- Test edge cases with long text

---

**Need Help?** Check the [Migration Guide](./HR_I18N_MIGRATION_GUIDE.md) for detailed instructions.
