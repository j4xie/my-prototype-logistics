# Miscellaneous Modules i18n Migration Guide

## Migration Status

### ✅ Completed
- attendance/AttendanceStatisticsScreen.tsx
- attendance/AttendanceHistoryScreen.tsx
- attendance/TimeStatsScreen.tsx

### 🔄 Remaining Files

## Translation Keys Summary

All translation keys have been organized by namespace. Add these to the respective translation files if not already present.

### Common Namespace (`common.json`)

```json
{
  "demo": {
    "formily": {
      "title": "Formily Dynamic Form Demo",
      "subtitle": "Verify React Native Paper Adapter Features",
      "features": {
        "title": "Features",
        "schemaDriven": "Schema Driven Rendering",
        "fieldLinkage": "Field Linkage",
        "realtimeValidation": "Realtime Validation",
        "conditionalDisplay": "Conditional Display",
        "aiAssistant": "AI Assistant"
      },
      "form": {
        "title": "Quality Check Form (qualityCheckSchema)",
        "aiEnabled": "AI Assistant enabled - Click button below"
      },
      "operations": {
        "title": "Form Operations",
        "validate": "Validate",
        "getValues": "Get Values",
        "fillExample": "Fill Example",
        "reset": "Reset"
      },
      "realtimeValues": "Realtime Form Values",
      "submitResult": "Submit Result",
      "aiFillResult": "AI Fill Result",
      "confidence": "Confidence",
      "aiGuide": {
        "title": "AI Form Assistant Guide",
        "step1": "1. Click the AI floating button in bottom-right corner",
        "step2": "2. Choose input method:",
        "textInput": "• Text Input: Describe content like \"Fish batch, temp -20°C, passed\"",
        "voiceInput": "• Voice Input: Hold to speak, release to send",
        "photoInput": "• Photo/Album: Take photo of quality check document, AI auto-fills",
        "step3": "3. AI will automatically parse and fill form fields",
        "step4": "4. Review filled results, manually correct if needed, then submit"
      },
      "linkageRules": {
        "title": "Linkage Rules",
        "rule1": "1. When \"Test Result\" is \"Failed\", \"Failure Reason\" field shows and becomes required",
        "rule2": "2. When \"Test Result\" changes to other values, \"Failure Reason\" auto-clears and hides",
        "rule3": "3. Temperature input supports range validation: -50°C ~ 100°C",
        "rule4": "4. Must check \"Inspector Confirm\" before submission"
      },
      "aiBanner": "AI Form Assistant enabled! Click floating button to use voice, text or photo to auto-fill form.",
      "aiAssistantOn": "AI Assistant ON",
      "aiAssistantOff": "AI Assistant OFF",
      "aiFillSuccess": "AI Fill Success",
      "aiFillFailed": "AI Fill Failed",
      "filledFields": "Filled {{count}} fields"
    }
  },
  "test": {
    "serverConnectivity": {
      "title": "Server Connectivity Test",
      "cardTitle": "Server Connection Test",
      "server": "Server",
      "networkStatus": {
        "online": "Online",
        "offline": "Offline",
        "unknown": "Unknown"
      },
      "progress": {
        "title": "Overall Progress",
        "completed": "{{completed}}/{{total}} ({{percentage}}%)"
      },
      "phase": "Phase {{number}}",
      "summary": {
        "title": "Test Summary",
        "passed": "Passed",
        "failed": "Failed",
        "skipped": "Skipped",
        "duration": "Duration"
      },
      "actions": {
        "runAllTests": "Run All Tests",
        "clearResults": "Clear Results"
      },
      "logs": {
        "title": "Test Logs",
        "empty": "No logs yet, click \"Run All Tests\" to start",
        "startTest": "Starting server connection test...",
        "serverUrl": "Server: {{url}}",
        "startIntegrity": "Starting data integrity test...",
        "testName": "Test: {{name}}",
        "passed": "{{name}} passed",
        "failed": "{{name}} failed: {{error}}",
        "skipped": "Skip data integrity test (authentication failed)",
        "completed": "Test completed!",
        "exception": "Test exception: {{error}}"
      },
      "phases": {
        "1": "Network & Health Check",
        "2": "Authentication",
        "3": "Basic APIs",
        "4": "Data Integrity"
      },
      "status": {
        "pending": "PENDING",
        "running": "RUNNING",
        "success": "SUCCESS",
        "failed": "FAILED"
      }
    },
    "pushNotification": {
      "title": "Push Notification Test"
    },
    "batchOperations": {
      "title": "Batch Operations Test"
    }
  },
  "traceability": {
    "public": {
      "title": "Public Traceability Query",
      "scanPrompt": "Scan Product QR Code",
      "inputBatchNumber": "Or Enter Batch Number",
      "batchNumberPlaceholder": "Enter batch number",
      "query": "Query",
      "batchInfo": "Batch Information",
      "productionDate": "Production Date",
      "expiryDate": "Expiry Date",
      "status": "Status",
      "traceInfo": "Traceability Information",
      "noData": "No traceability data found",
      "invalidBatchNumber": "Please enter valid batch number"
    },
    "detail": {
      "title": "Traceability Details",
      "batchNumber": "Batch Number",
      "productInfo": "Product Information",
      "productName": "Product Name",
      "productionDate": "Production Date",
      "expiryDate": "Expiry Date",
      "quantity": "Quantity",
      "materialTrace": "Material Traceability",
      "materialName": "Material Name",
      "supplier": "Supplier",
      "inboundDate": "Inbound Date",
      "qualityCheck": "Quality Check Records",
      "checkDate": "Check Date",
      "result": "Result",
      "inspector": "Inspector",
      "processing": "Processing Records",
      "stage": "Stage",
      "operator": "Operator",
      "completed": "Completed",
      "share": "Share",
      "export": "Export"
    },
    "screen": {
      "title": "Traceability",
      "scanToQuery": "Scan to Query",
      "recentQueries": "Recent Queries",
      "noHistory": "No query history"
    }
  },
  "notification": {
    "center": {
      "title": "Notification Center",
      "tabs": {
        "all": "All",
        "unread": "Unread",
        "system": "System",
        "production": "Production",
        "quality": "Quality"
      },
      "markAllRead": "Mark All Read",
      "noNotifications": "No notifications",
      "types": {
        "system": "System",
        "production": "Production",
        "quality": "Quality",
        "alert": "Alert",
        "approval": "Approval"
      },
      "actions": {
        "markRead": "Mark as Read",
        "delete": "Delete"
      },
      "timeAgo": {
        "justNow": "Just now",
        "minutesAgo": "{{count}} minutes ago",
        "hoursAgo": "{{count}} hours ago",
        "daysAgo": "{{count}} days ago"
      }
    }
  }
}
```

### Alerts Namespace (`alerts.json`)

Translation keys already exist - see existing alerts.json file.

### Profile Namespace (`profile.json`)

Translation keys already exist - see existing profile.json file.

For `FeedbackScreen.tsx` and `MembershipScreen.tsx`, use existing profile keys.

### HR Namespace (`hr.json`)

For work module files (`WorkTypeFormScreen.tsx`, `WorkTypeListScreen.tsx`):

```json
{
  "work": {
    "type": {
      "title": "Work Type Management",
      "list": {
        "title": "Work Types",
        "empty": "No work types",
        "search": "Search work types..."
      },
      "form": {
        "title": "Work Type Form",
        "createTitle": "Add Work Type",
        "editTitle": "Edit Work Type",
        "name": "Work Type Name",
        "namePlaceholder": "Enter work type name",
        "nameRequired": "Work type name is required",
        "description": "Description",
        "descriptionPlaceholder": "Enter description",
        "hourlyRate": "Hourly Rate",
        "hourlyRatePlaceholder": "Enter hourly rate",
        "category": "Category",
        "categoryPlaceholder": "Select category",
        "isActive": "Active",
        "cancel": "Cancel",
        "submit": "Submit",
        "create": "Create",
        "update": "Update"
      },
      "categories": {
        "production": "Production",
        "quality": "Quality Check",
        "warehouse": "Warehouse",
        "management": "Management",
        "other": "Other"
      },
      "actions": {
        "add": "Add Work Type",
        "edit": "Edit",
        "delete": "Delete",
        "view": "View Details"
      },
      "messages": {
        "createSuccess": "Work type created successfully",
        "createFailed": "Failed to create work type",
        "updateSuccess": "Work type updated successfully",
        "updateFailed": "Failed to update work type",
        "deleteSuccess": "Work type deleted successfully",
        "deleteFailed": "Failed to delete work type",
        "deleteConfirm": "Delete Work Type",
        "deleteConfirmMsg": "Are you sure you want to delete this work type?"
      }
    }
  }
}
```

### Warehouse Namespace (`warehouse.json`)

For legacy inventory screens, translation keys already exist in warehouse.json.

## Migration Steps for Each File

### 1. Add Import
```typescript
import { useTranslation } from 'react-i18n';
```

### 2. Add Hook
```typescript
const { t } = useTranslation('namespace'); // Replace 'namespace' with appropriate one
```

### 3. Replace Chinese Strings

Pattern:
```typescript
// Before
<Text>"中文字符串"</Text>
Alert.alert("标题", "消息")

// After
<Text>{t('key.path')}</Text>
Alert.alert(t('title.key'), t('message.key'))
```

## File-by-File Namespace Mapping

| File | Namespace | Notes |
|------|-----------|-------|
| ✅ attendance/AttendanceStatisticsScreen.tsx | hr | Completed |
| ✅ attendance/AttendanceHistoryScreen.tsx | hr | Completed |
| ✅ attendance/TimeStatsScreen.tsx | hr | Completed |
| demo/FormilyDemoScreen.tsx | common | Use `common.demo.formily` keys |
| test/ServerConnectivityTestScreen.tsx | common | Use `common.test.serverConnectivity` keys |
| test/PushNotificationTestScreen.tsx | common | Use `common.test.pushNotification` keys |
| test/BatchOperationsTestScreen.tsx | common | Use `common.test.batchOperations` keys |
| legacy/hr/HREmployeeAIScreen.tsx | hr | Use existing hr keys |
| legacy/hr/HRDashboardScreen.tsx | hr | Use existing hr keys |
| legacy/warehouse/InventoryStatisticsScreen.tsx | warehouse | Use existing warehouse keys |
| legacy/warehouse/InventoryCheckScreen.tsx | warehouse | Use existing warehouse keys |
| traceability/PublicTraceScreen.tsx | common | Use `common.traceability.public` keys |
| traceability/TraceabilityScreen.tsx | common | Use `common.traceability.screen` keys |
| traceability/TraceabilityDetailScreen.tsx | common | Use `common.traceability.detail` keys |
| alerts/CreateExceptionScreen.tsx | alerts | Use existing alerts keys |
| alerts/ExceptionAlertScreen.tsx | alerts | Use existing alerts keys |
| common/NotificationCenterScreen.tsx | common | Use `common.notification.center` keys |
| profile/FeedbackScreen.tsx | profile | Use `profile.feedback` keys |
| profile/MembershipScreen.tsx | profile | Use `profile.membership` keys (if exists) |
| profile/ProfileScreen.tsx | profile | Use existing profile keys |
| work/WorkTypeFormScreen.tsx | hr | Use `hr.work.type.form` keys |
| work/WorkTypeListScreen.tsx | hr | Use `hr.work.type.list` keys |

## Completion Checklist

- [x] AttendanceStatisticsScreen.tsx
- [x] AttendanceHistoryScreen.tsx
- [x] TimeStatsScreen.tsx
- [ ] FormilyDemoScreen.tsx
- [ ] ServerConnectivityTestScreen.tsx
- [ ] PushNotificationTestScreen.tsx
- [ ] BatchOperationsTestScreen.tsx
- [ ] HREmployeeAIScreen.tsx
- [ ] HRDashboardScreen.tsx
- [ ] InventoryStatisticsScreen.tsx
- [ ] InventoryCheckScreen.tsx
- [ ] PublicTraceScreen.tsx
- [ ] TraceabilityScreen.tsx
- [ ] TraceabilityDetailScreen.tsx
- [ ] CreateExceptionScreen.tsx
- [ ] ExceptionAlertScreen.tsx
- [ ] NotificationCenterScreen.tsx
- [ ] FeedbackScreen.tsx
- [ ] MembershipScreen.tsx
- [ ] ProfileScreen.tsx
- [ ] WorkTypeFormScreen.tsx
- [ ] WorkTypeListScreen.tsx

## Next Steps

1. Add the translation keys above to the appropriate JSON files in `/src/i18n/locales/zh-CN/` and `/src/i18n/locales/en-US/`
2. For each remaining file:
   - Add the import and hook as shown above
   - Replace all Chinese strings with t() calls using the keys from this guide
   - Test the screen to ensure translations work correctly

## Automated Migration Script

Consider creating a script to automate the string replacement:

```bash
# Example: Replace common patterns
find src/screens -name "*.tsx" -exec sed -i '' 's/"加载中..."/{t("common.status.loading")}/g' {} \;
```

## Notes

- All existing translation keys in hr.json, alerts.json, profile.json, and warehouse.json should be preserved
- New keys only need to be added for sections that don't exist yet
- Follow the existing translation structure and naming conventions
- Ensure both zh-CN and en-US files are updated simultaneously
