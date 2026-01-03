# Warehouse Module i18n Migration Guide

## Overview

This guide provides instructions for migrating the remaining warehouse module files to use i18n translations. The `WHHomeScreen.tsx` file has been completed as a reference example.

## Status

- **Completed**: 1/33 files
  - ✅ `src/screens/warehouse/home/WHHomeScreen.tsx`

- **Pending**: 32/33 files (see list below)

## Migration Pattern

### Step 1: Add i18n Import

Add the import statement after other imports:

```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Add useTranslation Hook

Add the hook at the beginning of the component function:

```typescript
export default function ComponentName() {
  const { t } = useTranslation('warehouse');
  // ... rest of component
}
```

### Step 3: Replace Chinese Strings with Translation Keys

Use the translation keys from `src/i18n/locales/zh-CN/warehouse.json`.

## Common Translation Patterns

### 1. Simple Text Replacement

**Before:**
```typescript
<Text>库存管理</Text>
```

**After:**
```typescript
<Text>{t('inventory.title')}</Text>
```

### 2. Interpolated Text

**Before:**
```typescript
<Text>在库 {stats.total} 种 | 总量 {stats.totalWeight} kg</Text>
```

**After:**
```typescript
<Text>{t('inventory.headerSubtitle', { total: stats.total, weight: stats.totalWeight })}</Text>
```

### 3. Conditional Text

**Before:**
```typescript
{task.status === 'arrived' ? '完成入库' : '确认入库'}
```

**After:**
```typescript
{task.status === 'arrived' ? t('home.inboundTask.finishInbound') : t('home.inboundTask.confirmInbound')}
```

### 4. String Constants in Data Mapping

**Before:**
```typescript
supplier: b.supplierName || '未知供应商',
```

**After:**
```typescript
supplier: b.supplierName || t('messages.unknownSupplier'),
```

### 5. Status Labels

**Before:**
```typescript
switch (status) {
  case 'waiting':
    label = '待打包';
    break;
  case 'packing':
    label = '打包中';
    break;
}
```

**After:**
```typescript
switch (status) {
  case 'waiting':
    label = t('home.status.waiting');
    break;
  case 'packing':
    label = t('home.status.packing');
    break;
}
```

## Translation Key Reference

### Home Module (`home.*`)
- `home.title` - "仓储工作台"
- `home.headerSubtitle` - "今日入库 {{inbound}} 单 | 待出货 {{pending}} 单"
- `home.tabs.outbound` - "出货任务"
- `home.tabs.inbound` - "入库任务"
- `home.stats.todayInbound` - "今日入库"
- `home.stats.todayOutbound` - "今日出库"
- `home.stats.pendingOutbound` - "待出货"
- `home.stats.alertCount` - "库存预警"
- `home.outboundTask.customer` - "客户"
- `home.outboundTask.product` - "产品"
- `home.outboundTask.quantity` - "数量"
- `home.inboundTask.supplier` - "供应商"
- `home.inboundTask.goods` - "货品"
- `home.status.waiting` - "待打包"
- `home.status.pending` - "待入库"
- `home.status.completed` - "已入库"

### Inventory Module (`inventory.*`)
- `inventory.title` - "库存管理"
- `inventory.headerSubtitle` - "在库 {{total}} 种 | 总量 {{weight}} kg"
- `inventory.loading` - "加载中..."
- `inventory.quickActions.check` - "盘点"
- `inventory.quickActions.transfer` - "调拨"
- `inventory.search.placeholder` - "搜索物料名称/批次号"
- `inventory.filter.all` - "全部"
- `inventory.filter.fresh` - "鲜品"
- `inventory.filter.frozen` - "冻品"

### Inbound Module (`inbound.*`)
- `inbound.title` - "入库管理"
- `inbound.create.title` - "新建入库"
- `inbound.create.materialName` - "物料名称"
- `inbound.create.supplier` - "供应商"
- `inbound.create.quantity` - "数量(kg)"
- `inbound.create.submit` - "提交入库"
- `inbound.detail.title` - "入库详情"
- `inbound.inspect.title` - "质检作业"

### Batch Module (`batch.*`)
- `batch.detail.title` - "批次详情"
- `batch.detail.batchNumber` - "批次号"
- `batch.detail.currentQty` - "当前数量"

### Common Messages (`messages.*`)
- `messages.unknownCustomer` - "未知客户"
- `messages.unknownSupplier` - "未知供应商"
- `messages.unknownMaterial` - "未知材料"
- `messages.defaultLocation` - "默认库位"
- `messages.toBeArranged` - "待安排"
- `messages.loadFailed` - "加载仓储首页数据失败"

## Files Pending Migration

### Shared Module (6 files)
- `src/screens/warehouse/shared/WHConversionAnalysisScreen.tsx`
- `src/screens/warehouse/shared/WHAlertHandleScreen.tsx`
- `src/screens/warehouse/shared/WHAlertListScreen.tsx`
- `src/screens/warehouse/shared/WHScanOperationScreen.tsx`
- `src/screens/warehouse/shared/WHRecallManageScreen.tsx`
- `src/screens/warehouse/shared/WHBatchTraceScreen.tsx`

### Profile Module (4 files)
- `src/screens/warehouse/profile/WHSettingsScreen.tsx`
- `src/screens/warehouse/profile/WHProfileScreen.tsx`
- `src/screens/warehouse/profile/WHOperationLogScreen.tsx`
- `src/screens/warehouse/profile/WHProfileEditScreen.tsx`

### Inventory Module (9 files)
- `src/screens/warehouse/inventory/WHTempMonitorScreen.tsx`
- `src/screens/warehouse/inventory/WHLocationManageScreen.tsx`
- `src/screens/warehouse/inventory/WHInventoryTransferScreen.tsx`
- `src/screens/warehouse/inventory/WHInventoryDetailScreen.tsx`
- `src/screens/warehouse/inventory/WHInventoryListScreen.tsx`
- `src/screens/warehouse/inventory/WHIOStatisticsScreen.tsx`
- `src/screens/warehouse/inventory/WHExpireHandleScreen.tsx`
- `src/screens/warehouse/inventory/WHInventoryCheckScreen.tsx`
- `src/screens/warehouse/inventory/WHBatchDetailScreen.tsx`

### Inbound Module (4 files)
- `src/screens/warehouse/inbound/WHInboundDetailScreen.tsx`
- `src/screens/warehouse/inbound/WHInboundListScreen.tsx`
- `src/screens/warehouse/inbound/WHPutawayScreen.tsx`
- `src/screens/warehouse/inbound/WHInspectScreen.tsx`

### Outbound Module (7 files)
- `src/screens/warehouse/outbound/WHShippingConfirmScreen.tsx`
- `src/screens/warehouse/outbound/WHOrderDetailScreen.tsx`
- `src/screens/warehouse/outbound/WHTrackingDetailScreen.tsx`
- `src/screens/warehouse/outbound/WHLoadingScreen.tsx`
- `src/screens/warehouse/outbound/WHOutboundListScreen.tsx`
- `src/screens/warehouse/outbound/WHPackingScreen.tsx`
- `src/screens/warehouse/outbound/WHOutboundDetailScreen.tsx`

### Legacy Module (2 files)
- `src/screens/legacy/warehouse/InventoryStatisticsScreen.tsx`
- `src/screens/legacy/warehouse/InventoryCheckScreen.tsx`

## Migration Checklist

For each file, follow this checklist:

- [ ] Add `import { useTranslation } from 'react-i18next';`
- [ ] Add `const { t } = useTranslation('warehouse');` in component
- [ ] Replace page title/header text
- [ ] Replace button labels
- [ ] Replace form labels
- [ ] Replace status text
- [ ] Replace error/success messages
- [ ] Replace placeholder text
- [ ] Replace tab/segment labels
- [ ] Replace data mapping constants (e.g., '未知客户')
- [ ] Test the page to ensure all text displays correctly

## Tips

1. **Search for Chinese characters**: Use regex `[\u4e00-\u9fa5]+` to find all Chinese text in a file
2. **Preserve spacing**: Be careful with spaces around curly braces in JSX
3. **Test incrementally**: Test after each major section is migrated
4. **Check interpolation**: Ensure variable names in `t()` match the JSON keys
5. **Keep code comments**: Only migrate user-facing text, not code comments

## Example: Complete Migration of a Simple Component

**Before:**
```typescript
export default function WHAlertListScreen() {
  return (
    <View>
      <Text>库存预警</Text>
      <Text>全部</Text>
      <Text>低库存</Text>
      <Text>即将过期</Text>
    </View>
  );
}
```

**After:**
```typescript
import { useTranslation } from 'react-i18next';

export default function WHAlertListScreen() {
  const { t } = useTranslation('warehouse');

  return (
    <View>
      <Text>{t('home.alerts.title')}</Text>
      <Text>{t('inventory.filter.all')}</Text>
      <Text>{t('inventory.warning.lowStock')}</Text>
      <Text>{t('home.alerts.expiring')}</Text>
    </View>
  );
}
```

## Validation

After migration, verify:

1. **No Chinese text remains**: Search the file for `[\u4e00-\u9fa5]+`
2. **All keys exist**: Check that every `t('key')` has a corresponding entry in `warehouse.json`
3. **UI displays correctly**: Run the app and navigate to the screen
4. **Interpolations work**: Verify dynamic text renders with correct values
5. **No runtime errors**: Check console for missing translation warnings

## Notes

- Only migrate user-facing text
- Do NOT translate:
  - Code comments
  - Logger messages
  - Variable names
  - API endpoints
  - Developer console messages
- Use existing translation keys from `warehouse.json`
- Do NOT create new translation keys without approval

## Reference Files

- **Completed example**: `src/screens/warehouse/home/WHHomeScreen.tsx`
- **Translation file**: `src/i18n/locales/zh-CN/warehouse.json`
- **English translations**: `src/i18n/locales/en-US/warehouse.json` (auto-generated)
