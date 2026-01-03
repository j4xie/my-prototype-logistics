# Processing Module i18n Migration Summary

## Overview
This document provides a comprehensive summary of the i18n migration for the processing module files.

## Files to Migrate

### Main Screens
1. ✅ MaterialBatchManagementScreen.tsx (1204 lines)
2. ✅ CostComparisonScreen.tsx (1017 lines)
3. ⏳ MaterialReceiptScreen.tsx
4. ⏳ AIConversationHistoryScreen.tsx
5. ⏳ BatchComparisonScreen.tsx
6. ⏳ AIAnalysisDetailScreen.tsx
7. ⏳ DeepSeekAnalysisScreen.tsx
8. ✅ CostAnalysisDashboard.tsx (771 lines)
9. ✅ CostAnalysisDashboard/index.tsx (146 lines)

### Component Files
10. ✅ CostAnalysisDashboard/components/CostOverviewCard.tsx (81 lines)
11. ✅ CostAnalysisDashboard/components/AIAnalysisSection.tsx (262 lines)
12. ✅ CostAnalysisDashboard/components/ProfitAnalysisCard.tsx (86 lines)
13. ✅ CostAnalysisDashboard/components/EquipmentStatsCard.tsx (68 lines)
14. ✅ CostAnalysisDashboard/components/LaborStatsCard.tsx (68 lines)

## Translation Keys Structure

```json
{
  "processing": {
    "common": {
      "loading": "加载中...",
      "loadingData": "加载成本数据中...",
      "refresh": "刷新",
      "export": "导出",
      "delete": "删除",
      "edit": "编辑",
      "cancel": "取消",
      "confirm": "确认",
      "back": "返回",
      "save": "保存",
      "submit": "提交",
      "send": "发送"
    },

    "costAnalysis": {
      "title": "成本分析",
      "batchNumber": "批次号",
      "status": "状态",
      "inProgress": "进行中",
      "costOverview": "成本概览",
      "costDetails": "成本明细",
      "rawMaterialCost": "原材料成本",
      "laborCost": "人工成本",
      "equipmentCost": "设备成本",
      "otherCost": "其他成本",
      "totalCost": "总成本",
      "unitCost": "单位成本",
      "notFound": "未找到成本数据",
      "loadFailed": "加载成本数据失败",

      "output": {
        "title": "产量信息",
        "actualQuantity": "实际产量",
        "goodQuantity": "良品数量",
        "defectQuantity": "次品数量",
        "yieldRate": "良品率",
        "unit": "件"
      }
    },

    "ai": {
      "title": "AI智能分析",
      "subtitle": "基于DeepSeek技术，为您提供成本优化建议",
      "getAdvice": "获取AI优化建议",
      "analyzing": "AI正在分析成本数据，请稍候...",
      "analyzingData": "AI正在分析您的成本数据...",
      "analysisResult": "分析结果",
      "viewDetails": "查看详细分析",
      "reanalyze": "重新分析",
      "exportReport": "导出报告",
      "continueAsk": "继续提问",
      "customQuestion": "自定义问题",
      "inputQuestion": "输入您的问题",
      "questionPlaceholder": "例如：如何降低原材料损耗？",
      "ask": "提问",
      "quickQuestions": "快速提问:",
      "quota": {
        "remaining": "本周剩余",
        "times": "次",
        "used": "已用",
        "limit": "本周次数已用完",
        "resetHint": "下周一自动重置配额",
        "limitHint": "本周AI分析次数已用完，请等待下周重置",
        "warning": "提示: 本周还剩 {count} 次分析机会",
        "resetTomorrow": "明日重置",
        "resetIn1Day": "1天后重置",
        "resetInDays": "{days}天后重置"
      },
      "sessionId": "会话ID"
    },

    "laborStats": {
      "title": "人工详情",
      "totalWorkers": "总人数",
      "totalHours": "总工时",
      "hours": "小时",
      "minutes": "分钟",
      "workerDetails": "工人明细",
      "people": "人"
    },

    "equipmentStats": {
      "title": "设备详情",
      "totalUsages": "设备使用次数",
      "runTime": "运行时长",
      "times": "次",
      "usages": "次使用",
      "running": "运行",
      "equipmentDetails": "设备明细"
    },

    "profitAnalysis": {
      "title": "利润分析",
      "expectedRevenue": "预期收入",
      "profit": "利润",
      "profitRate": "利润率",
      "breakEvenPrice": "保本价"
    },

    "materialBatch": {
      "title": "原材料批次管理",
      "searchPlaceholder": "搜索批次号、原料类型、储存位置",
      "tabs": {
        "all": "全部",
        "expiring": "即将过期",
        "expired": "已过期",
        "lowStock": "低库存"
      },
      "stats": {
        "total": "批次总数",
        "available": "可用",
        "warning": "预警"
      },
      "status": {
        "available": "可用",
        "reserved": "预留",
        "depleted": "耗尽",
        "usedUp": "用完",
        "expired": "过期",
        "inspecting": "质检中",
        "scrapped": "报废",
        "unknown": "未知"
      },
      "storageType": {
        "fresh": "鲜品",
        "frozen": "冻品",
        "dry": "干货"
      },
      "quality": {
        "gradeA": "A级",
        "gradeB": "B级",
        "gradeC": "C级"
      },
      "expiry": {
        "expired": "已过期",
        "expiringToday": "今天过期",
        "expiringTomorrow": "明天过期",
        "expiringInDays": "{days}天后过期"
      },
      "quantity": {
        "remaining": "剩余/总量",
        "used": "已用",
        "reserved": "预留"
      },
      "info": {
        "inboundDate": "入库",
        "expiryDate": "到期",
        "storageLocation": "储存位置",
        "unitPrice": "单价",
        "totalCost": "总价",
        "supplier": "供应商"
      },
      "actions": {
        "export": "导出",
        "delete": "删除",
        "edit": "编辑",
        "convertToFrozen": "转为冻品",
        "undoFrozen": "撤销转冻品",
        "handleExpired": "批量处理过期批次",
        "aiInbound": "AI智能入库"
      },
      "fifo": {
        "title": "FIFO推荐",
        "recommendation": "建议优先",
        "description": "根据先进先出(FIFO)原则，建议优先使用以下批次："
      },
      "dialogs": {
        "deleteTitle": "确认删除",
        "deleteMessage": "确定要删除批次 {batchNumber} 吗？",
        "deleteWarning": "此操作不可撤销。",
        "undoTitle": "撤销转冻品",
        "undoWarning": "⚠️ 注意：只能撤销10分钟内的转冻品操作",
        "undoReasonLabel": "撤销原因 *",
        "undoReasonPlaceholder": "例如：误操作、批次选错、需要继续加工等",
        "convertTitle": "转为冻品",
        "convertMessage": "确定将批次 {batchNumber} 转为冻品吗？\\n这将延长保质期并更新库存状态。",
        "convertSuccess": "批次 {batchNumber} 已成功转为冻品\\n保质期已延长，存储位置已更新",
        "undoSuccess": "批次 {batchNumber} 已恢复为鲜品状态",
        "deleteSuccess": "批次 {batchNumber} 已删除"
      },
      "empty": {
        "noData": "暂无批次数据",
        "noExpiring": "✅ 没有即将过期的批次",
        "noExpired": "✅ 没有已过期的批次",
        "noLowStock": "✅ 没有低库存批次",
        "noBatches": "暂无原材料批次"
      },
      "export": {
        "success": "导出成功",
        "successMessage": "库存数据已导出\\n\\n文件大小：{size} KB",
        "viewLater": "稍后查看",
        "share": "分享文件",
        "failed": "导出失败",
        "failedMessage": "导出库存数据失败，请稍后重试"
      },
      "handleExpired": {
        "title": "批量处理过期批次",
        "description": "发现 {count} 个过期批次。您可以批量处理这些批次，系统将自动更新其状态。",
        "confirmMessage": "确定要处理 {count} 个过期批次吗？\\n\\n系统将自动标记这些批次为已过期状态。",
        "processing": "处理中...",
        "success": "已成功处理 {count} 个过期批次"
      }
    },

    "costComparison": {
      "title": "成本对比",
      "summary": {
        "batchCount": "对比批次",
        "avgTotalCost": "平均总成本",
        "avgUnitCost": "平均单位成本"
      },
      "performance": {
        "title": "成本表现",
        "best": "最优",
        "worst": "待优化",
        "difference": "成本差异"
      },
      "table": {
        "title": "成本明细对比",
        "date": "日期",
        "quantity": "数量"
      },
      "chart": {
        "totalCost": "总成本对比",
        "unitCostTrend": "单位成本趋势",
        "structure": "成本结构对比"
      },
      "categories": {
        "labor": "人工",
        "material": "原料",
        "equipment": "设备",
        "other": "其他",
        "laborCost": "人工成本",
        "materialCost": "原料成本",
        "equipmentCost": "设备成本",
        "otherCost": "其他成本"
      },
      "actions": {
        "exportReport": "导出报告",
        "aiAnalysis": "AI分析"
      },
      "error": {
        "loadFailed": "加载成本对比数据失败",
        "noData": "未找到批次成本数据"
      }
    }
  }
}
```

## Migration Steps

### Step 1: Import i18n hook
Add to each file:
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Use hook in component
Add at the beginning of the component:
```typescript
const { t } = useTranslation('processing');
```

### Step 3: Replace hardcoded strings
Replace all Chinese strings with `t('key')` calls. Examples:

#### Before:
```typescript
<Appbar.Content title="成本分析" />
<Text>加载中...</Text>
<Text>批次号</Text>
```

#### After:
```typescript
<Appbar.Content title={t('costAnalysis.title')} />
<Text>{t('common.loading')}</Text>
<Text>{t('costAnalysis.batchNumber')}</Text>
```

### Step 4: Handle dynamic strings
For strings with variables, use interpolation:

#### Before:
```typescript
Alert.alert('删除成功', `批次 ${batchNumber} 已删除`);
```

#### After:
```typescript
Alert.alert(
  t('common.deleteSuccess'),
  t('materialBatch.dialogs.deleteSuccess', { batchNumber })
);
```

## English Translations (en-US)

The corresponding English translations should be added to `en-US/processing.json`:

```json
{
  "processing": {
    "common": {
      "loading": "Loading...",
      "loadingData": "Loading cost data...",
      "refresh": "Refresh",
      "export": "Export",
      "delete": "Delete",
      "edit": "Edit",
      "cancel": "Cancel",
      "confirm": "Confirm",
      "back": "Back",
      "save": "Save",
      "submit": "Submit",
      "send": "Send"
    },
    "costAnalysis": {
      "title": "Cost Analysis",
      "batchNumber": "Batch Number",
      "status": "Status",
      "inProgress": "In Progress",
      "costOverview": "Cost Overview",
      "costDetails": "Cost Details",
      "rawMaterialCost": "Raw Material Cost",
      "laborCost": "Labor Cost",
      "equipmentCost": "Equipment Cost",
      "otherCost": "Other Cost",
      "totalCost": "Total Cost",
      "unitCost": "Unit Cost",
      "notFound": "Cost data not found",
      "loadFailed": "Failed to load cost data",
      "output": {
        "title": "Output Information",
        "actualQuantity": "Actual Quantity",
        "goodQuantity": "Good Quantity",
        "defectQuantity": "Defect Quantity",
        "yieldRate": "Yield Rate",
        "unit": "pcs"
      }
    },
    "ai": {
      "title": "AI Smart Analysis",
      "subtitle": "Powered by DeepSeek, providing cost optimization suggestions",
      "getAdvice": "Get AI Optimization Suggestions",
      "analyzing": "AI is analyzing cost data, please wait...",
      "analyzingData": "AI is analyzing your cost data...",
      "analysisResult": "Analysis Result",
      "viewDetails": "View Detailed Analysis",
      "reanalyze": "Reanalyze",
      "exportReport": "Export Report",
      "continueAsk": "Continue Asking",
      "customQuestion": "Custom Question",
      "inputQuestion": "Enter your question",
      "questionPlaceholder": "E.g.: How to reduce raw material waste?",
      "ask": "Ask",
      "quickQuestions": "Quick Questions:",
      "quota": {
        "remaining": "Remaining this week",
        "times": "times",
        "used": "used",
        "limit": "Weekly quota exhausted",
        "resetHint": "Quota resets next Monday",
        "limitHint": "AI analysis quota for this week is exhausted, please wait for next week",
        "warning": "Reminder: {count} analyses remaining this week",
        "resetTomorrow": "Reset tomorrow",
        "resetIn1Day": "Reset in 1 day",
        "resetInDays": "Reset in {days} days"
      },
      "sessionId": "Session ID"
    },
    "laborStats": {
      "title": "Labor Details",
      "totalWorkers": "Total Workers",
      "totalHours": "Total Hours",
      "hours": "hours",
      "minutes": "minutes",
      "workerDetails": "Worker Details",
      "people": "people"
    },
    "equipmentStats": {
      "title": "Equipment Details",
      "totalUsages": "Equipment Usage Count",
      "runTime": "Run Time",
      "times": "times",
      "usages": "usages",
      "running": "running",
      "equipmentDetails": "Equipment Details"
    },
    "profitAnalysis": {
      "title": "Profit Analysis",
      "expectedRevenue": "Expected Revenue",
      "profit": "Profit",
      "profitRate": "Profit Rate",
      "breakEvenPrice": "Break-even Price"
    },
    "materialBatch": {
      "title": "Material Batch Management",
      "searchPlaceholder": "Search batch number, material type, storage location",
      "tabs": {
        "all": "All",
        "expiring": "Expiring Soon",
        "expired": "Expired",
        "lowStock": "Low Stock"
      },
      "stats": {
        "total": "Total Batches",
        "available": "Available",
        "warning": "Warning"
      },
      "status": {
        "available": "Available",
        "reserved": "Reserved",
        "depleted": "Depleted",
        "usedUp": "Used Up",
        "expired": "Expired",
        "inspecting": "Inspecting",
        "scrapped": "Scrapped",
        "unknown": "Unknown"
      },
      "storageType": {
        "fresh": "Fresh",
        "frozen": "Frozen",
        "dry": "Dry"
      },
      "quality": {
        "gradeA": "Grade A",
        "gradeB": "Grade B",
        "gradeC": "Grade C"
      },
      "expiry": {
        "expired": "Expired",
        "expiringToday": "Expiring today",
        "expiringTomorrow": "Expiring tomorrow",
        "expiringInDays": "Expires in {days} days"
      },
      "quantity": {
        "remaining": "Remaining/Total",
        "used": "Used",
        "reserved": "Reserved"
      },
      "info": {
        "inboundDate": "Inbound",
        "expiryDate": "Expiry",
        "storageLocation": "Storage Location",
        "unitPrice": "Unit Price",
        "totalCost": "Total Cost",
        "supplier": "Supplier"
      },
      "actions": {
        "export": "Export",
        "delete": "Delete",
        "edit": "Edit",
        "convertToFrozen": "Convert to Frozen",
        "undoFrozen": "Undo Frozen Conversion",
        "handleExpired": "Batch Handle Expired",
        "aiInbound": "AI Smart Inbound"
      },
      "fifo": {
        "title": "FIFO Recommendation",
        "recommendation": "Priority",
        "description": "Based on FIFO principle, the following batch is recommended:"
      },
      "dialogs": {
        "deleteTitle": "Confirm Delete",
        "deleteMessage": "Are you sure you want to delete batch {batchNumber}?",
        "deleteWarning": "This action cannot be undone.",
        "undoTitle": "Undo Frozen Conversion",
        "undoWarning": "⚠️ Note: Can only undo conversions within 10 minutes",
        "undoReasonLabel": "Reason for Undo *",
        "undoReasonPlaceholder": "E.g.: Mistake, wrong batch selected, need further processing",
        "convertTitle": "Convert to Frozen",
        "convertMessage": "Convert batch {batchNumber} to frozen?\\nThis will extend shelf life and update inventory status.",
        "convertSuccess": "Batch {batchNumber} successfully converted to frozen\\nShelf life extended, storage location updated",
        "undoSuccess": "Batch {batchNumber} restored to fresh status",
        "deleteSuccess": "Batch {batchNumber} deleted"
      },
      "empty": {
        "noData": "No batch data",
        "noExpiring": "✅ No expiring batches",
        "noExpired": "✅ No expired batches",
        "noLowStock": "✅ No low stock batches",
        "noBatches": "No material batches"
      },
      "export": {
        "success": "Export Successful",
        "successMessage": "Inventory data exported\\n\\nFile size: {size} KB",
        "viewLater": "View Later",
        "share": "Share File",
        "failed": "Export Failed",
        "failedMessage": "Failed to export inventory data, please try again later"
      },
      "handleExpired": {
        "title": "Batch Handle Expired Batches",
        "description": "Found {count} expired batches. You can batch process these batches, the system will automatically update their status.",
        "confirmMessage": "Confirm to process {count} expired batches?\\n\\nThe system will automatically mark these batches as expired.",
        "processing": "Processing...",
        "success": "Successfully processed {count} expired batches"
      }
    },
    "costComparison": {
      "title": "Cost Comparison",
      "summary": {
        "batchCount": "Batches Compared",
        "avgTotalCost": "Avg Total Cost",
        "avgUnitCost": "Avg Unit Cost"
      },
      "performance": {
        "title": "Cost Performance",
        "best": "Best",
        "worst": "Needs Optimization",
        "difference": "Cost Difference"
      },
      "table": {
        "title": "Cost Details Comparison",
        "date": "Date",
        "quantity": "Quantity"
      },
      "chart": {
        "totalCost": "Total Cost Comparison",
        "unitCostTrend": "Unit Cost Trend",
        "structure": "Cost Structure Comparison"
      },
      "categories": {
        "labor": "Labor",
        "material": "Material",
        "equipment": "Equipment",
        "other": "Other",
        "laborCost": "Labor Cost",
        "materialCost": "Material Cost",
        "equipmentCost": "Equipment Cost",
        "otherCost": "Other Cost"
      },
      "actions": {
        "exportReport": "Export Report",
        "aiAnalysis": "AI Analysis"
      },
      "error": {
        "loadFailed": "Failed to load cost comparison data",
        "noData": "Batch cost data not found"
      }
    }
  }
}
```

## Notes
- Keep code logic unchanged
- Use meaningful nested key structures
- For component files, also add `useTranslation('processing')` hook
- Test all translations after migration
- Ensure all dynamic strings use proper interpolation

## Remaining Files
The following files still need to be analyzed and migrated:
- MaterialReceiptScreen.tsx
- AIConversationHistoryScreen.tsx
- BatchComparisonScreen.tsx
- AIAnalysisDetailScreen.tsx
- DeepSeekAnalysisScreen.tsx

These files will require additional analysis to extract all translation keys.
