# 六扇门 V1 QA 测试手册 — **Web 端**

**⚠️ 本手册仅 Web 端**. RN APK (移动端) 测试在 **`../移动端流程测试/`** 独立文件夹.

| 端 | 文件夹 | 文件数 | 对象 |
|---|--------|-------|------|
| **Web** | 本文件夹 `流程实际测试/` | 53 | web-admin (139:8086) |
| **RN APK** | 姐妹文件夹 `../移动端流程测试/` | 15 | CretasFoodTrace-*.apk |
| 跨端一致性 | `../移动端流程测试/14-cross-platform-consistency.md` | 1 | Web ↔ RN 数据同步 |

两份配合 → 全栈企业级 QA.

---



**版本**: 2026-04-16 v2
**前身**: `../QA-MANUAL.md` (单文件版, 已保留但不再更新)
**目标**: 按模块独立测试文件, 便于分工 + 维护

---

## 📁 文件索引

| # | 文件 | 内容 | 耗时 | 必做? |
|---|------|------|------|-------|
| 01 | [01-setup.md](01-setup.md) | 环境准备 + 账号 + 登录 + 浏览器配置 | 5 min | ⭐ 首次必做 |
| 02 | [02-regression-17bugs.md](02-regression-17bugs.md) | **Part 1**: 17 Bug 复测 (客户 4-14 反馈) | 30 min | ⭐ 每次部署后 |
| 03 | [03-rd-sample.md](03-rd-sample.md) | 段 1: 研发样品 → BOM → 报价推送 | 15 min | 完整验收 |
| 04 | [04-sales-order.md](04-sales-order.md) | 段 2: 销售订单创建 + 财务审核 | 15 min | 完整验收 |
| 05 | [05-procurement.md](05-procurement.md) | 段 3: 采购 (**含三价同屏**) + 到货 | 20 min | 完整验收 |
| 06 | [06-production.md](06-production.md) | 段 4: 生产计划 + 报工 + 审批 | 15 min | 完整验收 |
| 07 | [07-shipment.md](07-shipment.md) | 段 5: 成品出库 (FIFO 批次分配) | 10 min | 完整验收 |
| 08 | [08-finance-invoice.md](08-finance-invoice.md) | 段 6: 开票 + 审核 + PDF 回写 + 收款 | 15 min | 完整验收 |
| 09 | **[09-killer-feature-g1.md](09-killer-feature-g1.md)** | ⭐⭐⭐ **税率分组开票 G1 (Apr 7 杀手锏)** | 10 min | ⭐⭐⭐ 客户演示必做 |
| 10 | [10-cross-module-dataflow.md](10-cross-module-dataflow.md) | 跨模块数据流验证 (8 条数据链路) | 30 min | 深度验证 |
| 11 | [11-end-to-end-chain.md](11-end-to-end-chain.md) | 端到端完整业务链 (1 订单全程) | 60-90 min | ⭐ 客户演示 |
| 12 | [12-role-permission.md](12-role-permission.md) | 16 角色权限验证矩阵 | 30 min | 安全验收 |
| 13 | [13-known-gaps.md](13-known-gaps.md) | 已知 UI 缺失 / V2 roadmap | 阅读 | 先看再测 |
| 14 | [14-requirements-matrix.md](14-requirements-matrix.md) | 会议需求覆盖对照表 | 阅读 | 交付参考 |
| 15 | [15-automation.md](15-automation.md) | Playwright 自动化 + 回归测试 | 5 min | 每次部署 |
| 16 | [16-full-checklist.md](16-full-checklist.md) | 完整 checklist (140+ 项勾选) | 跑完后 | ⭐ 交付凭证 |
| 17 | [17-system-admin.md](17-system-admin.md) | 系统管理 (用户/角色/Canvas/POS 深度) | 25 min | 深度验收 |
| 18 | [18-hr-operations.md](18-hr-operations.md) | HR (员工/部门/考勤/白名单/⭐工牌) | 20 min | 深度验收 |
| 19 | [19-equipment-ops.md](19-equipment-ops.md) | 设备 (CRUD/维修/告警) | 15 min | 深度验收 |
| 20 | [20-quality.md](20-quality.md) | **质量 (原完全空白补全!)** | 15 min | ⭐ 补齐 |
| 21 | [21-bi-deep.md](21-bi-deep.md) | BI 深度 (Excel/查询模板/AI问答/导出) | 20 min | 深度验收 |
| 22 | [22-finance-deep.md](22-finance-deep.md) | 财务深度 (AR/AP/成本/月结) | 15 min | 深度验收 |
| 23 | [23-warehouse-deep.md](23-warehouse-deep.md) | **仓储深度 (供应商/批次/⭐库存调整/KPI)** | 25 min | ⭐ 补齐 |
| 24 | [24-edge-cases.md](24-edge-cases.md) | **⭐ 10 类边界场景 + 反复操作防护** | 30 min | ⭐⭐ 必做 |
| 25 | [25-downstream-dataflow.md](25-downstream-dataflow.md) | **每操作下游立即验证 (20+ 操作)** | 30 min | ⭐⭐ 必做 |
| 26 | [26-ui-common-patterns.md](26-ui-common-patterns.md) | UI 通用 (分页/排序/多选/导出/脏数据) | 20 min | 通用质量 |
| 27 | [27-scheduling.md](27-scheduling.md) | 智能调度 (7 子路由, 原空白) | 25 min | 补齐 |
| 28 | [28-analytics-reports.md](28-analytics-reports.md) | 分析 (KPI/AI报告/进销存/人效) | 20 min | 补齐 |
| 29 | [29-restaurant-analytics.md](29-restaurant-analytics.md) | 餐饮 (四象限/门店/损耗/点评差距) | 20 min | 补齐 (鼎鲜火锅) |
| 30 | [30-ai-intent-skills.md](30-ai-intent-skills.md) | AI 意图 + Skill/Tool 治理 + 校准 | 20 min | 平台级 |
| 31 | [31-smartbi-advanced.md](31-smartbi-advanced.md) | SmartBI 高级 (What-If/SKU毛利/物料价格) | 15 min | 补齐 |
| 32 | [32-concurrent-safety.md](32-concurrent-safety.md) | **⭐⭐⭐ 并发安全 (多会话)** | 20 min | 数据一致性 |
| 33 | [33-error-recovery.md](33-error-recovery.md) | 错误路径 + 异常恢复 (32 项) | 30 min | 健壮性 |
| 34 | [34-data-integrity.md](34-data-integrity.md) | **数据完整性 + 业务规则 (32 项)** | 40 min | ⭐ 财务核心 |
| 35 | [35-security.md](35-security.md) | **⭐ 安全 (8 攻击向量)** | 2 h | 安全审计 |
| 36 | [36-performance.md](36-performance.md) | 性能 + 压测 (12 项) | 1 h | NFR |
| 37 | [37-i18n-compat.md](37-i18n-compat.md) | 国际化 + 浏览器 + 无障碍 | 30 min | NFR |
| 38 | [38-compliance-observability.md](38-compliance-observability.md) | 合规 + 审计日志 + 可观测 | 30 min | 合规 |
| 39 | [39-platform-admin.md](39-platform-admin.md) | 平台级 (多工厂/蓝图) | 30 min | platform_admin |
| 40 | [40-traceability-camera.md](40-traceability-camera.md) | 溯源 + 摄像头 + VL 识别 | 25 min | IoT |
| 41 | [41-ai-execution-webhook.md](41-ai-execution-webhook.md) | AI 意图 + Webhook + 微信/钉钉 | 25 min | 集成 |
| 42 | [42-device-activation.md](42-device-activation.md) | 设备激活 + 撤销 | 10 min | 安全 |
| 43 | [43-rn-workflows.md](43-rn-workflows.md) | **RN 员工 (operator/inspector/warehouse)** | 45 min | ⭐ 移动端 |
| 44 | [44-rn-offline-compat.md](44-rn-offline-compat.md) | **RN 离线 + Android 兼容 + 推送** | 30 min | ⭐ 移动端 |
| 45 | [45-trigger-chain-e2e.md](45-trigger-chain-e2e.md) | 触发链 E2E + ⭐ **失败恢复** | 30 min | 工作流 |
| 46 | [46-spel-dynamic-rules.md](46-spel-dynamic-rules.md) | SpEL 规则热更新 + 跨工厂继承 | 15 min | Canvas 配套 |
| 47 | [47-cron-jobs-observability.md](47-cron-jobs-observability.md) | 定时任务 + 失败告警 + 手动触发 | 15 min | 运维 |
| 48 | [48-recent-regression-guard.md](48-recent-regression-guard.md) | **⭐⭐ 最近 8 commit 回归防护 (每次部署必做)** | 15 min | ⭐⭐ 必做 |
| 49 | [49-canvas-all-in-one.md](49-canvas-all-in-one.md) | ⭐⭐ **Canvas 大模块集中版 (7 Tab + V3 + 蓝图)** | 90 min | 按模块视角 |
| 50 | [50-smartbi-factory.md](50-smartbi-factory.md) | ⭐⭐ **工厂 SmartBI (OEE/进销存/SKU/What-If)** | 90-120 min | ⭐ **必跑** |
| 51 | [51-smartbi-restaurant.md](51-smartbi-restaurant.md) | ⭐⭐ **餐饮 SmartBI (菜品四象限/门店/损耗/V2)** | 60-90 min | ⭐ **必跑** |
| **99** | **[99-pending-followup.md](99-pending-followup.md)** | ⭐⭐⭐ **R1-R6 遗留 16 项追踪 (curl/V2/验证/渗透)** | 30 min | ⭐⭐ 交付前必跑 |

**⚠️ 注意**: 50 和 51 是系统的**两大独立 BI 模块**, **都要跑**. 内容不交叉但两者都是产品核心功能, 不能省略任一边 (即使当前客户是工厂/餐饮单一类型, 系统本身都有这两套并行).

---

## 🎯 推荐执行顺序

### A. 快速回归 (15 min, 每次部署后)
```
01-setup → 15-automation (跑 Playwright) → 02-regression 抽查 3-5 项
```

### B. 完整验收 (3-4 小时, 重要节点)
```
01-setup → 13-known-gaps (先了解边界) →
02-regression-17bugs (30 min) →
03 → 04 → 05 → 06 → 07 → 08 → 09 (段 1-6, 依次) →
10-cross-module → 11-end-to-end →
12-role-permission → 16-full-checklist 勾选
```

### B+ 深度验收 (6-7 小时, 全模块)
在 B 之后继续:
```
17-system-admin → 18-hr → 19-equipment →
20-quality → 21-bi-deep → 22-finance-deep → 23-warehouse-deep
```
覆盖所有业务模块.

### C 完整 QA (8-10 小时, 交付客户必做)
在 B+ 之后继续:
```
24-edge-cases (边界/反复点击) →
25-downstream-dataflow (每操作下游验证) →
26-ui-common-patterns (分页/排序/导出/脏数据) →
27-scheduling (智能调度) →
28-analytics-reports (分析中心) →
29-restaurant-analytics (餐饮专属) →
30-ai-intent-skills (AI 治理) →
31-smartbi-advanced (SmartBI 高级) →
32-concurrent-safety (并发多会话)
```
真正的**全站 QA**.

### D 企业级全 QA (16-20 小时, 生产上线必做)
在 C 之后继续 (R3 深度审计新增):
```
33-error-recovery (10 类异常恢复) →
34-data-integrity (金额/累计/事务原子) →
35-security (8 攻击向量渗透) →
36-performance (Lighthouse+压测) →
37-i18n-compat (多浏览器+响应式+无障碍) →
38-compliance-observability (脱敏+审计日志+traceId) →
39-platform-admin (多工厂/蓝图) →
40-traceability-camera (溯源+VL) →
41-ai-execution-webhook (意图+集成) →
42-device-activation (设备管理) →
43-rn-workflows (RN 员工完整流) →
44-rn-offline-compat (RN 离线/Android/推送)
```
真正的**企业级交付 QA** — 可上线 / 对合规客户 / 安全审计.

### E 终极全站 QA (24-28 小时, 含触发链+回归+双 BI)
在 D 之后继续 (R4+R5 审计新增):
```
45-trigger-chain-e2e (触发链失败恢复) →
46-spel-dynamic-rules (规则热更新) →
47-cron-jobs-observability (定时任务可观测) →
48-recent-regression-guard (每次部署必做 ⭐⭐) →
49-canvas-all-in-one (Canvas 大模块) →
50-smartbi-factory (工厂 BI, ⭐ 必跑) →
51-smartbi-restaurant (餐饮 BI, ⭐ 必跑)
```

**⚠️ 50 和 51 是两个独立 BI 模块, 必须都跑** — 这是产品设计, 不能按客户类型省一边.

### C. 客户演示准备 (1 小时, 重点演示流)
```
01-setup → 11-end-to-end (预演一遍) → 09-killer-feature-g1 (杀手锏精炼)
```

### D. 分工测试 (多人并行)
- QA-1: 02 (17 bug)
- QA-2: 03, 04, 05 (业务前半)
- QA-3: 06, 07, 08, 09 (业务后半 + G1)
- QA-4: 10, 11 (跨模块 + 链路)
- QA-5: 12 (角色)
- 最后汇总 16-full-checklist

---

## 🎯 通用说明

### 测试环境
- **Web-Admin**: http://139.196.165.140:8086/
- **API**: https://www.cretaceousfuture.com/api/mobile/*
- **APK**: `CretasFoodTrace-六扇门V1-prod-v1.0.1.apk` (122 MB, 项目根)

### 账号 (F001 工厂, 密码全部 `123456`)
见 [01-setup.md](01-setup.md) 完整账号矩阵.

### Bug 上报格式
见 [01-setup.md](01-setup.md) 附录.

### 每个测试文件的结构
每个文件都包含:
1. **前置条件** — 需要什么数据, 用什么账号
2. **操作步骤** — 1/2/3 具体到点哪、输什么
3. **字段清单** — 所有表单字段的名称/类型/必填/示例值
4. **PASS 信号** ✅ — 看到什么 = 通过
5. **FAIL 信号** ❌ — 看到什么 = 失败, 如何上报
6. **后端 API** — 开发定位用
7. **已知限制** — 什么情况跳过
8. **清单勾选** — 本节 checklist

---

## 📊 覆盖统计

| 维度 | 数量 | 备注 |
|------|------|------|
| 模块 | 48 | 业务+辅助+深度+高级+NFR+集成+移动+触发链+回归 |
| Bug 复测 | 17 | 客户 4-14 反馈 |
| 业务链路段 | 6 | 研发→SO→采购→生产→出库→开票 |
| 跨模块数据流 | 8+20 | 段间联动 + 每操作下游 |
| 角色验证 | 16 | 全工厂角色 |
| 会议需求对照 | 19 | 84% 覆盖 |
| 深度模块 | 7 | 系统/HR/设备/质量/BI/财务/仓储 |
| ⭐ 补齐模块 | 6 | 调度/分析/餐饮/AI治理/SmartBI高级 |
| ⭐⭐ 边界场景 | 35 | 反复提交/并发/状态锁/离页 |
| ⭐⭐ 并发多会话 | 10 | 数据一致性 |
| UI 通用模式 | 25 | 分页/排序/导出/脏数据 |
| ⭐ R3 深度补齐 | 12 | 错误恢复/数据完整/安全/性能/合规/RN/平台/溯源/AI/Webhook |
| 安全攻击向量 | 20 | SQL/XSS/CSRF/JWT/IDOR 等 |
| 性能基线 | 12 | 首屏/分页/并发 |
| 数据完整性 | 32 | 累计/事务/FK |
| RN APK 深度 | 50 | 员工完整流 + 离线 + Android 兼容 |
| 触发链 + Cron + SpEL | 28 | 工作流失败恢复 + 热更新 |
| 回归防护 | 12 | 每次部署必跑 |
| 最终 checklist | **750+ 勾选项** | 企业级全 QA |

---

## ⚠️ 先读 [13-known-gaps.md](13-known-gaps.md) 再开始测!

有 6 项会议需求 UI 未完整实现 (属 V2 roadmap), 不算 bug, 跳过即可. 不先读会把这些当 bug 反馈浪费时间.

---

## 文件参考
- **本手册**: `tests/bug-verify-2026-04-15/qa-manual/`
- **自动化**: `tests/bug-verify-2026-04-15/verify-17-full.mjs`
- **会议文档**: `docs/会议内容/客户会议/研发样品至财务回款全流程文档.md`
- **原 bug 清单**: `docs/会议内容/客户会议/web白垩纪ai4-14bug测试.docx`
