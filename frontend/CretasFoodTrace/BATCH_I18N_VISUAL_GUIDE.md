# Batch Module I18N Migration - Visual Guide

## File Structure Overview

```
frontend/CretasFoodTrace/
├── src/
│   ├── i18n/
│   │   └── locales/
│   │       ├── zh-CN/
│   │       │   └── workshop.json ← UPDATE THIS (ADD BATCH KEYS)
│   │       └── en-US/
│   │           └── workshop.json ← UPDATE THIS (ADD BATCH KEYS)
│   │
│   └── screens/workshop-supervisor/batches/
│       ├── WSBatchesScreen.tsx          ← MODIFY (15 strings)
│       ├── BatchDetailScreen.tsx        ← MODIFY (11 strings)
│       ├── BatchStageScreen.tsx         ← MODIFY (24 strings)
│       ├── BatchCompleteScreen.tsx      ← MODIFY (14 strings)
│       ├── BatchStartScreen.tsx         ← MODIFY (12 strings)
│       └── MaterialConsumptionScreen.tsx ← MODIFY (10 strings)
│
└── [Migration Docs]  ← YOU ARE HERE
    ├── BATCH_I18N_QUICKSTART.md          (Start here!)
    ├── BATCH_I18N_SUMMARY.md             (Overview)
    ├── BATCH_I18N_MIGRATION_INSTRUCTIONS.md
    ├── batch-i18n-patches.txt            (Detailed changes)
    ├── batch-translations-zh-CN.json     (Copy to workshop.json)
    └── batch-translations-en-US.json     (Copy to workshop.json)
```

## Translation Key Structure

```
workshop.json
└── batches
    ├── title, searchPlaceholder          (Common)
    ├── filters {all, inProgress...}      (Tabs)
    ├── stats {inProgress, pending...}    (Counters)
    ├── status {urgent, pending...}       (Badges)
    ├── fields {product, target...}       (Labels)
    ├── progressInfo, estimated           (Display)
    │
    ├── detail                            ← BatchDetailScreen
    │   ├── title, inProgress
    │   ├── startTime, estimatedEndTime
    │   ├── currentStage, processFlow
    │   ├── participants, equipment
    │   └── enterData, completeBatch
    │
    ├── stage                             ← BatchStageScreen
    │   ├── title, submit
    │   ├── autoDataSection, aiDataSection
    │   ├── duration, envTemperature
    │   ├── inputWeight, outputWeight
    │   ├── productCount, confirmedDefects
    │   ├── currentLossRate, industryAverage
    │   ├── saveData, submitSuccess
    │   └── unit {pieces, kg, celsius, mm}
    │
    ├── complete                          ← BatchCompleteScreen
    │   ├── title, productionComplete
    │   ├── dataSection, confirmSection
    │   ├── targetQuantity, actualQuantity
    │   ├── qualityRate, totalTime
    │   ├── checkQuality, checkData
    │   └── confirmComplete, successMessage
    │
    ├── start                             ← BatchStartScreen
    │   ├── title, selectProduct
    │   ├── targetQuantity, notes
    │   ├── cancel, create
    │   └── confirmMessage, successMessage
    │
    └── materialConsumption               ← MaterialConsumptionScreen
        ├── title, recordsTitle
        ├── batchesConsumed, totalPlanned
        ├── consumed, pending
        ├── plannedQuantity, actualQuantity
        └── addRecord, selectMaterialHint
```

## Screen-by-Screen Visual Map

### 1. WSBatchesScreen (Batch List)

```
┌─────────────────────────────────┐
│ [批次管理]         [+]          │ ← t('batches.title')
├─────────────────────────────────┤
│ [🔍 搜索批次号...]              │ ← t('batches.searchPlaceholder')
├─────────────────────────────────┤
│ [全部] [进行中] [待开始] [已完成]│ ← t('batches.filters.*')
├─────────────────────────────────┤
│   3          4          4        │
│ 进行中     待开始     已完成     │ ← t('batches.stats.*')
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ PB-20251227-001  [[急]切片中]│ ← t('batches.status.urgent')
│ │ 产品: 带鱼片                 │ ← t('batches.fields.product')
│ │ 目标: 80kg  进度: 65%        │ ← t('batches.fields.target/progress')
│ │ ████████░░░░                 │
│ │ 52kg / 80kg  预计 11:30      │ ← t('batches.progressInfo/estimated')
│ └─────────────────────────────┘ │
│ ...                             │
└─────────────────────────────────┘
```

### 2. BatchDetailScreen

```
┌─────────────────────────────────┐
│ [←] 批次详情           [⋮]      │ ← t('batches.detail.title')
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ PB-20251227-001  [进行中]   │ ← t('batches.detail.inProgress')
│ │ 带鱼片                       │
│ │ ████████░░░░ 65%             │
│ │ 52kg / 80kg                  │
│ │ 开始: 08:30  预计: 11:30     │ ← t('batches.detail.startTime/estimatedEndTime')
│ └─────────────────────────────┘ │
│                                 │
│ 当前工艺环节                     │ ← t('batches.detail.currentStage')
│ ┌─────────────────────────────┐ │
│ │ [⚙️] 切片                   [>]│
│ │ 进行中 - 预计15分钟完成       │ ← t('batches.detail.stageInProgress')
│ └─────────────────────────────┘ │
│                                 │
│ 工艺流程                         │ ← t('batches.detail.processFlow')
│ 参与人员                         │ ← t('batches.detail.participants')
│ 使用设备    [运行中]            │ ← t('batches.detail.equipment/running')
├─────────────────────────────────┤
│ [录入数据]  [完成批次]          │ ← t('batches.detail.enterData/completeBatch')
└─────────────────────────────────┘
```

### 3. BatchStageScreen (Data Entry)

```
┌─────────────────────────────────┐
│ [←] 切片 - 数据录入      [提交] │ ← t('batches.stage.title/submit')
├─────────────────────────────────┤
│ [🤖] 自动采集数据 (只读)  [↻]   │ ← t('batches.stage.autoDataSection')
│ ┌─────────────────────────────┐ │
│ │ [🕐] 时长: 45分钟            │ ← t('batches.stage.duration')
│ │ [🌡️] 环境温度: 18°C          │ ← t('batches.stage.envTemperature')
│ │ [⚖️] 投入重量: 95.0 kg       │ ← t('batches.stage.inputWeight')
│ │ [⚖️] 产出重量: 52.0 kg       │ ← t('batches.stage.outputWeight')
│ │ 数据来源: 切片机A · 10:30:15 │ ← t('batches.stage.dataSource')
│ └─────────────────────────────┘ │
│                                 │
│ [🤖] AI辅助识别 (请确认/修正)   │ ← t('batches.stage.aiDataSection')
│ ┌─────────────────────────────┐ │
│ │ 产品计数 (AI识别)            │ ← t('batches.stage.productCount')
│ │ [48] 件                      │ ← t('batches.stage.unit.pieces')
│ │ 置信度: 92%                  │ ← t('batches.stage.confidence')
│ │                              │
│ │ 确认不合格数                 │ ← t('batches.stage.confirmedDefects')
│ │ [2] 件                       │
│ │ [查看AI标记图片 (3)]         │ ← t('batches.stage.viewDefectImages')
│ └─────────────────────────────┘ │
│                                 │
│ [✏️] 手动录入数据               │ ← t('batches.stage.manualDataSection')
│ 返工数量 (件)                   │ ← t('batches.stage.reworkCount')
│ 切片厚度标准差 (mm)             │ ← t('batches.stage.thicknessStd')
│ 实际参与人数                    │ ← t('batches.stage.actualWorkers')
│                                 │
│ [📝] 备注与问题汇报             │ ← t('batches.stage.notesSection')
│ [📊] AI对比分析                 │ ← t('batches.stage.comparisonSection')
│ 当前损耗率: 5.3%                │ ← t('batches.stage.currentLossRate')
│ 行业均值: 6.0% ✓                │ ← t('batches.stage.industryAverage')
├─────────────────────────────────┤
│      [✓ 保存数据]               │ ← t('batches.stage.saveData')
└─────────────────────────────────┘
```

### 4. BatchCompleteScreen

```
┌─────────────────────────────────┐
│ [←] 完成批次                    │ ← t('batches.complete.title')
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ [✅] 批次生产完成             │ ← t('batches.complete.productionComplete')
│ │ PB-20251227-001              │
│ │ 带鱼片                       │
│ └─────────────────────────────┘ │
│                                 │
│ 生产数据汇总                     │ ← t('batches.complete.dataSection')
│ ┌─────────────────────────────┐ │
│ │ 目标产量  实际产量            │ ← t('batches.complete.targetQuantity/actualQuantity')
│ │  80 kg     78 kg             │
│ │                              │
│ │ 合格数量   合格率             │ ← t('batches.complete.qualifiedQuantity/qualityRate')
│ │  76 kg    97.4%              │
│ │                              │
│ │ 总耗时    参与人数            │ ← t('batches.complete.totalTime/workers')
│ │ 3h 15min   3 人              │
│ └─────────────────────────────┘ │
│                                 │
│ 完成确认                         │ ← t('batches.complete.confirmSection')
│ ┌─────────────────────────────┐ │
│ │ [✓] 质检已完成               │ ← t('batches.complete.checkQuality')
│ │ [✓] 数据已录入完整           │ ← t('batches.complete.checkData')
│ │ [✓] 设备已复位清洁           │ ← t('batches.complete.checkEquipment')
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│    [✓ 确认完成批次]             │ ← t('batches.complete.confirmComplete')
└─────────────────────────────────┘
```

### 5. BatchStartScreen

```
┌─────────────────────────────────┐
│ [✕] 创建批次                    │ ← t('batches.start.title')
├─────────────────────────────────┤
│ 选择产品 *                       │ ← t('batches.start.selectProduct')
│ ┌───────────┐  ┌───────────┐   │
│ │ 带鱼片 ✓  │  │  鲈鱼片   │   │
│ └───────────┘  └───────────┘   │
│ ┌───────────┐  ┌───────────┐   │
│ │  黄鱼片   │  │ 银鲳鱼片  │   │
│ └───────────┘  └───────────┘   │
│                                 │
│ 目标产量 (kg) *                  │ ← t('batches.start.targetQuantity')
│ ┌─────────────────────────────┐ │
│ │ 请输入目标产量          kg   │ ← t('batches.start.targetPlaceholder')
│ └─────────────────────────────┘ │
│                                 │
│ 备注 (可选)                      │ ← t('batches.start.notes')
│ ┌─────────────────────────────┐ │
│ │ 输入备注信息...              │ ← t('batches.start.notesPlaceholder')
│ └─────────────────────────────┘ │
│                                 │
│ [ℹ️] 创建批次后，系统将自动...   │ ← t('batches.start.infoText')
├─────────────────────────────────┤
│  [取消]         [创建批次]      │ ← t('batches.start.cancel/create')
└─────────────────────────────────┘
```

### 6. MaterialConsumptionScreen

```
┌─────────────────────────────────┐
│ [←] 原料消耗                    │ ← t('batches.materialConsumption.title')
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ PB-20251227-001  [切片]     │
│ │ 带鱼段（冷冻）               │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │  2/3        300 kg  197.7kg │
│ │ 消耗批次    计划总量 实际用量 │ ← t('batches.materialConsumption.batchesConsumed/totalPlanned/totalActual')
│ └─────────────────────────────┘ │
│                                 │
│ 消耗记录                         │ ← t('batches.materialConsumption.recordsTitle')
│ ┌─────────────────────────────┐ │
│ │ 带鱼    MB-20251225-001      │
│ │         [已消耗]             │ ← t('batches.materialConsumption.consumed')
│ │                              │
│ │ 计划用量  实际用量  偏差      │ ← t('batches.materialConsumption.plannedQuantity/actualQuantity/variance')
│ │ 100 kg   98.5 kg   -1.5%    │
│ │                              │
│ │ [🕐] 2025-12-27 08:30        │
│ │ [👤] 王建国                  │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 带鱼    MB-20251226-003      │
│ │         [待消耗]             │ ← t('batches.materialConsumption.pending')
│ │ 100 kg    -       -          │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│   [+ 添加消耗记录]              │ ← t('batches.materialConsumption.addRecord')
└─────────────────────────────────┘
```

## Migration Flow Diagram

```
START
  │
  ├─► 1. Copy batch-translations-zh-CN.json
  │      content to workshop.json (zh-CN)
  │
  ├─► 2. Copy batch-translations-en-US.json
  │      content to workshop.json (en-US)
  │
  ├─► 3. For each TSX file:
  │      │
  │      ├─► Add import { useTranslation }
  │      │
  │      ├─► Add const { t } = useTranslation('workshop')
  │      │
  │      └─► Replace strings using batch-i18n-patches.txt
  │
  ├─► 4. Test in Chinese mode
  │
  ├─► 5. Switch to English mode
  │
  ├─► 6. Test in English mode
  │
  └─► 7. SUCCESS ✅
```

## Color-Coded Priority

🟢 **High Priority** (Must do first)
- JSON file updates
- Import statements
- useTranslation hooks

🟡 **Medium Priority** (Core strings)
- Screen titles
- Button labels
- Form fields

🔵 **Low Priority** (Polish)
- Helper text
- Placeholder text
- Info messages

## Quick Stats

| Metric | Count |
|--------|-------|
| **Files Modified** | 8 (6 TSX + 2 JSON) |
| **Translation Keys** | 76 |
| **String Replacements** | ~90 |
| **Estimated Time** | 18-25 minutes |
| **Complexity** | Medium |

## Success Indicators

✅ No red error text in console
✅ All Chinese text displays correctly
✅ All English text displays correctly
✅ Language switch works immediately
✅ No missing translation warnings
✅ App doesn't crash on any screen

---

**Remember**: Use `BATCH_I18N_QUICKSTART.md` for step-by-step instructions!
