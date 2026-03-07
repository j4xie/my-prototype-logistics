# Vue Web-Admin 餐饮端 vs 工厂端权限分离审计报告

**日期**: 2026-03-03
**模式**: Full | 3 Researchers (codebase-grounded) → Analyst

---

## Executive Summary

当前 factoryType 权限隔离仅覆盖 **5/17 个顶级模块（29%）**，RESTAURANT 用户可见并可访问 12 个不相关模块。Dashboard 完全不考虑 factoryType，餐饮管理员首页全是工厂指标（产量/批次/设备）。后端 API 层 factoryType 校验为**零**。

---

## 一、需立即修复的模块清单

### 需添加 `factoryTypes: ['FACTORY', 'CENTRAL_KITCHEN']` 的模块

| 模块 | 侧边栏位置 | 路由位置 | 类型 |
|------|-----------|---------|------|
| 仓储管理（父+3子） | AppSidebar.vue menuConfig | router/index.ts | 父级限制 |
| 质量管理（父+2子） | AppSidebar.vue menuConfig | router/index.ts | 父级限制 |
| 调拨管理（父+子） | AppSidebar.vue menuConfig | router/index.ts | 父级限制 |
| 销售订单 | AppSidebar.vue 子项 | router/index.ts | 子项限制 |
| 成品库存 | AppSidebar.vue 子项 | router/index.ts | 子项限制 |
| 车间实时生产报表 | AppSidebar.vue 子项 | router/index.ts | 子项限制 |
| 异常预警 | AppSidebar.vue 子项 | router/index.ts | 子项限制 |

### 保持无限制的共享模块

| 模块 | 理由 |
|------|------|
| 采购管理 | 餐饮也需要食材采购 |
| 销售-客户管理 | 通用客户/平台管理 |
| 销售-智能销售分析 | 通用分析 |
| 人事管理 | 通用员工/考勤 |
| 财务管理 | 通用财务 |
| 系统管理 | 后台管理通用 |
| 数据分析（除车间报表/异常预警） | 通用分析 |
| 智能BI | 通用分析平台 |
| 行为校准 | 通用AI校准 |

### 已正确配置的模块

| 模块 | factoryTypes |
|------|-------------|
| 生产管理 | `['FACTORY', 'CENTRAL_KITCHEN']` |
| 设备管理 | `['FACTORY', 'CENTRAL_KITCHEN']` |
| 智能调度 | `['FACTORY', 'CENTRAL_KITCHEN']` |
| 生产分析 | `['FACTORY', 'CENTRAL_KITCHEN']` |
| 餐饮管理 | `['RESTAURANT', 'CENTRAL_KITCHEN']` |

---

## 二、Dashboard 问题

- **无 DashboardRestaurant.vue** — 需新建
- `getDashboardComponent()` 仅按 role 分派，不考虑 factoryType
- DashboardAdmin 的4个卡片（产量/批次/设备运行/设备告警）对餐饮全部无意义
- 快捷操作中「生产管理」链接对餐饮无效

### 餐饮 Dashboard 应显示的指标

| 指标 | API 来源 |
|------|---------|
| 今日食材库存总量 | warehouse API |
| 低库存预警数 | warehouse API |
| 今日领料单数 | restaurant/requisitions API |
| 本日损耗金额 | restaurant/wastage API |
| 今日出勤人数 | hr API |
| 本月营业额 | finance API |

---

## 三、后端安全缺陷

- JWT 不携带 factoryType
- JwtAuthInterceptor 只检查 factoryId 归属，不检查 factoryType
- 5个餐饮 Controller + 7个工厂 Controller 均无 factoryType 校验
- FactoryType.hasProductionCapability() 从未被调用
- 权限分离完全依赖前端菜单隐藏

---

## 四、Sprint 计划

### Sprint 1（1-2天）：P0 — 前端权限配置

1. AppSidebar.vue 添加 7 个模块的 factoryTypes
2. router/index.ts 同步添加路由 meta.factoryTypes
3. guards.ts 拦截行为统一（/ → /403）

### Sprint 2（2-3天）：P0-P1 — Dashboard + 类型安全

1. 新建 DashboardRestaurant.vue
2. getDashboardComponent 支持 factoryType
3. User 接口添加 factoryType 字段，消除 3 处 as any

### Sprint 3（3-5天）：P2 — 共享模块适配

1. 17 个 useBusinessMode 文件的 isRestaurant 逻辑分叉
2. DashboardWarehouse 术语修复

### Sprint 4（5-8天）：P3 — 后端 API 隔离

1. JWT 携带 factoryType
2. 拦截器白名单映射
3. Controller @PreAuthorize 校验

---

## 五、RESTAURANT 用户登录后应看到的最终菜单

```
首页（餐饮 Dashboard）
├── 餐饮管理
│   ├── 配方管理
│   ├── 领料管理
│   ├── 盘点管理
│   └── 损耗管理
├── 采购管理
│   ├── 采购订单（进货单）
│   ├── 供应商（供货商）
│   └── 价格表
├── 销售管理
│   ├── 客户管理（客户/平台）
│   └── 智能销售分析
├── 人事管理
│   ├── 员工管理
│   ├── 考勤管理
│   ├── 白名单管理
│   └── 部门管理
├── 财务管理
│   ├── 成本分析
│   ├── 财务报表
│   ├── 应收应付
│   └── 智能财务分析
├── 系统管理
│   ├── 用户管理
│   ├── 角色管理
│   ├── 操作日志
│   ├── 系统设置
│   ├── AI意图配置
│   ├── 产品信息管理
│   ├── 功能模块配置
│   └── POS集成
├── 数据分析
│   ├── 分析概览
│   ├── 趋势分析
│   ├── AI分析报告
│   └── KPI看板
├── 行为校准
│   └── 校准管理
└── 智能BI
    ├── 经营驾驶舱
    ├── 智能数据分析
    ├── AI问答
    ├── 销售数据分析
    ├── 财务数据分析
    ├── Excel上传
    ├── 查询模板
    ├── 数据完整度
    └── 知识库反馈
```

**被隐藏的工厂专属模块**：
- 生产管理（含批次/计划/转换率/BOM）
- 仓储管理（含原材料批次/出货/盘点）
- 质量管理（含质检记录/废弃处理）
- 调拨管理
- 设备管理（含列表/维护/告警）
- 智能调度（含排产/实时/工人/告警）
- 生产分析（含生产数据/人效）
- 数据分析下的"车间实时生产报表"和"异常预警"
- 销售管理下的"销售订单"和"成品库存"

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Browser explorer: OFF
- Total codebase findings: 30+
- Key disagreements: 0
- Phases: Research → Analysis → Heal
- Fact-check: disabled (codebase-grounded)
- Healer: All checks passed ✅
