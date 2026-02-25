# 首页长按编辑 — 添加快捷操作功能排查报告

**日期**: 2026-02-23
**研究主题**: factory_admin 首页长按编辑模式下"添加快捷操作"功能不可用

---

## Executive Summary

用户反馈"添加快捷操作功能不可用"。经 3 名研究员代码审计 + Analyst 分析 + Critic 验证，Critic 推翻了 Analyst 的 2/3 结论并发现了真正的 P0 根因。

**根因**: `renderQuickActionsModule` 硬编码 `allQuickActions.slice(0, 4)` 显示，config 仅用于黑名单过滤。"添加"操作成功写入 config 但渲染逻辑完全忽略 config 中的新增项，导致点击添加后界面无任何变化。

---

## Analyst vs Critic 分歧

| # | Analyst 结论 | Critic 判定 | 说明 |
|---|-------------|------------|------|
| Bug #1 (P0→P2) | ID 不匹配导致功能异常 | **降级为 P2** | ID 确实不匹配（reports/settings vs dataReport/systemConfig），但不影响正常渲染 |
| Bug #2 (P1→否定) | 弹窗为空 | **否定** | 弹窗实际显示 4 个可添加项，Analyst 误判 |
| Bug #3 (P2→否定) | "无更多模块"误报 | **否定** | dev_tools 默认 visible:false，功能正常 |
| **Bug A (P0)** | 未发现 | **新发现** | 渲染逻辑硬编码 slice(0,4) 忽略 config 新增项 |

---

## 确认的 Bug

### Bug A (P0): 添加操作写入 config 但渲染忽略

**代码路径**:
1. 用户点击"添加"按钮 → 弹窗正常弹出，列出 4 个可添加项
2. 用户选择某项 → `addQuickAction()` 成功更新 config.actions
3. 重新渲染 `renderQuickActionsModule`:

```typescript
// FAHomeScreen.tsx:906 (修复前)
const defaultActions = allQuickActions.slice(0, 4);
// ^^^ 永远是 [newBatch, dataReport, staffManagement, systemConfig]
// inventory 和 qualityCheck 永远不在此列表中，无论 config 怎么设置
```

4. `displayActions` 只从 `defaultActions` 过滤，**从不读取 config 中新添加的项**
5. 结果：config 标记了 `inventory: visible: true`，但界面什么都没变

### Bug B (P2): DEFAULT_HOME_LAYOUT action ID 不匹配

```
decoration.ts:222-227 定义: newBatch, qualityCheck, reports, settings
FAHomeScreen.tsx allQuickActions: newBatch, dataReport, staffManagement, systemConfig, inventory, qualityCheck
                                           ^^^^^^^^^^  ^^^^^^^^^^^^^^^  ^^^^^^^^^^^^
                                           不匹配       不匹配           不匹配
```

`reports` 和 `settings` 在 allQuickActions 中不存在，是幽灵配置。

---

## 修复记录

### Fix 1 (P0): Config-driven 显示逻辑
- **文件**: `FAHomeScreen.tsx`
- **改动**: `renderQuickActionsModule` 从 config.actions 的 visible IDs 匹配 allQuickActions 显示
- **同时修复**: `addableActions` 弹窗过滤逻辑简化为 `!visibleConfigIds.includes(action.id)`

### Fix 2 (P2): 修正 DEFAULT_HOME_LAYOUT action IDs
- **文件**: `decoration.ts:222-227`
- **改动**: `reports→dataReport`, `settings→systemConfig`, `qualityCheck→staffManagement`

### Fix 3: 升级 persist key
- **文件**: `homeLayoutStore.ts:763`
- **改动**: `v7→v8`，强制清除旧布局数据

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (trigger/state, popup rendering, module system)
- Total sources examined: 5 files (FAHomeScreen.tsx, decoration.ts, homeLayoutStore.ts, HomeLayoutEditorScreen.tsx, BentoGridEditor.tsx)
- Key disagreements: 3 (Analyst 2/3 claims challenged and overturned by Critic)
- Phases completed: Research → Analysis → Critique+Integration → Fix
- Healer: All checks passed (structural completeness, cross-reference integrity, actionable recommendations)
