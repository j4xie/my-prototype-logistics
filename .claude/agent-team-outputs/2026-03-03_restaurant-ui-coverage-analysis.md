# 餐饮端 UI 覆盖深度分析

**日期**: 2026-03-03
**Agent Team Mode**: Full (3 Researchers + Analyst + Critic)
**研究主题**: 餐饮模式通过模块权限加减法复用工厂端 UI — 假设验证

---

## Executive Summary

**假设验证结果**：RN 前端 **部分成立**（约 70% 到位），Vue Web-Admin **不成立**（接近 0% 功能隔离）。

餐饮模式的核心设计思路是"共享 UI + 减法隐藏 + 术语替换"——这一架构模式在 RN 端实现了三层过滤（Tab 隐藏 + 路由不注册 + 九宫格条件渲染），成功屏蔽了 21 个工厂专属屏幕，并在 4 处完成了术语动态切换。但 Vue Web-Admin 端仅完成了基础设施搭建（`useBusinessMode` composable），核心的模块可见性过滤完全缺失——餐饮用户登录后可看到并进入生产管理、设备管理、排产调度等全部工厂专属模块。

**新发现**：CENTRAL_KITCHEN 类型在 RN 端与 Vue 端的处理逻辑相反（RN 归为工厂，Vue 归为餐饮），是一个跨端设计缺陷。

---

## 一、三层覆盖矩阵

### 餐饮共享模块（双端可用）

| 模块 | 后端 Controller | RN 前端 | Vue 前端 | 术语适配 |
|------|----------------|---------|---------|---------|
| 首页/Dashboard | `RestaurantDashboardController` | 专属统计卡+快捷操作 | 无适配（显示工厂KPI） | RN完整/Vue缺失 |
| 采购订单 | `PurchaseOrderController` 共享 | 可见 | 可见 + label替换 | RN缺/Vue有 |
| 销售订单 | `SalesOrderController` 共享 | 可见 | 可见 + label替换 | RN缺/Vue有 |
| 成品/菜品库存 | 共享 FinishedGoods | 入口术语"半成品库存" | 可见 + label替换 | 双端有 |
| 调拨管理 | `TransferController` 共享 | 可见 | 可见 + label替换 | RN缺/Vue有 |
| 供应商管理 | 共享 Controller | 可见 | 可见（无label适配） | 双端缺 |
| 客户管理 | 共享 Controller | 可见 | 可见（无label适配） | 双端缺 |
| 出货管理 | 共享 Controller | 可见 | 可见 | — |
| 应收应付/价格表/退货 | 共享 Controller | 可见 | 可见（无label适配） | 双端缺 |
| 员工/部门管理 | 共享 Controller | 可见 | 可见 | — |
| 菜品管理(产品类型) | 共享 `ProductTypeController` | 术语"菜品管理" | 无术语适配 | RN有/Vue缺 |
| 食材类型(原材料) | 共享 `MaterialTypeController` | 术语"食材类型" | 无术语适配 | RN有/Vue缺 |
| 报废记录 | 共享 Controller | 可见 | 可见 | — |
| AI分析/SmartBI | 共享 | Tab可见 | 完整可见 | — |
| 系统配置(Schema/模板/规则/AI) | 共享 | 全部可见 | 部分可见 | — |

### 工厂专属模块（餐饮应隐藏）

| 模块 | RN 前端 | Vue 前端 | 问题 |
|------|---------|---------|------|
| 设备中心/设备分析 | **已隐藏** | **可见** (equipment/*) | Vue未过滤 |
| IoT电子秤 (4屏) | **已隐藏** | 无对应页面 | — |
| ISAPI摄像头 (6屏) | **已隐藏** | 无对应页面 | — |
| 智能设备添加 (3屏) | **已隐藏** | 无对应页面 | — |
| NFC标签管理 | **已隐藏** | 无对应页面 | — |
| 标签识别监控 | **已隐藏** | 无对应页面 | — |
| 转换率配置 | **已隐藏** | **可见** (production/conversions) | Vue未过滤 |
| 质检项配置/SOP | **已隐藏** | **可见** (quality/*) | Vue未过滤 |
| 报工审批 | **已隐藏** | 无对应页面 | — |
| 生产报表Tab | **已隐藏**(整个Tab) | **可见** (production/*) | Vue未过滤 |
| 排产调度 | RN无对应 | **可见** (scheduling/*) | Vue未过滤 |
| 生产分析 | RN无对应 | **可见** (production-analytics/*) | Vue未过滤 |

### 餐饮专属模块（后端有，前端无）

| 模块 | 后端 Controller | RN 屏幕 | Vue 页面 | 状态 |
|------|----------------|---------|---------|------|
| 菜谱管理 (Recipe/BOM) | `RecipeController` | **无** | **无** | 后端就绪，双端缺失 |
| 领料管理 (MaterialRequisition) | `MaterialRequisitionController` | **无** | **无** | 后端就绪，双端缺失 |
| 损耗记录 (WastageRecord) | `WastageRecordController` | **无** | **无** | 后端就绪，双端缺失 |
| 盘点记录 (StocktakingRecord) | `StocktakingRecordController` | **无** | **无** | 后端就绪，双端缺失 |

---

## 二、RN 前端权限机制详解

### 核心函数 (factoryType.ts)

```typescript
isRestaurant(user)          // factoryType === 'RESTAURANT'
hasProductionCapability(user) // FACTORY || CENTRAL_KITCHEN
getFactoryType(user)         // 从 user.factoryUser.factoryType 读取
```

### 三层过滤机制

| 层级 | 文件 | 控制方式 | 效果 |
|------|------|---------|------|
| Tab层 | `FactoryAdminTabNavigator.tsx:82` | `!isRestaurantMode` | 隐藏"报表"Tab（1个） |
| 路由层 | `FAManagementStackNavigator.tsx:118-276` | `{!isRestaurantMode && <>...</>}` | 21个Screen不注册 |
| 九宫格层 | `FAManagementScreen.tsx:61-237` | `{!isRestaurantMode && <GridItem/>}` | 6个入口隐藏 |

### 餐饮专属 Dashboard (FAHomeScreen.tsx)

- **数据源**: `getRestaurantDashboardSummary()` (非工厂的 getDashboardOverview)
- **统计卡**: 今日领料 / 待审批 / 告警 (工厂: 产量/批次/收料/告警)
- **快捷操作**: 新建采购/新建销售/库存查询/员工管理 (工厂: 创建计划/数据报告/员工/系统配置)
- **工厂KPI指标**(良品率等): 隐藏

### RN 术语映射 (4处动态切换)

| 位置 | 工厂术语 | 餐饮术语 |
|------|---------|---------|
| FAManagementScreen:100 | 产品类型 | 菜品管理 |
| FAManagementScreen:106 | 原材料类型 | 食材类型 |
| FAManagementScreen:164 | 成品库存 | 半成品库存 |
| FAManagementScreen:148 | 进销存管理 | 门店进销存 |

---

## 三、Vue Web-Admin 权限机制详解

### useBusinessMode (composables/useBusinessMode.ts)

已定义 16 个术语映射键值对：

| 工厂 | 餐饮 | 实际调用View数 |
|------|------|---------------|
| 原材料 | 食材 | 2 |
| 成品 | 菜品 | 2 |
| 采购 | 进货 | 2 |
| 销售 | 出餐/外卖 | 2 |
| 调拨 | 调拨 | 2 |
| 成品库存 | 菜品库存 | 1 |
| 采购订单 | 进货单 | 2 |
| 销售订单 | 出餐单 | 2 |
| 供应商→供货商, 客户→客户/平台, 仓库→后厨仓库, 生产→备餐, 批次→备货批次, 发货→配送, 收货→验收 | | 各 0 (未使用) |

**实际使用率**: 7/81 个 View 文件 = **8.6%**，且全部只解构 `label`，**零处**解构 `isRestaurant` 做条件显隐。

### Sidebar 菜单控制 (AppSidebar.vue)

- **过滤逻辑**: `permissionStore.canAccess(module)` — 纯角色RBAC
- **无 factoryType 判断**: `factoryType`/`RESTAURANT` 字符串在整个 `web-admin/src` 中仅出现在 `useBusinessMode.ts` 定义文件
- **影响**: 餐饮 `factory_super_admin` 与工厂 `factory_super_admin` 权限矩阵完全相同，看到所有 14 个一级菜单

### 路由守卫

- `router/index.ts` 所有路由静态注册，无 `beforeEach` 中的 factoryType 判断
- 用户可通过 URL 直接访问 `/production/plans`、`/equipment/list` 等工厂专属页面

---

## 四、关键发现：CENTRAL_KITCHEN 跨端逻辑矛盾

| 端 | CENTRAL_KITCHEN 判定 | 代码位置 |
|----|---------------------|---------|
| RN | `isRestaurant()` = **false**，`hasProductionCapability()` = **true** | factoryType.ts:16,24 |
| Vue | `mode` = **'RESTAURANT'** (与 RESTAURANT 同组) | useBusinessMode.ts:62 |

**影响**: 中央厨房用户在 RN 端看到工厂模式 UI（含设备/质检/SOP），在 Vue 端看到餐饮术语（食材/菜品）。两端体验矛盾。

---

## 五、缺口优先级排序

| # | 缺口 | 严重程度 | 影响范围 | 建议 |
|---|------|---------|---------|------|
| 1 | **Vue Sidebar 无 factoryType 过滤** | 严重 | 全部餐饮Vue用户 | permission.ts 添加 RESTAURANT_HIDDEN_MODULES 过滤 |
| 2 | **餐饮专属后端无前端对接** (菜谱/领料/损耗/盘点) | 严重 | 餐饮核心差异化功能 | RN 九宫格增加4个`isRestaurantMode &&`入口 + 新Screen |
| 3 | **Vue 路由无 factoryType 守卫** | 中 | Vue URL直接访问 | router.beforeEach 拦截工厂专属路由 |
| 4 | **Vue useBusinessMode 利用率 8.6%** | 中 | 术语一致性 | 扩展到 supplier/customer/warehouse 等页面 |
| 5 | **CENTRAL_KITCHEN 跨端逻辑矛盾** | 中 | 中央厨房用户 | 统一判定逻辑，RN 端 isRestaurant 应包含 CENTRAL_KITCHEN |
| 6 | **RN 进销存子页面缺术语替换** | 低 | 子页面文案 | 引入 isRestaurant 替换页面内标签 |
| 7 | **Vue Dashboard 无餐饮分支** | 低 | 首页展示 | 创建 DashboardRestaurant.vue 或条件分支 |

---

## 六、RN 端餐饮可见功能完整清单

### Tab 栏 (5个可见 / 1个隐藏)

| Tab | 状态 | 说明 |
|-----|------|------|
| 首页 | 可见 | 餐饮专属Dashboard (领料/审批/告警) |
| AI分析 | 可见 | 共享 |
| ~~报表~~ | **隐藏** | 无生产报表 |
| 智能分析(SmartBI) | 可见 | 共享 |
| 管理 | 可见 | 九宫格减法 |
| 我的 | 可见 | 共享 |

### 管理中心九宫格 (21项可见 / 6项隐藏)

**核心管理**: 员工管理, 部门管理 (隐藏: 设备中心, 设备分析, 生产报工)
**业务管理**: 菜品管理, 食材类型 (隐藏: 转换率)
**供应链**: 供应商, 客户, 出货 (全部可见)
**门店进销存**: 采购订单, 销售订单, 半成品库存, 调拨, 应收应付, 价格表, 退货 (全部可见，7项)
**系统配置**: Schema, 表单模版, 规则, AI初始化, 编码规则, AI意图查看 (隐藏: 质检项配置, SOP配置)
**其他**: 报废记录 (可见)

---

## 七、总结对比

| 评估维度 | RN 前端 | Vue Web-Admin |
|---------|---------|--------------|
| 模块可见性控制 | **70%** (Tab+路由+九宫格三层) | **0%** (无 factoryType 过滤) |
| 路由安全 | **高** (工厂路由不注册) | **无** (所有路由可直接访问) |
| 术语映射 | **入口级有效** (4处), 子页面不足 | **基础设施已建** (16键), 利用率8.6% |
| Dashboard 适配 | **完整** (专属API+UI+快捷操作) | **无** |
| 餐饮专属功能UI | **0 专属屏幕** (后端4个Controller无对接) | **0 专属页面** |
| 复用模式 | "减法隐藏+术语替换" 有效运作 | "术语替换" 部分运作, "减法隐藏" 未实施 |

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (RN权限/Vue权限/模块映射)
- Browser explorer: OFF
- Total source files examined: 12+
- Key code references: factoryType.ts, FAManagementStackNavigator.tsx, FactoryAdminTabNavigator.tsx, FAManagementScreen.tsx, FAHomeScreen.tsx, useBusinessMode.ts, AppSidebar.vue, permission.ts, + 7 Vue views using useBusinessMode
- Key disagreements: 1 resolved (useBusinessMode 覆盖率 44%→8.6%), 0 unresolved
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase grounding mode)
- Healer: All checks passed (all sections present, cross-references consistent, recommendations actionable)
- New finding: CENTRAL_KITCHEN 跨端逻辑矛盾 (Critic发现)
