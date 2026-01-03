# Warehouse Module i18n Migration - Complete Instructions

## Quick Start

### Step 1: Merge Translation Files
Copy the contents from the generated translation files into the existing warehouse.json files:

1. Open `/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/warehouse-translations-complete-zh-CN.json`
2. Copy the `"shared"` section
3. Merge it into `/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/src/i18n/locales/zh-CN/warehouse.json`

4. Open `/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/warehouse-translations-complete-en-US.json`
5. Copy the `"shared"` section
6. Merge it into `/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/src/i18n/locales/en-US/warehouse.json`

### Step 2: Apply Migration Pattern to Each File

For each of the 27 files listed below, follow this migration pattern:

## Migration Pattern

### 1. Add Import
```typescript
import { useTranslation } from 'react-i18next';
```

### 2. Add Hook in Component
```typescript
export function ScreenName() {
  const { t } = useTranslation('warehouse');
  // ... rest of component
}
```

### 3. Replace Chinese Strings

## File-by-File Migration Guide

### Shared Screens

#### 1. WHConversionAnalysisScreen.tsx
**Translation namespace:** `shared.conversion`

Key replacements:
- `"转换率分析"` → `{t('shared.conversion.title')}`
- `"AI 智能生产效率分析"` → `{t('shared.conversion.subtitle')}`
- `"今日"` → `{t('shared.conversion.period.today')}`
- `"本周"` → `{t('shared.conversion.period.week')}`
- `"本月"` → `{t('shared.conversion.period.month')}`
- `"季度"` → `{t('shared.conversion.period.quarter')}`
- `"周一"` through `"周日"` → `{t('shared.conversion.weekDays.monday')}` etc.
- `"本月整体转换率"` → `{t('shared.conversion.mainCard.title')}`
- `"AI分析"` → `{t('shared.conversion.mainCard.aiTag')}`
- `"较上月"` → `{t('shared.conversion.mainCard.comparedToLastMonth')}`
- `"行业平均"` → `{t('shared.conversion.mainCard.industryAvg')}`
- `"配置目标"` → `{t('shared.conversion.mainCard.target')}`
- `"差距"` → `{t('shared.conversion.mainCard.gap')}`
- `"品类转换率分析"` → `{t('shared.conversion.categoryAnalysis')}`
- `"投入"` → `{t('shared.conversion.input')}`
- `"产出"` → `{t('shared.conversion.output')}`
- `"超过目标"` → `{t('shared.conversion.status.exceed')}`
- `"低于行业"` → `{t('shared.conversion.status.belowIndustry')}`
- `"达到目标"` → `{t('shared.conversion.status.meetTarget')}`
- `"优秀"` → `{t('shared.conversion.status.excellent')}`
- `"损耗分析"` → `{t('shared.conversion.lossAnalysis')}`
- `"正常损耗"` → `{t('shared.conversion.normalLoss')}`
- `"异常损耗"` → `{t('shared.conversion.abnormalLoss')}`
- `"异常损耗明细"` → `{t('shared.conversion.abnormalDetails')}`
- `"转换率趋势"` → `{t('shared.conversion.trendAnalysis')}`
- `"实际转换率"` → `{t('shared.conversion.actualRate')}`
- `"AI 优化建议"` → `{t('shared.conversion.aiOptimization')}`
- `"智能分析"` → `{t('shared.conversion.smartAnalysis')}`
- `"AI分析于 3分钟前"` → `{t('shared.conversion.aiAnalyzedAt', { time: '3分钟前' })}`
- `"生成报告"` → `{t('shared.conversion.generateReport')}`
- `"供应商影响分析"` → `{t('shared.conversion.supplierImpact')}`
- `"A级"` → `{t('shared.conversion.grade', { grade: 'A' })}`
- `"供货转换率"` → `{t('shared.conversion.conversionRate')}`
- `"质检合格率"` → `{t('shared.conversion.qualityRate')}`
- `"供货占比"` → `{t('shared.conversion.sharePercent')}`
- `"导出报表"` → `{t('shared.conversion.exportReport')}`
- `"AI深度分析"` → `{t('shared.conversion.deepAnalysis')}`

#### 2. WHAlertHandleScreen.tsx
**Translation namespace:** `shared.alertHandle`

Key replacements:
- `"预警处理"` → `{t('shared.alertHandle.title')}`
- `"处理库存预警"` → `{t('shared.alertHandle.subtitle')}`
- `"预警信息"` → `{t('shared.alertHandle.alertInfo')}`
- `"紧急"` → `{t('shared.alertHandle.urgent')}`
- `"当前库存"` → `{t('shared.alertHandle.currentStock')}`
- `"安全库存"` → `{t('shared.alertHandle.safeStock')}`
- `"缺口"` → `{t('shared.alertHandle.gap')}`
- `"过期时间"` → `{t('shared.alertHandle.expireTime')}`
- `"选择处理方案"` → `{t('shared.alertHandle.selectSolution')}`
- `"紧急采购"` → `{t('shared.alertHandle.solutions.purchase.title')}`
- `"推荐"` → `{t('shared.alertHandle.solutions.purchase.recommended')}`
- `"转为冻品"` → `{t('shared.alertHandle.solutions.freeze.title')}`
- `"优先消耗 (FIFO)"` → `{t('shared.alertHandle.solutions.fifo.title')}`
- `"报损处理"` → `{t('shared.alertHandle.solutions.dispose.title')}`
- `"采购信息"` → `{t('shared.alertHandle.purchaseInfo')}`
- `"采购数量"` → `{t('shared.alertHandle.purchaseQty')}`
- `"供应商"` → `{t('shared.alertHandle.supplier')}`
- `"预计单价"` → `{t('shared.alertHandle.unitPrice')}`
- `"预计总金额"` → `{t('shared.alertHandle.totalAmount')}`
- `"备注"` → `{t('shared.alertHandle.remarks')}`
- `"请输入备注信息"` → `{t('shared.alertHandle.remarksPlaceholder')}`
- `"转冻品信息"` → `{t('shared.alertHandle.freezeInfo')}`
- `"转换数量"` → `{t('shared.alertHandle.freezeQty')}`
- `"目标库位"` → `{t('shared.alertHandle.targetLocation')}`
- `"转冻品说明"` → `{t('shared.alertHandle.freezeInstructions')}`
- `"取消"` → `{t('shared.alertHandle.cancel')}`
- `"确认处理方案"` → `{t('shared.alertHandle.confirmSolution')}`
- `"成功"` → `{t('shared.alertHandle.success')}`
- `"处理方案已提交"` → `{t('shared.alertHandle.successMessage')}`

#### 3. WHAlertListScreen.tsx
**Translation namespace:** `shared.alertList`

Key replacements:
- `"常规告警"` → `{t('shared.alertList.alertTypeTabs.standard')}`
- `"AI智能告警"` → `{t('shared.alertList.alertTypeTabs.ai')}`
- `"🤖 AI 智能分析告警"` → `{t('shared.alertList.aiAnalysis')}`
- `"紧急预警"` → `{t('shared.alertList.urgentAlerts')}`
- `"一般预警"` → `{t('shared.alertList.warningAlerts')}`
- `"高优先级"` → `{t('shared.alertList.priority.high')}`
- `"中优先级"` → `{t('shared.alertList.priority.medium')}`
- `"低优先级"` → `{t('shared.alertList.priority.low')}`
- `"🤖 AI 建议"` → `{t('shared.alertList.aiSuggestion')}`
- `"忽略"` → `{t('shared.alertList.ignore')}`
- `"处理"` → `{t('shared.alertList.handle')}`
- `"立即处理"` → `{t('shared.alertList.handleImmediately')}`
- `"查看详情"` → `{t('shared.alertList.viewDetails')}`
- `"预警统计"` → `{t('shared.alertList.alertStats')}`
- `"紧急"` → `{t('shared.alertList.statsCategories.urgent')}`
- `"一般"` → `{t('shared.alertList.statsCategories.warning')}`
- `"提醒"` → `{t('shared.alertList.statsCategories.info')}`
- `"已解决"` → `{t('shared.alertList.statsCategories.resolved')}`
- `"暂无AI智能告警"` → `{t('shared.alertList.noAiAlerts')}`
- `"暂无紧急预警"` → `{t('shared.alertList.noUrgentAlerts')}`
- `"暂无一般预警"` → `{t('shared.alertList.noWarningAlerts')}`
- `"共 {count} 条预警"` → `{t('shared.alertList.totalAlerts', { count: totalActiveAlerts + aiAlerts.length })}`
- `"加载告警数据中..."` → `{t('shared.alertList.loadingAlerts')}`
- `"告警已忽略"` → `{t('shared.alertList.ignoreSuccess')}`
- `"告警已处理"` → `{t('shared.alertList.handleSuccess')}`

#### 4. WHScanOperationScreen.tsx
**Translation namespace:** `shared.scanOperation`

Key replacements:
- `"扫码入库"` → `{t('shared.scanOperation.inbound.title')}`
- `"入库"` → `{t('shared.scanOperation.inbound.action')}`
- `"扫码出库"` → `{t('shared.scanOperation.outbound.title')}`
- `"出库"` → `{t('shared.scanOperation.outbound.action')}`
- `"将二维码/条码放入框内"` → `{t('shared.scanOperation.scanHint')}`
- `"扫码中..."` → `{t('shared.scanOperation.scanning')}`
- `"已扫描"` → `{t('shared.scanOperation.scanned')}`
- `"最近扫描"` → `{t('shared.scanOperation.lastScan')}`
- `"暂无扫描记录"` → `{t('shared.scanOperation.noRecord')}`
- `"点击扫码"` → `{t('shared.scanOperation.clickToScan')}`
- `"手动输入"` → `{t('shared.scanOperation.manualInput')}`
- `"扫码成功"` → `{t('shared.scanOperation.scanSuccess')}`
- `"批次号:"` → `{t('shared.scanOperation.batchNumber', { number: mockCode })}`
- `"继续扫码"` → `{t('shared.scanOperation.continueScanning')}`
- `"请输入批次号"` → `{t('shared.scanOperation.inputPrompt')}`
- `"取消"` → `{t('shared.scanOperation.inputCancel')}`
- `"确定"` → `{t('shared.scanOperation.inputConfirm')}`
- `"扫码说明"` → `{t('shared.scanOperation.tips.title')}`
- `"支持二维码、条形码扫描"` → `{t('shared.scanOperation.tips.qrAndBarcode')}`

#### 5. WHRecallManageScreen.tsx
**Translation namespace:** `shared.recall`

Key replacements:
- `"召回管理"` → `{t('shared.recall.title')}`
- `"产品召回追溯"` → `{t('shared.recall.subtitle')}`
- `"进行中(1)"` → `{t('shared.recall.tabs.active', { count: 1 })}`
- `"已完成(3)"` → `{t('shared.recall.tabs.completed', { count: 3 })}`
- `"新建召回"` → `{t('shared.recall.tabs.create')}`
- `"紧急"` → `{t('shared.recall.level.urgent')}`
- `"一般"` → `{t('shared.recall.level.normal')}`
- `"执行中"` → `{t('shared.recall.status.processing')}`
- `"已完成"` → `{t('shared.recall.status.completed')}`
- `"召回原因"` → `{t('shared.recall.recallReason')}`
- `"涉及批次"` → `{t('shared.recall.affectedBatch')}`
- `"涉及数量"` → `{t('shared.recall.affectedQuantity')}`
- `"发起时间"` → `{t('shared.recall.startTime')}`
- `"完成时间"` → `{t('shared.recall.completeTime')}`
- `"追溯范围"` → `{t('shared.recall.traceScope')}`
- `"库存在库"` → `{t('shared.recall.inventory')}`
- `"已出货"` → `{t('shared.recall.shipped')}`
- `"已消耗"` → `{t('shared.recall.consumed')}`
- `"已冻结"` → `{t('shared.recall.frozen')}`
- `"通知中"` → `{t('shared.recall.notifying')}`
- `"处理进度"` → `{t('shared.recall.processingProgress')}`
- `"查看详情"` → `{t('shared.recall.viewDetails')}`
- `"继续处理"` → `{t('shared.recall.continueProcess')}`
- `"召回流程"` → `{t('shared.recall.recallFlow')}`
- `"冻结库存"` → `{t('shared.recall.flowSteps.freezeInventory.title')}`
- `"通知客户"` → `{t('shared.recall.flowSteps.notifyCustomers.title')}`
- `"回收产品"` → `{t('shared.recall.flowSteps.recoverProducts.title')}`
- `"处置记录"` → `{t('shared.recall.flowSteps.dispose.title')}`
- `"原因分析"` → `{t('shared.recall.flowSteps.rootCause.title')}`
- `"关闭召回"` → `{t('shared.recall.flowSteps.closeRecall.title')}`
- `"历史召回记录"` → `{t('shared.recall.historyRecords')}`
- `"发起新召回"` → `{t('shared.recall.createNew')}`

#### 6. WHBatchTraceScreen.tsx
**Translation namespace:** `shared.batchTrace`

Key replacements:
- `"批次追溯"` → `{t('shared.batchTrace.title')}`
- `"初始"` → `{t('shared.batchTrace.initial')}`
- `"当前"` → `{t('shared.batchTrace.current')}`
- `"完整追溯链"` → `{t('shared.batchTrace.completeTraceChain')}`
- `"原料来源"` → `{t('shared.batchTrace.nodes.source')}`
- `"入库验收"` → `{t('shared.batchTrace.nodes.inbound')}`
- `"仓储管理"` → `{t('shared.batchTrace.nodes.storage')}`
- `"出库记录"` → `{t('shared.batchTrace.nodes.outbound')}`
- `"当前状态"` → `{t('shared.batchTrace.nodes.current')}`
- `"供应商"` → `{t('shared.batchTrace.supplier')}`
- `"捕捞日期"` → `{t('shared.batchTrace.catchDate')}`
- `"捕捞区域"` → `{t('shared.batchTrace.catchArea')}`
- `"检验报告"` → `{t('shared.batchTrace.inspectionReport')}`
- `"查看报告 >"` → `{t('shared.batchTrace.viewReport')}`
- `"入库时间"` → `{t('shared.batchTrace.inboundTime')}`
- `"入库数量"` → `{t('shared.batchTrace.inboundQty')}`
- `"质检员"` → `{t('shared.batchTrace.inspector')}`
- `"质量等级"` → `{t('shared.batchTrace.qualityGrade')}`
- `"库位"` → `{t('shared.batchTrace.location')}`
- `"储存温度"` → `{t('shared.batchTrace.storageTemp')}`
- `"符合要求"` → `{t('shared.batchTrace.meetsRequirement')}`
- `"温控记录"` → `{t('shared.batchTrace.tempRecords')}`
- `"查看记录 >"` → `{t('shared.batchTrace.viewRecords')}`
- `"存储天数"` → `{t('shared.batchTrace.storageDays')}`
- `"订单"` → `{t('shared.batchTrace.order')}`
- `"生产批次"` → `{t('shared.batchTrace.productionBatch')}`
- `"客户"` → `{t('shared.batchTrace.customer')}`
- `"出库时间"` → `{t('shared.batchTrace.outboundTime')}`
- `"产品"` → `{t('shared.batchTrace.product')}`
- `"消耗时间"` → `{t('shared.batchTrace.consumptionTime')}`
- `"剩余数量"` → `{t('shared.batchTrace.remainingQty')}`
- `"到期时间"` → `{t('shared.batchTrace.expiryTime')}`
- `"导出报告"` → `{t('shared.batchTrace.exportReport')}`
- `"发起召回"` → `{t('shared.batchTrace.initiateRecall')}`
- `"确定要发起召回吗?"` → `{t('shared.batchTrace.confirmRecall')}`
- `"追溯报告已导出"` → `{t('shared.batchTrace.reportExported')}`

### Profile Screens

#### 7-9. WHSettingsScreen, WHOperationLogScreen, WHProfileEditScreen
These screens already have most translations defined in the existing `warehouse.json` under:
- `profile.settings`
- `profile.operationLog`
- `profile.profileEdit`

Verify and use existing keys.

### Inventory Screens

#### 10-18. Inventory screens
These screens already have most translations defined in the existing `warehouse.json` under:
- `tempMonitor`
- `locationManage`
- `inventoryTransfer`
- `inventoryDetail`
- `ioStatistics`
- `expireHandle`
- `inventoryCheck`
- `batchDetail`

Verify and use existing keys.

### Inbound Screens

#### 19-22. Inbound screens
These screens already have most translations defined in the existing `warehouse.json` under:
- `inbound.detail`
- `inbound.list`
- `inbound.putaway`
- `inbound.inspect`

Verify and use existing keys.

### Outbound Screens

#### 23-28. Outbound screens
These screens already have most translations defined in the existing `warehouse.json` under:
- `outbound.shipping`
- `outbound.detail`
- `outbound.tracking`
- `outbound.loading`
- `outbound.packing`

Verify and use existing keys.

## Testing

After migration, test each screen:
1. Run the app
2. Navigate to the migrated screen
3. Switch language between Chinese and English
4. Verify all strings display correctly
5. Check that dynamic values (like counts, dates) display properly

## Troubleshooting

### Missing translations
If you see a translation key instead of text:
1. Check the key path matches the JSON structure
2. Verify the namespace is 'warehouse'
3. Ensure the translation file was properly merged

### Wrong namespace
If translations don't load:
- Verify you're using `useTranslation('warehouse')` not `useTranslation()`

### Dynamic values not showing
For interpolated values like `t('key', { value: x })`:
- Ensure the JSON has `{{value}}` placeholder
- Pass the correct variable name in the options object

## Summary

- 27 files to migrate
- 6 shared screens with new translation keys
- 21 screens with existing translation keys
- Use namespace 'warehouse' for all
- Test language switching after migration
