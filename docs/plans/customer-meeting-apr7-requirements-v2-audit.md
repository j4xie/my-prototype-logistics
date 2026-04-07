# customer-meeting-apr7-requirements-v2 审核报告

> 审核对象: `docs/plans/customer-meeting-apr7-requirements-v2.md` (画布配置驱动方案)
> 审核日期: 2026-04-07
> 审核团队: Researcher A/B/C + Analyst + Critic + Integrator
> 状态: **不建议按 v2 原计划执行**, 需按本报告"硬伤修复"后重排

---

## 1. 执行摘要 (Executive Summary)

v2 方向值得肯定（画布化、配置驱动是正确长期愿景），但作为**4 周交付计划**严重低估工期、技术前提不成立、且把客户口头降级的需求（采购/人事/财务）放进 P0。三大核心发现:

1. **画布技术栈不存在** — PageEditor 组件 0 文件、Formily 0 依赖、49 个 el-form 硬编码页未纳入范围, Phase 3 "不写一行代码" 不成立。
2. **300+ Tool 的 factoryId 行级隔离未审计** — 一旦六扇门看到别家工厂数据，演示当场退货，比 PageEditor 严重 10 倍 (Critic 新增 P0 blocker)。
3. **17 项遗漏 + 6 个口径错位** — 销售运营报价、税率分组开票、物料需求单实体、产品大类隔离 bug、指定人员授权等真痛点 v2 都漏了。

**最终推荐**: 采用 **Critic 方案 A — 单人 8 周, Week 1 做 factoryId 隔离审计 + 产品大类 bug 修**, v2 重新定位为 **V1.0 (P0-P1 落地) + V2.0 (画布愿景)** 双阶段路线图。

---

## 2. v2 幻觉清单 (Reality Check)

| # | v2 假设 | 实际状态 | 证据 |
|---|--------|---------|------|
| 1 | "PageEditor 组件已存在, 复用即可" | ❌ 0 文件 | Grep `PageEditor` → no match (Researcher A) |
| 2 | "前端用 Formily 渲染动态表单" | ❌ 0 依赖 | `web-admin/package.json` 无 `@formily/*` |
| 3 | "DynamicEntityForm 已覆盖所有表单页" | ❌ 仅 2 页使用, 9 字段, 207 行 | Grep usage = 2 (Researcher A) |
| 4 | "SmartBiSkill 已支持 factory_id 隔离" | ✅ 唯一完全成立 | `SmartBiSkill.java` 缺 factory_id 字段确认 |
| 5 | "Repository finder 全部缺 by-factory" | ❌ Researcher A 错判 | `AIIntentConfigRepository` 已有 11+ by-factory 方法 (Critic 亲验) |
| 6 | "Phase 3 不写一行代码" | ❌ A1-A12 本身就是代码; FormTemplate 编辑器 0 存在 | Researcher C |
| 7 | "适配 5 个 Tool 即可" | ❌ 实际 30+ Tool, 169 意图回归 | Researcher C |
| 8 | "FactoryFeatureConfig 前端已接入" | ❌ 前端 0 引用 | Grep `FactoryFeatureConfig` → 仅后端 |

**结论**: 8 项假设中 1 ✅ / 7 ❌, 整体可行性 < 15%。

---

## 3. 硬伤修复 (Must-Fix Before Execution)

### 硬伤 1: PageEditor 组件不存在
- **现状**: v2 多处引用 "复用 PageEditor", 但代码库 0 文件
- **修复**: 从 P0 范围中移除"画布编辑器", 改为 **后端 schemaJson 直读 + 前端 DynamicEntityForm 扩展**, V2.0 再做编辑器
- **影响**: 砍掉 v2 Phase 3 全部 UI 工作, 节省 ~3 周

### 硬伤 2: Formily 零依赖
- **现状**: `package.json` 无 `@formily/element-plus`, `@formily/core`
- **修复**: **不引入 Formily**(学习成本 1 周 + 49 页迁移成本 4 周), 改用现有 el-form + 配置驱动 props 包装层
- **影响**: 砍掉 1 周引入成本 + 长期维护风险

### 硬伤 3: 49 页 el-form 硬编码 (隐藏成本)
- **现状**: Grep `<el-form` web-admin → 49 文件, 含 list.vue 584 行
- **修复**: V1.0 **只画布化客户演示路径上的 6 页** (sales/orders, sales/quotes, production/plans, production/requisition, material/inbound, factory/products), 其余 43 页保持硬编码, V2.0 再迁移
- **影响**: 范围从"全站画布化"缩到"演示线画布化"

### 硬伤 4: 300+ Tool factoryId 行级隔离未验证 ⚠️ Critic 新增 P0 blocker
- **现状**: Tool 层无统一 factoryId 透传审计, 风险: 六扇门看到别家工厂数据 → 当场退货 + 法律风险
- **修复**: **Week 1 必须做完**:
  1. 编写 `tool-factory-isolation-audit.mjs`, 遍历 `ai/tool/impl/**/*.java`, 检查 doExecute 是否使用 factoryId 参数
  2. 对每个 Repository 的 finder 加单元测试, 跨工厂调用必须返回空
  3. 修复清单提交 PR, 双人 review
- **影响**: 这是**演示前不可妥协**的红线, 优先级高于所有功能

### 硬伤 5: Phase 3 "不写代码" 承诺
- **现状**: A1-A12 + BomItem.group 字段 + FormTemplate 编辑器都是代码
- **修复**: v2 文档把 Phase 3 改名为 **"配置层落地 (含必要代码)"**, 删除 "不写一行代码" 表述
- **影响**: 管理客户预期, 避免 PM 用此承诺对外背书

---

## 4. 需求重新分类

> 客户拒收级别: 🔴 真拒收 / 🟡 抱怨但接受 / 🟢 演示加分项

### P0 立即修 (Week 1, 本周必须开工)
| # | 项 | 拒收级 | 来源 |
|---|----|------|------|
| P0-1 | factoryId 行级隔离审计 + 修复 | 🔴 | Critic |
| P0-2 | 产品大类隔离 bug (G5, 线上 bug 不是新功能) | 🔴 | Researcher B |
| P0-3 | 销售订单税率分组开票 (9% 原料 + 13% 加工费) (G1) | 🔴 | Researcher B 金矿 |
| P0-4 | 销售运营报价流程 (L1, 客户讲了 80 秒) | 🔴 | Researcher B |
| P0-5 | 物料需求单实体补齐 (G3 生产 6 步缺第 2 步) | 🔴 | Researcher B |
| P0-6 | 指定人员授权 (L2, 不是岗位) | 🟡 | Researcher B |

### P0 客户验收必须 (Week 2-4)
| # | 项 | 拒收级 |
|---|----|------|
| P0-7 | A1-A12 字段 schemaJson (**只保留六扇门 1 套模板**, 砍掉另外 5 套) | 🔴 |
| P0-8 | 手机端拍照签收 (L7) | 🔴 |
| P0-9 | 生产报工 mode_1 简化版 | 🔴 |
| P0-10 | 大组长/小组长角色分工 (L16) | 🟡 |

### P1 (Week 5-6)
- L3 工人欠退/换岗扫码
- L5 周转耗材 SKU 化 (客户认为当下痛点, v2 错降 P2)
- L12 研发样品 3 页合 2 页
- 其余 L 级遗漏中 4 项

### P2 (验收后, Week 7+)
- A6 采购模块、A7 人事、A8 财务 (客户原话 5049s "不特别紧急")

### P3 愿景 (V2.0, 8 周外)
- PageEditor 画布编辑器
- Formily 引入 (若决定)
- FormTemplate 编辑器
- 49 页全画布化
- 6 套行业模板

---

## 5. 立即可做清单 (Day 1-5)

| Day | 任务 | 文件 | 工时 | 验收 |
|-----|------|------|------|------|
| D1 AM | 编写 factoryId 隔离审计脚本 | `scripts/audit/tool-factory-isolation-audit.mjs` (新建) | 3h | 输出 300+ Tool 的 factoryId 使用矩阵 CSV |
| D1 PM | 跑审计 + 标红高危 Tool | 输出 `audit-results.md` | 3h | 高危清单 ≤ 30, 列入 Week 1 修复 |
| D2 | 修产品大类 bug | `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/ProductCategoryServiceImpl.java` (定位中) + `web-admin/src/views/factory/products/list.vue` | 6h | 跨工厂查询返回空, E2E 通过 |
| D3 | 税率分组开票后端 | `entity/sales/SalesOrder.java` 加 `taxBreakdown` JSON 字段 + `service/InvoiceService.java` 按税率聚合 | 8h | 单测覆盖 9%/13% 混合场景 |
| D4 | 税率分组开票前端 | `web-admin/src/views/sales/orders/list.vue` (584 行, 已 M) + `views/finance/invoice/create.vue` | 6h | UI 显示双税率明细行 |
| D4 | 销售运营报价 — 数据建模 | 新建 `entity/sales/OperationalQuote.java` + Repository | 4h | 表迁移脚本就绪 |
| D5 | 销售运营报价 — API + 简易 UI | `controller/sales/OperationalQuoteController.java` + `views/sales/quotes/operational.vue` | 8h | 创建/查询/转订单流程跑通 |
| D5 PM | 物料需求单实体 stub | 新建 `entity/production/MaterialRequisition.java` | 2h | DB 表 + 基础 CRUD |

**Day 1-5 工时合计: ~40h (单人一周满载)**

---

## 6. 工期重估 + 推荐方案

| 方案 | 资源 | 工期 | 置信度 | 来源 |
|------|------|------|--------|------|
| v2 原计划 | 单人 | 4 周 | < 15% | v2 原文 |
| 方案 A | 单人 | 8 周 | 70% | Critic 推荐 |
| 方案 B | 双人 | 6 周 | 45% (Brooks's Law) | Analyst 原推荐 |
| 全画布 | 单人 | 11 周 | 80% | Researcher C |

**最终推荐: 方案 A — 单人 8 周**, 理由:
1. 双人协作开销 + 契约谈判, B 实际 7-8 周, 收益不显著
2. 单人对画布架构的整体认知更连贯, 减少返工
3. Week 1 的 factoryId 审计是单点串行任务, 加人无效
4. v2 重新定位为 V1.0 (8 周, P0-P1) + V2.0 (画布愿景)

### Weekly Milestones
- **W1**: factoryId 审计 + 产品大类 bug + 税率分组 + 运营报价 + 物料需求单
- **W2**: A1-A6 schemaJson + 指定人员授权 + 生产报工 mode_1
- **W3**: A7-A12 schemaJson + 拍照签收 + 大小组长
- **W4**: P0 收尾 + **客户预演 (内部 dry-run)**
- **W5**: P1 — 欠退/周转耗材 SKU
- **W6**: P1 — 研发 3→2 页 + 其余 L 项
- **W7**: E2E 回归 169 意图 + buffer
- **W8**: 客户正式演示 + 验收

---

## 7. 里程碑验收标准 (DoD)

| 里程碑 | DoD |
|--------|-----|
| W1 | (a) audit-results.md 高危 Tool 全部修复 PR merge (b) 跨工厂 E2E 自动化用例覆盖率 100% (c) 产品大类 bug 复现 case 关闭 (d) 税率分组单测 + UI 演示视频 |
| W2 | A1-A6 在六扇门工厂 schemaJson 配置渲染正确, 不影响其他 demo 工厂 |
| W3 | A7-A12 同上 + 报工 mode_1 实机演示通过 + 拍照签收 RN App 联调 |
| W4 | **内部 dry-run** 通过 (PM + 销售 + 1 名外部观察员), 写出"客户可能反悔点"清单 |
| W5-6 | P1 项全部通过 E2E |
| W7 | 169 意图回归通过率 ≥ 98%, factoryId 隔离回归 100% |
| W8 | 客户验收 sign-off |

---

## 8. 风险登记册

| # | 风险 | 概率 | 影响 | 分数 | 缓解 |
|---|------|------|------|------|------|
| R1 🔥 | factoryId 隔离漏洞 → 跨工厂数据泄露 | 40% | 致命 | 16 | W1 必修 + 双人 review + 自动化回归 |
| R2 🔥 | 客户反悔"采购不紧急"承诺 | 55% | 高 | 11 | W4 dry-run 时让 PM 重确认书面 |
| R3 🔥 | Week 4 发现 schemaJson 设计方向错, 回滚 2 周 | 30% | 高 | 9 | W1-W2 做小步 spike, 不一次性铺开 |
| R4 | Phase 3 "不写代码" 被引用对外背书 | 60% | 中 | 9 | v2 文档立即改名 |
| R5 | 49 页硬编码迁移诱惑导致范围蔓延 | 50% | 中 | 7.5 | W1 锁定 6 页清单, 其余进 V2.0 |
| R6 | 169 意图 W7 回归不通过 | 25% | 高 | 6 | W3 起每周跑一次回归 |
| R7 | 单人病假/中断 | 15% | 高 | 4.5 | W4 之后允许加人, W1-W3 不允许 |

---

## 9. v3 文档大纲

**v3 核心原则**: 双阶段路线图 (V1.0 落地 / V2.0 愿景), 不做无证据承诺, 每项需求带客户拒收级别, 工期带置信度。

**v3 章节结构**:
1. 背景与客户原话锚点 (引用会议时间戳)
2. V1.0 范围 (8 周, P0-P1)
3. V2.0 愿景 (画布化, 不绑定时间)
4. 需求清单 (按 P0/P1/P2/P3 + 拒收级别)
5. 技术前提清单 (factoryId 审计、schemaJson 设计、49 页范围锁定)
6. 8 周里程碑 + DoD
7. 风险登记册
8. 开放决策项 (抛回 PM)
9. Appendix: 与 v2 的差异对照表

**v3 与 v2 关键差异**:
- 删除 "PageEditor 复用"、"Formily"、"不写一行代码" 等不实表述
- 新增 factoryId 隔离 P0 章节
- 砍 5 套模板, 只留六扇门
- 工期 4 周 → 8 周
- 把采购/人事/财务从 P0 降到 P2

---

## 10. 开放问题 (Need PM / CEO Decision)

| # | 问题 | 决策方 | 截止 |
|---|------|--------|------|
| Q1 | 6 套行业模板是砍 5 套还是保留？(整场会议只有 1 个客户, B 类过度设计) | CEO/PM 商业战略 | W1 D2 |
| Q2 | v2 4 周计划是否已对客户/老板承诺？推翻成本? | PM | W1 D1 |
| Q3 | 是否接受 V1.0 (8 周 P0-P1) + V2.0 (画布愿景) 双阶段定位? | PM + CEO | W1 D2 |
| Q4 | 采购/人事/财务从 P0 降到 P2 是否需要客户书面确认? | PM + 销售 | W1 D3 |
| Q5 | factoryId 隔离审计若发现 > 50 个高危 Tool, 是否延期 1-2 周演示? | PM | W1 D5 |
| Q6 | Formily 是否引入? (V2.0 决策, 但需 W4 前定方向) | 技术负责人 | W4 |
| Q7 | 49 页硬编码迁移是否进 V2.0 commit, 还是按需迁移? | 技术负责人 | V1.0 验收后 |

---

**报告完。** 建议 PM 在 W1 D1 上午先决策 Q1/Q2/Q3, 否则 W1 工作无法启动。
