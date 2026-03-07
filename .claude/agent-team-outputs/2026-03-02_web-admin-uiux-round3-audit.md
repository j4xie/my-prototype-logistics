# Web-Admin UI/UX Deep Audit Round 3 — 最终报告

**日期**: 2026-03-02
**模式**: Full | 语言: Chinese
**审计范围**: web-admin/src/views/ 全部 95+ 视图文件 + 20+ 页面 Playwright 实测
**测试环境**: http://139.196.165.140:8086
**测试用户**: factory_admin1, workshop_sup1, warehouse_mgr1

---

## Executive Summary

Round 3 全站深度审计覆盖 95+ 视图文件 + 20+ 页面浏览器实测。发现 **0 个 P0, 6 个 P1, 7 个 P2**。主要问题集中在：(1) `formatAmount()` 在 5 个文件中重复定义；(2) 状态标签颜色不一致（调拨 CANCELLED 用 info 而非 danger）；(3) 调度模块使用非标准 el-tag 实现。编辑对话框回填、Dashboard 角色映射、权限守卫均无系统性问题。Round 1-2 全部修复已验证。

---

## 问题清单

### P1 Issues (6)

| ID | 类别 | 问题描述 | 影响文件 | 修复工作量 |
|----|------|---------|---------|-----------|
| P1-FMT-2 | 金额格式化 | `formatAmount()` 在 5 文件中重复定义完全相同代码 | finance/ar-ap, procurement/orders/detail, sales/orders/detail, transfer/list, transfer/detail | 30min |
| P1-FMT-1 | 金额格式化 | 成本分析页使用 `.toLocaleString()` 无 ¥ 前缀，同模块不一致 | finance/cost/analysis.vue:89 | 10min |
| P1-TAG-1 | 状态标签 | 调拨列表 CANCELLED 为 `info`，全站其他均为 `danger` | transfer/list.vue:31 | 5min |
| P1-TAG-2 | 状态标签 | 调度模块状态值 snake_case (pending/in_progress)，全站其他 UPPER_CASE | scheduling/realtime, scheduling/index | 取决后端 |
| P1-TAG-3 | 状态标签 | 调度模块用 `:color` + HEX 自定义色，非标准 `:type` | scheduling/realtime, scheduling/index | 15min |
| P1-PERM-1 | 权限 | canAccess() 对 'w' only 返回 true，只写角色可访问列表页 | router/guards.ts | 设计决策 |

### P2 Issues (7)

| ID | 类别 | 问题描述 | 影响文件 | 修复工作量 |
|----|------|---------|---------|-----------|
| P2-TAG-4 | 类型安全 | 10 处 `as any` 在 el-tag :type 上 | 7 文件 | 30min |
| P2-EDIT-1 | 表单验证 | production/batches 用手动 if 而非 el-form :rules | production/batches/list.vue | 15min |
| P2-FMT-3 | 金额格式化 | DashboardFinance 用 .toFixed(1)，风格不一致 | DashboardFinance.vue | 10min |
| P2-RESP-1 | 响应式 | 断点值不统一 (768/900/992/1200/1366/1400) | 全局 | 1h |
| P2-RESP-3 | 响应式 | 财务概览 stat-cards 固定 4 列无折叠 | finance/ar-ap/index.vue | 15min |
| P2-DATE-1 | 日期格式 | scheduling 用 toLocaleTimeString 非统一工具 | scheduling/* | 15min |
| P2-PERM-2 | 权限 | ROLE_PATH_WHITELIST 仅 finance_manager | router/guards.ts | 30min |

### 无问题项 (验证通过)

| 检查项 | 结果 |
|--------|------|
| 编辑对话框回填 | 10+ 个 handleEdit 均正确逐字段赋值，无引用污染 |
| Dashboard 角色映射 | 6 角色→5 变体，映射完整无遗漏 |
| 权限守卫架构 | 7 层检查链，module 级权限覆盖完整 |
| Round 1-2 修复 | emptyCell (40 文件), tooltip (40 文件), empty-text (52 表), form rules (21 表单), activeMenu, catch blocks 全部验证 |

---

## 状态标签全站映射

| 状态值 | 含义 | 正确颜色 | 例外 |
|--------|------|----------|------|
| DRAFT | 草稿 | info | — |
| COMPLETED | 已完成 | success | — |
| CANCELLED | 已取消 | danger | transfer/list.vue 用 info (P1-TAG-1) |
| APPROVED | 已批准 | '' (默认) | — |
| ACTIVE | 活跃/合作中 | success | — |
| IN_PROGRESS | 进行中 | warning | scheduling 用 HEX #E6A23C (P1-TAG-3) |

---

## 修复计划

### Batch 1: 立即修复 (~1h)
1. 提取 `formatAmount()` 到 `@/utils/tableFormatters.ts`
2. 5 文件替换本地定义为 import
3. 修复 finance/cost/analysis.vue 格式
4. 修复 transfer/list.vue CANCELLED 颜色
5. 定义 `TagType` 联合类型，消除 10 处 `as any`

### Batch 2: 短期修复 (~1h)
1. 调度模块 el-tag 改用标准 :type
2. production/batches 改用 el-form :rules
3. 财务 stat-cards 响应式
4. 调度日期工具函数统一

### Batch 3: 设计决策
1. 调度 snake_case 状态值 (需确认后端)
2. 只写角色列表访问权限
3. 全站断点规范
4. 路径白名单扩展

---

## Process Note
- Mode: Full
- Researchers deployed: 2 (code audit + responsive/roles)
- Browser explorer: ON (20+ pages visited)
- Total issues found: 13 (P0: 0, P1: 6, P2: 7)
- Key disagreements: 0 unresolved
- Phases completed: Research + Browser → Analysis → Critique → Integration → Heal
- Fact-check: disabled (code audit, not external claims)
- Healer: All checks passed ✅
