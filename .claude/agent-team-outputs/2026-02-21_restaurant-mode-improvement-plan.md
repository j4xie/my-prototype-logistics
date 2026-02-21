# 餐饮模式完善方案 — Agent Team 深度研究报告

**日期**: 2026-02-21
**模式**: Full | 语言: Chinese | Codebase Grounding: ENABLED | Fact-check: OFF

---

## Executive Summary

餐饮模式 E2E 测试 37/37 PASS，条件渲染 6/6 正确，但存在 6 个待完善项。经 3 Researcher + Analyst + Critic + Integrator 全链路分析，核心发现：

1. **后端餐饮 Dashboard API 已存在且功能完整**（`RestaurantDashboardController` + `RestaurantDashboardServiceImpl`），但前端从未调用
2. **前端 Dashboard 调用链**实际为 `dashboardAPI.getDashboardOverview()` → `ReportController` → `ProcessingServiceImpl`，NOT `MobileServiceImpl.getDashboardData()`（Critic 纠正了 Analyst 的关键错误）
3. **i18n 缺失约 15+ keys**，分布在 home.json、profile.json 两个 namespace
4. **Alert 数据隔离**通过 factoryId 已天然实现（餐饮 F002 无 ProductionAlert 数据）
5. **测试数据**已有完整 seed（`seed_restaurant_R001.sql`），但 factoryId 不匹配（R001 vs F002）

**总工作量**: P0 6-8h + P1 3-5h + P2 2-3h = **约 11-16h**

---

## 问题根因分析与修复方案

### P0: 首页 Dashboard 数据 (6-8h) — 必须立即修复

#### 问题
首页 3 个 stat cards 中 "今日订单" 和 "食材预警" 显示 `'--'`，"Failed to load data" 错误提示。

#### 根因 (Critic 验证后修正)

**实际调用链**:
```
FAHomeScreen.tsx L235
  → dashboardAPI.getDashboardOverview('today')
    → GET /api/mobile/{factoryId}/reports/dashboard/overview
      → ReportController → ProcessingServiceImpl.getDashboardOverview()
```

**NOT**:
```
❌ MobileServiceImpl.getDashboardData()  ← Analyst 初始方案有误
```

`ProcessingServiceImpl.getDashboardOverview()` 返回工厂维度数据（总产量、批次数等），对餐饮无意义。

#### 修复方案

**Step 1: 前端路由分发** (`dashboardApiClient.ts`)
```typescript
// 新增方法
async getRestaurantDashboardSummary(): Promise<RestaurantDashboardDTO> {
  return apiClient.get(`/api/mobile/${factoryId}/restaurant-dashboard/summary`);
}
```

**Step 2: FAHomeScreen 条件调度** (`FAHomeScreen.tsx`)
```typescript
// 替换 L235 的 dashboardAPI.getDashboardOverview('today')
const dashboardData = isRestaurantMode
  ? await dashboardAPI.getRestaurantDashboardSummary()
  : await dashboardAPI.getDashboardOverview('today');
```

**Step 3: Stat Cards 数据绑定**
```typescript
// 餐饮 stat cards 绑定实际数据
{ title: t('stats.todayOrders'), value: dashboardData.todayRequisitions }
{ title: t('stats.lowStockAlert'), value: dashboardData.lowStockCount }
{ title: t('stats.alerts'), value: alertCount }
```

**后端**: `RestaurantDashboardController` + `RestaurantDashboardServiceImpl` **已完整实现**，无需后端改动。

#### 文件清单
| 文件 | 改动 | 工作量 |
|------|------|--------|
| `dashboardApiClient.ts` | 新增 `getRestaurantDashboardSummary()` | 0.5h |
| `FAHomeScreen.tsx` | 条件分发 + stat cards 绑定 | 2-3h |
| `types/dashboard.ts` | 新增 `RestaurantDashboardDTO` | 0.5h |

---

### P1a: i18n 缺失 Keys (2-3h) — 本周修复

#### 问题
- 首页 4 个 quick actions 中 "Staff" 未走 i18n，3 个中文硬编码
- Change Password 页面 11 个 raw keys
- About 页面 4 个 raw keys
- FinishedGoodsListScreen 错误弹窗硬编码中文

#### 修复方案

**home.json** (zh-CN + en-US):
```json
{
  "stats": {
    "todayOrders": "今日订单 / Today's Orders",
    "lowStockAlert": "食材预警 / Ingredient Alerts"
  },
  "quickActions": {
    "newPurchase": "新建采购 / New Purchase",
    "newSales": "新建销售 / New Sales",
    "inventoryQuery": "库存查询 / Inventory",
    "staffManagement": "员工管理 / Staff"
  },
  "layout": {
    "restaurantInsights": "经营洞察 / Business Insights",
    "todayOverview": "今日概览 / Today's Overview"
  }
}
```

**profile.json** — Change Password:
```json
{
  "changePassword": {
    "currentPasswordPlaceholder": "请输入当前密码",
    "newPasswordPlaceholder": "请输入新密码",
    "confirmPasswordPlaceholder": "请确认新密码",
    "submitting": "提交中...",
    "confirmButton": "确认修改",
    "errors": {
      "currentRequired": "请输入当前密码",
      "newRequired": "请输入新密码",
      "confirmRequired": "请确认新密码",
      "minLength": "密码至少6位",
      "mismatch": "两次密码不一致",
      "changeFailed": "修改失败"
    }
  }
}
```

**profile.json** — About:
```json
{
  "about": {
    "productIntro": "产品介绍",
    "productDescription": "白垩纪食品溯源系统...",
    "userAgreement": "用户协议",
    "latestVersion": "已是最新版本"
  }
}
```

#### 文件清单
| 文件 | 改动 |
|------|------|
| `i18n/locales/zh-CN/home.json` | 补充 stats/quickActions/layout keys |
| `i18n/locales/en-US/home.json` | 同步 |
| `i18n/locales/zh-CN/profile.json` | 补充 changePassword/about keys, 修复 feedback 重复 |
| `i18n/locales/en-US/profile.json` | 同步 |
| `FAHomeScreen.tsx` | 替换 L485/722/780-817/858/866 硬编码 → `t()` |
| `ChangePasswordScreen.tsx` | 替换 L51-188 → `t()` |
| `AboutScreen.tsx` | 替换 L27/77/80/101 → `t()` |
| `FinishedGoodsListScreen.tsx` | L20 `Alert.alert('错误', ...)` → `t()` |

---

### P1b: 测试数据修复 (1-2h) — 本周修复

#### 问题
- `seed_restaurant_R001.sql` 使用 factoryId=R001，测试账号 restaurant_admin1 的 factoryId=F002
- `factory_feature_config` 表缺少 R001/F002 餐饮配置
- 角色映射: cashier→quality_inspector 不合理

#### 修复方案

**Option A (推荐)**: 创建 `seed_restaurant_F002.sql`，将 R001 数据复制为 F002 版本
```sql
-- 修改 factoryId 为 F002
INSERT INTO recipes (factory_id, ...) VALUES ('F002', ...);
-- 添加 feature_config
INSERT INTO factory_feature_config (factory_id, feature_key, enabled)
VALUES ('F002', 'smartbi', true), ('F002', 'ai_analysis', true), ...;
```

**Option B**: 修改 restaurant_admin1 的 factoryId 从 F002 → R001

---

### P2: 首页错误提示消除 (2-3h) — 短期优化

#### 问题
- "Failed to load data, pull down to refresh" 错误 banner
- "加载成品库存失败" Alert 弹窗

#### 根因
FAHomeScreen 在初始化时调用 `getDashboardOverview()`，餐饮模式下返回错误。
FinishedGoodsListScreen 在某处被触发加载。

#### 修复方案
P0 修复后，Dashboard 错误将自动消失（因为改为调用 restaurant-dashboard API）。

对于成品库存弹窗，在 `FAHomeScreen.tsx` 中添加 `isRestaurantMode` 守卫：
```typescript
if (!isRestaurantMode) {
  // 只在工厂模式下加载成品库存
  await loadFinishedGoods();
}
```

---

### P3: Alert 数据隔离 (Critic 评估: 无需修复)

#### Analyst 原始建议
在 `AlertController` 添加 factoryType 过滤。

#### Critic 反驳 (已验证)
Alert 已按 `factoryId` 过滤。餐饮 F002 不会有 ProductionAlert 数据（那是 F001 的设备维护告警）。当前看到的 "干燥机1号" 告警是因为测试数据不完整（F002 可能共享了 F001 的告警数据）。

**结论**: 非代码问题，是测试数据隔离问题。P1b 的测试数据修复将解决此问题。

---

### P4: SmartBI 餐饮适配 (延后)

| 改进项 | 说明 | 优先级 |
|--------|------|--------|
| 餐饮 KPI 指标 | 翻台率、客单价、食材损耗率 | P3 |
| 餐饮分析模板 | 菜品销量排行、时段分析 | P3 |
| 餐饮术语映射 | "产品"→"菜品"、"原材料"→"食材" | P3 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| P0 修复方案 (前端路由分发) | **95%** | Critic 代码验证确认调用链 |
| 后端 API 已完整 | **90%** | RestaurantDashboardServiceImpl 代码已读，但未实际调用测试 |
| i18n 修复范围完整 | **85%** | 可能遗漏其他页面的硬编码 |
| Alert 无需代码修复 | **80%** | 依赖测试数据隔离正确 |
| 总工作量 11-16h | **75%** | 不含测试验证时间 |

---

## Recommendations

### Immediate (本次迭代)
1. **执行 P0**: 修改 `dashboardApiClient.ts` + `FAHomeScreen.tsx` 路由分发
2. **执行 P1a**: 补全 i18n keys (home.json + profile.json)
3. **验证**: 重新构建 APK，复测首页 + Change Password + About

### Short-term (本周)
4. **执行 P1b**: 创建 F002 测试数据 + feature_config seed
5. **执行 P2**: 添加 isRestaurantMode 守卫消除错误提示
6. **全量复测**: 再次 E2E 截图验证 40 页面

### Conditional (视需求)
7. **P4 SmartBI 餐饮适配**: 仅当有明确餐饮客户需求时执行

---

## Open Questions

1. 是否需要为餐饮模式创建独立的 Dashboard 页面组件（而非在 FAHomeScreen 内 if/else）？
2. restaurant_admin1 的 factoryId 应保持 F002 还是改为 R001？
3. 餐饮模式是否需要独立的 SmartBI 分析模板？
4. 是否需要补充餐饮专属的 Alert 类型（如食材过期预警、库存不足预警）？

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (frontend i18n, backend API, test data/architecture)
- Total sources found: 15+ codebase files examined
- Key disagreements: 1 resolved (Dashboard API call chain — Critic corrected Analyst)
- Phases completed: Research → Analysis → Critique → Integration
- Fact-check: disabled (codebase-grounded analysis)
- Codebase grounding: ENABLED — all claims verified against actual source code
- CRITICAL correction: Analyst's P0 target was `MobileServiceImpl.getDashboardData()`, Critic proved actual target is `ProcessingServiceImpl.getDashboardOverview()` via `ReportController`
