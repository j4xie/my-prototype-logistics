# 餐饮模块修复后评估（Round 2）+ 模块裁剪

**日期**: 2026-03-04
**模式**: Full | 语言: Chinese | 代码库验证: ENABLED

---

## Executive Summary

餐饮模块P0/P2修复到位，但发现2个严重遗漏并已修复：
1. **AppSidebar.vue 5处 module='production'** → 已改为 'restaurant'
2. **restaurant_manager 权限矩阵过宽** → 已裁剪 production/warehouse/sales 为 '-'

额外修复：Dashboard金额格式化、4页search-bar移动端flex-wrap。

---

## 修复验证结果

| 检查项 | 状态 | 备注 |
|--------|------|------|
| P0 Dashboard数据源 | ✅ PASS | 正确调用getRestaurantDashboardSummary |
| P1 router/index.ts module | ✅ PASS | 5条路由均为'restaurant' |
| P1 wastage导出 | ✅ PASS | handleExport完整 |
| P1 productTypeId验证 | ✅ PASS | prop+computed条件规则 |
| P2 loadData catch | ✅ PASS | 3页均有catch+ElMessage.error |
| **AppSidebar module** | ✅ **已修复** | 5处'production'→'restaurant' |
| **权限矩阵裁剪** | ✅ **已修复** | production/warehouse/sales→'-' |
| **Dashboard金额格式** | ✅ **已修复** | toLocaleString千分位 |
| **search-bar flex-wrap** | ✅ **已修复** | 4页均添加 |

## 权限裁剪方案（已实施：方案B）

| 模块 | 修改前 | 修改后 | 原因 |
|------|--------|--------|------|
| dashboard | 'r' | 'r' | 保留 |
| **restaurant** | **'rw'** | **'rw'** | 核心 |
| production | 'r' | **'-'** | 工厂产线，餐饮无关 |
| warehouse | 'r' | **'-'** | 餐饮有自己的盘点 |
| sales | 'r' | **'-'** | 工厂销售，餐饮无关 |
| procurement | 'r' | 'r' | 保留（食材采购） |
| finance | 'r' | 'r' | 保留（成本查看） |
| analytics | 'r' | 'r' | 保留（SmartBI） |

## 遗留问题

| 问题 | 优先级 | 工作量 |
|------|--------|--------|
| rejectWastage后端缺reject端点 | P0 | 后端30min |
| 食材ID手动输入→el-select选择器 | P2 | 每页1-2h |
| 领料独立详情页(KPI+timeline) | P3 | 4-6h |
| 盘点统计汇总卡片 | P3 | 2-3h |
| 配方按菜品分组联动视图 | P3 | 3-4h |
| 7个未使用API函数 | P3 | 信息记录 |
| ref<any[]>类型安全 | P3 | 项目级 |

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (修复验证, 功能对标, API审计)
- Total source files examined: 22+
- Key disagreements: 3 resolved (AppSidebar严重度, reject优先级, 权限裁剪范围)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Healer: All checks passed ✅
