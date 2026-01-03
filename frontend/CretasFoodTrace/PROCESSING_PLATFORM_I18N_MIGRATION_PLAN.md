# Processing & Platform Module i18n Migration Plan

## Overview
This document outlines the i18n migration for 21 files across processing and platform modules.

## Files to Migrate

### Processing Module (15 files)
1. ✅ CreateBatchScreen.tsx - PARTIALLY STARTED
2. MaterialBatchManagementScreen.tsx
3. CostComparisonScreen.tsx
4. MaterialReceiptScreen.tsx
5. AIConversationHistoryScreen.tsx
6. BatchComparisonScreen.tsx
7. AIAnalysisDetailScreen.tsx
8. DeepSeekAnalysisScreen.tsx
9. CostAnalysisDashboard.tsx
10. CostAnalysisDashboard/index.tsx
11. CostAnalysisDashboard/components/CostOverviewCard.tsx
12. CostAnalysisDashboard/components/AIAnalysisSection.tsx
13. CostAnalysisDashboard/components/ProfitAnalysisCard.tsx
14. CostAnalysisDashboard/components/EquipmentStatsCard.tsx
15. CostAnalysisDashboard/components/LaborStatsCard.tsx

### Platform Module (6 files)
1. IndustryTemplateEditScreen.tsx
2. PlatformReportsScreen.tsx
3. IndustryTemplateManagementScreen.tsx
4. FactorySetupScreen.tsx
5. BlueprintManagementScreen.tsx
6. AIQuotaManagementScreen.tsx

## Migration Pattern

### 1. Import Statement
```typescript
import { useTranslation } from 'react-i18next';
```

### 2. Hook Usage
```typescript
// For processing files
const { t } = useTranslation('processing');

// For platform files
const { t } = useTranslation('platform');
```

### 3. String Replacement Pattern
```typescript
// Before
<Text>原材料批次管理</Text>
Alert.alert('成功', '批次创建成功');

// After
<Text>{t('materialBatch.title')}</Text>
Alert.alert(t('common.success'), t('materialBatch.createSuccess'));
```

## Translation Keys Needed for CreateBatchScreen.tsx

```json
{
  "createBatch": {
    "title": "原料入库",
    "editTitle": "编辑批次",
    "loadingTitle": "加载中",
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
    "createButton": "创建批次",
    "updateButton": "更新批次",
    "selectMaterialType": "点击选择原料类型",
    "quantityPlaceholder": "例如: 1200",
    "costPlaceholder": "例如: 30000",
    "selectSupplier": "选择供应商",
    "selectSupervisor": "点击选择负责人",
    "validation": {
      "error": "验证错误",
      "materialTypeRequired": "请选择原料类型",
      "quantityRequired": "请输入有效的原料数量",
      "costRequired": "请输入原料成本",
      "supplierRequired": "请选择供应商",
      "supervisorRequired": "请选择生产负责人"
    },
    "messages": {
      "success": "成功",
      "createSuccess": "原材料批次 {{batchNumber}} 入库成功!",
      "updateSuccess": "批次信息已更新!",
      "createFailed": "入库失败",
      "updateFailed": "更新失败",
      "loadFailed": "加载失败",
      "backToList": "返回列表"
    }
  }
}
```

## Translation Keys for MaterialReceiptScreen.tsx

```json
{
  "materialReceipt": {
    "title": "原材料入库",
    "basicInfo": "基本信息",
    "storageInfo": "储存信息",
    "qualityInfo": "质检信息",
    "otherInfo": "其他信息",
    "supplier": "供应商",
    "supplierPlaceholder": "请选择供应商",
    "materialType": "原料类型",
    "materialTypePlaceholder": "例如：三文鱼、虾仁",
    "quantity": "入库重量 (kg)",
    "quantityPlaceholder": "例如：100.5",
    "unitPrice": "单价 (元/kg)",
    "unitPricePlaceholder": "例如：45.00",
    "totalAmount": "总金额（自动计算）",
    "storageType": "储存类型",
    "storageLocation": "储存位置",
    "storageLocationPlaceholder": "例如：冷库A区-货架3",
    "shelfLife": "保质期 (天)",
    "shelfLifePlaceholder": "例如：30",
    "expiryDate": "到期日期（自动计算）",
    "qualityInspector": "质检员",
    "qualityInspectorPlaceholder": "例如：张三",
    "qualityStatus": "质检状态",
    "qualityScore": "新鲜度评分 (0-100)",
    "qualityScorePlaceholder": "例如：95",
    "qualityNotes": "质检备注",
    "qualityNotesPlaceholder": "质检备注信息",
    "qualityPhotos": "质检照片上传（待实现）",
    "notes": "备注",
    "notesPlaceholder": "其他备注信息",
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
      "submit": "确认入库",
      "confirmCancel": "确认取消",
      "confirmCancelMessage": "确定要取消入库操作吗？已填写的数据将丢失。",
      "continueEditing": "继续填写",
      "cancelReceipt": "取消入库"
    },
    "validation": {
      "failed": "验证失败",
      "fillAllRequired": "请填写所有必填项",
      "supplierRequired": "请选择供应商",
      "materialTypeRequired": "请输入原料类型",
      "quantityRequired": "请输入有效的入库重量",
      "unitPriceRequired": "请输入有效的单价",
      "storageLocationRequired": "请输入储存位置",
      "shelfLifeRequired": "请输入有效的保质期",
      "inspectorRequired": "请输入质检员"
    },
    "messages": {
      "success": "成功",
      "receiptSuccess": "原材料入库成功",
      "error": "错误",
      "loadSuppliersFailed": "加载供应商列表失败",
      "receiptFailed": "入库操作失败"
    }
  }
}
```

## Translation Keys for CostComparisonScreen.tsx

```json
{
  "costComparison": {
    "title": "成本对比",
    "loading": "加载中...",
    "compareBatches": "对比批次",
    "avgTotalCost": "平均总成本",
    "avgUnitCost": "平均单位成本",
    "performance": "成本表现",
    "best": "最优",
    "needsOptimization": "待优化",
    "costDifference": "成本差异",
    "costDetail": "成本明细对比",
    "totalCostComparison": "总成本对比",
    "unitCostTrend": "单位成本趋势",
    "costStructureComparison": "成本结构对比",
    "batchNumber": "批次号",
    "productType": "产品类型",
    "date": "日期",
    "quantity": "数量",
    "totalCost": "总成本",
    "unitCost": "单位成本",
    "laborCost": "人工成本",
    "materialCost": "原料成本",
    "equipmentCost": "设备成本",
    "otherCost": "其他成本",
    "labor": "人工",
    "material": "原料",
    "equipment": "设备",
    "other": "其他",
    "actions": {
      "exportReport": "导出报告",
      "aiAnalysis": "AI分析",
      "switchView": "切换视图"
    },
    "messages": {
      "noData": "未找到批次成本数据",
      "loadFailed": "加载成本对比数据失败"
    }
  }
}
```

## Migration Status

### Completed
- ✅ CreateBatchScreen.tsx (Partially - imports added, need to replace all strings)

### Remaining
- All other 20 files

## Recommended Approach

Due to the large volume of content (21 files with hundreds of Chinese strings), I recommend:

1. **Batch Processing**: Migrate 3-5 files at a time
2. **Translation File Updates**: Add all keys to zh-CN first, then create en-US translations
3. **Testing**: Test each batch before proceeding to next
4. **Priority Order**:
   - High Priority: CreateBatchScreen, MaterialReceiptScreen, CostComparisonScreen
   - Medium Priority: Dashboard components, AIAnalysis screens
   - Low Priority: Other utility screens

## Next Steps

1. Complete CreateBatchScreen.tsx migration (replace all remaining Chinese strings)
2. Add translation keys to processing.json and platform.json
3. Create corresponding en-US translations
4. Migrate next batch of files
5. Test and iterate

## Estimated Effort

- **Per File**: 15-30 minutes (depending on complexity)
- **Total**: ~8-12 hours for all 21 files
- **Translation File Updates**: ~2-3 hours

## Notes

- Some files like MaterialBatchManagementScreen.tsx have 1200+ lines with extensive Chinese text
- Consider using automated tools for initial extraction of Chinese strings
- Manual review required to ensure correct context and grouping of translation keys
