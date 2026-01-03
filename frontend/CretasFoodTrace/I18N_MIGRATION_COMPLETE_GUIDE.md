# Complete I18N Migration Guide

## Files Completed (2/19)

### Quality Inspector - Completed
1. ✅ QITrendScreen.tsx
2. ✅ QINotificationsScreen.tsx

### Quality Inspector - Remaining (12 files)
3. QIInspectListScreen.tsx
4. QIRecordDetailScreen.tsx
5. QIFormScreen.tsx
6. QIVoiceScreen.tsx
7. QIClockInScreen.tsx
8. QISettingsScreen.tsx
9. QIAnalysisScreen.tsx
10. QIResultScreen.tsx
11. QIBatchSelectScreen.tsx
12. QIReportScreen.tsx
13. QICameraScreen.tsx
14. QIHomeScreen.tsx (already done)

### Workshop Supervisor Batches - Remaining (5 files)
1. BatchDetailScreen.tsx
2. BatchStageScreen.tsx
3. BatchCompleteScreen.tsx
4. MaterialConsumptionScreen.tsx
5. BatchStartScreen.tsx

## Standard Migration Pattern

### Step 1: Add Import
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Add Hook (Quality Inspector)
```typescript
const { t } = useTranslation('quality');
```

### Step 3: Add Hook (Workshop Supervisor)
```typescript
const { t } = useTranslation('workshop');
```

### Step 4: Replace Chinese Strings

#### Common Patterns:
```typescript
// Loading
"加载中..." → t('common.status.loading')
"加载失败" → t('common.error.loadFailed')

// Buttons
"确认" → t('common.confirm')
"取消" → t('common.cancel')
"保存" → t('common.buttons.save')
"删除" → t('common.buttons.delete')
"提交" → t('common.buttons.submit')

// Alerts
Alert.alert('提示', ...) → Alert.alert(t('quality.alert'), ...)
Alert.alert('错误', ...) → Alert.alert(t('common.error.general'), ...)
Alert.alert('成功', ...) → Alert.alert(t('common.status.success'), ...)
```

#### Quality Inspector Specific:
```typescript
// Batches
"待检批次" → t('inspectList.pendingBatches')
"开始检验" → t('inspectList.startInspection')

// Records
"检验记录" → t('records.title')
"检验详情" → t('recordDetail.title')

// Form
"检验表单" → t('form.title')
"提交检验结果" → t('form.submitInspectionResult')

// Results
"检验通过" → t('result.inspectionPassed')
"检验未通过" → t('result.inspectionFailed')

// Settings
"质检设置" → t('settings.title')
"语音助手" → t('settings.voiceAssistant')
```

#### Workshop Supervisor Specific:
```typescript
// Batches
"批次管理" → t('batches.title')
"批次详情" → t('batches.detail')
"开始生产" → t('batches.startProduction')
"完成生产" → t('batches.completeProduction')

// Status
"待开始" → t('batches.status.pending')
"进行中" → t('batches.status.inProgress')
"已完成" → t('batches.status.completed')
```

## Quick Reference - Translation Keys

### Quality Inspector Keys (quality namespace)
- `home.*` - Home screen
- `form.*` - Inspection form
- `result.*` - Inspection result
- `records.*` - Records list
- `inspectList.*` - Pending batches
- `voice.*` - Voice inspection
- `clock.*` - Attendance
- `settings.*` - Settings
- `analysis.*` - Analysis
- `batchSelect.*` - Batch selection
- `report.*` - Reports
- `camera.*` - Camera/photos
- `scan.*` - QR scanning
- `trend.*` - Trend analysis
- `notifications.*` - Notifications
- `recordDetail.*` - Record details
- `profile.*` - Profile/Personal center
- `grades.*` - Grade labels (A/B/C/D)

### Workshop Supervisor Keys (workshop namespace)
- `home.*` - Home screen
- `batches.*` - Batch management
- `workers.*` - Worker management
- `equipment.*` - Equipment management
- `notifications.*` - Notifications
- `profile.*` - Profile
- `taskGuide.*` - Task guide
- `taskGuideDetail.*` - Task guide steps

### Common Keys (common namespace)
- `buttons.*` - All buttons
- `status.*` - Status messages
- `error.*` - Error messages
- `confirm.*` - Confirmation dialogs
- `time.*` - Time-related texts
- `units.*` - Units (kg, g, pieces, etc.)

## Migration Checklist for Each File

- [ ] Import `useTranslation` from 'react-i18next'
- [ ] Add `const { t } = useTranslation('namespace')` hook
- [ ] Replace all Chinese text strings with `t('key')`
- [ ] Replace Alert.alert titles with translations
- [ ] Replace console.error/log Chinese messages
- [ ] Test the screen in both zh-CN and en-US
- [ ] Check that no hardcoded Chinese strings remain

## Testing

After migration:
1. Switch language to English
2. Navigate through all screens
3. Trigger all actions (buttons, alerts, errors)
4. Verify no Chinese text appears in English mode
5. Switch back to Chinese and verify everything works

## Notes

- Use existing keys from JSON files whenever possible
- DO NOT create new translation keys unless absolutely necessary
- If a key is missing, add it to BOTH zh-CN and en-US files
- Keep translation keys semantic and hierarchical
- Use common namespace for shared strings across modules
