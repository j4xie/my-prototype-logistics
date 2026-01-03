# Management Module i18n Migration Summary

## Migration Status

This document tracks the i18n migration of all management module screens.

## Migration Pattern

Each screen follows this pattern:

### 1. Import i18n
```typescript
import { useTranslation } from 'react-i18next';
```

### 2. Initialize hook
```typescript
const { t } = useTranslation('management');
```

### 3. Replace strings with t() calls
```typescript
// Before
<Appbar.Content title="供应商管理" />

// After
<Appbar.Content title={t('supplierManagement.title')} />
```

## Files Migrated

### ✅ Completed
1. **SupplierManagementScreen.tsx** - Partially migrated
   - Added i18n import and hook
   - Migrated common messages (success, error, confirm)
   - Remaining: UI strings in JSX

### ⏳ In Progress
2. **CustomerManagementScreen.tsx**
3. **DepartmentManagementScreen.tsx**
4. **MaterialTypeManagementScreen.tsx**
5. **ProductTypeManagementScreen.tsx**

### ⏸ Pending
6. SupplierAdmissionScreen.tsx
7. FactorySettingsScreen.tsx
8. ConversionRateScreen.tsx
9. WorkTypeManagementScreen.tsx
10. DisposalRecordManagementScreen.tsx
11. ShipmentManagementScreen.tsx
12. WorkSessionManagementScreen.tsx
13. RuleConfigurationScreen.tsx
14. MaterialSpecManagementScreen.tsx
15. WhitelistManagementScreen.tsx
16. MaterialConversionDetailScreen.tsx
17. EntityDataExportScreen.tsx
18. AISettingsScreen.tsx
19. SopConfigScreen.tsx

## Translation Keys Required

Based on zh-CN/management.json, all required keys exist for:
- ✅ supplierManagement
- ✅ customerManagement
- ✅ departmentManagement
- ✅ materialTypeManagement
- ✅ productTypeManagement
- ✅ userManagement
- ✅ common (shared keys)

## Missing Translation Keys

The following screens may need additional translation keys:

1. **SupplierAdmissionScreen** - needs admission-specific keys
2. **FactorySettingsScreen** - needs settings-specific keys
3. **ConversionRateScreen** - needs conversion-specific keys
4. **WorkTypeManagementScreen** - needs workTypes keys
5. **DisposalRecordManagementScreen** - needs disposal keys
6. **ShipmentManagementScreen** - needs shipment keys
7. **WorkSessionManagementScreen** - needs workSession keys
8. **RuleConfigurationScreen** - needs rules keys
9. **MaterialSpecManagementScreen** - needs spec keys
10. **WhitelistManagementScreen** - needs whitelist keys
11. **AISettingsScreen** - needs AI settings keys
12. **SopConfigScreen** - needs SOP keys

## Common String Replacement Patterns

### Alerts
```typescript
// Before → After
Alert.alert('错误', ...) → Alert.alert(t('common.error'), ...)
Alert.alert('成功', ...) → Alert.alert(t('common.success'), ...)
Alert.alert('提示', ...) → Alert.alert(t('common.confirm'), ...)
Alert.alert('确认删除', ...) → Alert.alert(t('common.delete'), ...)
```

### Buttons
```typescript
'编辑' → t('common.edit')
'删除' → t('common.delete')
'保存' → t('common.save')
'创建' → t('common.create')
'更新' → t('common.update')
'取消' → t('common.cancel')
'确定' → t('common.confirm')
'启用' → t('common.activate')
'停用' → t('common.deactivate')
```

### Status Chips
```typescript
'启用中' → t('common.active')
'已停用' → t('common.inactive')
'启用' → t('common.enabled')
'停用' → t('common.disabled')
```

### Search & Filter
```typescript
'搜索...' → t('common.searchPlaceholder')
'全部' → t('filter.all')
'加载中...' → t('common.loading')
```

### Empty States
```typescript
'暂无数据' → t('empty.noData')
'点击右下角"+"按钮添加' → t('empty.hint')
```

### Statistics
```typescript
'总数' → t('common.total')
'启用' → t('common.enabled')
'停用' → t('common.disabled')
```

## Next Steps

1. Complete string replacement for SupplierManagementScreen
2. Migrate CustomerManagementScreen
3. Migrate DepartmentManagementScreen
4. Migrate MaterialTypeManagementScreen
5. Migrate ProductTypeManagementScreen
6. Create additional translation keys for remaining screens
7. Migrate remaining 14 screens
8. Test all screens with both zh-CN and en-US locales

## Notes

- All screens already have the translation files (zh-CN/management.json and en-US/management.json)
- The translation structure is well-organized with nested keys
- Some screens may need new translation keys added to the JSON files
- Testing should be done with language switching to ensure all strings are properly translated
