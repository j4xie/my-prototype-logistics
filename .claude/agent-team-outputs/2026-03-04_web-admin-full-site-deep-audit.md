# Web-Admin 全站深度审计报告

**日期**: 2026-03-04
**目标URL**: http://139.196.165.140:8086
**测试账号**: factory_admin1 / 123456 (factory_super_admin, F001)
**Mode**: Full | Language: Chinese | Browser: ON | Codebase Grounding: ON

---

## Executive Summary

本次审计覆盖 Web-Admin 全站约 **60+ Vue 页面**、**45+ 注册路由**，从浏览器巡检、代码静态分析、工作流验证、SmartBI E2E 四个维度进行了深度检查。

- **可正常使用的核心页面**: ~12 个（Dashboard、SmartBI 分析/上传、餐饮四模块、采购/销售/调拨等）
- **存在严重缺陷的页面**: ~15 个（500/502 API 错误、空壳页面、工作流断裂）
- **不可达的页面**: ~10 个（404 路由未注册）+ 16 个已实现但未注册的 Vue 文件
- **需要紧急修复的问题**: 5 个 P0 级别

---

## TOP 5 最高优先级修复项

| 排名 | 问题 | 影响范围 | 复杂度 | 状态 |
|------|------|----------|--------|------|
| **#1** | 财务报表 getMockData() 假数据降级 | 用户看到假数据误以为真实 | **S** | 待修 |
| **#2** | 12 页面 API 500/502 后端错误 | 全站 ~30% 页面白屏 | **L** | 待修 |
| **#3** | 质检+生产批次详情工作流断裂 | 两大模块完全不可操作 | **M-L** | 待修 |
| **#4** | XSS — v-html 无 DOMPurify | 安全风险 | **S** | 待修 |
| **#5** | 设备维护路由指向空壳 | 完整页面被废弃 | **S** | 待修 |

---

## 模块 × 质量维度矩阵

| 模块 | 页面可达性 | API 可用性 | 工作流完整度 | 代码质量 | 综合评级 |
|------|-----------|-----------|-------------|---------|---------|
| Dashboard | ✅ OK | ✅ OK | N/A | OK | **A** |
| SmartBI | ✅ (有路由竞态) | ✅ OK | 完整 | 5×F001 硬编码 | **B+** |
| 餐饮运营 | ✅ (4页) | ✅ OK | B (缺权限检查) | submitting 守卫 ✅ | **B** |
| 采购管理 | ✅ OK | ❌ 500+502 | A (流转完整) | OK | **B-** |
| 销售管理 | ✅ OK | ⚠️ 502 | A | OK | **B+** |
| 调拨管理 | ✅ OK | ⚠️ 502 | A | OK | **B** |
| 生产管理 | ✅ (列表) | ❌ 500 | **D** (详情空壳) | 空壳 | **D** |
| 质量管理 | ✅ OK | ✅ OK | **D** (按钮未绑定) | OK | **D+** |
| 仓储管理 | ✅ OK | ❌ 502×2 | N/A | OK | **C** |
| 设备管理 | ❌ 500 | ❌ 500 | 路由错误 | 完整代码被废弃 | **D** |
| 人事管理 | ⚠️ 502 | ❌ 502 | N/A | OK | **D** |
| 财务管理 | ✅ OK | ❌ 500 | N/A | **假数据降级** | **F** |
| 调度管理 | ✅ OK | ❌ 500 | B- (缺 submitting) | 状态大小写不一致 | **C-** |
| 系统管理 | ❌ 500 | ❌ 500 | N/A | OK | **C** |
| 数据分析 | ✅ OK | ✅ OK | N/A | ECharts 泄漏 | **C** |

---

## 分类行动计划

### P0 — 阻断性问题（立即修复）

| ID | 问题 | 文件/位置 | 修复方案 | 复杂度 |
|----|------|-----------|----------|--------|
| P0-1 | 财务报表假数据降级（违反禁止降级规则） | `finance/reports/index.vue:98-105` | 删除 getMockData()，API 失败时 ElMessage.error | **S** |
| P0-2 | 12 页面 500/502 后端错误 | 后端 API 层 | 分批排查：500(稳定bug)优先，502(可能瞬态)二次验证 | **L** |
| P0-3 | 质检"新建"+"查看详情"按钮未绑定 | `quality/inspections/list.vue:83,121` | 添加 @click 事件 + 表单/详情实现 | **M** |
| P0-4 | 生产批次详情空壳 (仅 21 行) | `production/batches/detail.vue` | 实现完整详情页 | **L** |
| P0-5 | XSS — v-html 无消毒 | `analytics/ai-reports/index.vue:217` | 引入 DOMPurify | **S** |

### P1 — 功能缺陷（本周修复）

| ID | 问题 | 文件/位置 | 复杂度 |
|----|------|-----------|--------|
| P1-1 | 设备维护路由指向空壳 index.vue（同目录 list.vue 384行完整实现） | `router/index.ts` | **S** (1行) |
| P1-2 | 侧边栏展开触发意外导航（系统级） | AppSidebar.vue / router guard | **M** |
| P1-3 | SmartBI 路由竞态 — 自动跳转 dashboard | 路由守卫逻辑 | **M** |
| P1-4 | 餐饮领料/损耗缺 canWrite 权限检查 | `restaurant/requisitions/list.vue`, `wastage/list.vue` | **S** |
| P1-5 | 餐饮创建 catch 块为空 — 无错误提示 | 同上 submitCreateForm | **S** |
| P1-6 | 调度/生产计划缺 submitting 双击防护 | `scheduling/plans/*.vue`, `production/plans/list.vue` | **S** |
| P1-7 | 5× 硬编码 F001 factoryId | `SmartBIAnalysis.vue:1307` + calibration×4 | **S** |
| P1-8 | 16 个 Vue 文件未注册路由（含 3 个完整 smartbi-config 页面） | router + views/ | **M** |
| P1-9 | 10 个 404 路由（侧边栏菜单指向不存在的路由） | router vs sidebar menuConfig | **M** |

### P2 — 代码质量（下周修复）

| ID | 问题 | 范围 | 复杂度 |
|----|------|------|--------|
| P2-1 | ECharts 内存泄漏 ×3 + echarts.dispose() 缺失 | analytics/trends, production-analytics/* | **S** |
| P2-2 | 10+ getElementById 反模式 | 多处 SmartBI/analytics | **S** |
| P2-3 | 80× `as any` 类型断言 | 全站 | **M** |
| P2-4 | 35× console.log 残留 | 全站 | **S** |
| P2-5 | 调度模块状态大小写不一致 (draft vs DRAFT) | scheduling 模块 | **S** |
| P2-6 | 质量废弃处理缺 submitting 守卫 | `quality/disposals/list.vue:134-174` | **S** |
| P2-7 | 3 个 composable 写好未使用 (useChartResize, usePagedList, useAsyncData) | composables/ | **M** |

---

## 工作流完整度评级

| 工作流 | 状态覆盖 | 防重复提交 | 确认对话框 | Loading | 错误处理 | 权限 | 等级 |
|--------|----------|-----------|-----------|---------|---------|------|------|
| 采购订单 | 6个全覆盖 | ✅ | ✅ | ✅ | ✅ | ✅ | **A** |
| 销售订单 | 6个全覆盖 | ✅ | ✅ | ✅ | ✅ | ✅ | **A** |
| 调拨管理 | 8个全覆盖 | ✅ | ✅ | ✅ | ✅ | ✅ | **A** |
| 领料管理 | 4个全覆盖 | ✅ | ✅ | ⚠️ | ⚠️ 空catch | ❌ | **B** |
| 损耗管理 | 4个全覆盖 | ✅ | ✅ | ⚠️ | ⚠️ 空catch | ❌ | **B** |
| 调度计划 | 5个(小写) | ❌ | ✅ | ⚠️ 全局loading | ✅ | ⚠️ | **B-** |
| 生产计划 | 5个覆盖 | ❌ | ✅ | ⚠️ 无按钮级 | ✅ | ✅ | **B-** |
| 质量废弃 | 4个覆盖 | ❌ | ✅ | ⚠️ | ✅ | ✅ | **B-** |
| 生产批次 | 详情空壳 | ❌ | ❌ | ✅ 列表 | ✅ 列表 | ✅ | **D** |
| 质量检验 | 2个(只读) | ❌ | ❌ | ✅ | ✅ | ✅(按钮无@click) | **D** |

---

## SmartBI E2E 测试

### 已验证（缓存数据）
- ✅ 7 个图表正确渲染（柱状、饼图、面积、折线、帕累托、排行、增减）
- ✅ KPI 卡片有数据
- ✅ AI 分析生成 4 条洞察（2 风险 + 2 建议），内容针对食品行业
- ✅ 功能按钮完整（同比、因果、分享、导出、维度筛选）

### 未能验证（路由竞态阻塞）
- ❌ 东门口火锅 3461 行数据上传
- ❌ 青花椒鱼类餐饮数据上传
- ❌ Restaurant-hotpot-normal 测试数据上传
- **根因**: /smart-bi/analysis 页面在 Playwright 交互时自动跳转到 /dashboard 或 /production/batches

---

## Quick Wins（1-2 小时内可完成）

1. **设备维护路由修复** — 改 1 行 import 路径 (P1-1)
2. **财务假数据删除** — 删 ~15 行 getMockData (P0-1)
3. **XSS 修复** — 1 行加 DOMPurify.sanitize (P0-5)
4. **ECharts 内存泄漏** — 3 文件各加 ~5 行 cleanup (P2-1)
5. **餐饮权限检查** — 2 文件加 v-if="canWrite" (P1-4)
6. **空 catch 块修复** — 添加 ElMessage.error (P1-5)
7. **硬编码 F001** — 5 处改为 authStore.factoryId (P1-7)

---

## Critic 关键修正

| 原评级 | 修正后 | 原因 |
|--------|--------|------|
| 500/502 统一 P0 | **500=P0, 502=P1** | 502 可能是瞬态网关问题，需二次验证 |
| 财务假数据 P0-2 | **P0-1** (最高优先级) | 唯一让用户看到错误数据的问题 |
| XSS P0-5 | **P1** (降级) | 攻击面窄，AI 生成内容非用户可控 |
| 侧边栏导航 bug (未列TOP5) | **应列入 P1 系统级** | 影响全站导航 + SmartBI E2E |

## 系统性发现

项目存在"前端 UI 先行、后端/交互逻辑滞后"的模式：多个模块有完整的 UI 壳子但核心交互未实现（生产批次详情、质检操作、设备维护路由错误）。后续开发应避免继续产生"看似完成实则不可用"的页面。

---

## Console Error 聚合（15 个独立 API 错误）

### HTTP 502 Bad Gateway (8 个)
| API | 受影响页面 |
|-----|-----------|
| /users?page=1&size=10 | /hr/employees |
| /customers?page=1&size=10 | /sales/customers |
| /suppliers?page=1&size=10 | /procurement/suppliers |
| /transfers?page=1&size=10 | /transfer/list |
| /purchase/orders?page=1&size=10 | /procurement/orders |
| /material-batches?page=1&size=20 | /warehouse/inventory |
| /material-batches/inventory/statistics | /warehouse/inventory |
| /timeclock/admin/history + statistics | /hr/attendance |

### HTTP 500 Internal Server Error (6 个)
| API | 受影响页面 |
|-----|-----------|
| /scheduling/plans?page=0&size=10 | /scheduling/plans |
| /users?page=1&size=10&username=&roleCode= | /system/users |
| /equipment?page=1&size=10 | /equipment/list |
| /smart-bi/analysis/finance | /finance/reports |
| /production-analytics/dashboard | /production-analytics |
| /materials/types | /procurement/orders |

### HTTP 404 Not Found (1 个)
| API | 受影响页面 |
|-----|-----------|
| /products/types | /sales/orders |

---

## Process Note
- Mode: Full
- Researchers deployed: 4 (2 browser + 2 codebase)
- Browser explorer: ON (28+ pages visited)
- Total unique issues found: 42
- Phases completed: Research (parallel) → Analysis → Critique → Heal
- Healer: All checks passed ✅
