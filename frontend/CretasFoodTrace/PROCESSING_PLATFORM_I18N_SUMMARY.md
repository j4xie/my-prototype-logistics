# Processing & Platform Module i18n Migration Summary

## Current Status

### ✅ Completed
1. **CreateBatchScreen.tsx** - Partially migrated (imports added, hook initialized)
   - Added `import { useTranslation } from 'react-i18next'`
   - Added `const { t } = useTranslation('processing')`
   - Still needs: Replace all Chinese strings with t() calls

### ⏳ In Progress
- Translation key extraction and documentation

### ⏸️ Not Started (20 files)

#### Processing Module (14 files)
1. MaterialBatchManagementScreen.tsx (~1200 lines, ~150+ Chinese strings)
2. CostComparisonScreen.tsx (~1000 lines, ~80+ Chinese strings)
3. MaterialReceiptScreen.tsx (~570 lines, ~60+ Chinese strings)
4. AIConversationHistoryScreen.tsx
5. BatchComparisonScreen.tsx
6. AIAnalysisDetailScreen.tsx
7. DeepSeekAnalysisScreen.tsx
8. CostAnalysisDashboard.tsx
9. CostAnalysisDashboard/index.tsx
10. CostAnalysisDashboard/components/CostOverviewCard.tsx
11. CostAnalysisDashboard/components/AIAnalysisSection.tsx
12. CostAnalysisDashboard/components/ProfitAnalysisCard.tsx
13. CostAnalysisDashboard/components/EquipmentStatsCard.tsx
14. CostAnalysisDashboard/components/LaborStatsCard.tsx

#### Platform Module (6 files)
1. IndustryTemplateEditScreen.tsx
2. PlatformReportsScreen.tsx
3. IndustryTemplateManagementScreen.tsx
4. FactorySetupScreen.tsx
5. BlueprintManagementScreen.tsx
6. AIQuotaManagementScreen.tsx

## Files Created

### 1. Migration Plan
📄 **PROCESSING_PLATFORM_I18N_MIGRATION_PLAN.md**
- Detailed migration strategy
- Translation key structure for each file
- Code examples
- Timeline estimates

### 2. Extraction Script
📄 **scripts/extract-chinese-strings.js**
- Automated Chinese string extraction
- Translation key generation
- Usage: `node scripts/extract-chinese-strings.js <file-path>`

## Key Translation Examples

### CreateBatchScreen.tsx Translations Needed

```json
{
  "createBatch": {
    "title": "原料入库",
    "editTitle": "编辑批次",
    "noPermission": "无权操作",
    "factoryUsersOnly": "仅限工厂用户使用",
    "materialInfo": "原料信息",
    "materialType": "原料类型",
    "materialQuantity": "原料数量 (kg)",
    "materialCost": "原料成本 (元)",
    "supplier": "供应商",
    "supervisorInfo": "负责人信息",
    "productionSupervisor": "生产负责人",
    "notes": "备注",
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
      "loadFailed": "加载失败"
    }
  }
}
```

### MaterialReceiptScreen.tsx Translations Needed

```json
{
  "materialReceipt": {
    "title": "原材料入库",
    "basicInfo": "基本信息",
    "storageInfo": "储存信息",
    "qualityInfo": "质检信息",
    "supplier": "供应商",
    "materialType": "原料类型",
    "quantity": "入库重量 (kg)",
    "unitPrice": "单价 (元/kg)",
    "totalAmount": "总金额（自动计算）",
    "storageType": "储存类型",
    "storageLocation": "储存位置",
    "shelfLife": "保质期 (天)",
    "expiryDate": "到期日期（自动计算）",
    "qualityInspector": "质检员",
    "qualityStatus": "质检状态",
    "qualityScore": "新鲜度评分 (0-100)",
    "storageTypes": {
      "fresh": "新鲜",
      "frozen": "冻货"
    },
    "qualityStatuses": {
      "qualified": "合格",
      "unqualified": "不合格"
    },
    "actions": {
      "cancel": "取消",
      "submit": "确认入库"
    }
  }
}
```

## Recommended Workflow

### Phase 1: Complete CreateBatchScreen.tsx (30 mins)
```bash
# 1. Replace all Chinese strings with t() calls
# Example replacements:
# "原料入库" → {t('createBatch.title')}
# "编辑批次" → {t('createBatch.editTitle')}
# Alert.alert('验证错误', '请选择原料类型') →
#   Alert.alert(t('createBatch.validation.error'), t('createBatch.validation.materialTypeRequired'))
```

### Phase 2: Update Translation Files (20 mins)
```bash
# Add keys to:
# - src/i18n/locales/zh-CN/processing.json
# - src/i18n/locales/en-US/processing.json (English translations)
```

### Phase 3: Test CreateBatchScreen (10 mins)
```bash
# 1. Run app
# 2. Switch language
# 3. Verify all strings translate correctly
```

### Phase 4: Migrate MaterialReceiptScreen.tsx (45 mins)
```bash
# Similar process as Phase 1-3
```

### Phase 5: Migrate CostComparisonScreen.tsx (40 mins)
```bash
# Similar process as Phase 1-3
```

### Phase 6: Remaining Files (6-8 hours)
```bash
# Continue with other processing files
# Then platform files
```

## Translation File Structure

### For processing.json
```json
{
  "common": { ... },
  "dashboard": { ... },
  "batchList": { ... },
  "createBatch": {
    // New section for CreateBatchScreen
  },
  "materialReceipt": {
    // New section for MaterialReceiptScreen
  },
  "costComparison": {
    // New section for CostComparisonScreen
  },
  "materialBatchManagement": {
    // New section for MaterialBatchManagementScreen
  }
  // ... other screens
}
```

### For platform.json
```json
{
  "title": "Platform Management Center",
  "dashboard": { ... },
  "factoryManagement": { ... },
  "industryTemplate": {
    "edit": { ... },
    "management": { ... }
  },
  "reports": { ... },
  "systemMonitoring": { ... },
  "factorySetup": {
    // New section
  },
  "blueprint": { ... },
  "aiQuota": { ... }
}
```

## Usage of Extraction Script

```bash
# Extract strings from a single file
node scripts/extract-chinese-strings.js src/screens/processing/CreateBatchScreen.tsx

# Extract from multiple files (bash)
for file in src/screens/processing/*.tsx; do
  echo "Processing $file"
  node scripts/extract-chinese-strings.js "$file" > "translations/${file##*/}.json"
done
```

## Testing Checklist

After each file migration:
- [ ] File compiles without errors
- [ ] All Chinese strings replaced with t() calls
- [ ] Translation keys added to zh-CN JSON file
- [ ] English translations added to en-US JSON file
- [ ] App runs without runtime errors
- [ ] Language switching works correctly
- [ ] All UI text displays correctly in both languages
- [ ] Dynamic text (with variables) displays correctly

## Common Patterns

### 1. Simple Text
```typescript
// Before
<Text>原材料批次管理</Text>

// After
<Text>{t('materialBatchManagement.title')}</Text>
```

### 2. Alert Messages
```typescript
// Before
Alert.alert('成功', '批次创建成功');

// After
Alert.alert(t('common.success'), t('createBatch.messages.createSuccess'));
```

### 3. Placeholders
```typescript
// Before
<TextInput placeholder="例如: 1200" />

// After
<TextInput placeholder={t('createBatch.quantityPlaceholder')} />
```

### 4. Dynamic Text with Variables
```typescript
// Before
Alert.alert('成功', `原材料批次 ${batchNumber} 入库成功!`);

// After
Alert.alert(
  t('common.success'),
  t('createBatch.messages.createSuccess', { batchNumber })
);

// In JSON:
{
  "createSuccess": "原材料批次 {{batchNumber}} 入库成功!"
}
```

### 5. Button Labels
```typescript
// Before
<Button>创建批次</Button>

// After
<Button>{t('createBatch.createButton')}</Button>
```

## Estimated Total Effort

| Task | Time | Status |
|------|------|--------|
| CreateBatchScreen.tsx | 1h | ⏳ Partially Done |
| MaterialReceiptScreen.tsx | 1h | ⏸️ Not Started |
| CostComparisonScreen.tsx | 45min | ⏸️ Not Started |
| MaterialBatchManagementScreen.tsx | 2h | ⏸️ Not Started |
| Other Processing Files (11 files) | 4h | ⏸️ Not Started |
| Platform Files (6 files) | 3h | ⏸️ Not Started |
| Translation File Updates | 2h | ⏸️ Not Started |
| Testing & Refinement | 1.5h | ⏸️ Not Started |
| **TOTAL** | **~15h** | **5% Complete** |

## Notes

1. **Large Files**: MaterialBatchManagementScreen.tsx has 1200+ lines and will take the most time
2. **CostAnalysisDashboard Components**: Consider migrating parent component first, then child components
3. **Shared Translations**: Some strings may be reusable across files (use common section)
4. **English Translations**: Can be done in parallel or after Chinese keys are finalized
5. **Testing**: Important to test language switching after each batch of 3-5 files

## Next Immediate Steps

1. **Complete CreateBatchScreen.tsx** (already started)
   - Replace remaining ~25 Chinese strings
   - Add translation keys to processing.json
   - Test

2. **Choose Next File**: MaterialReceiptScreen.tsx or CostComparisonScreen.tsx
   - Extract Chinese strings using script
   - Create translation keys
   - Migrate file
   - Test

3. **Iterate**: Continue with 3-5 files at a time

## Resources Created

- ✅ PROCESSING_PLATFORM_I18N_MIGRATION_PLAN.md (Detailed plan)
- ✅ PROCESSING_PLATFORM_I18N_SUMMARY.md (This file)
- ✅ scripts/extract-chinese-strings.js (Automation script)
- ⏸️ Translation keys in JSON files (In progress)

---

**Last Updated**: 2026-01-02
**Completion**: 5% (1 of 21 files partially complete)
