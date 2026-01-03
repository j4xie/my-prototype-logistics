# Management Module i18n Migration Guide

This document provides instructions for completing the i18n migration for all management module screens.

## Files Already Migrated

1. ✅ `ManagementScreen.tsx` - Fully migrated
2. 🔄 `UserManagementScreen.tsx` - Import added, needs string replacement
3. 🔄 `DepartmentManagementScreen.tsx` - Import added, needs string replacement

## Files Pending Migration

### High Priority (Commonly used)
- ProductTypeManagementScreen.tsx
- MaterialTypeManagementScreen.tsx
- SupplierManagementScreen.tsx
- CustomerManagementScreen.tsx

### Medium Priority
- WorkTypeManagementScreen.tsx
- DepartmentManagementScreen.tsx
- WorkSessionManagementScreen.tsx
- ShipmentManagementScreen.tsx

### Lower Priority
- SupplierAdmissionScreen.tsx
- FactorySettingsScreen.tsx
- ConversionRateScreen.tsx
- RuleConfigurationScreen.tsx
- MaterialSpecManagementScreen.tsx
- DisposalRecordManagementScreen.tsx
- SopConfigScreen.tsx
- WhitelistManagementScreen.tsx
- MaterialConversionDetailScreen.tsx
- EntityDataExportScreen.tsx
- AISettingsScreen.tsx

## Migration Steps for Each File

### Step 1: Add Import
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Add Hook in Component
```typescript
const { t } = useTranslation('management');
```

### Step 3: Replace Chinese Strings

Common patterns based on available translation keys:

#### Page Titles
- `"用户管理"` → `t('userManagement.title')`
- `"部门管理"` → `t('departmentManagement.title')`
- `"产品类型管理"` → `t('productTypeManagement.title')`
- `"原材料类型管理"` → `t('materialTypeManagement.title')`
- `"供应商管理"` → `t('supplierManagement.title')`
- `"客户管理"` → `t('customerManagement.title')`

#### Search Placeholders
- `"搜索用户名、姓名、手机号"` → `t('userManagement.searchPlaceholder')`
- `"搜索部门编码、名称"` → `t('departmentManagement.searchPlaceholder')`
- `"搜索供应商名称、编码、联系人"` → `t('supplierManagement.searchPlaceholder')`
- `"搜索客户名称、编码、联系人"` → `t('customerManagement.searchPlaceholder')`

#### Common Buttons
- `"确定"` → `t('common.confirm')`
- `"取消"` → `t('common.cancel')`
- `"保存"` → `t('common.save')`
- `"创建"` → `t('common.create')`
- `"更新"` → `t('common.update')`
- `"编辑"` → `t('common.edit')`
- `"删除"` → `t('common.delete')`
- `"加载中..."` → `t('common.loading')`

#### Filter Options
- `"全部"` → `t('userManagement.filter.all')`
- `"操作员"` → `t('userManagement.filter.operator')`
- `"部门管理"` → `t('userManagement.filter.departmentAdmin')`
- `"超管"` → `t('userManagement.filter.superAdmin')`

#### Stats Labels
- `"总用户数"` → `t('userManagement.stats.totalUsers')`
- `"激活"` → `t('userManagement.stats.active')`
- `"停用"` → `t('userManagement.stats.inactive')`
- `"总部门数"` → `t('departmentManagement.stats.total')`
- `"启用中"` → `t('departmentManagement.stats.enabled')`
- `"总员工数"` → `t('departmentManagement.stats.totalEmployees')`

#### Empty States
- `"暂无用户"` → `t('userManagement.empty.noUsers')`
- `"点击右下角\"+\"按钮创建用户"` → `t('userManagement.empty.hint')`
- `"暂无部门"` → `t('departmentManagement.empty.noDepartments')`
- `"暂无产品类型"` → `t('productTypeManagement.empty.noProducts')`

#### Messages
- `"加载用户列表失败"` → `t('userManagement.messages.loadFailed')`
- `"用户名、姓名和角色不能为空"` → `t('userManagement.messages.requiredFields')`
- `"创建用户时密码不能为空"` → `t('userManagement.messages.passwordRequired')`
- `"用户信息已更新"` → `t('userManagement.messages.updateSuccess')`
- `"用户创建成功"` → `t('userManagement.messages.createSuccess')`

#### Form Labels (UserManagement example)
- `"用户名"` → `t('userManagement.form.username')`
- `"密码"` → `t('userManagement.form.password')`
- `"真实姓名"` → `t('userManagement.form.realName')`
- `"手机号"` → `t('userManagement.form.phone')`
- `"邮箱"` → `t('userManagement.form.email')`
- `"角色"` → `t('userManagement.form.role')`
- `"部门"` → `t('userManagement.form.department')`
- `"职位"` → `t('userManagement.form.position')`

#### Roles
- `"操作员"` → `t('userManagement.roles.operator')`
- `"部门管理员"` → `t('userManagement.roles.departmentAdmin')`
- `"权限管理员"` → `t('userManagement.roles.permissionAdmin')`
- `"工厂超管"` → `t('userManagement.roles.factorySuperAdmin')`

#### Departments
- `"加工部"` → `t('userManagement.departments.processing')`
- `"物流部"` → `t('userManagement.departments.logistics')`
- `"质检部"` → `t('userManagement.departments.quality')`
- `"管理层"` → `t('userManagement.departments.management')`

#### Permissions
- `"您没有权限访问此页面"` → `t('common.noPermission')`
- `"仅限工厂超管、权限管理员和部门管理员"` → `t('common.permissionHint')`
- `"仅限工厂超管和平台管理员"` → `t('common.permissionHintSuperAdmin')`

## Testing

After migration, test each screen to ensure:
1. All Chinese text is displayed correctly
2. Language switching works (if implemented)
3. No hardcoded Chinese strings remain
4. Form validation messages appear correctly
5. Error messages are properly translated

## Translation Keys Reference

All keys are available in:
- `/src/i18n/locales/zh-CN/management.json` (Chinese)
- `/src/i18n/locales/en-US/management.json` (English - if exists)

## Notes

- Some files may have unique strings not in the translation file
- For missing keys, add them to the translation files first
- Maintain the same nesting structure as existing translations
- Use interpolation for dynamic values: `t('key', { value: dynamicValue })`

Example:
```typescript
t('userManagement.confirmDelete.message', { name: userName })
// Result: 确定要删除用户 "张三" 吗？
```

## Progress Tracking

- [ ] UserManagementScreen.tsx
- [ ] DepartmentManagementScreen.tsx
- [ ] ProductTypeManagementScreen.tsx
- [ ] MaterialTypeManagementScreen.tsx
- [ ] SupplierManagementScreen.tsx
- [ ] CustomerManagementScreen.tsx
- [ ] SupplierAdmissionScreen.tsx
- [ ] FactorySettingsScreen.tsx
- [ ] ConversionRateScreen.tsx
- [ ] ShipmentManagementScreen.tsx
- [ ] WorkSessionManagementScreen.tsx
- [ ] RuleConfigurationScreen.tsx
- [ ] WorkTypeManagementScreen.tsx
- [ ] MaterialSpecManagementScreen.tsx
- [ ] DisposalRecordManagementScreen.tsx
- [ ] SopConfigScreen.tsx
- [ ] WhitelistManagementScreen.tsx
- [ ] MaterialConversionDetailScreen.tsx
- [ ] EntityDataExportScreen.tsx
- [ ] AISettingsScreen.tsx
