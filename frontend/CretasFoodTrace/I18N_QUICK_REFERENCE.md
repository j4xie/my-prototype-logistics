# i18n Quick Reference - Management Module

Quick lookup for common translation patterns. Use this as a cheat sheet during migration.

---

## Setup (Required for every file)

```typescript
// 1. Add import at top
import { useTranslation } from 'react-i18next';

// 2. Add hook in component
export default function MyScreen() {
  const { t } = useTranslation('management');
  // ... rest of code
}
```

---

## Common UI Elements

### Page Headers
```typescript
<Appbar.Content title={t('userManagement.title')} />
<Text style={styles.title}>{t('departmentManagement.title')}</Text>
```

### Search
```typescript
<Searchbar
  placeholder={t('userManagement.searchPlaceholder')}
  value={searchQuery}
/>
```

### Buttons
```typescript
<Button>{t('common.save')}</Button>
<Button>{t('common.cancel')}</Button>
<Button>{t('common.create')}</Button>
<Button>{t('common.edit')}</Button>
<Button>{t('common.delete')}</Button>
<Button>{t('common.confirm')}</Button>
```

### Status Text
```typescript
{isActive ? t('common.active') : t('common.inactive')}
{enabled ? t('common.enabled') : t('common.disabled')}
```

### Loading
```typescript
<ActivityIndicator />
<Text>{t('common.loading')}</Text>
```

### Empty States
```typescript
<Text>{t('userManagement.empty.noUsers')}</Text>
<Text>{t('userManagement.empty.hint')}</Text>
```

---

## Forms

### Labels & Placeholders
```typescript
<TextInput
  label={t('userManagement.form.username')}
  placeholder={t('userManagement.form.usernamePlaceholder')}
  value={formData.username}
/>
```

### Common Form Fields
```typescript
// Name
label={t('*.form.name')}
placeholder={t('*.form.namePlaceholder')}

// Code
label={t('*.form.code')}
placeholder={t('*.form.codePlaceholder')}

// Description
label={t('*.form.description')}
placeholder={t('*.form.descriptionPlaceholder')}

// Phone
label={t('*.form.phone')}
placeholder={t('*.form.phonePlaceholder')}

// Email
label={t('*.form.email')}
placeholder={t('*.form.emailPlaceholder')}
```

---

## Alerts & Messages

### Success
```typescript
Alert.alert(t('common.success'), t('userManagement.messages.createSuccess'));
Alert.alert(t('common.success'), t('userManagement.messages.updateSuccess'));
Alert.alert(t('common.success'), t('userManagement.messages.deleteSuccess'));
```

### Error
```typescript
Alert.alert(t('common.error'), t('userManagement.messages.saveFailed'));
Alert.alert(t('common.error'), t('userManagement.messages.loadFailed'));
Alert.alert(t('common.error'), t('userManagement.messages.deleteFailed'));
```

### Validation
```typescript
Alert.alert(t('common.error'), t('userManagement.messages.requiredFields'));
Alert.alert(t('common.error'), t('userManagement.messages.passwordRequired'));
```

### Confirmation
```typescript
Alert.alert(
  t('userManagement.confirmDelete.title'),
  t('userManagement.confirmDelete.message', { name: userName }),
  [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: handleDelete }
  ]
);
```

---

## Stats & Metrics

```typescript
<View style={styles.statsRow}>
  <View style={styles.statItem}>
    <Text style={styles.statValue}>{users.length}</Text>
    <Text style={styles.statLabel}>{t('userManagement.stats.totalUsers')}</Text>
  </View>
  <View style={styles.statItem}>
    <Text style={styles.statValue}>{activeCount}</Text>
    <Text style={styles.statLabel}>{t('userManagement.stats.active')}</Text>
  </View>
</View>
```

---

## Filters & Segments

```typescript
<SegmentedButtons
  value={filterRole}
  onValueChange={setFilterRole}
  buttons={[
    { value: 'all', label: t('userManagement.filter.all') },
    { value: 'operator', label: t('userManagement.filter.operator') },
    { value: 'admin', label: t('userManagement.filter.departmentAdmin') },
  ]}
/>
```

---

## Switch/Case Translations

```typescript
// ❌ WRONG - Hardcoded
const getRoleName = (role: string) => {
  switch (role) {
    case 'operator': return '操作员';
    case 'admin': return '管理员';
    default: return '未知';
  }
};

// ✅ CORRECT - Using t()
const getRoleName = (role: string) => {
  switch (role) {
    case 'operator': return t('userManagement.roles.operator');
    case 'admin': return t('userManagement.roles.departmentAdmin');
    default: return t('userManagement.roles.unknown');
  }
};
```

---

## Interpolation (Dynamic Values)

```typescript
// With variables
t('userManagement.confirmDelete.message', { name: userName })
// Result: "确定要删除用户 \"张三\" 吗？"

t('userManagement.stats.totalUsers', { count: users.length })
// Result: "总用户数: 15"

t('departmentManagement.form.employeeCount', { count: employeeCount })
// Result: "5人"
```

---

## Common Translation Key Patterns

### Pattern: `[screen].[section].[item]`

**Examples**:
- `userManagement.title`
- `userManagement.form.username`
- `userManagement.messages.createSuccess`
- `departmentManagement.stats.total`
- `productTypeManagement.empty.noProducts`

### Shared Keys (use `common.*`)
- `common.save`, `common.cancel`, `common.create`, `common.edit`, `common.delete`
- `common.success`, `common.error`, `common.confirm`
- `common.loading`, `common.active`, `common.inactive`
- `common.enabled`, `common.disabled`

---

## FAB (Floating Action Button)

```typescript
<FAB
  icon="plus"
  style={styles.fab}
  onPress={handleAdd}
  label={t('userManagement.createUser')}
/>
```

---

## Modal Titles

```typescript
<Text style={styles.modalTitle}>
  {editingUser ? t('userManagement.editUser') : t('userManagement.createUser')}
</Text>
```

---

## Permission Messages

```typescript
// No permission screen
<Text>{t('userManagement.noPermission.title')}</Text>
<Text>{t('userManagement.noPermission.hint')}</Text>

// OR use common
<Text>{t('common.noPermission')}</Text>
<Text>{t('common.permissionHint')}</Text>
```

---

## Testing Checklist

After migrating strings, test:
- [ ] Page loads without errors
- [ ] All text visible and correct
- [ ] Forms validate properly
- [ ] Buttons have correct labels
- [ ] Alerts show correct messages
- [ ] No console errors
- [ ] No "missing key" warnings

---

## Common Mistakes to Avoid

1. ❌ `<Text>加载中...</Text>` → ✅ `<Text>{t('common.loading')}</Text>`
2. ❌ `placeholder="搜索"` → ✅ `placeholder={t('*.searchPlaceholder')}`
3. ❌ `title="用户管理"` → ✅ `title={t('userManagement.title')}`
4. ❌ `Alert.alert('成功', '操作成功')` → ✅ `Alert.alert(t('common.success'), t('*.messages.success'))`
5. ❌ Forgetting `{}` in JSX: `<Text>t('key')</Text>` → ✅ `<Text>{t('key')}</Text>`

---

## File-Specific Keys

### UserManagement
- `userManagement.title`, `searchPlaceholder`, `createUser`, `editUser`
- `userManagement.filter.*` (all, operator, departmentAdmin, superAdmin)
- `userManagement.stats.*` (totalUsers, active, inactive)
- `userManagement.form.*` (username, password, realName, phone, email, role, department, position)
- `userManagement.roles.*` (operator, departmentAdmin, permissionAdmin, factorySuperAdmin, viewer, unactivated, unknown)
- `userManagement.departments.*` (processing, logistics, quality, management, unassigned)
- `userManagement.actions.*` (edit, activate, deactivate, delete)
- `userManagement.messages.*` (loadFailed, createSuccess, updateSuccess, deleteSuccess, etc.)
- `userManagement.confirmDelete.*` (title, message)
- `userManagement.empty.*` (noUsers, hint)

### DepartmentManagement
- `departmentManagement.title`, `searchPlaceholder`, `add`, `edit`, `initializeDefaults`
- `departmentManagement.stats.*` (total, enabled, totalEmployees)
- `departmentManagement.form.*` (name, code, description, displayOrder, departmentColor, isActive, manager, employees, employeeCount, parentDepartment)
- `departmentManagement.colors.*` (blue, green, orange, red, purple, cyan, pink, brown)
- `departmentManagement.messages.*` (nameRequired, updateSuccess, createSuccess, deleteSuccess, deleteConfirm, statusUpdated, statusActivated)

### ProductTypeManagement
- `productTypeManagement.title`, `add`, `edit`, `configureSku`
- `productTypeManagement.stats.*` (total, active, configured)
- `productTypeManagement.form.*` (name, code, unit, category, codeAutoGenerate)
- `productTypeManagement.categories.*` (seafood, frozenSeafood, processed, semiFinished)
- `productTypeManagement.sku.*` (full SKU config section)

### MaterialTypeManagement
- `materialTypeManagement.title`, `searchPlaceholder`, `add`, `edit`
- `materialTypeManagement.stats.*` (total, active, categories)
- `materialTypeManagement.form.*` (code, name, category, unit, shelfLife, storageType, notes)
- `materialTypeManagement.categories.*` (seafood, meat, vegetables, fruits, flour, rice, oil, seasoning, other)
- `materialTypeManagement.storageTypes.*` (fresh, frozen, dried, ambient)

### SupplierManagement
- `supplierManagement.title`, `searchPlaceholder`, `create`, `edit`
- `supplierManagement.filter.*` (all, active, inactive)
- `supplierManagement.stats.*` (total, enabled, disabled)
- `supplierManagement.form.*` (code, name, contactPerson, phone, email, address, businessType)

### CustomerManagement
- `customerManagement.title`, `searchPlaceholder`, `create`, `edit`
- `customerManagement.filter.*` (all, active, inactive)
- `customerManagement.stats.*` (total, enabled, disabled)
- `customerManagement.form.*` (code, name, contactPerson, phone, email, address, businessType, customerType, industry)
- `customerManagement.customerTypes.*` (distributor, retailer, direct, other, uncategorized)
- `customerManagement.industries.*` (restaurant, supermarket, ecommerce, foodProcessing, other, uncategorized)

---

## Need Help?

See full guides:
- `MANAGEMENT_I18N_MIGRATION_GUIDE.md` - Detailed instructions
- `MANAGEMENT_I18N_STATUS_REPORT.md` - Progress tracking
- `MANAGEMENT_I18N_COMPLETION_SUMMARY.md` - Complete summary

Translation file:
- `src/i18n/locales/zh-CN/management.json`

---

**Quick Tip**: Search for Chinese characters in your file (`[\u4e00-\u9fa5]+`) to find strings that still need migration.
