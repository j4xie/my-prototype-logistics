# Dispatcher Module i18n Migration - Documentation Index

> **Quick Navigation:** Use this index to find the right documentation for your task.

---

## 📚 Documentation Files

### 1. 🎯 [QUICK GUIDE](./DISPATCHER_I18N_QUICK_GUIDE.md) - **START HERE**
**Use when:** You need to migrate a file right now

**Contains:**
- 3-step migration process
- Common find/replace patterns
- Translation key reference tables
- Tools & tips
- Troubleshooting guide

**Best for:** Developers actively migrating files

---

### 2. 📊 [STATUS TRACKER](./DISPATCHER_I18N_MIGRATION_STATUS.md)
**Use when:** You need to check what's done and what's pending

**Contains:**
- Complete file listing (21 files)
- Migration status for each file
- Translation key structure
- Progress percentage
- Next steps

**Best for:** Project managers, tracking overall progress

---

### 3. 📖 [SUMMARY](./DISPATCHER_I18N_SUMMARY.md)
**Use when:** You need the big picture overview

**Contains:**
- Completed work details
- Progress statistics
- Remaining work breakdown with time estimates
- Quality checklist
- Key learnings & best practices
- Impact & benefits

**Best for:** Team leads, documentation, reporting

---

## 🚀 Quick Start Paths

### Path 1: "I need to migrate a file NOW"
1. Open [QUICK GUIDE](./DISPATCHER_I18N_QUICK_GUIDE.md)
2. Follow the 3-step process
3. Use the replacement tables
4. Check off items in the final checklist
5. Update [STATUS TRACKER](./DISPATCHER_I18N_MIGRATION_STATUS.md)

### Path 2: "I want to understand the project status"
1. Open [STATUS TRACKER](./DISPATCHER_I18N_MIGRATION_STATUS.md)
2. Review completed vs pending files
3. Check progress percentage
4. Read [SUMMARY](./DISPATCHER_I18N_SUMMARY.md) for details

### Path 3: "I'm planning the remaining work"
1. Open [SUMMARY](./DISPATCHER_I18N_SUMMARY.md)
2. Review "Remaining Work Breakdown"
3. Note estimated times
4. Follow recommended phase order
5. Track progress in [STATUS TRACKER](./DISPATCHER_I18N_MIGRATION_STATUS.md)

---

## 🛠️ Tools & Resources

### Translation Files
- **Chinese:** `src/i18n/locales/zh-CN/dispatcher.json`
- **English:** `src/i18n/locales/en-US/dispatcher.json`

### Helper Script
- **Location:** `./migrate-dispatcher-i18n.sh`
- **Purpose:** Automates import/hook additions
- **Note:** Manual text replacement still required

### Reference Implementation
- **Fully Complete:** `src/screens/dispatcher/home/WorkshopStatusScreen.tsx`
- **Use as:** Example of correct migration pattern

---

## 📋 Current Status (At a Glance)

| Metric | Value |
|--------|-------|
| **Total Files** | 21 |
| **Completed** | 1 (5%) |
| **Partial** | 2 (10%) |
| **Pending** | 18 (85%) |
| **Est. Time Remaining** | 11-14 hours |

**Last Updated:** 2026-01-02

---

## 🎓 Common Questions

### Q: Which document should I read first?
**A:** Start with [QUICK GUIDE](./DISPATCHER_I18N_QUICK_GUIDE.md) if you're migrating. Read [SUMMARY](./DISPATCHER_I18N_SUMMARY.md) for overview.

### Q: How do I find the right translation key?
**A:** See "Finding the Right Translation Key" in [QUICK GUIDE](./DISPATCHER_I18N_QUICK_GUIDE.md), Method 1-3.

### Q: What if a translation key doesn't exist?
**A:** Use the closest existing key. Do NOT create new keys for this task.

### Q: How do I test my changes?
**A:** Toggle language in app settings. See "Testing After Migration" in [STATUS](./DISPATCHER_I18N_MIGRATION_STATUS.md).

### Q: Can I use the automation script?
**A:** Yes, but it only adds imports/hooks. You must manually replace Chinese text. See "Automated Migration Helper" in [STATUS](./DISPATCHER_I18N_MIGRATION_STATUS.md).

---

## ✅ Migration Workflow

```
┌─────────────────────────────────────────────┐
│ 1. Check STATUS TRACKER                    │
│    ↓                                        │
│ 2. Choose next file from pending list      │
│    ↓                                        │
│ 3. Open QUICK GUIDE for instructions       │
│    ↓                                        │
│ 4. Migrate the file (3-step process)       │
│    ↓                                        │
│ 5. Test in both languages                  │
│    ↓                                        │
│ 6. Update STATUS TRACKER (mark complete)   │
│    ↓                                        │
│ 7. Repeat for next file                    │
└─────────────────────────────────────────────┘
```

---

## 📞 Support & Resources

### Need Help?
1. Check [QUICK GUIDE](./DISPATCHER_I18N_QUICK_GUIDE.md) "Need Help?" section
2. Review `WorkshopStatusScreen.tsx` as example
3. Browse `dispatcher.json` for key patterns

### Want to Contribute?
1. Pick a file from [STATUS TRACKER](./DISPATCHER_I18N_MIGRATION_STATUS.md) pending list
2. Follow [QUICK GUIDE](./DISPATCHER_I18N_QUICK_GUIDE.md)
3. Submit PR with updated STATUS file

---

## 🎯 Priority Files (Do These First)

High-impact, user-facing screens:

1. ⏳ **PlanListScreen.tsx** - Main production planning
2. ⏳ **PlanCreateScreen.tsx** - 60% done, finish it
3. ⏳ **PlanDetailScreen.tsx** - 10% done, complete it
4. ⏳ **ResourceOverviewScreen.tsx** - Resource dashboard
5. ⏳ **AIScheduleScreen.tsx** - AI scheduling

See full priority order in [SUMMARY](./DISPATCHER_I18N_SUMMARY.md) "Next Steps" section.

---

## 📂 File Structure

```
frontend/CretasFoodTrace/
├── DISPATCHER_I18N_INDEX.md                    ← You are here
├── DISPATCHER_I18N_QUICK_GUIDE.md              ← Migration guide
├── DISPATCHER_I18N_MIGRATION_STATUS.md         ← Progress tracker
├── DISPATCHER_I18N_SUMMARY.md                  ← Project overview
├── migrate-dispatcher-i18n.sh                  ← Helper script
│
├── src/
│   ├── i18n/
│   │   └── locales/
│   │       ├── zh-CN/
│   │       │   └── dispatcher.json             ← Chinese translations
│   │       └── en-US/
│   │           └── dispatcher.json             ← English translations
│   │
│   └── screens/
│       └── dispatcher/
│           ├── home/
│           │   └── WorkshopStatusScreen.tsx    ← ✅ Fully migrated (reference)
│           ├── plan/
│           │   ├── PlanCreateScreen.tsx        ← ⚠️ 60% complete
│           │   ├── PlanDetailScreen.tsx        ← ⚠️ 10% complete
│           │   └── ... (7 more files)          ← ⏳ Pending
│           ├── ai/ (4 files)                   ← ⏳ Pending
│           ├── personnel/ (5 files)            ← ⏳ Pending
│           └── profile/ (2 files)              ← ⏳ Pending
```

---

## 🏁 Success Criteria

**A file is considered "migrated" when:**

- ✅ `useTranslation` import added
- ✅ Hook `const { t } = useTranslation('dispatcher')` added
- ✅ All Chinese text replaced with `t()` calls
- ✅ Tested and working in zh-CN
- ✅ Tested and working in en-US
- ✅ No console warnings
- ✅ Marked complete in STATUS TRACKER

**The project is complete when:**

- ✅ All 21 files migrated
- ✅ Full test suite passes in both languages
- ✅ No hardcoded Chinese strings remain
- ✅ Production-ready

---

**Current Phase:** Phase 1 - Completing Partial Files
**Next Milestone:** Finish PlanCreateScreen & PlanDetailScreen
**Target Completion:** TBD (11-14 hours estimated)

---

_Documentation created 2026-01-02 by Claude Opus 4.5_
