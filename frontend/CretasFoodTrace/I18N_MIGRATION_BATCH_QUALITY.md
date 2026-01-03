# I18N Migration Guide - Batch & Quality Inspector Screens

## Overview
This document provides the complete migration plan for internationalizing 10 screens:
- 5 workshop-supervisor batch screens
- 5 quality-inspector screens

## Status
- ✅ Translation files updated (workshop.json, quality.json - both zh-CN and en-US)
- ⏳ Screen files migration (to be completed)

---

## Workshop Supervisor Screens (5 files)

### 1. BatchDetailScreen.tsx
**Path**: `src/screens/workshop-supervisor/batches/BatchDetailScreen.tsx`

**Changes Required**:
```typescript
// Add at top
import { useTranslation } from 'react-i18n';

// In component
const { t } = useTranslation('workshop');

// Replace all hardcoded Chinese strings:
"批次详情" → {t('batchDetail.title')}
"进行中" → {t('batchDetail.status.inProgress')}
"当前工艺环节" → {t('batchDetail.currentStage')}
"工艺流程" → {t('batchDetail.processFlow')}
"参与人员" → {t('batchDetail.participants')}
"使用设备" → {t('batchDetail.equipment')}
"解冻" → {t('batchDetail.stages.defrost')}
"清洗" → {t('batchDetail.stages.clean')}
"切片" → {t('batchDetail.stages.slice')}
"包装" → {t('batchDetail.stages.package')}
"入库" → {t('batchDetail.stages.warehouse')}
"进行中 - 预计15分钟完成" → {t('batchDetail.stageDuration.estimated', { minutes: 15 })}
"开始" → {t('batchDetail.time.start')}
"预计" → {t('batchDetail.time.estimated')}
"运行中" → {t('batchDetail.equipmentStatus.running')}
"录入数据" → {t('batchDetail.actions.enterData')}
"完成批次" → {t('batchDetail.actions.completeBatch')}
```

### 2. BatchStageScreen.tsx
**Path**: `src/screens/workshop-supervisor/batches/BatchStageScreen.tsx`

**Changes Required**:
```typescript
// Add at top
import { useTranslation } from 'react-i18next';

// In component
const { t } = useTranslation('workshop');

// Replace strings:
"{stageName || '切片'} - 数据录入" → {t('batchStage.title', { stageName: stageName || t('batchDetail.stages.slice') })}
"提交" → {t('batchStage.submit')}
"自动采集数据 (只读)" → {t('batchStage.autoData.title')}
"时长" → {t('batchStage.autoData.duration')}
"环境温度" → {t('batchStage.autoData.envTemp')}
"投入重量" → {t('batchStage.autoData.inputWeight')}
"产出重量" → {t('batchStage.autoData.outputWeight')}
"数据来源" → {t('batchStage.autoData.dataSource')}
"更新于" → {t('batchStage.autoData.updatedAt')}
"AI辅助识别 (请确认/修正)" → {t('batchStage.aiData.title')}
"产品计数 (AI识别)" → {t('batchStage.aiData.productCount')}
"置信度" → {t('batchStage.aiData.confidence')}
"确认不合格数" → {t('batchStage.aiData.confirmedDefects')}
"查看AI标记图片" → {t('batchStage.aiData.viewDefects')}
"件" → {t('batchStage.aiData.unit.pieces')}
"手动录入数据" → {t('batchStage.manualData.title')}
"返工数量 (件)" → {t('batchStage.manualData.reworkCount')}
"切片厚度标准差 (mm)" → {t('batchStage.manualData.thicknessStd')}
"实际参与人数" → {t('batchStage.manualData.actualWorkers')}
"备注与问题汇报" → {t('batchStage.notes.title')}
"输入备注或问题..." → {t('batchStage.notes.placeholder')}
"AI对比分析" → {t('batchStage.comparison.title')}
"当前损耗率" → {t('batchStage.comparison.lossRate')}
"当前合格率" → {t('batchStage.comparison.passRate')}
"行业均值" → {t('batchStage.comparison.industryAvg')}
"保存数据" → {t('batchStage.actions.save')}
"提交成功" → {t('batchStage.alerts.submitSuccess')}
"工艺环节数据已保存" → {t('batchStage.alerts.dataSaved')}
```

### 3. BatchCompleteScreen.tsx
**Path**: `src/screens/workshop-supervisor/batches/BatchCompleteScreen.tsx`

**Changes Required**:
```typescript
// Add at top
import { useTranslation } from 'react-i18next';

// In component
const { t } = useTranslation('workshop');

// Replace strings:
"完成批次" → {t('batchComplete.title')}
"批次生产完成" → {t('batchComplete.summary.title')}
"生产数据汇总" → {t('batchComplete.summary.productionData')}
"目标产量" → {t('batchComplete.data.targetQuantity')}
"实际产量" → {t('batchComplete.data.actualQuantity')}
"合格数量" → {t('batchComplete.data.qualifiedQuantity')}
"合格率" → {t('batchComplete.data.qualityRate')}
"总耗时" → {t('batchComplete.data.totalTime')}
"参与人数" → {t('batchComplete.data.workers')}
"人" → {t('batchComplete.data.people')}
"完成确认" → {t('batchComplete.checklist.title')}
"质检已完成" → {t('batchComplete.checklist.qualityCheck')}
"数据已录入完整" → {t('batchComplete.checklist.dataComplete')}
"设备已复位清洁" → {t('batchComplete.checklist.equipmentReset')}
"确认完成批次" → {t('batchComplete.actions.confirm')}
// Alert messages
Alert.alert(
  t('batchComplete.alerts.confirmTitle'),
  t('batchComplete.alerts.confirmMessage', { batchNumber: batch.batchNumber }),
  ...
)
Alert.alert(t('batchComplete.alerts.successTitle'), t('batchComplete.alerts.successMessage'), ...)
```

### 4. MaterialConsumptionScreen.tsx
**Path**: `src/screens/workshop-supervisor/batches/MaterialConsumptionScreen.tsx`

**Changes Required**:
```typescript
// Add at top
import { useTranslation } from 'react-i18next';

// In component
const { t } = useTranslation('workshop');

// Replace strings:
"原料消耗" → {t('materialConsumption.title')}
"消耗批次" → {t('materialConsumption.stats.batches')}
"计划总量" → {t('materialConsumption.stats.plannedTotal')}
"实际用量" → {t('materialConsumption.stats.actualUsage')}
"消耗记录" → {t('materialConsumption.list.title')}
"已消耗" → {t('materialConsumption.record.status.consumed')}
"待消耗" → {t('materialConsumption.record.status.pending')}
"计划用量" → {t('materialConsumption.record.plannedQuantity')}
"实际用量" → {t('materialConsumption.record.actualQuantity')}
"偏差" → {t('materialConsumption.record.variance')}
"添加消耗记录" → {t('materialConsumption.actions.add')}
```

### 5. BatchStartScreen.tsx
**Path**: `src/screens/workshop-supervisor/batches/BatchStartScreen.tsx`

**Changes Required**:
```typescript
// Add at top
import { useTranslation } from 'react-i18next';

// In component
const { t } = useTranslation('workshop');

// Replace strings:
"创建批次" → {t('batchStart.title')}
"选择产品 *" → {t('batchStart.selectProduct')}
"目标产量 (kg) *" → {t('batchStart.targetQuantity')}
"备注 (可选)" → {t('batchStart.notes')}
"请输入目标产量" → {t('batchStart.placeholder.targetQuantity')}
"输入备注信息..." → {t('batchStart.placeholder.notes')}
"提示" → {t('batchStart.info.title')}
"创建批次后，系统将自动分配工位、设备和人员。请在任务开始前完成任务引导流程。" → {t('batchStart.info.message')}
"取消" → {t('batchStart.actions.cancel')}
"创建批次" → {t('batchStart.actions.create')}
// Alert messages
Alert.alert(t('batchStart.alerts.selectProduct'))
Alert.alert(t('batchStart.alerts.enterQuantity'))
Alert.alert(
  t('batchStart.alerts.confirmCreate'),
  t('batchStart.alerts.confirmMessage', { product: selectedProduct, quantity: targetQuantity }),
  ...
)
```

---

## Quality Inspector Screens (5 files)

### Quality JSON Updates Needed

**zh-CN/quality.json** - Add these sections:
```json
{
  "batchSelect": {
    "processingBatch": "加工批次",
    "processingDesc": "生产线加工完成的产品批次",
    "materialBatch": "原材料批次",
    "materialDesc": "入库原材料的质量检验",
    "finishedBatch": "成品批次",
    "finishedDesc": "待出货的成品检验",
    "returnBatch": "退货批次",
    "returnDesc": "退回产品的质量复检",
    "selectTypeHint": "选择批次类型后，系统将显示对应类型的待检批次列表"
  }
}
```

**en-US/quality.json** - Add these sections:
```json
{
  "batchSelect": {
    "processingBatch": "Processing Batch",
    "processingDesc": "Products from production line processing",
    "materialBatch": "Material Batch",
    "materialDesc": "Quality inspection of incoming materials",
    "finishedBatch": "Finished Batch",
    "finishedDesc": "Inspection of products ready for shipment",
    "returnBatch": "Return Batch",
    "returnDesc": "Quality re-inspection of returned products",
    "selectTypeHint": "After selecting batch type, the system will display the corresponding pending batch list"
  }
}
```

### 6. QIResultScreen.tsx
**Path**: `src/screens/quality-inspector/QIResultScreen.tsx`

**Changes Required**:
```typescript
// Add at top
import { useTranslation } from 'react-i18next';

// In component
const { t } = useTranslation('quality');

// Replace strings (these already exist in quality.json):
"检验通过" → {t('result.inspectionPassed')}
"检验未通过" → {t('result.inspectionFailed')}
"该批次产品符合质量标准，可以进入下一环节" → {t('result.passedDescription')}
"该批次产品存在质量问题，请按规定处理" → {t('result.failedDescription')}
"记录编号" → {t('result.recordNumber')}
"检验时间" → {t('result.inspectionTime')}
"检验结果" → {t('result.inspectionResult')}
"合格" → {t('result.qualified')}
"不合格" → {t('result.unqualified')}
"下一步" → {t('result.nextStep')}
"产品将进入包装/出货流程" → {t('result.productWillEnterPackaging')}
"需要处理" → {t('result.needsHandling')}
"请将不合格批次进行隔离标记" → {t('result.pleaseIsolateBatch')}
"查看检验详情" → {t('result.viewInspectionDetail')}
"返回首页" → {t('result.returnHome')}
"继续质检" → {t('result.continueInspection')}
```

### 7. QIBatchSelectScreen.tsx
**Path**: `src/screens/quality-inspector/QIBatchSelectScreen.tsx`

**Changes Required**:
```typescript
// Add at top
import { useTranslation } from 'react-i18next';

// In component
const { t } = useTranslation('quality');

// Update BATCH_TYPES array:
const BATCH_TYPES: BatchType[] = [
  {
    id: 'processing',
    name: t('batchSelect.processingBatch'),
    description: t('batchSelect.processingDesc'),
    icon: 'construct',
    color: '#2196F3',
  },
  {
    id: 'material',
    name: t('batchSelect.materialBatch'),
    description: t('batchSelect.materialDesc'),
    icon: 'cube',
    color: '#4CAF50',
  },
  {
    id: 'finished',
    name: t('batchSelect.finishedBatch'),
    description: t('batchSelect.finishedDesc'),
    icon: 'gift',
    color: '#9C27B0',
  },
  {
    id: 'return',
    name: t('batchSelect.returnBatch'),
    description: t('batchSelect.returnDesc'),
    icon: 'return-down-back',
    color: '#FF9800',
  },
];

// Replace strings:
"扫码开始检验" → {t('batchSelect.scanToStart')}
"扫描批次二维码快速定位" → {t('batchSelect.scanQrCode')}
"或选择批次类型" → {t('batchSelect.orSelectType')}
"选择批次类型后，系统将显示对应类型的待检批次列表" → {t('batchSelect.selectTypeHint')}
```

### 8. QIReportScreen.tsx
**Path**: `src/screens/quality-inspector/QIReportScreen.tsx`

**Changes Required**:
```typescript
// Add at top
import { useTranslation } from 'react-i18next';

// In component
const { t } = useTranslation('quality');

// Replace strings (these already exist in quality.json):
"报告类型" → {t('report.reportType')}
"日报" → {t('report.daily')}
"今日检验数据汇总" → {t('report.dailyDesc')}
"周报" → {t('report.weekly')}
"本周检验数据汇总" → {t('report.weeklyDesc')}
"月报" → {t('report.monthly')}
"本月检验数据汇总" → {t('report.monthlyDesc')}
"自定义" → {t('report.custom')}
"选择日期范围" → {t('report.customDesc')}
"导出格式" → {t('report.exportFormat')}
"PDF 文档" → {t('report.pdfDocument')}
"Excel 表格" → {t('report.excelSheet')}
"报告内容" → {t('report.reportContent')}
"检验概况统计" → {t('report.summary')}
"等级分布图表" → {t('report.gradeDistribution')}
"分类评分详情" → {t('report.categoryScores')}
"问题分析汇总" → {t('report.issueAnalysis')}
"趋势走势图" → {t('report.trendChart')}
"批次明细列表" → {t('report.batchList')}
"报告预览" → {t('report.preview')}
"格式" → {t('report.format')}
"生成报告" → {t('report.generate')}
"生成中..." → {t('report.generating')}
// Alert messages:
Alert.alert(t('common.alert'), t('report.selectAtLeastOne'))
Alert.alert(t('common.success'), t('report.generateSuccess'), ...)
```

### 9. QICameraScreen.tsx
**Path**: `src/screens/quality-inspector/QICameraScreen.tsx`

**Changes Required**:
```typescript
// Add at top
import { useTranslation } from 'react-i18next';

// In component
const { t } = useTranslation('quality');

// Replace strings:
"拍照质检" → {t('camera.title')}
"加载中..." → {t('camera.loading')}
"需要相机权限" → {t('camera.cameraPermission')}
"请授权相机权限以拍照记录" → {t('camera.grantPermission')}
"授权相机" → {t('camera.authorize')}
"已拍摄 {{count}} 张" → {t('camera.photoTaken', { count: photos.length })}
"完成" → {t('camera.done')}
"拍照失败" → {t('camera.captureFailed')}
Alert.alert(t('camera.captureFailed'), t('common.retryHint'))
```

### 10. QIHomeScreen.tsx
**Path**: `src/screens/quality-inspector/QIHomeScreen.tsx`

**Changes Required**:
```typescript
// Add at top
import { useTranslation } from 'react-i18next';

// In component
const { t } = useTranslation('quality');

// Replace strings (these already exist in quality.json):
"欢迎回来" → {t('home.welcomeBack')}
"质检员" → {t('home.qualityInspector')}
"下一个待检批次" → {t('home.nextPendingBatch')}
"暂无待检批次" → {t('home.noPendingBatch')}
"点击查看检验记录" → {t('home.clickToViewRecords')}
"开始质检" → {t('home.startInspection')}
"查看列表" → {t('home.viewList')}
"待检" → {t('home.pending')}
"进行中" → {t('home.inProgress')}
"已通过" → {t('home.passed')}
"未通过" → {t('home.failed')}
"今日合格率" → {t('home.todayPassRate')}
"平均检验时间" → {t('home.avgInspectionTime')}
"分钟/批" → {t('home.minutesPerBatch')}
"较昨日提升 {{percent}}%" → {t('home.improvedFromYesterday', { percent: 12 })}
"{{passed}}/{{total}} 批次通过" → {t('home.batchesPassed', { passed, total })}
"快捷操作" → {t('home.quickActions')}
"扫码质检" → {t('home.scanInspection')}
"语音质检" → {t('home.voiceInspection')}
"检验记录" → {t('home.inspectionRecords')}
"数据分析" → {t('home.dataAnalysis')}
"异常提醒" → {t('home.exceptionAlert')}
"今日有 {{count}} 批次未通过检验，请及时处理" → {t('home.batchesFailedToday', { count: statistics.today.failed })}
```

---

## Implementation Steps

1. **For each screen file**:
   - Add import: `import { useTranslation } from 'react-i18next';`
   - Add hook: `const { t } = useTranslation('workshop');` or `useTranslation('quality')`
   - Replace ALL Chinese strings with `t('key.path')`
   - Replace Alert.alert messages with translated strings
   - Test the screen in both languages

2. **Translation key naming convention**:
   - Use nested keys: `section.subsection.key`
   - Actions: `actions.buttonName`
   - Alerts: `alerts.alertType`
   - Status: `status.statusName`

3. **Testing checklist**:
   - [ ] All Chinese text replaced
   - [ ] All English translations provided
   - [ ] No hardcoded strings remain
   - [ ] Dynamic values use interpolation: `t('key', { variable })`
   - [ ] Language switching works correctly

---

## Quick Reference

### Common Patterns

```typescript
// Simple string
<Text>{t('key.path')}</Text>

// With interpolation
<Text>{t('key.path', { count: 5, name: 'Product' })}</Text>

// Alert messages
Alert.alert(
  t('alerts.title'),
  t('alerts.message', { param: value }),
  [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.confirm'), onPress: handleConfirm },
  ]
)

// Conditional translation
<Text>{passed ? t('status.passed') : t('status.failed')}</Text>
```

### Common Translation Keys (from common.json)
- `common.loading` - "加载中..." / "Loading..."
- `common.retry` - "重试" / "Retry"
- `common.cancel` - "取消" / "Cancel"
- `common.confirm` - "确认" / "Confirm"
- `common.save` - "保存" / "Save"

---

## Next Steps

Execute the migration for each file following the patterns above. After completion:
1. Test each screen individually
2. Verify language switching
3. Check for any remaining hardcoded strings
4. Run the app in both Chinese and English
