# Platform Module i18n Migration Status

## Migration Date
2026-01-02

## Overview
Migration of 6 platform module files to use i18n with the `useTranslation('platform')` hook.

---

## ✅ Completed Files

### 1. AIQuotaManagementScreen.tsx
**Status**: ✅ Fully Migrated

**Changes Made**:
- Added `import { useTranslation } from 'react-i18next';`
- Added `const { t } = useTranslation('platform');`
- Migrated all Chinese strings to translation keys:
  - Title, loading states, tab labels
  - Error/success messages (Alert dialogs)
  - Form labels (weeklyQuota, timesPerWeek, etc.)
  - Usage statistics labels
  - Quota suggestion messages
  - Global rule and factory-specific rule labels
  - Day of week labels (Monday-Sunday)
  - Action buttons (save, cancel, delete, etc.)

**Translation Keys Used**:
- `aiQuota.title`, `aiQuota.loading`
- `aiQuota.usageOverview`, `aiQuota.ruleConfig`
- `aiQuota.weeklyQuota`, `aiQuota.timesPerWeek`
- `aiQuota.save`, `aiQuota.cancel`, `aiQuota.delete`
- `aiQuota.quotaSaved`, `aiQuota.saveFailed`
- `aiQuota.highUtilization`, `aiQuota.mediumUtilization`, `aiQuota.lowUtilization`
- `aiQuota.sunday` through `aiQuota.saturday`
- And 35+ more keys

---

## 📋 Remaining Files

### 2. IndustryTemplateEditScreen.tsx (30KB)
**Status**: ⏳ Pending

**Required Keys** (already exist in platform.json):
- `industryTemplate.edit.*`
- All keys under this namespace are already defined

**Estimated Effort**: Medium (60+ Chinese strings to replace)

---

### 3. IndustryTemplateManagementScreen.tsx (23KB)
**Status**: ⏳ Pending

**Required Keys** (already exist in platform.json):
- `industryTemplate.management.*`
- All keys under this namespace are already defined

**Estimated Effort**: Medium (50+ Chinese strings)

---

### 4. FactorySetupScreen.tsx (31KB)
**Status**: ⏳ Pending

**Required Keys** (already exist in platform.json):
- `factorySetup.*`
- All keys under this namespace are already defined

**Estimated Effort**: Large (80+ Chinese strings)

---

### 5. BlueprintManagementScreen.tsx (40KB)
**Status**: ⏳ Pending

**Required Keys** (already exist in platform.json):
- `blueprint.*`
- All keys under this namespace are already defined

**Estimated Effort**: Large (100+ Chinese strings, largest file)

---

### 6. PlatformReportsScreen.tsx (16KB)
**Status**: ⏳ Pending

**Required Keys** (already exist in platform.json):
- `reports.*`
- All keys under this namespace are already defined

**Estimated Effort**: Small (30+ Chinese strings)

---

## Translation Files Status

### ✅ zh-CN/platform.json
**Status**: Complete with all required keys

Structure:
```json
{
  "aiQuota": { ... },      // ✅ Complete
  "blueprint": { ... },    // ✅ Complete
  "factorySetup": { ... }, // ✅ Complete
  "industryTemplate": {    // ✅ Complete
    "edit": { ... },
    "management": { ... }
  },
  "reports": { ... }       // ✅ Complete
}
```

### ✅ en-US/platform.json
**Status**: Complete with all required keys (matching zh-CN structure)

---

## Migration Pattern for Remaining Files

For each file, follow this pattern:

### 1. Add imports
```typescript
import { useTranslation } from 'react-i18next';
```

### 2. Add hook
```typescript
export function ComponentName() {
  const { t } = useTranslation('platform');
  // ... rest of component
}
```

### 3. Replace strings
```typescript
// Before
<Text>创建模板</Text>
<Appbar.Content title="行业模板管理" />
Alert.alert('成功', '模板已创建');

// After
<Text>{t('industryTemplate.management.newTemplate')}</Text>
<Appbar.Content title={t('industryTemplate.management.title')} />
Alert.alert(t('industryTemplate.edit.success'), t('industryTemplate.edit.createSuccess'));
```

---

## Key Naming Convention

All translation keys follow this structure:
```
platform:
  <module>:
    <submodule?>:
      <key>: "value"
```

Examples:
- `aiQuota.title`
- `blueprint.versionHistory`
- `industryTemplate.edit.basicInfo`
- `factorySetup.templateMode`
- `reports.dataOverview`

---

## Completion Checklist

- [x] AIQuotaManagementScreen.tsx
- [ ] IndustryTemplateEditScreen.tsx
- [ ] IndustryTemplateManagementScreen.tsx
- [ ] FactorySetupScreen.tsx
- [ ] BlueprintManagementScreen.tsx
- [ ] PlatformReportsScreen.tsx

**Progress**: 1/6 files completed (17%)

---

## Notes

1. All translation keys are pre-defined in both zh-CN and en-US platform.json files
2. No new translation keys need to be added
3. Each file migration is independent and can be done separately
4. Test each file after migration to ensure all strings display correctly
5. Alert dialogs, form labels, and button text are the priority items to migrate

---

## Next Steps

1. Migrate IndustryTemplateEditScreen.tsx (medium complexity)
2. Migrate IndustryTemplateManagementScreen.tsx (medium complexity)
3. Migrate PlatformReportsScreen.tsx (small complexity)
4. Migrate FactorySetupScreen.tsx (large complexity)
5. Migrate BlueprintManagementScreen.tsx (largest, do last)
6. Test all screens in both Chinese and English
7. Verify all Alert dialogs work correctly
8. Check for any missed strings using grep

---

## Verification Command

After migration, use this to find any remaining Chinese strings:
```bash
grep -n "[\u4e00-\u9fa5]" src/screens/platform/[FileName].tsx
```

Or count remaining Chinese characters:
```bash
grep -o "[\u4e00-\u9fa5]" src/screens/platform/[FileName].tsx | wc -l
```
