# Batch Module I18N Migration - Complete Index

## 📚 Documentation Files

### 🚀 Start Here
| File | Purpose | Read Time |
|------|---------|-----------|
| **BATCH_I18N_QUICKSTART.md** | Fast 5-minute setup guide | 3 min |

### 📖 Reference Documentation
| File | Purpose | When to Use |
|------|---------|-------------|
| **BATCH_I18N_SUMMARY.md** | Project overview & architecture | Before starting |
| **BATCH_I18N_VISUAL_GUIDE.md** | Screen mockups & visual reference | During migration |
| **BATCH_I18N_MIGRATION_INSTRUCTIONS.md** | Detailed step-by-step guide | Comprehensive walkthrough |

### 🔧 Technical Resources
| File | Purpose | When to Use |
|------|---------|-------------|
| **batch-i18n-patches.txt** | Line-by-line code changes | During coding |
| **batch-translations-zh-CN.json** | Chinese translations only | JSON update |
| **batch-translations-en-US.json** | English translations only | JSON update |

## 📂 Files to Modify

### JSON Translation Files (2)
```
src/i18n/locales/
├── zh-CN/workshop.json    ← Add 76 keys under "batches"
└── en-US/workshop.json    ← Add 76 keys under "batches"
```

### TypeScript Component Files (6)
```
src/screens/workshop-supervisor/batches/
├── WSBatchesScreen.tsx          ← 15 strings, ~30 lines changed
├── BatchDetailScreen.tsx        ← 11 strings, ~25 lines changed
├── BatchStageScreen.tsx         ← 24 strings, ~50 lines changed
├── BatchCompleteScreen.tsx      ← 14 strings, ~30 lines changed
├── BatchStartScreen.tsx         ← 12 strings, ~28 lines changed
└── MaterialConsumptionScreen.tsx ← 10 strings, ~22 lines changed
```

## 🗺️ Migration Path

### Path A: Quick & Dirty (18 minutes)
```
1. Read: BATCH_I18N_QUICKSTART.md (3 min)
2. JSON: Update both workshop.json files (2 min)
3. Code: Apply search-replace patterns (12 min)
4. Test: Verify both languages (1 min)
```

### Path B: Comprehensive (35 minutes)
```
1. Read: BATCH_I18N_SUMMARY.md (5 min)
2. Read: BATCH_I18N_VISUAL_GUIDE.md (8 min)
3. JSON: Update both workshop.json files (2 min)
4. Code: Apply from batch-i18n-patches.txt (15 min)
5. Test: Full screen-by-screen testing (5 min)
```

### Path C: Learning Mode (60 minutes)
```
1. Read all documentation (20 min)
2. Understand architecture (10 min)
3. JSON updates with validation (5 min)
4. Code changes with review (20 min)
5. Comprehensive testing (5 min)
```

## 📊 Translation Coverage

### By Screen
| Screen | File | Keys | Complexity |
|--------|------|------|-----------|
| List | WSBatchesScreen | 15 | ⭐⭐ |
| Detail | BatchDetailScreen | 11 | ⭐⭐ |
| Stage | BatchStageScreen | 24 | ⭐⭐⭐ |
| Complete | BatchCompleteScreen | 14 | ⭐⭐ |
| Start | BatchStartScreen | 12 | ⭐⭐ |
| Material | MaterialConsumptionScreen | 10 | ⭐⭐ |

### By Category
| Category | Count | Examples |
|----------|-------|----------|
| Labels | 28 | "产品", "目标", "进度" |
| Actions | 12 | "录入数据", "完成批次" |
| Status | 8 | "进行中", "已完成" |
| Messages | 10 | "批次已创建", "确认完成" |
| Placeholders | 6 | "搜索批次号", "请输入..." |
| Sections | 12 | "生产数据汇总", "完成确认" |

## 🎯 Key Translation Patterns

### 1. Simple Replacement
```typescript
"批次管理" → {t('batches.title')}
```

### 2. Parameterized
```typescript
`${batch.currentQuantity}kg / ${batch.targetQuantity}kg`
→ {t('batches.progressInfo', { current, target })}
```

### 3. Conditional
```typescript
batch.status === 'completed' ? '产量' : '目标'
→ batch.status === 'completed' ? t('batches.fields.output') : t('batches.fields.target')
```

### 4. Alert Messages
```typescript
Alert.alert('成功', '批次已创建')
→ Alert.alert(t('batches.start.successTitle'), t('batches.start.successMessage'))
```

## 🔍 Quick Reference

### Common Translation Keys
| Key | zh-CN | en-US |
|-----|-------|-------|
| `batches.title` | 批次管理 | Batch Management |
| `batches.status.inProgress` | 进行中 | In Progress |
| `batches.status.urgent` | [急]  | [Urgent]  |
| `batches.fields.product` | 产品 | Product |
| `batches.detail.enterData` | 录入数据 | Enter Data |
| `batches.stage.saveData` | 保存数据 | Save Data |
| `batches.complete.confirmComplete` | 确认完成批次 | Confirm Complete Batch |
| `batches.start.create` | 创建批次 | Create Batch |

### File Modification Template
```typescript
// 1. Add import
import { useTranslation } from 'react-i18next';

// 2. Add hook (inside component)
const { t } = useTranslation('workshop');

// 3. Replace strings
<Text>{t('batches.xxx')}</Text>

// 4. With parameters
{t('batches.progressInfo', { current: 52, target: 80 })}
```

## ✅ Validation Checklist

### Before Starting
- [ ] Understand project structure
- [ ] Know where JSON files are
- [ ] Know where TSX files are
- [ ] Have reference docs ready

### During Migration
- [ ] JSON files have valid syntax
- [ ] All imports added correctly
- [ ] All hooks added correctly
- [ ] No typos in translation keys
- [ ] Parameters match template

### After Migration
- [ ] No console errors
- [ ] Chinese displays correctly
- [ ] English displays correctly
- [ ] Language switching works
- [ ] All 6 screens tested
- [ ] No missing key warnings

## 🐛 Troubleshooting Guide

### Error: "Missing translation key"
```
Check: Translation key exists in JSON
Fix: Add key to both zh-CN and en-US
```

### Error: Text shows as "batches.title"
```
Check: Namespace is 'workshop'
Fix: const { t } = useTranslation('workshop')
```

### Error: Parameters not working
```
Check: {{ variable }} syntax in JSON
Fix: Use {{variable}} (no spaces)
```

### Error: App crashes after changes
```
Check: JSON syntax valid (no trailing commas)
Fix: Validate JSON, restart Metro
```

## 📈 Progress Tracking

```
Stage 1: JSON Updates          [░░░░░] 0%
├─ zh-CN additions
└─ en-US additions

Stage 2: Import & Hooks        [░░░░░] 0%
├─ WSBatchesScreen
├─ BatchDetailScreen
├─ BatchStageScreen
├─ BatchCompleteScreen
├─ BatchStartScreen
└─ MaterialConsumptionScreen

Stage 3: String Replacements   [░░░░░] 0%
├─ WSBatchesScreen (15)
├─ BatchDetailScreen (11)
├─ BatchStageScreen (24)
├─ BatchCompleteScreen (14)
├─ BatchStartScreen (12)
└─ MaterialConsumptionScreen (10)

Stage 4: Testing               [░░░░░] 0%
├─ Chinese mode
├─ English mode
├─ Language switching
└─ All screens verified
```

## 🎓 Learning Resources

### Understanding i18n
- Translation keys organize by feature/screen
- Namespace isolates translations (workshop vs common)
- Parameters allow dynamic content
- t() function returns localized string

### Best Practices
- Keep keys descriptive: `batches.detail.title` not `bd.t`
- Group related keys: `batches.stage.*`
- Reuse common keys: `common.confirm`
- Test both languages always

## 🚦 Status Indicators

### ✅ Ready to Use
- All documentation files
- Translation JSON files (ready to copy)
- Code patches (ready to apply)

### ⏸️ Pending User Action
- JSON file updates
- TypeScript file modifications
- Testing & verification

### 🔜 Future Enhancements
- Plural forms support
- Number formatting
- Date/time localization
- Context-based translations

## 📞 Support

If you encounter issues:

1. **Check Documentation**
   - Re-read relevant guide
   - Check visual guide for screen mockups
   - Review patches for exact changes

2. **Validate Files**
   - JSON syntax checker
   - TypeScript compiler
   - i18n key validator

3. **Compare Examples**
   - Look at migrated modules (workers, home)
   - Follow same patterns
   - Use same structure

## 🎯 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Translation Coverage | 100% | No hard-coded Chinese strings |
| Both Languages Work | Yes | Test all screens in both modes |
| No Console Errors | 0 | Check browser/Metro console |
| Migration Time | <30 min | From start to tested |
| User Experience | Seamless | Language switch instant |

---

## 📋 File Overview

| # | File | Size | Lines | Purpose |
|---|------|------|-------|---------|
| 1 | BATCH_I18N_INDEX.md | - | - | This file (navigation) |
| 2 | BATCH_I18N_QUICKSTART.md | 5.0K | 200 | Quick start guide |
| 3 | BATCH_I18N_SUMMARY.md | 5.7K | 250 | Overview & architecture |
| 4 | BATCH_I18N_VISUAL_GUIDE.md | 12K | 450 | Screen mockups & visuals |
| 5 | BATCH_I18N_MIGRATION_INSTRUCTIONS.md | 11K | 400 | Detailed instructions |
| 6 | batch-i18n-patches.txt | 14K | 600 | Line-by-line changes |
| 7 | batch-translations-zh-CN.json | 3.6K | 100 | Chinese translations |
| 8 | batch-translations-en-US.json | 3.9K | 105 | English translations |

**Total Documentation**: 8 files, ~55KB, ~2,100 lines

---

## 🚀 Ready to Start?

**Recommended Path**: Read `BATCH_I18N_QUICKSTART.md` → Follow steps → Complete in 18 minutes

**Need Help?**: Check `BATCH_I18N_VISUAL_GUIDE.md` for screen-by-screen reference

**Technical Details?**: Reference `batch-i18n-patches.txt` for exact code changes

---

**Last Updated**: 2026-01-02
**Module**: workshop-supervisor/batches
**Status**: Documentation Complete ✅
**Next**: Manual Application Required
