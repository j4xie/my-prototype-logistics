# I18n Migration Guide

## Overview

This guide covers the migration of ~227 remaining TSX files to use i18n internationalization.

### Current Status
- **Total TSX files**: 238
- **Already migrated**: 11 files
- **Remaining**: ~227 files
- **Estimated effort**: 10-15 hours

## Quick Start

### Option 1: Automated Analysis (Recommended)

Use the migration script to analyze files and generate translation keys:

```bash
cd frontend/CretasFoodTrace

# Analyze a single file
node scripts/migrate-i18n.js src/screens/factory-admin/profile/PersonalInfoScreen.tsx

# Analyze an entire directory
node scripts/migrate-i18n.js --batch src/screens/factory-admin

# Analyze all screens
node scripts/migrate-i18n.js --batch src/screens
```

The script will:
1. Extract all Chinese text
2. Suggest translation keys
3. Determine the correct namespace
4. Generate JSON snippets for translation files

### Option 2: Manual Migration

Follow this pattern for each file:

#### Step 1: Add Import
```typescript
import { useTranslation } from 'react-i18next';
```

#### Step 2: Add Hook (in component body)
```typescript
const { t } = useTranslation('namespace'); // See namespace mapping below
```

#### Step 3: Replace Hardcoded Text
```typescript
// Before
<Text>个人信息</Text>

// After
<Text>{t('personalInfo.title')}</Text>
```

#### Step 4: Update Translation Files
Add to both `zh-CN/{namespace}.json` and `en-US/{namespace}.json`

## Namespace Mapping

| Directory | Namespace | Translation Files |
|-----------|-----------|-------------------|
| `factory-admin/*` | `profile` | `profile.json` |
| `workshop-supervisor/*` | `processing` | `processing.json` |
| `quality-inspector/*` | `quality` | `quality.json` |
| `platform/*` | `management` | `management.json` |
| `reports/*` | `reports` | `reports.json` |
| `alerts/*` | `alerts` | `alerts.json` |
| `traceability/*` | `common` | `common.json` |
| `attendance/*`, `work/*` | `hr` | `hr.json` |
| `warehouse/*` | `warehouse` | `warehouse.json` |
| `dispatcher/*` | `dispatcher` | `dispatcher.json` |
| `common/*`, `legacy/*` | `common` | `common.json` |

## Migration Checklist

### For Each File

- [ ] Add `useTranslation` import
- [ ] Add `const { t } = useTranslation('namespace')` hook
- [ ] Replace all hardcoded Chinese text with `t()` calls
- [ ] Update `zh-CN/{namespace}.json` with Chinese translations
- [ ] Update `en-US/{namespace}.json` with English translations
- [ ] Test the file - verify no TypeScript errors
- [ ] Verify UI displays correctly in both languages

### Common Patterns

#### 1. Simple Text
```typescript
// Before
<Text>加载中...</Text>

// After
<Text>{t('common.status.loading')}</Text>
```

#### 2. Text with Variables
```typescript
// Before
<Text>共 {total} 条</Text>

// After
<Text>{t('common.pagination.total', { total })}</Text>

// Translation JSON
{
  "pagination": {
    "total": "共 {{total}} 条"
  }
}
```

#### 3. Alert Messages
```typescript
// Before
Alert.alert('成功', '保存成功');

// After
Alert.alert(t('common.messages.success'), t('common.messages.saveSuccess'));
```

#### 4. Placeholders
```typescript
// Before
<TextInput placeholder="请输入用户名" />

// After
<TextInput placeholder={t('auth.username.placeholder')} />
```

#### 5. Button Labels
```typescript
// Before
<Button title="确认提交" />

// After
<Button title={t('common.buttons.submit')} />
```

## Directory-by-Directory Plan

### Phase 1: Critical User-Facing Screens (~50 files, 3-4 hours)
- [ ] `factory-admin/profile/*` (8 files)
- [ ] `factory-admin/home/*` (6 files)
- [ ] `workshop-supervisor/batches/*` (6 files)
- [ ] `quality-inspector/*` (12 files)
- [ ] `reports/*` (6 files)
- [ ] `alerts/*` (2 files)

### Phase 2: Management & Configuration (~60 files, 4-5 hours)
- [ ] `factory-admin/ai-analysis/*` (6 files)
- [ ] `factory-admin/config/*` (4 files)
- [ ] `management/*` (15 files)
- [ ] `warehouse/*` (25 files)
- [ ] `dispatcher/*` (10 files)

### Phase 3: Supporting Screens (~60 files, 3-4 hours)
- [ ] `processing/*` (20 files)
- [ ] `attendance/*` (4 files)
- [ ] `work/*` (2 files)
- [ ] `traceability/*` (3 files)
- [ ] `common/*`, `legacy/*` (15 files)
- [ ] `auth/*`, `profile/*` (5 files)

## Translation File Structure

### Example: `zh-CN/profile.json`
```json
{
  "title": "我的",
  "sections": {
    "accountSettings": "账户设置",
    "systemSettings": "系统设置"
  },
  "personalInfo": {
    "title": "个人信息",
    "username": "用户名",
    "realName": "真实姓名",
    "email": "邮箱",
    "phone": "手机号",
    "save": "保存",
    "edit": "编辑"
  },
  "changePassword": {
    "title": "修改密码",
    "currentPassword": "当前密码",
    "newPassword": "新密码",
    "confirmPassword": "确认新密码",
    "submit": "确认修改"
  },
  "messages": {
    "saveSuccess": "保存成功",
    "saveFailed": "保存失败"
  }
}
```

### Example: `en-US/profile.json`
```json
{
  "title": "Profile",
  "sections": {
    "accountSettings": "Account Settings",
    "systemSettings": "System Settings"
  },
  "personalInfo": {
    "title": "Personal Information",
    "username": "Username",
    "realName": "Real Name",
    "email": "Email",
    "phone": "Phone",
    "save": "Save",
    "edit": "Edit"
  },
  "changePassword": {
    "title": "Change Password",
    "currentPassword": "Current Password",
    "newPassword": "New Password",
    "confirmPassword": "Confirm Password",
    "submit": "Submit"
  },
  "messages": {
    "saveSuccess": "Save Successful",
    "saveFailed": "Save Failed"
  }
}
```

## Testing After Migration

### 1. TypeScript Compilation
```bash
npx tsc --noEmit
```

### 2. Runtime Testing
```bash
npm start
# Test language switching
# Verify all screens display correctly
```

### 3. Check for Missing Translations
Look for untranslated text (Chinese characters) in the UI

## Common Issues & Solutions

### Issue 1: Import Error
```
Error: Cannot find module 'react-i18next'
```
**Solution**: Check import path is `'react-i18next'` not `'react-i18n'`

### Issue 2: Missing Translation Key
```
Warning: Missing translation key: profile.personalInfo.title
```
**Solution**: Add the key to both `zh-CN` and `en-US` JSON files

### Issue 3: Variables Not Showing
```typescript
// Wrong
t('total items', { count })

// Correct
t('totalItems', { count })
// JSON: "totalItems": "共 {{count}} 条"
```

## Batch Processing Tips

1. **Process by directory** - easier to manage namespaces
2. **Test incrementally** - migrate 10-20 files, test, then continue
3. **Reuse common keys** - many screens share buttons/labels
4. **Keep context** - group related keys together in JSON

## Estimated Timeline

| Phase | Files | Time | Priority |
|-------|-------|------|----------|
| Phase 1 | 50 files | 3-4 hours | High |
| Phase 2 | 60 files | 4-5 hours | Medium |
| Phase 3 | 60 files | 3-4 hours | Low |
| Testing & Fixes | - | 2 hours | - |
| **Total** | **170 files** | **12-15 hours** | - |

## Next Steps

1. Run the automated script on all directories to generate translation keys
2. Review and organize the suggested keys
3. Start with Phase 1 (high-priority user-facing screens)
4. Test each batch before proceeding
5. Update this guide with any new patterns discovered

## Questions?

- Check existing migrated files for examples: `src/screens/dispatcher/*`, `src/screens/quality-inspector/*`
- Refer to the i18n configuration: `src/i18n/config.ts`
- Review namespace index: `src/i18n/locales/index.ts`
