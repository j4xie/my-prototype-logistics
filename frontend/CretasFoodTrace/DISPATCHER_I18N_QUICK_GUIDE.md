# Dispatcher i18n Migration - Quick Reference Guide

## 🚀 Quick Start (3 Steps)

### 1️⃣ Add Imports & Hook
```typescript
// At top of file
import { useTranslation } from 'react-i18next';

// In component
export function MyScreen() {
  const { t } = useTranslation('dispatcher');
  // ... rest of code
}
```

### 2️⃣ Find & Replace Patterns

Use your editor's find/replace with these common patterns:

| Chinese Text | Translation Key |
|-------------|----------------|
| `计划详情` | `t('planDetail.title')` |
| `生产计划` | `t('planList.title')` |
| `确定` | `t('common.confirm')` |
| `取消` | `t('common.cancel')` |
| `加载中...` | `t('common.loading')` |
| `成功` | `t('common.success')` |
| `失败` | `t('common.failed')` |
| `保存` | `t('common.save')` |
| `编辑` | `t('common.edit')` |
| `删除` | `t('common.delete')` |

### 3️⃣ Test
```bash
# Start app
npm start

# Toggle language in app settings
# Verify all screens display correctly in both languages
```

---

## 📋 File-by-File Checklist

### For Each Screen:

1. **Open the file**
2. **Check if already migrated** (search for `useTranslation`)
3. **Add import and hook** (see step 1 above)
4. **Find all Chinese text:**
   ```bash
   # Use regex in VSCode: [\u4e00-\u9fa5]+
   # This highlights all Chinese characters
   ```
5. **Replace with appropriate `t()` calls**
6. **Save file**
7. **Test the screen**
8. **Mark as complete** in `DISPATCHER_I18N_MIGRATION_STATUS.md`

---

##  Common Replacements by Screen Type

### Plan Screens (PlanList, PlanDetail, etc.)

```typescript
// Headers
'生产计划' → t('planList.title')
'计划详情' → t('planDetail.title')
'新建计划' → t('planList.create')

// Status
'待开始' → t('planList.status.pending')
'进行中' → t('planList.status.inProgress')
'已完成' → t('planList.status.completed')

// Actions
'创建计划' → t('planCreate.submit.create')
'暂停计划' → t('planDetail.actions.pause')
'完成计划' → t('planDetail.actions.complete')

// Fields
'计划编号' → t('planDetail.fields.planNumber')
'产品' → t('planDetail.fields.product')
'数量' → t('planDetail.fields.quantity')
'车间' → t('planDetail.fields.workshop')
```

### AI Screens

```typescript
// Titles
'AI 智能排产' → t('ai.schedule.title')
'完成概率分析' → t('ai.completionProb.title')
'人员优化' → t('ai.workerOptimize.title')

// Actions
'AI 分析' → t('ai.schedule.start.selectBatches')
'重新分析' → t('ai.schedule.result.actions.reanalyze')
'应用排产方案' → t('ai.schedule.result.actions.apply')
```

### Personnel Screens

```typescript
// Titles
'人员管理' → t('personnel.list.title')
'人员详情' → t('personnel.detail.title')
'人员调动' → t('personnel.transfer.title')

// Fields
'考勤记录' → t('personnel.attendance.title')
'排班管理' → t('personnel.schedule.title')
```

### Workshop Status

```typescript
// Titles
'车间状态详情' → t('workshop.status.title')

// Filters
'全部' → t('workshop.status.filters.all')
'切片' → t('workshop.status.filters.slicing')
'包装' → t('workshop.status.filters.packaging')

// Status
'运行中' → t('workshop.status.statusLabels.running')
'空闲' → t('workshop.status.statusLabels.idle')
'维护中' → t('workshop.status.statusLabels.maintenance')

// Sections
'负责人' → t('workshop.status.sections.supervisor')
'今日任务' → t('workshop.status.sections.todayTasks')
'设备状态' → t('workshop.status.sections.equipmentStatus')
```

---

## 🔍 Finding the Right Translation Key

### Method 1: Browse Translation File
Open `src/i18n/locales/zh-CN/dispatcher.json` and search for your Chinese text.

### Method 2: Key Naming Convention
```
namespace.screen.category.specificKey

Examples:
dispatcher.planList.title
dispatcher.planDetail.fields.planNumber
dispatcher.ai.schedule.result.actions.apply
dispatcher.common.confirm
```

### Method 3: Context Clues
```typescript
// If you see "生产计划" in PlanList screen
// Likely key: planList.title or planList.* something

// If you see status text like "进行中"
// Look under: planList.status.* or planDetail.status.*

// If you see common actions like "确定"
// Use: common.* keys
```

---

## ⚠️ Common Pitfalls

### ❌ Wrong: Hardcoded Chinese
```typescript
<Text>生产计划</Text>
```

### ✅ Correct: Use Translation
```typescript
<Text>{t('planList.title')}</Text>
```

---

### ❌ Wrong: Missing Interpolation
```typescript
<Text>共 {count} 个任务</Text>
```

### ✅ Correct: Use Interpolation
```typescript
<Text>{t('messages.taskCount', { count })}</Text>
```

In translation file:
```json
{
  "messages": {
    "taskCount": "共 {{count}} 个任务"
  }
}
```

---

### ❌ Wrong: Mixing Languages
```typescript
<Text>{t('planList.title')} 列表</Text>  // Don't mix!
```

### ✅ Correct: Full Translation
```typescript
<Text>{t('planList.fullTitle')}</Text>
```

---

## 🛠️ Tools & Tips

### VSCode Find/Replace
```
Find:    '([一-龥]+)'
Replace: {t('KEY_HERE')}
```
Then manually update KEY_HERE.

### Check for Missing Keys
After migration, run app and check console for warnings like:
```
i18next::translator: missingKey zh-CN dispatcher someKey
```

### Test Both Languages
```typescript
// In your app, toggle language
import { useLanguage } from '@/store/languageStore';

const { setLanguage } = useLanguage();
setLanguage('en-US'); // Test English
setLanguage('zh-CN'); // Test Chinese
```

---

## 📊 Progress Tracking

Update `DISPATCHER_I18N_MIGRATION_STATUS.md` after completing each file:

```markdown
### ✅ Completed Files
1. WorkshopStatusScreen.tsx ✓
2. PlanCreateScreen.tsx ✓  ← Mark as complete
```

---

## 🎯 Priority Order

**High Priority (User-facing):**
1. PlanListScreen
2. PlanDetailScreen
3. PlanCreateScreen
4. WorkshopStatusScreen ✓ (already done)
5. AIScheduleScreen

**Medium Priority:**
6. ResourceOverviewScreen
7. ApprovalListScreen
8. PersonnelListScreen
9. DSProfileScreen

**Low Priority:**
10. Remaining screens

---

## ✅ Final Checklist (Before Committing)

- [ ] All Chinese text replaced with `t()` calls
- [ ] No `as any` used
- [ ] Tested in zh-CN language
- [ ] Tested in en-US language
- [ ] No console warnings about missing keys
- [ ] Interpolated values work correctly (e.g., counts, names)
- [ ] Alert/Modal messages translated
- [ ] Placeholder text translated
- [ ] Button labels translated
- [ ] Status badges translated
- [ ] Error messages translated

---

## 🆘 Need Help?

1. **Can't find translation key?**
   - Check `dispatcher.json` for similar keys
   - Follow the naming pattern: `screen.category.key`

2. **Key doesn't exist?**
   - **DO NOT create new keys** for this task
   - Use the closest existing key
   - Report missing keys separately

3. **Complex interpolation?**
   ```typescript
   // Multiple values
   t('key', { count: 5, name: 'John' })

   // In JSON:
   "key": "{{count}} items for {{name}}"
   ```

---

**Happy Migrating! 🎉**

Remember: Quality over speed. Take time to find the right translation keys.
