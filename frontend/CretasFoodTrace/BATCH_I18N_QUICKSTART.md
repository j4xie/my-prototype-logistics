# Batch Module I18N Migration - Quick Start Guide

## 5-Minute Setup

### Step 1: Update JSON Files (2 minutes)

#### Chinese (zh-CN):
```bash
cd src/i18n/locales/zh-CN
# Edit workshop.json, find the "batches" section and add these keys inside it:
```

Copy content from `batch-translations-zh-CN.json` and merge into the `"batches": {}` section of `workshop.json`

**Result should look like**:
```json
"batches": {
  "title": "批次管理",
  "searchPlaceholder": "搜索批次号...",
  "filters": { ... },
  "stats": { ... },
  "detail": { ... },  ← NEW
  "stage": { ... },   ← NEW
  "complete": { ... },← NEW
  "start": { ... },   ← NEW
  "materialConsumption": { ... } ← NEW
}
```

#### English (en-US):
Repeat the same for `en-US/workshop.json` using `batch-translations-en-US.json`

### Step 2: Update TypeScript Files (3 minutes)

For **each of the 6 files**, apply this template:

#### File List:
1. `WSBatchesScreen.tsx`
2. `BatchDetailScreen.tsx`
3. `BatchStageScreen.tsx`
4. `BatchCompleteScreen.tsx`
5. `BatchStartScreen.tsx`
6. `MaterialConsumptionScreen.tsx`

#### Template Change:

**Before:**
```typescript
import { useNavigation } from '@react-navigation/native';

export function WSBatchesScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <Text style={styles.headerTitle}>批次管理</Text>
  );
}
```

**After:**
```typescript
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';  // ← ADD THIS

export function WSBatchesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('workshop');       // ← ADD THIS

  return (
    <Text style={styles.headerTitle}>{t('batches.title')}</Text>  // ← CHANGE THIS
  );
}
```

### Step 3: Apply Specific Replacements

Use the detailed `batch-i18n-patches.txt` file for exact line-by-line changes.

**Quick Search-Replace Examples:**

#### WSBatchesScreen.tsx:
```
Find: "批次管理"
Replace: {t('batches.title')}

Find: "搜索批次号..."
Replace: {t('batches.searchPlaceholder')}

Find: "进行中"
Replace: {t('batches.stats.inProgress')}
```

#### BatchDetailScreen.tsx:
```
Find: "批次详情"
Replace: {t('batches.detail.title')}

Find: "当前工艺环节"
Replace: {t('batches.detail.currentStage')}

Find: "录入数据"
Replace: {t('batches.detail.enterData')}
```

#### BatchStageScreen.tsx:
```
Find: "数据录入"
Replace: {t('batches.stage.title')}

Find: "自动采集数据 (只读)"
Replace: {t('batches.stage.autoDataSection')}

Find: "保存数据"
Replace: {t('batches.stage.saveData')}
```

#### BatchCompleteScreen.tsx:
```
Find: "完成批次"
Replace: {t('batches.complete.title')}

Find: "质检已完成"
Replace: {t('batches.complete.checkQuality')}

Find: "确认完成批次"
Replace: {t('batches.complete.confirmComplete')}
```

#### BatchStartScreen.tsx:
```
Find: "创建批次"
Replace: {t('batches.start.title')}

Find: "选择产品 *"
Replace: {t('batches.start.selectProduct')}

Find: "请输入目标产量"
Replace: {t('batches.start.targetPlaceholder')}
```

#### MaterialConsumptionScreen.tsx:
```
Find: "原料消耗"
Replace: {t('batches.materialConsumption.title')}

Find: "消耗记录"
Replace: {t('batches.materialConsumption.recordsTitle')}

Find: "添加消耗记录"
Replace: {t('batches.materialConsumption.addRecord')}
```

## Verification

### Test Each Screen:
```bash
# Start the app
npm start

# Navigate to:
车间主任 → 批次管理 → [Test each screen]
```

### Checklist:
- [ ] List screen: Filters show translated text
- [ ] Search placeholder is translated
- [ ] Detail screen: All labels translated
- [ ] Stage screen: AI sections translated
- [ ] Complete screen: Checkboxes translated
- [ ] Start screen: Form fields translated
- [ ] Material screen: Records translated
- [ ] Language switch works

## Troubleshooting

### Issue: Text shows as "batches.title"
**Fix:** JSON key missing or typo in translation file

### Issue: English text shows in Chinese mode
**Fix:** Check `useTranslation('workshop')` namespace is correct

### Issue: Errors after changes
**Fix:** Restart Metro bundler: `npm start --reset-cache`

## Success Criteria

✅ All 6 screens display translated text
✅ Language switching works in real-time
✅ No console errors about missing keys
✅ Chinese and English both work correctly

## Time Estimate

- JSON updates: **2 minutes**
- Import/hook additions: **1 minute**
- String replacements: **2 minutes per file × 6 = 12 minutes**
- Testing: **3 minutes**

**Total: ~18 minutes**

## Next Steps

After successful migration:
1. Delete reference files (batch-translations-*.json)
2. Test on physical device
3. Verify with different language settings
4. Mark module as complete in migration tracker

---

**Quick Reference Files:**
- `BATCH_I18N_SUMMARY.md` - Overview and architecture
- `batch-i18n-patches.txt` - Line-by-line changes
- `BATCH_I18N_MIGRATION_INSTRUCTIONS.md` - Detailed instructions
- `batch-translations-zh-CN.json` - Chinese translations only
- `batch-translations-en-US.json` - English translations only
