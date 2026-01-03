# CreateBatchScreen.tsx i18n Migration Guide

## Current Status
- ✅ Import statement added
- ✅ Hook initialized: `const { t } = useTranslation('processing');`
- ⏳ Need to replace Chinese strings with t() calls

## String Replacement Checklist

### 1. Alert Messages (Lines 78-112)

```typescript
// Line 78 - BEFORE
if (!materialType.trim() || !materialTypeId) return Alert.alert('验证错误', '请选择原料类型');

// Line 78 - AFTER
if (!materialType.trim() || !materialTypeId)
  return Alert.alert(t('createBatch.validation.error'), t('createBatch.validation.materialTypeRequired'));

// Line 79 - BEFORE
if (!materialQuantity || Number(materialQuantity) <= 0) return Alert.alert('验证错误', '请输入有效的原料数量');

// Line 79 - AFTER
if (!materialQuantity || Number(materialQuantity) <= 0)
  return Alert.alert(t('createBatch.validation.error'), t('createBatch.validation.quantityRequired'));

// Line 80 - BEFORE
if (!materialCost || Number(materialCost) <= 0) return Alert.alert('验证错误', '请输入原料成本');

// Line 80 - AFTER
if (!materialCost || Number(materialCost) <= 0)
  return Alert.alert(t('createBatch.validation.error'), t('createBatch.validation.costRequired'));

// Line 81 - BEFORE
if (!supplierName.trim() || !supplierId) return Alert.alert('验证错误', '请选择供应商');

// Line 81 - AFTER
if (!supplierName.trim() || !supplierId)
  return Alert.alert(t('createBatch.validation.error'), t('createBatch.validation.supplierRequired'));

// Line 82 - BEFORE
if (!supervisorId) return Alert.alert('验证错误', '请选择生产负责人');

// Line 82 - AFTER
if (!supervisorId)
  return Alert.alert(t('createBatch.validation.error'), t('createBatch.validation.supervisorRequired'));

// Line 109 - BEFORE
Alert.alert('成功', '批次信息已更新！', [{ text: '返回', onPress: () => navigation.goBack() }]);

// Line 109 - AFTER
Alert.alert(
  t('common.success'),
  t('createBatch.messages.updateSuccess'),
  [{ text: t('common.back'), onPress: () => navigation.goBack() }]
);

// Line 112 - BEFORE
Alert.alert('成功', `原材料批次 ${batchNumber} 入库成功！`, [
  { text: '返回列表', onPress: () => navigation.goBack() },
]);

// Line 112 - AFTER
Alert.alert(
  t('common.success'),
  t('createBatch.messages.createSuccess', { batchNumber }),
  [{ text: t('createBatch.messages.backToList'), onPress: () => navigation.goBack() }]
);
```

### 2. Appbar Titles (Lines 127-129, 143-145, 154-156)

```typescript
// Line 128 - BEFORE
<Appbar.Content title={isEditMode ? '编辑批次' : '原料入库'} />

// Line 128 - AFTER
<Appbar.Content title={isEditMode ? t('createBatch.editTitle') : t('createBatch.title')} />

// Line 144 - BEFORE
<Appbar.Content title="加载中" />

// Line 144 - AFTER
<Appbar.Content title={t('common.loading')} />

// Line 155 - BEFORE
<Appbar.Content title={isEditMode ? '编辑批次' : '原料入库'} titleStyle={{ fontWeight: '600' }} />

// Line 155 - AFTER
<Appbar.Content
  title={isEditMode ? t('createBatch.editTitle') : t('createBatch.title')}
  titleStyle={{ fontWeight: '600' }}
/>
```

### 3. Text Labels (Lines 131-133, 162, 167, 176, 183, 195, 218, 231)

```typescript
// Line 131 - BEFORE
<Text variant="headlineSmall" style={styles.errorText}>无权操作</Text>

// Line 131 - AFTER
<Text variant="headlineSmall" style={styles.errorText}>{t('createBatch.noPermission')}</Text>

// Line 132 - BEFORE
<Text style={styles.hint}>仅限工厂用户使用</Text>

// Line 132 - AFTER
<Text style={styles.hint}>{t('createBatch.factoryUsersOnly')}</Text>

// Line 133 - BEFORE
<NeoButton onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>返回</NeoButton>

// Line 133 - AFTER
<NeoButton onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
  {t('common.back')}
</NeoButton>

// Line 162 - BEFORE
<Text style={styles.hint}>记录原料入库信息,后续再决定生产什么产品</Text>

// Line 162 - AFTER
<Text style={styles.hint}>{t('createBatch.hint')}</Text>

// Line 167 - BEFORE
<Text variant="titleMedium" style={styles.sectionTitle}>原料信息</Text>

// Line 167 - AFTER
<Text variant="titleMedium" style={styles.sectionTitle}>{t('createBatch.materialInfo')}</Text>

// Line 218 - BEFORE
<Text variant="titleMedium" style={styles.sectionTitle}>负责人信息</Text>

// Line 218 - AFTER
<Text variant="titleMedium" style={styles.sectionTitle}>{t('createBatch.supervisorInfo')}</Text>
```

### 4. Form Fields (Lines 170-240)

```typescript
// Lines 170-178 - BEFORE
<MaterialTypeSelector
  value={materialType}
  onSelect={(name, id) => {
    setMaterialType(name);
    setMaterialTypeId(id || '');
  }}
  label="原料类型"
  placeholder="点击选择原料类型"
/>

// Lines 170-178 - AFTER
<MaterialTypeSelector
  value={materialType}
  onSelect={(name, id) => {
    setMaterialType(name);
    setMaterialTypeId(id || '');
  }}
  label={t('createBatch.materialType')}
  placeholder={t('createBatch.selectMaterialType')}
/>

// Lines 182-191 - BEFORE
<TextInput
  label="原料数量 (kg)"
  placeholder="例如: 1200"
  mode="outlined"
  keyboardType="numeric"
  value={materialQuantity}
  onChangeText={setMaterialQuantity}
  style={styles.input}
  activeOutlineColor={theme.colors.primary}
/>

// Lines 182-191 - AFTER
<TextInput
  label={t('createBatch.materialQuantity')}
  placeholder={t('createBatch.quantityPlaceholder')}
  mode="outlined"
  keyboardType="numeric"
  value={materialQuantity}
  onChangeText={setMaterialQuantity}
  style={styles.input}
  activeOutlineColor={theme.colors.primary}
/>

// Lines 194-203 - BEFORE
<TextInput
  label="原料成本 (元)"
  placeholder="例如: 30000"
  mode="outlined"
  keyboardType="numeric"
  value={materialCost}
  onChangeText={setMaterialCost}
  style={styles.input}
  activeOutlineColor={theme.colors.primary}
/>

// Lines 194-203 - AFTER
<TextInput
  label={t('createBatch.materialCost')}
  placeholder={t('createBatch.costPlaceholder')}
  mode="outlined"
  keyboardType="numeric"
  value={materialCost}
  onChangeText={setMaterialCost}
  style={styles.input}
  activeOutlineColor={theme.colors.primary}
/>

// Lines 207-213 - BEFORE
<SupplierSelector
  value={supplierName}
  onSelect={(id, name) => { setSupplierId(id); setSupplierName(name); }}
  label="供应商"
  placeholder="选择供应商"
/>

// Lines 207-213 - AFTER
<SupplierSelector
  value={supplierName}
  onSelect={(id, name) => { setSupplierId(id); setSupplierName(name); }}
  label={t('createBatch.supplier')}
  placeholder={t('createBatch.selectSupplier')}
/>

// Lines 221-226 - BEFORE
<SupervisorSelector
  value={supervisorName}
  onSelect={(name, id) => { setSupervisorName(name); setSupervisorId(id); }}
  label="生产负责人"
  placeholder="点击选择负责人"
/>

// Lines 221-226 - AFTER
<SupervisorSelector
  value={supervisorName}
  onSelect={(name, id) => { setSupervisorName(name); setSupervisorId(id); }}
  label={t('createBatch.productionSupervisor')}
  placeholder={t('createBatch.selectSupervisor')}
/>

// Lines 229-240 - BEFORE
<TextInput
  label="备注"
  placeholder="选填"
  mode="outlined"
  value={notes}
  onChangeText={setNotes}
  multiline
  numberOfLines={3}
  style={styles.input}
  activeOutlineColor={theme.colors.primary}
/>

// Lines 229-240 - AFTER
<TextInput
  label={t('createBatch.notes')}
  placeholder={t('createBatch.optional')}
  mode="outlined"
  value={notes}
  onChangeText={setNotes}
  multiline
  numberOfLines={3}
  style={styles.input}
  activeOutlineColor={theme.colors.primary}
/>
```

### 5. Buttons (Lines 244-252)

```typescript
// Lines 244-252 - BEFORE
<NeoButton
  variant="primary"
  size="large"
  onPress={handleSubmit}
  loading={loading}
  disabled={loading}
  style={styles.submitButton}
>
  {isEditMode ? '更新批次' : '创建批次'}
</NeoButton>

// Lines 244-252 - AFTER
<NeoButton
  variant="primary"
  size="large"
  onPress={handleSubmit}
  loading={loading}
  disabled={loading}
  style={styles.submitButton}
>
  {isEditMode ? t('createBatch.updateButton') : t('createBatch.createButton')}
</NeoButton>
```

## Translation Keys to Add to processing.json

```json
{
  "createBatch": {
    "title": "原料入库",
    "editTitle": "编辑批次",
    "noPermission": "无权操作",
    "factoryUsersOnly": "仅限工厂用户使用",
    "hint": "记录原料入库信息,后续再决定生产什么产品",
    "materialInfo": "原料信息",
    "materialType": "原料类型",
    "materialQuantity": "原料数量 (kg)",
    "materialCost": "原料成本 (元)",
    "supplier": "供应商",
    "supervisorInfo": "负责人信息",
    "productionSupervisor": "生产负责人",
    "notes": "备注",
    "optional": "选填",
    "selectMaterialType": "点击选择原料类型",
    "quantityPlaceholder": "例如: 1200",
    "costPlaceholder": "例如: 30000",
    "selectSupplier": "选择供应商",
    "selectSupervisor": "点击选择负责人",
    "createButton": "创建批次",
    "updateButton": "更新批次",
    "validation": {
      "error": "验证错误",
      "materialTypeRequired": "请选择原料类型",
      "quantityRequired": "请输入有效的原料数量",
      "costRequired": "请输入原料成本",
      "supplierRequired": "请选择供应商",
      "supervisorRequired": "请选择生产负责人"
    },
    "messages": {
      "createSuccess": "原材料批次 {{batchNumber}} 入库成功!",
      "updateSuccess": "批次信息已更新!",
      "backToList": "返回列表",
      "loadFailed": "加载失败"
    }
  }
}
```

## English Translations for en-US/processing.json

```json
{
  "createBatch": {
    "title": "Material Inbound",
    "editTitle": "Edit Batch",
    "noPermission": "No Permission",
    "factoryUsersOnly": "For factory users only",
    "hint": "Record material inbound information, decide production later",
    "materialInfo": "Material Information",
    "materialType": "Material Type",
    "materialQuantity": "Material Quantity (kg)",
    "materialCost": "Material Cost (CNY)",
    "supplier": "Supplier",
    "supervisorInfo": "Supervisor Information",
    "productionSupervisor": "Production Supervisor",
    "notes": "Notes",
    "optional": "Optional",
    "selectMaterialType": "Select material type",
    "quantityPlaceholder": "e.g.: 1200",
    "costPlaceholder": "e.g.: 30000",
    "selectSupplier": "Select supplier",
    "selectSupervisor": "Select supervisor",
    "createButton": "Create Batch",
    "updateButton": "Update Batch",
    "validation": {
      "error": "Validation Error",
      "materialTypeRequired": "Please select material type",
      "quantityRequired": "Please enter valid material quantity",
      "costRequired": "Please enter material cost",
      "supplierRequired": "Please select supplier",
      "supervisorRequired": "Please select production supervisor"
    },
    "messages": {
      "createSuccess": "Material batch {{batchNumber}} created successfully!",
      "updateSuccess": "Batch information updated!",
      "backToList": "Back to List",
      "loadFailed": "Load Failed"
    }
  }
}
```

## Steps to Complete

1. ✅ Import added
2. ✅ Hook initialized
3. ⏳ Replace strings (use this guide)
4. ⏳ Add zh-CN translations
5. ⏳ Add en-US translations
6. ⏳ Test both languages

## Estimated Time
- Replace strings: 20 minutes
- Add translations: 10 minutes
- Test: 5 minutes
- **Total: ~35 minutes**
