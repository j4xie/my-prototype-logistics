# Warehouse Module i18n Migration Summary

## Overview
Migration of 27 warehouse module files to use i18n with `useTranslation('warehouse')` hook.

## Files to Migrate

### Shared Screens (7 files)
1. `src/screens/warehouse/shared/WHConversionAnalysisScreen.tsx`
2. `src/screens/warehouse/shared/WHAlertHandleScreen.tsx`
3. `src/screens/warehouse/shared/WHAlertListScreen.tsx`
4. `src/screens/warehouse/shared/WHScanOperationScreen.tsx`
5. `src/screens/warehouse/shared/WHRecallManageScreen.tsx`
6. `src/screens/warehouse/shared/WHBatchTraceScreen.tsx`
7. `src/screens/warehouse/shared/WHSettingsScreen.tsx` (if exists)

### Profile Screens (3 files)
8. `src/screens/warehouse/profile/WHSettingsScreen.tsx`
9. `src/screens/warehouse/profile/WHOperationLogScreen.tsx`
10. `src/screens/warehouse/profile/WHProfileEditScreen.tsx`

### Inventory Screens (8 files)
11. `src/screens/warehouse/inventory/WHTempMonitorScreen.tsx`
12. `src/screens/warehouse/inventory/WHLocationManageScreen.tsx`
13. `src/screens/warehouse/inventory/WHInventoryTransferScreen.tsx`
14. `src/screens/warehouse/inventory/WHInventoryDetailScreen.tsx`
15. `src/screens/warehouse/inventory/WHIOStatisticsScreen.tsx`
16. `src/screens/warehouse/inventory/WHExpireHandleScreen.tsx`
17. `src/screens/warehouse/inventory/WHInventoryCheckScreen.tsx`
18. `src/screens/warehouse/inventory/WHBatchDetailScreen.tsx`

### Inbound Screens (4 files)
19. `src/screens/warehouse/inbound/WHInboundDetailScreen.tsx`
20. `src/screens/warehouse/inbound/WHInboundListScreen.tsx`
21. `src/screens/warehouse/inbound/WHPutawayScreen.tsx`
22. `src/screens/warehouse/inbound/WHInspectScreen.tsx`

### Outbound Screens (6 files)
23. `src/screens/warehouse/outbound/WHShippingConfirmScreen.tsx`
24. `src/screens/warehouse/outbound/WHOrderDetailScreen.tsx`
25. `src/screens/warehouse/outbound/WHTrackingDetailScreen.tsx`
26. `src/screens/warehouse/outbound/WHLoadingScreen.tsx`
27. `src/screens/warehouse/outbound/WHPackingScreen.tsx`
28. `src/screens/warehouse/outbound/WHOutboundDetailScreen.tsx`

## Migration Steps (Apply to Each File)

### Step 1: Add i18n Import
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Add useTranslation Hook
Add at the beginning of the component function:
```typescript
const { t } = useTranslation('warehouse');
```

### Step 3: Replace Chinese Strings
Replace all Chinese strings with `t('key')` calls using the translation keys defined below.

## Translation Keys Added

### Conversion Analysis (`shared.conversion`)
```json
{
  "shared": {
    "conversion": {
      "title": "转换率分析",
      "subtitle": "AI 智能生产效率分析",
      "period": {
        "today": "今日",
        "week": "本周",
        "month": "本月",
        "quarter": "季度"
      },
      "weekDays": {
        "monday": "周一",
        "tuesday": "周二",
        "wednesday": "周三",
        "thursday": "周四",
        "friday": "周五",
        "saturday": "周六",
        "sunday": "周日"
      },
      "mainCard": {
        "title": "本月整体转换率",
        "aiTag": "AI分析",
        "comparedToLastMonth": "较上月",
        "industryAvg": "行业平均",
        "target": "配置目标",
        "gap": "差距"
      },
      "categoryAnalysis": "品类转换率分析",
      "input": "投入",
      "output": "产出",
      "status": {
        "exceed": "超过目标",
        "belowIndustry": "低于行业",
        "meetTarget": "达到目标",
        "excellent": "优秀"
      },
      "lossAnalysis": "损耗分析",
      "normalLoss": "正常损耗",
      "abnormalLoss": "异常损耗",
      "abnormalDetails": "异常损耗明细",
      "trendAnalysis": "转换率趋势",
      "actualRate": "实际转换率",
      "targetLine": "目标线(93%)",
      "industryLine": "行业平均(91%)",
      "aiOptimization": "AI 优化建议",
      "smartAnalysis": "智能分析",
      "aiAnalyzedAt": "AI分析于 {{time}}",
      "generateReport": "生成报告",
      "supplierImpact": "供应商影响分析",
      "grade": "{{grade}}级",
      "conversionRate": "供货转换率",
      "qualityRate": "质检合格率",
      "sharePercent": "供货占比",
      "exportReport": "导出报表",
      "deepAnalysis": "AI深度分析"
    }
  }
}
```

### Alert Handle (`shared.alertHandle`)
```json
{
  "shared": {
    "alertHandle": {
      "title": "预警处理",
      "subtitle": "处理库存预警",
      "alertInfo": "预警信息",
      "urgent": "紧急",
      "currentStock": "当前库存",
      "safeStock": "安全库存",
      "gap": "缺口",
      "expireTime": "过期时间",
      "selectSolution": "选择处理方案",
      "solutions": {
        "purchase": {
          "title": "紧急采购",
          "recommended": "推荐",
          "suggestedQty": "建议采购量: {{qty}} kg",
          "recommendedSupplier": "推荐供应商: {{supplier}}",
          "expectedArrival": "预计到货: {{days}}天"
        },
        "freeze": {
          "title": "转为冻品",
          "extendShelfLife": "延长保质期: +{{days}}天",
          "transferTo": "转移至: {{location}}",
          "suitable": "适用于即将过期的批次"
        },
        "fifo": {
          "title": "优先消耗 (FIFO)",
          "relatedPlans": "关联生产计划: {{count}}个",
          "markPriority": "标记为优先消耗批次",
          "autoRecommend": "系统自动推荐此批次"
        },
        "dispose": {
          "title": "报损处理",
          "estimatedLoss": "预计损失: ¥{{amount}}",
          "requiresApproval": "需审批: {{role}}",
          "suitable": "适用于已过期/变质物料"
        }
      },
      "purchaseInfo": "采购信息",
      "purchaseQty": "采购数量",
      "supplier": "供应商",
      "unitPrice": "预计单价",
      "totalAmount": "预计总金额",
      "remarks": "备注",
      "freezeInfo": "转冻品信息",
      "freezeQty": "转换数量",
      "targetLocation": "目标库位",
      "freezeInstructions": "转冻品说明",
      "extendedExpiryDate": "新到期日期: {{date}}",
      "freezeProcessTime": "需要{{hours}}小时冷冻处理",
      "cancel": "取消",
      "confirmSolution": "确认处理方案",
      "success": "成功",
      "successMessage": "处理方案已提交"
    }
  }
}
```

### Scan Operation (`shared.scanOperation`)
```json
{
  "shared": {
    "scanOperation": {
      "inbound": {
        "title": "扫码入库",
        "action": "入库"
      },
      "outbound": {
        "title": "扫码出库",
        "action": "出库"
      },
      "scanHint": "将二维码/条码放入框内",
      "scanning": "扫码中...",
      "scanned": "已扫描",
      "lastScan": "最近扫描",
      "noRecord": "暂无扫描记录",
      "clickToScan": "点击扫码",
      "manualInput": "手动输入",
      "scanSuccess": "扫码成功",
      "batchNumber": "批次号: {{number}}",
      "successAction": "{{action}}成功!",
      "continueScanning": "继续扫码",
      "inputPrompt": "请输入批次号",
      "tips": {
        "title": "扫码说明",
        "qrAndBarcode": "支持二维码、条形码扫描",
        "autoConfirm": "扫描后自动{{action}}确认",
        "manualFallback": "如无法扫码，可点击\"手动输入\""
      }
    }
  }
}
```

### Recall Management (`shared.recall`)
```json
{
  "shared": {
    "recall": {
      "title": "召回管理",
      "subtitle": "产品召回追溯",
      "tabs": {
        "active": "进行中({{count}})",
        "completed": "已完成({{count}})",
        "create": "新建召回"
      },
      "level": {
        "urgent": "紧急",
        "normal": "一般"
      },
      "status": {
        "processing": "执行中",
        "completed": "已完成"
      },
      "recallNumber": "召回单号",
      "recallReason": "召回原因",
      "affectedBatch": "涉及批次",
      "affectedQuantity": "涉及数量",
      "startTime": "发起时间",
      "completeTime": "完成时间",
      "traceScope": "追溯范围",
      "inventory": "库存在库",
      "shipped": "已出货",
      "consumed": "已消耗",
      "frozen": "已冻结",
      "notifying": "通知中",
      "processingProgress": "处理进度",
      "viewDetails": "查看详情",
      "continueProcess": "继续处理",
      "recallFlow": "召回流程",
      "flowSteps": {
        "freezeInventory": {
          "title": "冻结库存",
          "description": "锁定问题批次"
        },
        "notifyCustomers": {
          "title": "通知客户",
          "description": "发送召回通知"
        },
        "recoverProducts": {
          "title": "回收产品",
          "description": "客户退货处理"
        },
        "dispose": {
          "title": "处置记录",
          "description": "销毁/处理"
        },
        "rootCause": {
          "title": "原因分析",
          "description": "根因分析报告"
        },
        "closeRecall": {
          "title": "关闭召回",
          "description": "完成闭环"
        }
      },
      "historyRecords": "历史召回记录",
      "createNew": "发起新召回",
      "selectBatch": "选择需要召回的批次",
      "confirmRecall": "确定要发起召回吗?"
    }
  }
}
```

### Batch Trace (`shared.batchTrace`)
```json
{
  "shared": {
    "batchTrace": {
      "title": "批次追溯",
      "batchNumber": "批次号",
      "initial": "初始",
      "current": "当前",
      "completeTraceChain": "完整追溯链",
      "nodes": {
        "source": "原料来源",
        "inbound": "入库验收",
        "storage": "仓储管理",
        "outbound": "出库记录",
        "current": "当前状态"
      },
      "supplier": "供应商",
      "catchDate": "捕捞日期",
      "catchArea": "捕捞区域",
      "inspectionReport": "检验报告",
      "viewReport": "查看报告 >",
      "inboundTime": "入库时间",
      "inboundQty": "入库数量",
      "inspector": "质检员",
      "qualityGrade": "质量等级",
      "location": "库位",
      "storageTemp": "储存温度",
      "meetsRequirement": "符合要求",
      "tempRecords": "温控记录",
      "viewRecords": "查看记录 >",
      "storageDays": "存储天数",
      "order": "订单",
      "productionBatch": "生产批次",
      "customer": "客户",
      "outboundTime": "出库时间",
      "product": "产品",
      "consumptionTime": "消耗时间",
      "remainingQty": "剩余数量",
      "expiryTime": "到期时间",
      "daysLater": "{{days}}天后",
      "exportReport": "导出报告",
      "initiateRecall": "发起召回",
      "confirmRecall": "确定要发起召回吗?",
      "reportExported": "追溯报告已导出"
    }
  }
}
```

## Example Migration

### Before:
```typescript
export function WHConversionAnalysisScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  return (
    <SafeAreaView>
      <Text style={styles.headerTitle}>转换率分析</Text>
      <Text style={styles.headerSubtitle}>AI 智能生产效率分析</Text>
      // ... more JSX
    </SafeAreaView>
  );
}
```

### After:
```typescript
export function WHConversionAnalysisScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation('warehouse');

  return (
    <SafeAreaView>
      <Text style={styles.headerTitle}>{t('shared.conversion.title')}</Text>
      <Text style={styles.headerSubtitle}>{t('shared.conversion.subtitle')}</Text>
      // ... more JSX
    </SafeAreaView>
  );
}
```

## Status
- ✅ Translation keys defined in `zh-CN/warehouse.json`
- ✅ Translation keys defined in `en-US/warehouse.json`
- ⏳ Individual file migrations pending

## Next Steps
1. Apply migration to each file following the pattern above
2. Test each migrated screen to ensure translations display correctly
3. Verify language switching works properly
4. Add any missing translation keys as discovered during testing
