# Vue Web-Admin 餐饮端 vs 工厂端权限分离审计

**日期**: 2026-03-03
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**Grounding**: 代码库验证

---

## Executive Summary

Vue web-admin 的餐饮/工厂权限分离框架已建立（侧边栏 `factoryTypes` + 路由守卫双层拦截），覆盖率约 **60%**。9 个工厂专属模块正确隔离，1 个餐饮专属模块正确限制。6 大模块未设置 `factoryTypes`（采购/人事/财务/系统/SmartBI/数据分析通用子项），但经 Critic 验证，**多数为有意通用设计**，并非安全漏洞。最关键的两个问题：(1) Dashboard 餐饮分支仅覆盖 2 个角色；(2) 财务视图硬编码工厂概念。P0 修复约 **2-3 天**。

---

## Consensus & Disagreements

| 主题 | 最终裁定 | 置信度 |
|------|---------|--------|
| 双层拦截机制有效 | **有效** — `guards.ts:112-118` + `AppSidebar.vue:218-229` | ★★★★★ |
| financeManagerMenu 绕过 | **Low 风险** — `ROLE_PATH_WHITELIST` 白名单兜底 | ★★★★★ |
| 采购/人事/系统无 factoryTypes | **有意通用** — 业务功能一致，`useBusinessMode` 已做术语适配 | ★★★★☆ |
| SmartBI 处理策略 | **应做内容适配，非限制访问** — SmartBI 是数据驱动工具，两种业态都需要 | ★★★★☆ |
| Dashboard 餐饮覆盖不足 | **需扩大** — `getDashboardComponent()` 仅检查 2 角色 | ★★★★☆ |
| `isRestaurant` 零消费 | **确认** — Grep 验证 0 外部消费方 | ★★★★★ |

---

## Detailed Findings

### 1. 已正确隔离的模块（~60% 覆盖）

以下模块在侧边栏和路由两层均设置了 `factoryTypes: ['FACTORY', 'CENTRAL_KITCHEN']`，RESTAURANT 用户无法看到或访问：

| 模块 | 侧边栏位置 | 路由位置 | 状态 |
|------|-----------|---------|------|
| 生产管理 (4子路由) | `AppSidebar.vue:56-63` | `router/index.ts:64-97` | ✅ 正确隔离 |
| 仓储管理 (3子路由) | `AppSidebar.vue:66-73` | `router/index.ts:100-125` | ✅ 正确隔离 |
| 质量管理 (2子路由) | `AppSidebar.vue:75-81` | `router/index.ts:184-203` | ✅ 正确隔离 |
| 调拨管理 (1子路由) | `AppSidebar.vue:110-115` | `router/index.ts:128-147` | ✅ 正确隔离 |
| 设备管理 (3子路由) | `AppSidebar.vue:127-134` | `router/index.ts:314-339` | ✅ 正确隔离 |
| 智能调度 (5子路由) | `AppSidebar.vue:169-178` | `router/index.ts:496-545` | ✅ 正确隔离 |
| 生产分析 (2子路由) | `AppSidebar.vue:187-193` | 路由 meta | ✅ 正确隔离 |
| 数据分析-车间报表 | `AppSidebar.vue:164` | 路由 meta | ✅ 正确隔离 |
| 数据分析-异常预警 | `AppSidebar.vue:166` | 路由 meta | ✅ 正确隔离 |
| **餐饮管理** (4子路由) | `AppSidebar.vue:117-125` | `router/index.ts:149-181` | ✅ 正确隔离(RESTAURANT+CK) |

### 2. 未设置 factoryTypes 的模块

| 模块 | 业务判断 | 严重性 | 处理建议 |
|------|---------|--------|---------|
| 采购管理 (3子路由) | **有意通用** — 餐饮也需要进货，`useBusinessMode` 已做术语适配 | Low | 维持现状 |
| 人事管理 (4子路由) | **有意通用** — 员工/考勤/部门管理对两种业态一致 | Low | 维持现状 |
| 系统管理 (8子路由) | **基本通用** — POS 适合餐饮，但设备校准等子项偏工厂 | Low | 可选：系统管理子项级 factoryTypes |
| 财务管理 (3子路由) | **需适配** — 成本分析结构差异大（BOM成本 vs 食材成本） | Medium | P1：视图内 `isRestaurant` 条件渲染 |
| SmartBI (10子路由) | **需内容适配** — 不应限制访问，应在预定义报表中做差异化 | Medium | P1：预定义报表术语/维度适配 |
| 数据分析通用子项 (4项) | **需适配** — 概览/趋势内容偏工厂(产量/批次) | Medium | P1：视图内条件渲染 |
| 销售管理 (父级) | 父级无 factoryTypes，子路由"客户管理"+"智能分析"对餐饮可见 | Low | 可选：评估餐饮是否需要客户管理 |

### 3. Dashboard 分发逻辑

**当前实现** (`components/dashboard/index.ts:57-63`):
```
getDashboardComponent():
  if factoryType === 'RESTAURANT' && (role === 'factory_super_admin' || role === 'viewer')
    → DashboardRestaurant
  else
    → ROLE_DASHBOARD_MAP[role] (DashboardHR/DashboardWarehouse/DashboardFinance/etc.)
```

**问题**: 餐饮工厂的 hr_admin、warehouse_manager 等角色仍走各自的工厂版 Dashboard，其中硬编码了工厂概念的快捷入口（如"原材料批次""生产批次"）。

**建议**: 扩大餐饮判断范围 — 对所有角色检查 factoryType，RESTAURANT 用户统一使用 DashboardRestaurant 或对应的餐饮适配版。

### 4. DashboardDefault 硬编码工厂概念

`DashboardDefault.vue` 的 `moduleConfig` 中包含"生产管理""设备管理""质量管理"等工厂专属入口，无任何 `factoryType` 检查。若餐饮用户因角色映射回退到此组件，会看到不相关的工厂内容。

### 5. useBusinessMode Composable

**定位**: 术语替换基础设施，已导出 `isRestaurant`/`isFactory` 但零消费方。

**当前覆盖**: 17 个视图文件引用，全部仅使用 `label()` 函数。

**类型安全问题**: `useBusinessMode.ts:57` 使用 `(user as any).factoryType`，应改用 `authStore.factoryType`。

### 6. 后端 API 安全

后端 API 无 factoryType 级别访问控制，仅通过 `factoryId` 做数据隔离。前端隐藏菜单 + 路由守卫构成主要防线。经 Critic 评估为 Low 风险 — factoryId 隔离已满足数据安全需求。

---

## Actionable Recommendations

### P0 — Immediate（2-3 天）

| # | 修改 | 文件 | 工作量 |
|---|------|------|--------|
| 1 | 扩大 `getDashboardComponent()` 餐饮分支 — RESTAURANT 所有角色统一用 `DashboardRestaurant` | `components/dashboard/index.ts` | 5 分钟 |
| 2 | 修复 `(user as any).factoryType` → `authStore.factoryType` | `composables/useBusinessMode.ts:57` | 5 分钟 |
| 3 | `DashboardDefault` 增加 factoryType 感知 — 过滤 moduleConfig 中工厂专属入口 | `components/dashboard/DashboardDefault.vue` | 30 分钟 |

### P1 — Short-term（本周内）

| # | 修改 | 文件 | 工作量 |
|---|------|------|--------|
| 4 | 财务成本分析页面引入 `isRestaurant` 切换维度 | `views/finance/cost/analysis.vue` 等 | 2-3 小时 |
| 5 | SmartBI 预定义报表做餐饮内容适配 | `views/smart-bi/` 2-3 文件 | 2-3 小时 |
| 6 | `financeManagerMenu` 也走 `canSeeMenuItem()` 过滤 | `AppSidebar.vue:232-237` | 15 分钟 |

### Conditional（有餐饮客户接入时）

| # | 修改 | 范围 |
|---|------|------|
| 7 | 后端 API 添加 factoryType 过滤 | Controller/Service 层 |
| 8 | 激活 17 个视图的 `isRestaurant` 条件渲染 | 已引入 useBusinessMode 的视图 |

---

## Open Questions

1. 餐饮工厂的实际角色分配策略？（决定 Dashboard 覆盖优先级）
2. 后端 Service 层是否有隐式 factoryType 过滤？
3. `DashboardRestaurant` 的 `todayAttendance`/`monthRevenue` 恒为 0 的根因？
4. CENTRAL_KITCHEN 类型的实际测试覆盖？

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (侧边栏+路由、Dashboard+composable、产品逻辑)
- Browser explorer: OFF
- Total sources: 15+ core source files (all ★★★★★ codebase evidence)
- Key disagreements: 3 resolved, 1 unresolved
- Phases: Research → Analysis → Critique → Integration → Heal
- Healer: all checks passed ✅
