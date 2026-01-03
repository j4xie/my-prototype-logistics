# Warehouse i18n Migration - Quick Start Guide

## 🚀 Start Here

This is a 5-minute quick start to begin the warehouse module i18n migration.

## Step 1: Merge Translation Files (5 minutes)

### Chinese Translations

1. Open file: `warehouse-translations-complete-zh-CN.json`
2. Copy the entire `"shared"` object
3. Open: `src/i18n/locales/zh-CN/warehouse.json`
4. Paste the `"shared"` object after the existing content (before the closing `}`)

**Result should look like:**
```json
{
  "home": { ... existing ... },
  "inventory": { ... existing ... },
  "inbound": { ... existing ... },
  "outbound": { ... existing ... },
  "batch": { ... existing ... },
  "messages": { ... existing ... },
  "profile": { ... existing ... },
  "settings": { ... existing ... },
  "operationLog": { ... existing ... },
  "profileEdit": { ... existing ... },
  "tempMonitor": { ... existing ... },
  "locationManage": { ... existing ... },
  "inventoryTransfer": { ... existing ... },
  "inventoryCheck": { ... existing ... },
  "expireHandle": { ... existing ... },
  "ioStatistics": { ... existing ... },
  "inventoryDetail": { ... existing ... },
  "batchDetail": { ... existing ... },
  "orderDetail": { ... existing ... },
  "conversion": { ... existing ... },
  "shared": {
    "conversion": { ... NEW ... },
    "alertHandle": { ... NEW ... },
    "alertList": { ... NEW ... },
    "scanOperation": { ... NEW ... },
    "recall": { ... NEW ... },
    "batchTrace": { ... NEW ... }
  }
}
```

### English Translations

Repeat the same for English:
1. Open file: `warehouse-translations-complete-en-US.json`
2. Copy the entire `"shared"` object
3. Open: `src/i18n/locales/en-US/warehouse.json`
4. Paste the `"shared"` object after the existing content

## Step 2: Migrate Your First Screen (15 minutes)

Let's migrate `WHScanOperationScreen.tsx` as a simple example:

### 2.1 Add Import

Add at the top of the file:
```typescript
import { useTranslation } from 'react-i18next';
```

### 2.2 Add Hook

Add inside the component function:
```typescript
export function WHScanOperationScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { t } = useTranslation('warehouse'); // ← ADD THIS LINE

  // ... rest of code
}
```

### 2.3 Replace Strings

Find and replace these strings:

**Before:**
```typescript
const modeConfig = {
  inbound: {
    title: "扫码入库",
    icon: "package-down",
    color: "#4CAF50",
    action: "入库",
  },
  outbound: {
    title: "扫码出库",
    icon: "package-up",
    color: "#2196F3",
    action: "出库",
  },
};
```

**After:**
```typescript
const modeConfig = {
  inbound: {
    title: t('shared.scanOperation.inbound.title'),
    icon: "package-down",
    color: "#4CAF50",
    action: t('shared.scanOperation.inbound.action'),
  },
  outbound: {
    title: t('shared.scanOperation.outbound.title'),
    icon: "package-up",
    color: "#2196F3",
    action: t('shared.scanOperation.outbound.action'),
  },
};
```

**Before:**
```typescript
<Text style={styles.scanHint}>
  {isScanning ? "扫码中..." : "将二维码/条码放入框内"}
</Text>
```

**After:**
```typescript
<Text style={styles.scanHint}>
  {isScanning ? t('shared.scanOperation.scanning') : t('shared.scanOperation.scanHint')}
</Text>
```

Continue replacing all Chinese strings in the file.

## Step 3: Test (5 minutes)

1. Run your app: `npm start`
2. Navigate to the scan operation screen
3. Verify Chinese strings display correctly
4. Switch language to English (if you have a language switcher)
5. Verify English strings display correctly

## Common Replacements

Here are the most common string replacements you'll make:

| Chinese | Translation Key |
|---------|----------------|
| "扫码入库" | `t('shared.scanOperation.inbound.title')` |
| "扫码出库" | `t('shared.scanOperation.outbound.title')` |
| "扫码中..." | `t('shared.scanOperation.scanning')` |
| "已扫描" | `t('shared.scanOperation.scanned')` |
| "最近扫描" | `t('shared.scanOperation.lastScan')` |
| "点击扫码" | `t('shared.scanOperation.clickToScan')` |
| "手动输入" | `t('shared.scanOperation.manualInput')` |
| "扫码成功" | `t('shared.scanOperation.scanSuccess')` |
| "取消" | `t('shared.scanOperation.inputCancel')` |
| "确定" | `t('shared.scanOperation.inputConfirm')` |

## Next Screens to Migrate

After completing WHScanOperationScreen, migrate these in order:

1. ✅ WHScanOperationScreen.tsx (you just did this!)
2. → WHBatchTraceScreen.tsx (similar complexity)
3. → WHAlertHandleScreen.tsx (more complex)
4. → WHAlertListScreen.tsx (more complex)
5. → WHRecallManageScreen.tsx (most complex)
6. → WHConversionAnalysisScreen.tsx (most complex)

## Need Help?

- **Detailed instructions:** See `WAREHOUSE_I18N_MIGRATION_INSTRUCTIONS.md`
- **Full report:** See `WAREHOUSE_I18N_FINAL_REPORT.md`
- **Overview:** See `WAREHOUSE_I18N_MIGRATION_SUMMARY.md`

## Quick Tips

1. **Don't skip the import**: Always add `import { useTranslation } from 'react-i18next';`
2. **Don't skip the hook**: Always add `const { t } = useTranslation('warehouse');`
3. **Check your keys**: Make sure the translation key exists in the JSON file
4. **Test as you go**: Test each screen after migration
5. **Use search**: Use Cmd+F (Mac) or Ctrl+F (Windows) to find all Chinese strings

## Estimated Time

- **Per screen (simple):** 15-20 minutes
- **Per screen (complex):** 30-45 minutes
- **Total for 27 screens:** 10-13 hours

## Status Tracking

Mark screens as done:
- [ ] WHScanOperationScreen.tsx
- [ ] WHBatchTraceScreen.tsx
- [ ] WHAlertHandleScreen.tsx
- [ ] WHAlertListScreen.tsx
- [ ] WHRecallManageScreen.tsx
- [ ] WHConversionAnalysisScreen.tsx
- [ ] WHSettingsScreen.tsx
- [ ] WHOperationLogScreen.tsx
- [ ] WHProfileEditScreen.tsx
- [ ] WHTempMonitorScreen.tsx
- [ ] WHLocationManageScreen.tsx
- [ ] WHInventoryTransferScreen.tsx
- [ ] WHInventoryDetailScreen.tsx
- [ ] WHIOStatisticsScreen.tsx
- [ ] WHExpireHandleScreen.tsx
- [ ] WHInventoryCheckScreen.tsx
- [ ] WHBatchDetailScreen.tsx
- [ ] WHInboundDetailScreen.tsx
- [ ] WHInboundListScreen.tsx
- [ ] WHPutawayScreen.tsx
- [ ] WHInspectScreen.tsx
- [ ] WHShippingConfirmScreen.tsx
- [ ] WHOrderDetailScreen.tsx
- [ ] WHTrackingDetailScreen.tsx
- [ ] WHLoadingScreen.tsx
- [ ] WHPackingScreen.tsx
- [ ] WHOutboundDetailScreen.tsx

**Good luck! 🎉**
