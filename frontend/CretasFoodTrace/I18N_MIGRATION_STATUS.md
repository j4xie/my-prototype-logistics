# I18N Migration Status - Quality Inspector & Workshop Supervisor Batches

## Overview
This document tracks the i18n migration for remaining Quality Inspector and Workshop Supervisor batch screens.

## Migration Pattern

### Quality Inspector Files (use `quality` namespace)
```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('quality');
```

### Workshop Supervisor Files (use `workshop` namespace)
```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('workshop');
```

## Completed Files

### Quality Inspector
- ✅ QITrendScreen.tsx - trend analysis
- ✅ QINotificationsScreen.tsx - notifications list (PARTIAL - needs missing keys added)
- ✅ QIScanScreen.tsx (already migrated)
- ✅ QIProfileScreen.tsx (already migrated)
- ✅ QIRecordsScreen.tsx (already migrated)
- ✅ QIHomeScreen.tsx (already migrated)

## Pending Files

### Quality Inspector (8 files remaining)
1. QIInspectListScreen.tsx - inspect list (use keys from `inspectList`)
2. QIRecordDetailScreen.tsx - record detail (use keys from `recordDetail`)
3. QIFormScreen.tsx - inspection form (use keys from `form`)
4. QIVoiceScreen.tsx - voice inspection (use keys from `voice`)
5. QIClockInScreen.tsx - attendance clock (use keys from `clock`)
6. QISettingsScreen.tsx - settings (use keys from `settings`)
7. QIAnalysisScreen.tsx - analysis (use keys from `analysis`)
8. QIResultScreen.tsx - result (use keys from `result`)
9. QIBatchSelectScreen.tsx - batch select (use keys from `batchSelect`)
10. QIReportScreen.tsx - report (use keys from `report`)
11. QICameraScreen.tsx - camera (use keys from `camera`)

### Workshop Supervisor Batches (5 files)
1. BatchDetailScreen.tsx - batch detail (use keys from `batches`)
2. BatchStageScreen.tsx - batch stage (use keys from `batches`)
3. BatchCompleteScreen.tsx - batch complete (use keys from `batches`)
4. MaterialConsumptionScreen.tsx - material consumption (use keys from `batches`)
5. BatchStartScreen.tsx - batch start (use keys from `batches`)

## Missing Translation Keys

The following keys need to be added to translation files:

### zh-CN/quality.json
```json
{
  "trend": {
    "inspectionCount": "检验数量",
    "gradeTrend": "等级趋势",
    "maxValue": "最高值",
    "minValue": "最低值",
    "avgValue": "平均值",
    "trendAnalysis": "趋势分析",
    "passRateInsight": "合格率整体保持稳定，建议关注波动较大的时段，分析可能的影响因素。",
    "avgScoreInsight": "平均分呈现平稳趋势，各检验项目得分均衡，持续保持当前标准。",
    "countInsight": "检验数量与生产计划匹配，建议合理安排检验人员排班。"
  },
  "notifications": {
    "all": "全部",
    "unread": "未读",
    "urgent": "紧急",
    "confirmMarkAll": "确定将所有通知标为已读吗？",
    "deleteNotification": "删除通知",
    "confirmDelete": "确定删除这条通知吗？",
    "delete": "删除",
    "noUnread": "没有未读通知",
    "noUrgent": "没有紧急通知",
    "emptyList": "通知列表为空"
  }
}
```

### en-US/quality.json
```json
{
  "trend": {
    "inspectionCount": "Inspection Count",
    "gradeTrend": "Grade Trend",
    "maxValue": "Max",
    "minValue": "Min",
    "avgValue": "Avg",
    "trendAnalysis": "Trend Analysis",
    "passRateInsight": "Pass rate remains stable overall. Monitor periods with significant fluctuations and analyze potential factors.",
    "avgScoreInsight": "Average score shows steady trend. Scores across inspection items are balanced. Continue maintaining current standards.",
    "countInsight": "Inspection volume matches production plan. Schedule inspection personnel shifts appropriately."
  },
  "notifications": {
    "all": "All",
    "unread": "Unread",
    "urgent": "Urgent",
    "confirmMarkAll": "Mark all notifications as read?",
    "deleteNotification": "Delete Notification",
    "confirmDelete": "Are you sure you want to delete this notification?",
    "delete": "Delete",
    "noUnread": "No unread notifications",
    "noUrgent": "No urgent notifications",
    "emptyList": "Notification list is empty"
  }
}
```

### common.json (add to existing)
```json
{
  "cancel": "取消",
  "confirm": "确认"
}
```

## Next Steps

1. Add missing translation keys to JSON files
2. Migrate remaining 11 Quality Inspector files
3. Migrate 5 Workshop Supervisor batch files
4. Test all migrated screens
5. Verify language switching works correctly
