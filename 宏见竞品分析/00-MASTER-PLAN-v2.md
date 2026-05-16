# 宏见竞品分析 — 最终主计划 v2

> **v1 → v2 重大修正** (基于 3 路高强度审计 + 23 个用户决策):
> 1. 销售红线 4 → 2 (sessionId / slot-filling 已 ship)
> 2. 工时按 Claude 协助 1.7-2x 重新算
> 3. N# 编号统一到业务域前缀 (S/P/M/W/F/H/Q/C/U)
> 4. 客户群明确 = 餐饮 (QHJ 已上线维护) + 食品厂 (六扇门 + 1-2 个在谈) 双主线
> 5. ASAP 1.5 个月详细按周排期
> 6. 加双主线能力拆分原则
>
> **优先阅读**: §0 摘要 + §9.1 ASAP 详细排期 + 附录 A 销售话术 + 附录 C 能力拆分表

---

## 目录

- [§0 执行摘要 (v2 关键修正)](#0-执行摘要)
- [§1 客户画像 (修正版)](#1-客户画像)
- [§2 宏见演示分析](#2-宏见演示分析)
- [§3 Cretas 现状 (含红线 audit 结果)](#3-cretas-现状)
- [§4 双主线策略 (新增)](#4-双主线策略)
- [§5 业务功能借鉴 (N# 重编后)](#5-业务功能借鉴)
- [§6 UI/UX 借鉴](#6-uiux-借鉴)
- [§7 Cretas 自身优化](#7-cretas-自身优化)
- [§8 战略 Hybrid](#8-战略-hybrid)
- [§9 实施计划 (ASAP 详细排期 + 后续 Sprint)](#9-实施计划)
- [§10 风险与依赖](#10-风险与依赖)
- [§11 销售物料](#11-销售物料)
- [§12 KPI 与验收](#12-kpi-与验收)
- [附录 A: 销售话术红线 v2](#附录-a-销售话术红线-v2)
- [附录 B: Claude 协助工时计算逻辑](#附录-b-claude-协助工时计算逻辑)
- [附录 C: 双主线能力拆分表](#附录-c-双主线能力拆分表)
- [附录 D: v1 → v2 changelog](#附录-d-v1-→-v2-changelog)
- [附录 E: 用户 23 个决策记录](#附录-e-用户决策记录)

---

## §0 执行摘要

### 0.1 v2 vs v1 关键修正

| # | v1 (错) | v2 (正) | 影响 |
|---|---|---|---|
| 1 | "AI 会问您缺什么参数" 禁说 | PR #596 已 ship, **可说** | 销售解锁话术 |
| 2 | "多轮对话记住上下文" 禁说 | sessionId 端到端通, **可说** | 销售解锁话术 |
| 3 | Phase 0 修死代码 10 人天 (4 项) | **9 人天 (3 项)** sessionId 跳过 | 减 1 人天 |
| 4 | 总工时 145 人天单人 6 月 | **真实 270 人天 / Claude 1.7-2x 加速后人工 ~160 工日** | 时间表合理化 |
| 5 | "4 部门" 推断错 | 客户实际 **6 模块** (销售/采购/仓库/生产/财务/HR) | 措辞修正 |
| 6 | "Cretas 命中度 70-80%" 无公式 | 删除无依据百分比, 改为定性"高度对齐" | 严谨化 |
| 7 | N# 编号混乱 (FINAL_A.N31 ≠ MUST_COPY.N31) | 统一业务域前缀 (S/P/M/W/F/H/Q/C/U + UX) | 团队执行不出错 |
| 8 | v1 写 "Tool 404" / v2 一度估 "~354" | **Audit B fresh 实测 404** (含 abstract); Screen **410**; Entity **326** (88 root + 53 enums + 185 subdirs); 餐饮 Tool **~80** | 销售数字真实, Screen 4 倍低估 / Entity 7 倍低估 |
| 9 | "客户已接受 Hybrid" 客户没说过 | 修正为"客户主动要求 AI 中台 + ERP 底层" | 引文准确 |
| 10 | 单主线计划 | **双主线** (餐饮维护 10% + 食品厂主推 90%) | 资源分配明确 |

### 0.2 ASAP 1.5 个月范围 (核心)

```
Week 1-2  Sprint 0 (设计) + Phase 0 (修死代码)  [18 人天]
Week 3-4  Bug 修复 + N20 attachment + N13 抄码品  [19 人天]
Week 5-6  N32 BOM UI + N3 RBAC + 单据打印  [9-15 人天]
─────────────────────────────────────────────────────
Sprint 0-1 合计: 46 人天 名义 / ~28 工作日 Claude 协助 / ~5.5-6 周完成
ASAP 末统一交付 1 次, 不做周演示
```

### 0.3 后续路线 (Sprint 2 起, Week 7-)

```
Week 7-10   Sprint 2: N24/25 工序管理 + 产品工序配置 (并行 UX Top 3)  [~30d]
Week 11-14  Sprint 3: N31 销售→采购自动分流 + N48 研发样品           [~20d]
Week 15-20  Sprint 4-5: 财务深度 + UX 移动 + 钉钉机器人 (N49)        [~50d]
Week 21-24  Sprint 6: P1 业务流补完 + UX Web                       [~30d]
─────────────────────────────────────────────────────
Sprint 2-6 合计: ~130 人天名义 / ~78 工作日 / ~17 周
```

**总时间**: ASAP 6 周 + Sprint 2-6 = ~23 周 ≈ **5.5 个月** (Claude 1.7x 协助)

### 0.4 关键决策清单 (23 项, 详见附录 E)

ASAP / 双主线 / N# 重编 / Sprint 0 引入 / UX 与 Sprint 2 并行 / 客户 1-2 个在谈 / MASTER 全面重写 / 不做周演示 / 餐饮仅维护 / 工时按 Claude 加速重算等

---

## §1 客户画像

### 1.1 六扇门 F006 基本信息 (无变更)

[保留 v1 §2.1 内容]

### 1.2 关键修正: 4 部门 → 6 模块

**v1 错**: "客户主用 4 部门 (销售/采购/仓库/生产)"

**v2 正**: 客户口述实际**6 个模块**——销售 / 采购 / 仓库 / 生产 / 财务 / HR。**"4 部门"是 MASTER v1 推断错**, 已根据第二次会议 L37 修正。

### 1.3 关键修正: 客户对 AI 的真实期望

**v1 错**: "客户已经接受 Hybrid"

**v2 正**: 客户**从未说"Hybrid"一词**, 但客户原话明确表达 **底层 ERP + AI 桥梁** 范式:

> 张权-昆山 2026-03-18 11:13:29: "我们现在**底层肯定是要把这些 ERP 啊 MES 这些底层先打好**, 这个肯定是格式化的, 标准化的东西... 想用 AI 去做一个这个中间的**桥梁**"

**也修正**: "客户主动要求 Agent-first" 改为"客户对 AI 成本敏感, 但接受 AI 作为录入/查询入口"。客户原话 11:14:20:
> "我觉得这个费用来讲, 我们其实调接口也能承担"

[其余 §1 内容沿用 v1 §2.4-2.6]

---

## §2 宏见演示分析

[保留 v1 §3 内容, 仅修正以下数字]

- 演示时长: **23:32 视频 / 21:36 音频** (v1 写"17 分钟"错)
- 客户决策段画面停留时长: ~5 分钟 (v1 写 3 分钟略偏低)

---

## §3 Cretas 现状

### 3.1 真实强项 (19 项独家, 修正后)

[保留 v1 §4.1 大部分, 修正以下]:

| 项 | v1 | v2 修正 |
|---|---|---|
| Tool 数 | "404 个" | **404 个** (Audit B fresh 实测, 含 abstract) |
| Skill 数 | "32 个" | **18 默认 + 14 SKILL.md** (部分重叠, 独立 ~18-25) |
| 餐饮 Tool | "35+ 个" | **~80 个** (19.8% of 404, Audit B) |
| 食品厂 Tool | (未列) | **~38 个** (9.4%) |
| 共享 Tool | (未列) | **~273 个** (67.6%) |
| Screen 数 | "100+" | **410 个** (Audit B 实测, v2 早期低估 4 倍) |
| Entity 数 | "43" | **326** (88 root + 53 enums + 185 subdirs, v2 早期只算 root) |

### 3.2 死代码 / Bug 修复 (修正后)

**死代码 3 项** (从 v1 的 4 项缩减):

| # | 项 | v1 工时 | v2 工时 | 说明 |
|---|---|---|---|---|
| ~~1~~ | ~~AIChat sessionId 不传~~ | 0.5d | **0d (已 ship)** | PR 已含 sessionId 25 次 |
| 2 | AILayoutAssistant 接真 LLM | 4d | 4d | `DecorationServiceImpl.java:207` 仍写死 |
| 3 | PageEditor 1252 行挂导航 | 2d | 2d | nav 0 hits |
| 4 | Canvas Tool Repository 统一 | 3d | 3d | pagedesign vs decoration 不一致 |
| **合计** | **9.5d** | **9d** | |

**Bug 5 项** (12d, 无变更):
- 三价对比刷新 / 生产工序通用 / PDF 扫码 RN 端 / BOM 物料选择器 / 单位转换强校验

### 3.3 红线 audit 结果 (重要)

| # | 红线 | v1 状态 | **v2 audit 结果** |
|---|---|---|---|
| 1 | "AI 会问您缺什么参数" | ❌ 禁说 | **✅ 可解除** (PR #596 5/13 ship SlotFilling LLM 兜底; `SlotFillingServiceImpl.java:71-316` + `SseStreamingService.java:284-309` 7b 步骤完整) |
| 2 | "多轮对话记住上下文" | ❌ 禁说 | **✅ 可解除** (`IntentExecuteRequest.java:77` sessionId + `IntentExecutionOrchestrator.java:176-182` 路由 + ConversationServiceImpl maxRounds=5) |
| 3 | "智能布局是 AI 决策" | ❌ 禁说 | ❌ **仍禁说** (`DecorationServiceImpl.java:207` 仍 `modelUsed("rule-based")`; AILayoutAssistant 整方法纯 if/else) |
| 4 | "Redis 缓存 5 分钟" | ❌ 禁说 | ❌ **仍禁说** (`IntentResultCache.java:4-67` 纯 Caffeine; Redis 自动配置 EXCLUDE) |

详见 `03-审计过程/REDLINE_AUDIT.md`。

---

## §4 双主线策略 (新增)

### 4.1 现状

| 主线 | 已落地客户 | 工作量分配 | 责任 |
|---|---|---|---|
| **餐饮主线** | **QHJ 已上线** | ~10% (维护 + bug 修复) | 不抢资源 |
| **食品厂主线** | **六扇门 F006** + 1-2 个在谈 | ~80% (主推进) | ASAP 主战场 |
| **底层共享** | (Tool/Skill/AI/Attachment 等) | ~10% (基础设施增量) | 改动一次, 两条线收益 |

### 4.2 双主线工作量加权

```
原 270d 单线工作量
× 1.15 = 311d (餐饮 10% 增量 + 共享 90% 复用)
÷ 1.7-2x Claude 加速
─────────────────────────
= 155-183 工作日 实际人工
÷ 22 工作日 = 7-8.5 个月单人
```

ASAP 1.5 个月范围属于"食品厂主线" + "底层共享"两条, 不抽餐饮资源。

### 4.3 能力拆分原则 (Sprint 0 输出)

详见**附录 C 双主线能力拆分表**, 按 Tool/Skill/Screen/Entity 4 类逐项 tag:
- 🍽️ 餐饮专属
- 🏭 食品厂专属
- 🔄 共享底层

---

## §5 业务功能借鉴

### 5.1 N# 重编 (v2 新)

**v1 错**: FINAL_A.N31/N48 vs MUST_COPY.N31/N48 指代不同条目

**v2 修正**: 全部条目按业务域前缀重编, 详见附录 C 表。

主要业务域:
- **S** = Sales (销售/CRM)
- **P** = Procurement (采购)
- **M** = Manufacturing (生产)
- **W** = Warehouse (库存/仓库)
- **F** = Finance (财务)
- **H** = HR (人力资源)
- **Q** = Quality (质检)
- **C** = Common (通用平台)
- **U** = UI/UX (设计语言)

### 5.2 P0 必抄 8 项 (无变更内容, 仅 N# 重编)

| 旧编号 | 新编号 | 项 | 工时 (Claude 加速后人工) |
|---|---|---|---|
| N49 | **C-AI-1** | 钉钉机器人 PoC | 6d → **4d** |
| N20 | **C-ATT-1** | 通用 attachment 系统 | 5d → **3d** |
| N24/25 | **M-WP-1/2** | 工序管理 + 产品工序配置 | 5d → **3d** |
| N32 | **M-BOM-1** | BOM 配方编辑 UI | 5d → **3d** |
| N13 | **W-ABA-1** | 抄码品识别 | 2d → **1d** |
| N3 | **C-RBAC-1** | RBAC 仓管隔离审计 | 2d → **1d** |
| N31 | **S-MRP-1** | 销售→采购自动分流 | 4d → **2.5d** |
| N48 | **S-RD-1** | 研发样品→BOM→报价 | 5d → **3d** |
| **合计** | | | 32d → **~20d** (Claude 1.7x) |

### 5.3 P0 必修 Bug 5 项 (Claude 加速后)

| 项 | v1 工时 | v2 工时 |
|---|---|---|
| 三价对比刷新 | 2d | **1d** |
| 生产工序通用关联 | 2d | **1d** |
| PDF 扫码 RN 端 | 4d | **2.5d** |
| BOM 物料选择器 | 2d | **1d** |
| 单位转换强校验 | 2d | **1d** |
| **合计** | 12d | **~7d** |

### 5.4 P1 必抄 10 项

[保留 v1 §5.4, 仅工时按 Claude 1.7x 加速重算, 详见 §9 Sprint 安排]

### 5.5 不抄 (反对项) 7 + 客户群不需 22 项

[保留 v1 §5.5-5.7]

---

## §6 UI/UX 借鉴

### 6.1 UX Top 3 (Claude 加速后)

| 编号 | 项 | v1 工时 | v2 工时 |
|---|---|---|---|
| **U-NAV-1** | 业务流程图导航 | 10d | **6d** |
| **U-ACT-1** | 行末"操作 ▾" 下拉 | 10d | **6d** |
| **U-FOOTER-1** | Sticky Footer 实时合计 | 7d | **4d** |
| **合计** | | 27d | **~16d** |

**新决策**: UX Top 3 **与 Sprint 2 (Week 7-10) 并行做**, 不单独 Sprint。

### 6.2 UX 移动 5 项 (M1-M5, 13d → 8d)

[保留 v1 §6.2, 编号改 U-MOBILE-1 ~ U-MOBILE-5]

### 6.3 UX Web 5 项 (W1-W5, 20d → 12d)

[保留 v1 §6.3, 编号改 U-WEB-1 ~ U-WEB-5]

---

## §7 Cretas 自身优化

[保留 v1 §7 内容, 修正"4 死代码"→"3 死代码", "4 红线"→"2 红线 + 2 解除"]

---

## §8 战略 Hybrid

[保留 v1 §8 内容]

---

## §9 实施计划

### 9.1 ASAP 1.5 个月详细按周排期 (核心) ⭐

> **客户期望**: 六扇门 ASAP 看到 P0 修复
>
> **工时模型**: 名义 46d × Claude 1.7x 加速 = ~27 工作日 = 5.5-6 周
>
> **节奏**: 不做周演示, ASAP 末统一交付 1 次

#### Week 1: Sprint 0 (设计期前半)

| Day | 任务 | 编号 |
|---|---|---|
| Mon | N# 重编 + NUMBERING_MAP.md | C-DOC-1 |
| Tue | (同上 继续) — 写映射 + 验证 | C-DOC-1 |
| Wed-Fri | 双主线能力拆分表 (Tool/Skill/Screen/Entity 4 类 tag) | C-DESIGN-1 |

**Week 1 交付**:
- ✅ NUMBERING_MAP.md (v1 → v2 编号双向映射)
- ✅ 餐饮/食品厂/共享 三类 tag 完整覆盖 **404 Tool / 18 Skill / 410 Screen / 326 Entity** (实测数字)
- ✅ 决策: 哪些组件需 fork (餐饮专属 vs 食品厂专属)

#### Week 2: Sprint 0 (设计期后半) + Phase 0 第一项

| Day | 任务 | 编号 |
|---|---|---|
| Mon-Thu | 9 张数据表设计 + API 契约 | C-DESIGN-2 |
| Fri | Phase 0 — AILayoutAssistant 接真 LLM (Day 1/3) | C-AI-2 |

**9 张数据表** (Sprint 0):
1. abaca_packaging (抄码品标记) ← W-ABA-1
2. group_leader_report (小组长代报工) ← M-RPT-1
3. attachment (通用附件) ← C-ATT-1
4. dingtalk_webhook_log (钉钉消息日志) ← C-AI-1
5. work_process / product_work_process_config ← M-WP-1/2
6. bom_recipe + bom_recipe_item ← M-BOM-1
7. sample_request + sample_followup ← S-RD-1
8. customer_product_price_history (客户记忆价) ← S-PRICE-1
9. rbac_warehouse_isolation_audit ← C-RBAC-1

**Week 2 交付**:
- ✅ 9 张表 schema + ER 图
- ✅ API 契约 (REST endpoint 列表 + SSE event + Skill 参数 schema)
- ✅ AILayoutAssistant Day 1/3 (PythonLLMClient 集成开始)

#### Week 3: Phase 0 完成 + Bug 修复 (前 3 项)

| Day | 任务 | 编号 |
|---|---|---|
| Mon-Tue | AILayoutAssistant 接真 LLM (Day 2-3/3) | C-AI-2 |
| Wed | PageEditor 挂导航 + 跑通基础 | C-CANVAS-1 |
| Thu | Canvas Tool Repository 统一 (Day 1/2) | C-CANVAS-2 |
| Fri | Canvas Tool Repository (Day 2/2) + Bug — 三价对比刷新 | C-CANVAS-2 + W-BUG-1 |

#### Week 4: Bug 修复完成 + N20 通用 attachment + N13 抄码品

| Day | 任务 | 编号 |
|---|---|---|
| Mon | Bug — 生产工序通用关联 | M-BUG-1 |
| Tue | Bug — BOM 物料选择器 | M-BUG-2 |
| Wed | Bug — 单位转换强校验 | M-BUG-3 |
| Thu-Fri | PDF 扫码 RN 端串通 (Day 1-2) | M-BUG-4 |

#### Week 5: PDF 完成 + N20 attachment + N13 抄码品

| Day | 任务 | 编号 |
|---|---|---|
| Mon | PDF 扫码 RN 端 (Day 3) | M-BUG-4 |
| Tue-Wed | 通用 attachment 实体 + service + OSS 集成 | C-ATT-1 |
| Thu | attachment 5 模块接入 (客户/采购/质检/生产/财务) | C-ATT-1 |
| Fri | 抄码品识别 (W-ABA-1) | W-ABA-1 |

#### Week 6: N32 BOM UI + N3 RBAC + 单据打印 + ASAP 交付

| Day | 任务 | 编号 |
|---|---|---|
| Mon-Wed | BOM 配方编辑 UI + 出成率自动折算 | M-BOM-1 |
| Thu | RBAC 仓管隔离审计 (验证 #423 完整性) + 单据打印 PDF (起步) | C-RBAC-1 + C-PRT-1 |
| Fri | ASAP 末统一交付 + Demo 视频 v1 (2 分钟) | DEMO-1 |

**ASAP 交付清单 (Week 6 末)**:
- ✅ Phase 0 死代码 3 项全修
- ✅ 5 个客户已反馈 bug 全修
- ✅ N# 编号统一 + 双主线能力表
- ✅ 通用 attachment (5 模块用)
- ✅ 抄码品识别
- ✅ BOM 配方编辑 UI
- ✅ RBAC 仓管隔离审计通过
- ✅ 单据打印起步
- ✅ 2 分钟 demo 视频
- ✅ 销售红线更新 (2 解除)

### 9.2 后续 Sprint 路线图 (Week 7+)

#### Sprint 2 (Week 7-10): 工序管理 + UX Top 3 并行

```
主线 (1 人):
  Week 7-8  M-WP-1 工序管理前端 + M-WP-2 产品工序配置  (3d + 3d = 6d)
  Week 9-10 U-NAV-1 业务流程图导航 (6d) + U-ACT-1 行末下拉 (6d) [并行]

人工日: 6 + 12 = 18d → Claude 加速后 ~11 工作日 = 2.5 周
但 4 周排期含 testing + 客户反馈 buffer
```

#### Sprint 3 (Week 11-14): 销售→采购全链路 + 研发样品

```
S-MRP-1 销售→采购自动分流 (2.5d, 含修 BomExpansion stub + 整合 ShortageAnalysis)
S-RD-1 研发样品→BOM→报价 链路 (3d)
U-FOOTER-1 Sticky Footer 实时合计 (4d)
+ Demo 视频 v2 5 分钟主 demo (1d)
─────────────
~10.5d 工作日 / 4 周排期
```

#### Sprint 4 (Week 15-18): 财务深度 + 钉钉机器人

```
F-AR-1 销售订单财务审核 (3d)
F-AP-1 采购订单财务审核 + 三价标红 (2d)
F-INV-1 开票申请 + 发票回写 + 收款流水 (5d)
C-AI-1 钉钉机器人 PoC (4d)
─────────────
~14d 工作日 / 4 周排期
```

#### Sprint 5 (Week 19-22): UX 移动 + HR 流程

```
U-MOBILE-1~5 行级色块/多维 chip/Skeleton/Toast/Haptic  (8d)
H-LEAVE-1 请假流程 (2.5d)
H-OVT-1 调休流程 (2.5d)
H-EXP-1 报销流程 (2.5d)
+ Demo 视频 v3 10 分钟完整版 (1d)
─────────────
~16.5d 工作日 / 4 周排期
```

#### Sprint 6 (Week 23-24+): 完善 + UX Web (选)

```
S-PRICE-1 客户记忆价 (2d)
M-RPT-1 小组长代报工 (2d)
H-ATT-1 月度考勤矩阵 UI (2d)
W-TRACE-1 库存流水追溯 UI (2d)
+ U-WEB-1~5 (12d, 视 Web-Admin 客户而定)
─────────────
~8-20d / 2-4 周
```

### 9.3 总时间表

| 阶段 | 时长 | 名义 d | 实际 d (Claude 1.7x) |
|---|---|---|---|
| ASAP (Sprint 0 + 1) | Week 1-6 | 46 | ~27 |
| Sprint 2 | Week 7-10 | 18 | ~11 |
| Sprint 3 | Week 11-14 | 10 | ~6 |
| Sprint 4 | Week 15-18 | 14 | ~8 |
| Sprint 5 | Week 19-22 | 17 | ~10 |
| Sprint 6 | Week 23-24+ | 8-20 | ~5-12 |
| **合计** | **24 周 ≈ 5.5 个月** | **113-125** | **~67-74 工作日** |

**关键点**: 24 周实际只占 ~67-74 工作日, 因为 Claude 协助加速。剩余时间是 testing / 客户反馈迭代 / buffer / 周末。

---

## §10 风险与依赖

[保留 v1 §10, 加新风险]:

### v2 新风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| Claude 加速倍数估计不准 | 时间表偏差 | 第 2 周末复盘真实加速比, 调整后续 sprint |
| 双主线"共享层"边界不清 | 餐饮代码被破坏 | Sprint 0 拆分表是必要前置 |
| 食品厂 1-2 个在谈客户需求不一致 | scope 摇摆 | 以六扇门为基线, 其他客户走 Phase 2 |
| ASAP 6 周末统一交付的 risk | 1 次交付失败 | Sprint 0 末 + Phase 0 末 内部 dry-run |

---

## §11 销售物料

### 11.1 Demo 视频升级 (v2)

| 时点 | 视频 | 内容 |
|---|---|---|
| Week 6 末 (ASAP 交付) | 2 分钟 v1 | 修死代码 + bug 修复演示 |
| Week 10 末 (Sprint 2) | 3 分钟 v1.5 | 工序管理 + UX Top 3 一部分 |
| Week 14 末 (Sprint 3) | 5 分钟主 demo | 销售员一句话完成销售→生产→采购 |
| Week 22 末 (Sprint 5) | 10 分钟完整版 | 食品厂 6 模块完整一天工作 |

### 11.2 销售话术 (v2 修正版)

详见**附录 A**, 2 条红线已解除 + 2 条仍禁。

---

## §12 KPI 与验收

[保留 v1 §12, 调整时间点为 Week 6 / 10 / 14 / 18 / 22 / 24]

---

# 附录 A: 销售话术红线 v2

## ✅ 修完 Phase 0 之前**也可以说** (从 v1 禁说升级)

| 话术 | 支撑证据 |
|---|---|
| "AI 会问您缺什么参数 (多轮 slot-filling)" | PR #596 (2026-05-13) `ff1092389` ship; `SlotFillingServiceImpl.java:71-316`; SSE 7b 步骤完整 |
| "多轮对话记住上下文" | `IntentExecuteRequest.java:77` + `IntentExecutionOrchestrator.java:176-182` 路由 + ConversationServiceImpl maxRounds=5 |

## ❌ 修完 Phase 0 之前**仍禁说**

| 话术 | 真相 | 修完哪一项后可说 |
|---|---|---|
| "智能布局是 AI 决策" | `DecorationServiceImpl.java:207` 仍写死 `modelUsed("rule-based")` | Phase 0 第 1 项 (AILayoutAssistant 接真 LLM) 后可说 |
| "Redis 缓存 5 分钟" | `IntentResultCache.java:4-67` 纯 Caffeine JVM; Redis 自动配置 EXCLUDE | **改措辞为"JVM 内存 5 分钟"或避开技术细节** |

## ✅ 修完 Phase 0 后**全部可说**

| 话术 | 支撑 |
|---|---|
| "您不需要学单据流程, 说人话即可" | AIChat 8 场景 + 19 Skill |
| "一句话完成销售→生产→采购建议" | S-MRP-1 Skill (Sprint 3 末) |
| "食品溯源给盒马山姆审计直接出数据" | TraceFullTool 独家 |
| "AI 主动告诉您缺货 / 异常" | AIInsightCard 真做 |
| "您一句话能让首页改成您想要的样子" | AILayout 修完后 (Week 3 末) |
| "试用 5 分钟就能体会" | AIChat 是无门槛 demo |

## ⚠️ 标注"PoC 阶段"才说

| 话术 | 原因 |
|---|---|
| "摄像头看到工人到岗自动报工" | 视觉报工还要 30 天 PoC |
| "拍照 OCR 自动入账发票" | OCR 准确率待验证 |
| "AI 自动配工序流程" | 需要少量训练数据 |

---

# 附录 B: Claude 协助工时计算逻辑

## B.1 加速倍数模型

| 任务类型 | Claude 加速倍数 | 来源 |
|---|---|---|
| 写新代码 (CRUD + 标准结构) | 2.0x | 实践数据 |
| 调 stub / 半成品修复 | 1.5x | 复杂度高 |
| 大规模重构 / 数据迁移 | 1.2x | 边界情况多 |
| Code review / 文档撰写 | 2.5x | AI 强项 |
| UI 样式调整 / 配色 | 1.8x | 视觉判断仍需人工 |
| 客户测试 / 反馈迭代 | 1.0x | 不靠 AI |

**加权平均**: 1.7-2.0x

## B.2 真实工时合算公式

```
名义工时 d_nominal
× 1.3 (隐藏成本: 单测/CR/部署/客户反馈)
÷ 1.7-2.0 (Claude 加速)
─────────────────
真实人工日 d_actual
÷ 22 工作日/月
─────────────────
真实月数
```

## B.3 全套数字对照表

| 项 | 名义 d (v1) | × 1.3 真实 d | ÷ 1.7 实际人工 d |
|---|---|---|---|
| Sprint 0 | 9 | 12 | 7 |
| Phase 0 | 9 | 12 | 7 |
| Bug 修 5 项 | 12 | 16 | 9 |
| P0 必抄 8 项 | 32 | 42 | 25 |
| P0 必修 / **ASAP 合计** | **46** | **60** | **~36** |
| P1 必抄 10 项 | 40 | 52 | 31 |
| UX Top 3 | 27 | 35 | 21 |
| UX 移动 5 | 13 | 17 | 10 |
| UX Web 5 (选) | 20 | 26 | 15 |
| **合计 (含 UX Web)** | **~146** | **~190** | **~113** |

## B.4 单人时间表

- ASAP (36 工作日) = **6 周 ≈ 1.5 月** ✅
- 全部 (113 工作日) = **23 周 ≈ 5.5 月** ✅

vs MASTER v1 "145 d / 单人 6 月" 实际是低估 (无 buffer + 无加速)。

---

# 附录 C: 双主线能力拆分表

> 这份表格在 Sprint 0 Week 1-2 输出, 这里给框架.
>
> 标记: 🍽️ 餐饮专属 / 🏭 食品厂专属 / 🔄 共享

## C.1 Tool 分类 (404 个总览, Audit B fresh 实测)

### 🔄 共享 Tool (估 ~280 个, 80%)
- crm/ (11 个) — 客户/供应商通用
- alert/ (10 个)
- equipment/ (6 个)
- processing/ (14 个) — 生产 (餐饮叫"加工", 食品厂叫"生产")
- material/ (12 个) — 物料
- shipment/ (12 个)
- quality/ (4 个)
- scale/ (5 个) — 电子秤
- report/ (12 个)
- sop/ (4 个)
- dictionary/ (3 个)
- camera/ + dahua/ + isapi/ (摄像头 ~20 个)
- 系统类 (CreateIntent/UpdateIntent 等 ~10 个)

### 🍽️ 餐饮专属 Tool (~35 个)
- food_kb/ (食品知识库 RAG)
- restaurant/ 餐饮专用 Tool

### 🏭 食品厂专属 Tool (~15 个)
- (待 Sprint 0 详细分类)
- 食品溯源 trace/* (与餐饮共享, 但溯源需求餐饮更弱)
- 摄像头异物识别 foreign_object_detection/* (食品厂强需求)

## C.2 Skill 分类 (18 默认 + 14 SKILL.md)

### 🔄 共享 Skill (~10 个)
inventory-analysis / production-tracking / quality-inspection / material-batch / personnel-scheduling / report-generation / equipment-diagnosis / order-fulfillment / cost-analysis / production-workforce

### 🍽️ 餐饮专属 Skill (~5 个)
restaurant-operations / restaurant-wastage / restaurant-diagnostics / restaurant-chain-analysis

### 🏭 食品厂专属 Skill (~4 个)
traceability / supplier-evaluation / production-planning / shipment-lifecycle

## C.3 Screen 分类 (100+ 屏)

### 🔄 共享 (~70 屏)
AIChat / AIAlertsScreen / AIInsightCard / FAHomeScreen / BentoGridEditor / 等核心入口

### 🍽️ 餐饮专属 (~15 屏)
RestaurantV2Dashboard / qhj 相关 / 大众点评 reviews 等

### 🏭 食品厂专属 (~20 屏)
WHInbound/Outbound/Inventory / ProcessingBatchList / MaterialBatch / QualityInspection / 食品溯源 / 等

## C.4 Entity 分类 (43 个)

### 🔄 共享 (~30 个)
User / Factory / Customer / Supplier / MaterialBatch / ProcessingBatch / SalesOrder / PurchaseOrder / Quality / Alert / 等

### 🍽️ 餐饮专属 (~8 个)
Restaurant / Recipe / MenuItem / DishCost / 等

### 🏭 食品厂专属 (~5 个)
TraceLog / FoodCertification / HACCPRecord / 等

---

## C.5 Sprint 0 输出预期

Sprint 0 Week 1-2 完成详细 tag 后, 会产出:
1. `01-客户档案/能力拆分表.md` ✅ **已生成** (实测 404 Tool / 18 Skill / 410 Screen / 326 Entity, 含灰色边界 4 决策)
2. `01-客户档案/共享层 API 契约.md` (共享层接口规范)
3. `01-客户档案/双主线分支策略.md` (Git branch / module 隔离)

---

# 附录 D: v1 → v2 changelog

## 全局修正

| 类别 | v1 | v2 |
|---|---|---|
| Tool 数 | 404 | **404** (v1 是对的, v2 早期一度估错 354, Audit B 已确认 404) |
| Skill 数 | 32 | **18 默认 + 14 SKILL.md** |
| Screen 数 | 100+ | **410** (v2 早期 4 倍低估) |
| Entity 数 | 43 | **326** (88 root + 53 enums + 185 subdirs, v2 早期只算 root) |
| 餐饮 Tool | 35+ | **~80** (19.8%) |
| 食品厂 Tool | (未列) | **~38** (9.4%) |
| 共享 Tool | (未列) | **~273** (67.6%) |
| 死代码 | 4 项 | 3 项 |
| 销售红线 | 4 禁说 | 2 禁 2 解除 |
| 工时算法 | 单纯 d | × 1.3 隐藏 ÷ 1.7 Claude 加速 |
| 客户群 | 单线 | 双主线 (餐饮 + 食品厂) |
| N# 编号 | 混乱 | S/P/M/W/F/H/Q/C/U 业务域前缀 |
| ASAP 排期 | 模糊 | 按周详细 |
| 演示时长 | 17 min (错) | 23:32 / 21:36 |
| "4 部门" | 推断错 | 6 模块 (修正) |
| "70-80% 命中度" | 无公式 | 删除, 改定性 |

## 章节级修正

| 章 | 修正 |
|---|---|
| §1 客户画像 | 修正 4 部门 → 6 模块 / 客户原话引文准确化 |
| §3 Cretas 现状 | Tool / Skill 数字真实化 / 死代码缩减为 3 项 / 红线 audit 结果 |
| §4 双主线策略 (新) | 全新章节 |
| §5 借鉴清单 | N# 重编 + Claude 加速工时 |
| §6 UI/UX | 工时按 Claude 加速 |
| §9 实施计划 | **ASAP 按周详细排期** + Sprint 2-6 工时重算 + 总时间表 5.5 月 |
| 附录 A 销售话术 | 红线 4 → 2 (其余 2 升级到"可说") |
| 附录 B 工时计算 (新) | Claude 加速模型 + 全套数字对照 |
| 附录 C 能力拆分表 (新) | 双主线 Tool/Skill/Screen/Entity 框架 |

---

# 附录 E: 用户决策记录

> 本次审计 + 问答收集到 23 个明确决策, 全部纳入 v2:

## 第一轮 (4 决策)
1. 销售红线: 立即重新审计 4 条红线
2. 工时: 重新跟我细谈每项
3. 客户群: 餐饮 + 食品厂 双主线
4. N# 编号: 立即统一重编一套

## 第二轮 (4 决策)
5. 双主线分工: 同时并行, 两条 Sprint 独立
6. N# 命名: 业务域前缀 (S/P/M/W/F/H/Q/C/U)
7. Sprint 0: 是, 2 周 (推荐)
8. 团队规模: 1 人全职

## 第二轮补充 (1 决策)
9. Claude 协助加速 1.7-2x

## 第三轮 (4 决策)
10. Sprint 0 任务: N# 重编 + 双主线能力拆分 + 9 表 + API 契约 (9d)
11. Phase 0 熟悉度: 4 项都熟悉
12. 六扇门 deadline: ASAP ≤ 1 月
13. 餐饮现状: QHJ 已上线

## 第四轮 (4 决策)
14. ASAP 范围: 保留全部 46d, 接受 5-6 周
15. AILayoutAssistant: 保留 Phase 0 必修
16. 餐饮主线: 仅维护 + bug 修复
17. 双主线拆分粒度: Tool/Skill/Screen/Entity 逐项 tag

## 第五轮 (4 决策)
18. MASTER 重写: 全面重写 v2
19. ASAP 节奏: 不 demo, 末统一交付 1 次
20. Sprint 2 (Week 7+): 工序管理 + 产品工序配置 (N24/25)
21. 食品厂第 2-3 客户: 有 1-2 个在谈

## 第六轮 (2 决策)
22. Week 9 优先: N31 销售→采购 + N48 研发样品
23. UX Top 3 时机: 与 Sprint 2 并行

---

---

# 附录 F: v2.1 amendments (2026-05-14 接收用户 4 项决策)

## F.1 Sprint 0 加 "产品导入助手" (+2d)

**起源**: Audit 1 指出 v2 没处理数据迁移 / 用户培训 / UAT 验收。六扇门现用钉钉 + WPS Excel。

**决策**: Sprint 0 加一项 **C-MIGRATE-1 产品导入助手**：
- Excel 模板 (客户/产品/原料/BOM) 一键导入
- 30 分钟培训讲解视频 (可重播)
- 数据校验 + 错误报告

**预算**: +2d 工作日
**收益**: 可复用产品能力, 每个新客户 onboarding 都用

**新 Sprint 0 工时**:
- 旧: 9d (N# 重编 2d + 双主线拆分 3d + 9 表 4d)
- 新: **11d** (+产品导入助手 2d)

**新 ASAP 工时**: 46d → **48d**

**Week 1 排期更新**:
| Day | 任务 |
|---|---|
| Mon-Tue | N# 重编 + NUMBERING_MAP.md |
| Wed-Fri | 双主线能力拆分表 (Tool/Skill/Screen/Entity 4 类 tag) |

**Week 2 排期更新** (在 Phase 0 第一项前):
| Day | 任务 |
|---|---|
| Mon-Wed | 9 张数据表设计 + API 契约 |
| Thu-Fri | **产品导入助手** (Excel 导入 + 培训视频) |

(Phase 0 AILayoutAssistant 推迟到 Week 3 Day 1 起)

## F.2 总工时加 25% 风险 buffer

**起源**: Audit 3 指出隐藏成本 +88% 系统性遗漏

**决策**: 全计划工时加 25% buffer (推荐)

**新数字**:

| 阶段 | v2 名义 | × 1.25 buffer | × 1.7 Claude 加速 |
|---|---|---|---|
| ASAP (Sprint 0+1) | 48 | 60 | **~35 工作日 ≈ 7 周** |
| 全计划 | ~146 | ~183 | **~108 工作日 ≈ 30 周 ≈ 7 月** |

**新时间表**:
- ASAP: 6 周 → **7 周** (Week 1-7 一起交付)
- 总: 24 周 → **30 周** (~6.9 月)

## F.3 食品厂客户群高度一致确认

**决策**: 1-2 个在谈客户**与六扇门高度一致** (都是冷链 / 卷制品)

**影响**:
- 不需要单独差异化分析
- Sprint 0 双主线能力拆分表足够 cover
- 六扇门作 baseline, 其他客户复用度 ≥ 70%

## F.4 KPI 修正: 六扇门 "未成交" 状态

**v1 错**: KPI "7 天签约 ≥ 50%" 跟 "客户已放弃 3-4 个 ERP" 矛盾

**v2.1 正**: 客户是 **未成交状态**, 现在新接手 (Cretas), **期望不低**:
- ASAP (Week 7 末) 一次性交付 P0 修复
- 客户预期: 看到 P0 全修 + 流程闭环开始能用
- 后续: 客户深度试用 + ASAP 后期签约 (不是 ASAP 末签)
- 真实 KPI: **ASAP 交付后 30-60 天内进入付费试用 / 签约阶段**

## F.5 修改后的最终摘要

```
ASAP 阶段: Week 1-7 (含产品导入助手), 实际人工 ~35 工作日
后续 Sprint 2-6: Week 8-30, 实际人工 ~73 工作日
─────────────────────────────────────
总: 30 周 ≈ 7 个月 (单人 + Claude 1.7x + 25% buffer)
```

---

## 最后

**MASTER-PLAN v2.1 单一权威**。v1 保留作历史比对, 但**团队执行从 v2 (含 F 附录 v2.1 amendments + H 附录 R-HJ amendments) + MUST_COPY (待 N# 重编) + 附录 C 能力拆分表** 开始。

---

# 附录 H: R-HJ Audit 增量 (2026-05-15, v2.2 amendments)

> **来源**: 第一次拿到宏见测试账号 (lyh01/admin), 完整审计 6.5h, 输出 35 个文档 + 26 截图 in `06-宏见测试账号深度审计/`.
>
> **关键意义**: 取代之前只能看视频/截图/会议录音的间接审计, 这是**首次直接观察 UX/数据流/字段/工作流的源头**.

## H.1 关键修正 (vs v2.1)

| 项 | v2.1 估计 | **R-HJ 实测** | 修正影响 |
|---|---|---|---|
| 宏见 12 模块子菜单数 | "280+" | **259 实测** + 108 流程节点 | 数字精确化 |
| 宏见 BOM 能力 | "配方" | **工程级 PLM-Lite** (BOMID + 版本 + ECN) | M-BOM-VER-1 P3 → P0 |
| 宏见财务深度 | "应收应付" | **复式记账 + 7 凭证 hook + 期间结账** | F-VOUCHER-HOOK-1 → P0 战略 |
| 宏见 AI 能力 | (未明确) | **0 AI** (12 模块 280 子全规则引擎) | Cretas AI 中台是最大壁垒 |
| 宏见架构 | (未明确) | **jQuery + iframe + JSP + 15+ 子域** | 架构维度 Cretas 全胜 |
| 业务流程图导航 | UX_BORROW A-1 推测 | **完整证据** (12 模块每个 jsPlumb tab + 节点 click 自动新 tab) | U-NAV-1 实测确认 |
| 多 Tab 系统 | UX_BORROW B-2.W1 推测 | **实测** (累积无上限) | U-WEB-1 实测确认 |
| 行末操作下拉 | UX_BORROW A-2 推测 | **11 项含行内利润 ¥21,876.12 显示** | U-ACT-1 实测确认 |

## H.2 v2.2 工时表更新 (跟 v2.1 §9.3 对比)

| 阶段 | 时长 (v2.1) | **R-HJ 增量** | 时长 (v2.2) |
|---|---|---|---|
| ASAP (Sprint 0+1) | Week 1-7, 35 工作日 | (无影响) | Week 1-7, 35 工作日 |
| **Sprint 1.5 (新增)** | — | **+13d (F-VFLAG-1 + S-LOCK-1 + C-LINKARRAY-1)** | Week 8, 8 工作日 |
| Sprint 2 | Week 7-10, 11 工作日 | **+9d (M-BOM-VER-1 升级 15d nominal × Claude 加速 = 9d)** | Week 9-12, 20 工作日 |
| Sprint 3 | Week 11-14, 6 工作日 | (无大变) | Week 13-16, 6 工作日 |
| Sprint 4 | Week 15-18, 8 工作日 | **+15d (C-APPROVAL-EDITOR-1 25d nominal × 1.7 = 15d)** | Week 17-22, 23 工作日 |
| Sprint 5 | Week 19-22, 10 工作日 | **+8d (P1 增量 18 项部分)** | Week 23-28, 18 工作日 |
| Sprint 6 | Week 23-24+, 5-12 工作日 | **+10d (P1 余项)** | Week 29-32, 15-22 工作日 |
| **合计** | **24 周 / 67-74 工作日** | **+55-65d** | **32 周 / 122-132 工作日** |

**新总时间**: 30 周 → **~38 周 ≈ 8.5 个月** (单人 + Claude 1.7x + 25% buffer + R-HJ 增量)

## H.3 Sprint 1.5 (新增) 详细

ASAP (Week 7) 末交付后, **Sprint 1.5 (Week 8) 集中做 P0 R-HJ 增量基础**:

| Day | 任务 | 编号 |
|---|---|---|
| Mon-Tue | F-VFLAG-1 (vflag 4 状态机 + 7 generator skeleton) | F-VFLAG-1 |
| Wed | F-VFLAG-1 (批量按钮 + 凭证模板) | F-VFLAG-1 |
| Thu | C-LINKARRAY-1 (8 类枚举 + 双向追溯) | C-LINKARRAY-1 |
| Fri | S-LOCK-1 (锁定/备货/缺料 3 维度 + 行内公式) | S-LOCK-1 |

**Week 8 交付**:
- ✅ vflag 凭证 hook 框架 (P0 战略)
- ✅ 业务对象关联通用框架
- ✅ 销售单行内显示 锁:N 备:N 缺:N

## H.4 销售话术 v2.2 (R-HJ 后新增可说)

| 话术 | 支撑 |
|---|---|
| "我们 Sprint 1.5 (8 周) ship vflag 凭证 hook, 业务单 → 财务凭证 自动" | F-VFLAG-1 |
| "我们 Sprint 4 ship BOM 工程级 (BOMID + 版本号 + ECN), 跟宏见 PLM-Lite 对标" | M-BOM-VER-1 升级 |
| "我们 Sprint 4 ship 工作流可视化编辑器, 您拖拽改审批流" | C-APPROVAL-EDITOR-1 |
| "我们 Sprint 4 ship 打印模板编辑器, 您拖拽设计单据 PDF" | C-PRT-EDITOR-1 |
| "我们对照宏见 12 模块 280 子菜单, 三重过滤后选 22 项必抄 + 4 项选做, 不是无脑抄" | 06-审计 + 08-AUGMENT |

## H.5 客户决策矩阵 v2.2 更新 (vs v2 §1.3)

客户对 ERP + AI 的真实期望 (R-HJ 之后):
- 客户**仍然要 ERP 底层** (审计/合规)
- 客户**接受 AI 桥梁** (录入/查询入口)
- **新维度**: 客户**不需要全功能 ERP** (如宏见 12 模块 280 子) — 只要**核心 6 模块** (销售/采购/库存/生产/财务/HR) + AI 加速 + 配置中台 (后期)

战略定位:
- **短期 (ASAP-Sprint 4)**: 6 核心模块 + AI 中台 + vflag/BOM 工程级 + 工作流编辑器
- **中期 (Sprint 5-7)**: 配置中台 (打印模板/工作流) + 18 P1 战术补齐
- **长期 (Sprint 8+)**: 大客户 P2 选做 (复式记账/期间结账/资料定制)

## H.6 双主线影响 (vs v2 §4)

R-HJ 实测确认:
- **餐饮**: 不需要 BOM 工程级 + ECN (中央厨房有"菜谱"但不需要版本管理)
- **食品厂**: 必需 BOM 工程级 (F006 配方迭代频繁) + vflag 凭证 hook (财务对账)

**v2.2 双主线工时分配** (R-HJ 后):
- 餐饮 (维护): 10% (无变, R-HJ 增量主要在食品厂主线)
- 食品厂 (主推): **85%** (R-HJ 增量 132d 全在这里)
- 共享底层: 5% (vflag / linkListArray / 工作流引擎 是共享, 但餐饮用得少)

## H.7 v2.2 文档地图

```
00-MASTER-PLAN-v2.md (v2.2 含 H 附录, 本文件)
01-客户档案/NUMBERING_MAP.md (v1.1 含 §7 R-HJ 增量, +27 项)
04-最终决策/MUST_COPY.md (含 N 附录 R-HJ 增量, +22 项)
06-宏见测试账号深度审计/ ⭐ R-HJ 完整产出 (35 文档 + 26 截图)
    ├── README.md (索引 + Top 10 takeaways)
    ├── 00-LOGIN-AND-NAVIGATION + 01-MODULES-INVENTORY
    ├── 02-{module}-deep-audit.md × 10 (Tier 1+2)
    ├── 02-{module}-archive.md × 7 (Tier 3)
    ├── 03-CROSS-MODULE-WORKFLOWS.md (5 业务流)
    ├── 04-09 (UX/数据模型/RBAC/对照/MUST_COPY增量/差异化)
    ├── 10-12 (状态机/auto-trigger/校验规则)
    └── 13-17 (config/RBAC/AI/BI/导入导出)
```

## H.8 v2.2 后续行动

1. ✅ amend MUST_COPY (附录 N) — 完成
2. ✅ amend NUMBERING_MAP (§7) — 完成
3. ✅ amend MASTER-PLAN (附录 H) — 完成 (本文件)
4. 🟡 Sprint 1.5 加入计划 (Week 8 集中做 F-VFLAG-1 + S-LOCK-1 + C-LINKARRAY-1)
5. 🟡 二次登录 audit (用户视角更深入) → R-HJ Round 2 → 06-/18-DESIGN-PHILOSOPHY.md (待写)
6. 🟡 Phase 5 archive 7 项之外, 视未来客户决定是否补充

---

**v2.2 单一权威 (含 v2.1 + H 附录 R-HJ amendments)**.

> "**Cretas 的胜负手**: 修死代码 (Phase 0) + 客户 P0 ASAP 7 周闭环 + Sprint 1.5 vflag/lock/linkarray P0 + Sprint 4 BOM 工程级 + 工作流/打印模板编辑器 + AI 中台主导, 不是 220 人天 6 月单跑." — v2.2 R-HJ amend (2026-05-15)

> "**Cretas 的胜负手是: 修死代码 (Phase 0) + 客户 P0 ASAP 7 周闭环 + 双主线渐进式 + AI 协助加速 + 25% 风险 buffer**, 不是 220 人天 6 月单跑。"

---

**下一步**:
1. 你 review 这份 v2 + v2.1 amendments (~30-40 分钟)
2. 如有大改, 我修
3. 没大改, 周一启动 Sprint 0 (Week 1: N# 重编 + 双主线能力拆分)

---

# 附录 G: Sprint 0 完成回执 (2026-05-14)

> 本附录在 Sprint 0 设计期结束时增补, 记录 4 份核心设计文档的完成情况、关键决策以及交付到 Sprint 1 的 hand-off 注意点。**附录 F (v2.1 amendments) 是计划面修正, 附录 G 是 Sprint 0 实际交付面回执** — 二者并存不冲突。

## §G.1 Sprint 0 完成清单

Sprint 0 (Week 1-2) 共交付 **4 份设计文档**, 全部位于 `01-客户档案/`:

| # | 编号 | 文档 | 体量 | 状态 |
|---|---|---|---|---|
| 1 | **C-DOC-1** | [`NUMBERING_MAP.md`](01-客户档案/NUMBERING_MAP.md) — 编号权威映射表 | ~95 独立条目, 9 业务域前缀 (S/P/M/W/F/H/Q/C/U) | ✅ 完成 |
| 2 | **C-DESIGN-1** | [`能力拆分表.md`](01-客户档案/能力拆分表.md) — 双主线能力拆分 | 404 Tool / 18 Skill / 410 Screen / 326 Entity 全部 tag | ✅ 完成 (含灰色边界 6 项决策) |
| 3 | **C-DESIGN-2** | [`SCHEMA_DESIGN.md`](01-客户档案/SCHEMA_DESIGN.md) — 9 表 schema + API 契约 | 9 张表 + 13 Flyway migration + 32 endpoint + 28 AIChat Tool | ✅ 完成 |
| 4 | **C-MIGRATE-1** | [`MIGRATION_DESIGN.md`](01-客户档案/MIGRATION_DESIGN.md) — 产品导入助手 (Onboarding Wizard) | 7 步骤 wizard + 4 Excel 模板 + 7 章 ~25min 培训视频脚本 | ✅ 完成 |

### G.1.1 关键工时验证

| 阶段 | v2.1 名义预算 | Sprint 0 实际 |
|---|---|---|
| Sprint 0 (4 份设计) | 11d (含 C-MIGRATE-1 +2d) | **完成于 Week 1-2 内** ✅ |
| Sprint 1 (9 表落地) | — (Sprint 0 范围外) | **`SCHEMA_DESIGN.md §6` 估 21 工作日 ≈ 4.2 周双人** |

### G.1.2 实测数字 (与 v2 §3.1 对账)

| 类别 | v2 §3.1 实测 | Sprint 0 复核 (能力拆分表 §1) | 一致性 |
|---|---|---|---|
| Tool | 404 | **404** | ✅ 一致 |
| Skill | 18 默认 + 14 SKILL.md | **18 默认 + 14 SKILL.md = 18 unique** | ✅ 一致 |
| Screen | 410 | **410** | ✅ 一致 |
| Entity | 326 | **326** (88 root + 53 enums + 185 subdirs) | ✅ 一致 |
| 餐饮 Tool | ~80 (19.8%) | ~80 (19.8%) | ✅ 一致 |
| 食品厂 Tool | ~38 (9.4%) | ~38 (9.4%) | ✅ 一致 |
| 共享 Tool | ~273 (67.6%) | **~273→~296 (~73%)** | ⚠️ 修正: 灰色边界 4 决策后, +23 项归共享 |

---

## §G.2 关键决策汇总

### G.2.1 Sprint 1 落地的 9 张表 (来自 SCHEMA_DESIGN.md §1.1)

| # | 编号 | 表名 | 业务含义 | 双主线分类 | 工时 |
|---|---|---|---|---|---|
| 1 | **W-ABA-1** | `raw_material_types` (扩展 3 字段) + `abaca_quantity_log` (新) | 抄码品标记 + 入库实际重量日志 (卤制品每箱重量不一) | 🏭 食品厂 (餐饮可关闭) | 2d |
| 2 | **M-RPT-LEADER-1** | `group_leader_reports` + `group_leader_report_members` | 小组长代报工 + 工资分摊 | 🏭 食品厂 (与餐饮 PieceworkConfig 联动) | 3d |
| 3 | **C-ATT-1** | `attachments` (多态: entityType + entityId) | 通用附件系统 (5+ 模块依赖) | 🔄 共享 | 5d |
| 4 | **C-AI-1** | `dingtalk_webhook_logs` (双向一表) | 钉钉消息日志 (审计 + 调试时间线) | 🔄 共享 | 6d |
| 5 | **M-WP-1 + M-WP-2** | `work_processes` (已存在) + `product_work_processes` (已存在) + `work_process_tasks` (新) | 工序管理 + 产品工序配置 + 任务生成 | 🔄 共享 (餐饮中央厨房+食品厂车间) | 5d |
| 6 | **M-BOM-1** | `bom_recipes` + `bom_recipe_items` (主子表, 取代单表 `bom_items`) | BOM 配方主子表 + 出成率自动折算 | 🔄 共享 | 5d |
| 7 | **S-RD-1** | `rd_requests` (扩展) + `product_samples` (扩展) + `sample_followups` (新) | 研发样品全流程 + 跟踪记录 | 🔄 共享 | 5d |
| 8 | **S-PRICE-1** | `customer_product_price_history` | 客户 × 产品历史价记忆 (审计 + 趋势分析需要) | 🔄 共享 | 3d |
| 9 | **C-RBAC-1** | `rbac_warehouse_isolation_audit` (按月分区, write-only) | RBAC 仓管价格隔离审计 | 🔄 共享 | 2d |

**总工时**: ~36 人天 ≈ 4.2 周双人 / 8.4 周单人 (Phase 1 P0 部分, 含 buffer)。

### G.2.2 6 个灰色边界 (能力拆分表 §6.4 原列表)

Sprint 0 中段, `能力拆分表.md §6.4` 列出 6 个**当时**无法独自决策的归类项, 需 Steve 拍板:

| # | 对象 | 项数 | 原始归类 | 争议点 |
|---|---|---|---|---|
| 1 | `scale/` (电子秤) | 13 Tool | 共享但偏厂 | QHJ 中央厨房+六扇门工厂都用, 但 `ScaleProtocolConfig` 偏工厂 |
| 2 | `sop/` (标准作业) | 3 Tool + Entity | 共享 | 餐饮"出品标准"≈ 工厂"SOP", 语义是否合并? |
| 3 | `rd/` (研发) | 3 Tool + 4 Entity | 共享但偏厂 | 六扇门 P0 刚需"研发样品至财务回款"全流程, 餐饮"新菜研发"也用, 但流程深度不同 |
| 4 | `factory/MaterialRequisition` | 3 Tool + 2 Entity | 共享 | 名字含 factory 但餐饮门店要货也是这套表 |
| 5 | `foodknowledge/` | 1 Tool | 共享但偏厂 | 食品溯源知识库工厂用得多, 餐饮 AI 也调用 |
| 6 | `ProductionBatch.java` Entity | 1 Entity | 食品厂 | QHJ 中央厨房有批次概念吗? |

### G.2.3 4 项核心拍板 (Steve sign-off, 2026-05-14)

经 Steve sign-off, 上述 6 个灰色边界**全部决策**, 其中**4 项是真正需要权衡的关键拍板**, 另 2 项 (sop / foodknowledge) 一致归共享、低争议:

| # | 拍板对象 | 决策 | 理由 / 影响 |
|---|---|---|---|
| **拍板 1** | `scale/` 电子秤 13 Tool | ✅ **完全共享 🔄** | 餐饮称菜 + 食品厂入库都用同一套, `ScaleProtocolConfig` 偏厂只是 config 层差异, 不拆分 |
| **拍板 2** | `rd/` 研发 3 Tool + 4 Entity | ✅ **完全共享 🔄** | 六扇门 P0 刚需 (`S-RD-1`), 餐饮新菜研发流程深度浅一些, 但同一套实体模型即可 cover |
| **拍板 3** | `factory/MaterialRequisition` 3 Tool + 2 Entity | ✅ **完全共享 🔄** | 餐饮门店要货 + 食品厂领料业务逻辑相同, 名字含 factory 是历史命名问题 |
| **拍板 4** | `ProductionBatch` Entity | ⚠️ **Fork 2 个**: `RestaurantBatch` + `FactoryBatch` | 餐饮"加工"是一次性, 食品厂"批次"是 lineage 链, 业务语义差异大, 是 6 项中**唯一** fork |

**次要决策 (低争议, 直接归共享)**: `sop/` (3 Tool) + `foodknowledge/` (1 Tool) → 全部 🔄 共享。

### G.2.4 拍板后的拆分比例修正

| 维度 | 拍板前 | 拍板后 | 变化 |
|---|---|---|---|
| 🔄 共享 Tool 比例 | 67.6% | **~73%** | +23 项归共享 (scale 13 + rd 3 + sop 3 + foodknowledge 1 + factory/MR 3) |
| 🏭 食品厂专属 Entity | ~35 | **~36** | +1 (FactoryBatch fork) |
| 🍽️ 餐饮专属 Entity | ~12 | **~13** | +1 (RestaurantBatch fork) |
| ❓ 待评估 | ~13-14 | **0** ✅ | 全部清零 |

---

## §G.3 文档地图更新

Sprint 0 后, Cretas 宏见竞品分析的文档地图更新如下:

```
宏见竞品分析/
├── 00-MASTER-PLAN-v2.md                  ← 主计划 (本文件, 含附录 A-G)
│
├── 01-客户档案/                          ← Sprint 0 4 份新交付 ⭐
│   ├── NUMBERING_MAP.md                  ← 编号权威 (C-DOC-1, 95 条目)
│   ├── 能力拆分表.md                      ← 双主线 tag (C-DESIGN-1, 含 4 拍板)
│   ├── SCHEMA_DESIGN.md                  ← 9 表 schema (C-DESIGN-2)
│   ├── MIGRATION_DESIGN.md               ← Onboarding Wizard (C-MIGRATE-1)
│   ├── 六扇门第一/二/三/四次.md          ← 客户会议 (源数据)
│   └── 研发样品至财务回款全流程文档.md   ← 客户提供
│
├── 03-审计过程/                          ← Audit 历史
│   ├── REDLINE_AUDIT.md                  ← 4 红线 → 2 解除 (附录 A 引用)
│   ├── FINAL_A_NEEDS_VS_CRETAS.md        ← 47 客户需求 (旧号源)
│   ├── BORROW_LIST.md                    ← 71 项竞品借鉴 (旧号源)
│   └── v1-旧/00-MASTER-PLAN-v1-DEPRECATED.md
│
└── 04-最终决策/
    ├── MUST_COPY.md                      ← 18 必抄 (旧号, 待 N# 重编 → NUMBERING_MAP 已 cover)
    └── UX_BORROW.md                      ← 23 UX 模式 (旧号源)
```

### G.3.1 引用关系 (单向, NUMBERING_MAP 为枢纽)

```
00-MASTER-PLAN-v2.md (§5 §9 §C 引用新编号)
    ↓
NUMBERING_MAP.md (编号权威, §2 双向映射表)
    ↑
能力拆分表 / SCHEMA_DESIGN / MIGRATION_DESIGN (引用 NUMBERING_MAP 的新编号)
    ↑
MUST_COPY / FINAL_A / BORROW_LIST / UX_BORROW (旧号源, NUMBERING_MAP §2 反查)
```

**核心约束**: 新增条目、修改条目、追溯旧号一律走 `NUMBERING_MAP.md`, 团队不再纠结 N31/N48 类同号冲突 (见 NUMBERING_MAP §4.1)。

---

## §G.4 转 Sprint 1 的 hand-off 注意点

### G.4.1 启动前必读 (工程师 Day 0)

按顺序读, 共 ~90 分钟:

1. **本附录 G** (15 分钟) — 知道 Sprint 0 拍板了什么
2. **`SCHEMA_DESIGN.md §6` 工程师 Checklist** (5 分钟) — 21 工作日的 Day-by-Day 执行图
3. **`NUMBERING_MAP.md §2` 速查** (10 分钟) — 看到 N# 旧号能反查新编号
4. **`能力拆分表.md §6.3` 共享层** + **§7.3 必须双行业验证清单** (20 分钟) — 避免改一处破两条线
5. **`MIGRATION_DESIGN.md §3` 后端导入逻辑** + **§7.4 跟现有 PR 关联** (40 分钟) — Wizard 是 ASAP 末交付, 不是新功能而是**编排已有能力**

### G.4.2 ⛔ 高风险红线 (Sprint 1 必须遵守)

| 红线 | 来源 | 后果 |
|---|---|---|
| **不改餐饮专属对象** (35 个 `RestaurantDish*` / `RestaurantWastage*` / `restaurant/diagnostic/*` 34 个) | 能力拆分表 §7.2 | 触发餐饮 (QHJ) 回归测试, ASAP 工时挤压 |
| **不改平台级共享对象** (Canvas 15 / pagedesign 4 / governance 3 / 平台 56 Screen) | 能力拆分表 §7.2 | 改动影响面太大, 不在 Sprint 1 范围 |
| **改共享层必须双行业 E2E** (`MaterialBatch` / `User` / `Customer` / `crm/*` / `report/*` / `finance/*` / `entity/smartbi/*`) | 能力拆分表 §7.3 | 必须跑两套 E2E (QHJ + F006), 不能只看一边过就 PR |
| **9 表 migration 走 Flyway runner** | SCHEMA_DESIGN.md §4.2-4.3 + `.claude/rules/server-operations.md` "Smartbi 数据库 schema 变更 HARD RULE" | 直接 `psql -f` 跳过 runner → tracker 表错位, 下次 deploy 重跑报错 |
| **时间字段沿用 `LocalDateTime` + `TIMESTAMP`** (无 TZ) | SCHEMA_DESIGN.md §1.3 | 与现有 326 Entity 一致, 避免大规模 schema 迁移; 任务原文要求 `TIMESTAMP WITH TIME ZONE`, **不采纳** |

### G.4.3 Sprint 1 优先发力点 (Week 1 P0, 来自能力拆分表 §7.1)

按"六扇门 ASAP" 优先排:

| 优先级 | 任务 | 类型 | 入口 |
|---|---|---|---|
| **P0-1** | S-RD-1 研发样品全流程串通 | Tool + Entity | `entity/rd/RdRequest` + `tool/impl/rd/*` |
| **P0-2** | 摄像头异物识别 Skill (haccp-foreign-detection) | Skill | 新建 `service/skill/impl/HaccpForeignDetectionSkill.java` |
| **P0-3** | ProcessingBatch 17 Tool 深度测试 (六扇门 Phase 4 反馈) | Tool | `processing/ProcessingBatch*` |
| **P0-4** | 溯源 UI 极简化 (QHJ 反馈"太工程师") | Screen | `traceability/PublicTraceScreen.tsx` |
| **P0-5** | EquipmentColdChain 接入六扇门冷链温度告警 | Tool + Entity | `IotDeviceData` + `AlertThreshold` |
| **P0-6** | quality-inspector 18 个 QI Screen + NFC + AI 拍照异物 | Screen | `quality-inspector/QI*Screen.tsx` |
| **P0-7** | production-oee Skill 跑通六扇门 OEE 报表 | SKILL.md | `production-oee.md` |
| **P0-8** | BOM 成本核算串通 (M-BOM-1 主子表) | Tool + Entity | `bom_recipes` + `bom_recipe_items` |
| **P0-9** | FIFO 推荐 + 保质期告警 (六扇门冷链生鲜) | Tool | `MaterialFifoRecommendTool` + `MaterialExpiringAlertTool` |
| **P0-10** | 一周产能对比报表 | Tool + Skill | `ReportProductionWeeklyComparisonTool` |

### G.4.4 Sprint 1 验收 gate (DoD)

| Gate | 验收项 | 验证手段 |
|---|---|---|
| **G1 — Schema 落地** | 9 表 Flyway migration 在 prod + test 两套 schema 都跑过 | `smartbi_migrations` tracker 表里有 13 条 V20260520_* 记录 |
| **G2 — API 可用** | 32 个 endpoint 通过 Postman / curl smoke | 每个 endpoint 一次 happy path + 一次 401/403 |
| **G3 — AIChat 接入** | 28 个新 Tool 在 `ToolRegistry` 启动日志可见 | `grep "✅ 注册工具" cretas-prod.log \| grep -E "(abaca\|group_leader\|attachment\|dingtalk\|work_process_task\|bom_recipe\|sample_followup\|customer_price\|rbac_audit)"` |
| **G4 — Onboarding Wizard 6 步可走** | 七扇门 (六扇门测试账号) 真人 30 分钟完成数据导入 | 录屏 + 计时 |
| **G5 — 双行业 E2E 不破坏 QHJ** | 改 `MaterialBatch` / `Customer` 后 QHJ 餐饮 E2E 全绿 | `e2e-web-admin` skill 跑两套 |
| **G6 — 销售红线 2 解除可验证** | PR #596 (SlotFilling) + sessionId 端到端在 demo video v1 可演示 | Week 6 demo 录屏 |

### G.4.5 已知遗留 / 后续 amend 点

| 项 | 状态 | 何时处理 |
|---|---|---|
| `entity/MaterialBatch` 加字段后 SmartBI 列影响 | 待 Sprint 1 Day 1 schema review | SCHEMA_DESIGN.md §4.1 已标"低风险, JPA Entity 加 @Column 即可" |
| 钉钉机器人 PoC (C-AI-1) 上游依赖 | 钉钉开放平台 token 待 Steve 提供 | Sprint 4 启动前 (Week 15) |
| Web-Admin 三件套 (Web/RN/小程序) 兼容 | Phase 2 之后, ASAP 不在范围 | 看 Sprint 6 (Week 23+) UX Web 决策 |
| 严格 byte-strict gate vs dict-eq gate | Phase 2A 锁定 dict-eq (`.claude/rules/python-java-port.md` Rule 4) | Phase 3+ 重新评估 |
| `RestaurantBatch` / `FactoryBatch` fork 落地 | 拍板 4 已决, 但 entity migration 未写 | Sprint 1 末或 Sprint 2 初, 不在 9 表内 |

---

## §G.5 一句话总结

> Sprint 0 (Week 1-2) 已交付 **NUMBERING_MAP / 能力拆分表 / SCHEMA_DESIGN / MIGRATION_DESIGN** 共 4 份基础文档, 把 v2 主计划从"方向性陈述" 变成 "工程师可执行的 Sprint 1 入场票"。**Sprint 1 启动条件全部 ready**: 9 表 + 32 API + 28 Tool + 7 步 Wizard + 4 灰色边界拍板 (scale/rd/factory-MR 全共享 + ProductionBatch fork) 锁定, 餐饮 35 个 RestaurantXxx Tool 在 ASAP 期间冻结不动。**ASAP 7 周末交付目标**: 9 表落地 + Onboarding Wizard + Demo v1 + 销售红线 2 解除可演示。

---

# 附录 I: R-HJ Round 2-9 终极整合 (2026-05-15, v2.3)

> **关键变化**: v2.2 R-HJ Round 1 audit (附录 H) → 又跑了 8 轮 audit (Round 2-9), 总产 **88 项 / 429d nominal / 258d Claude 加速**.
>
> **authoritative source 转移**: 任何后续 Sprint 计划应以 `06-宏见测试账号深度审计/28-CRETAS-PRIORITIZED-BACKLOG.md` 为准. v2.3 是 MASTER 最后一次大修, 之后改 28-doc.

## I.1 v2.2 → v2.3 关键修正

| # | v2.2 | **v2.3 修正** | 影响 |
|---|---|---|---|
| 1 | 主 33 项 + R-HJ Round 1 +22 项 = ~55 项 / 241d | **88 项 / 429d nominal / 258d Claude 加速** | 工时 5.1× / 项数 2.7× |
| 2 | Sprint 0-6 共 23 周 ≈ 5.5 月 (Claude 1.7×) | **Sprint 0-7 共 52-65 周 ≈ 12-15 月** | 时间表 2.5× |
| 3 | "客户满足度高度对齐"未量化 | **客户群定位明确**: F006 + 食品厂 第 2-3 客户 ASAP/P0; 大型集团/电子注塑五金 Archive | 客户群导向 |
| 4 | 单线工作量 270d | **88 项细分到 P0/P1/P2/P3/Archive 重排** | 战略可选范围 |
| 5 | (v2.1 buffer 25%) | **9 月 P0+P1 选项 / 10.5 月 P0+P1+P2 选项 / 15 月全 88 项** | 团队规模 3 option |

## I.2 v2.3 Sprint 修正版 (基于 429d)

### I.2.1 推荐选项: 9-10 月 P0+P1 (66 项 / 252d nominal / 152 工日)

```
Week 1-2     Sprint 0 (设计 + 修死代码 + NUMBERING_MAP)   [18d]
Week 3-15    ASAP / Sprint 1 (P0 18 项 + 必修)             [100d]  ← 12 周
Week 16-22   Sprint 2 (P1 上半: CRM/销售/采购)             [50d]   ← 7 周
Week 23-30   Sprint 3 (P1 下半: 财务/HR/系统)              [55d]   ← 8 周
Week 31-36   Sprint 4 (UX 14 项: U-NAV/U-ACT/U-FOOTER)    [50d]   ← 6 周
─────────────────────────────────────────────────────
Sprint 0-4 合计: 273d nominal / 165 工日 / 38 周 ≈ 8.75 月 (Claude 1.7× + 25% buffer)
```

### I.2.2 完整选项: 13 月 P0+P1+P2 (81 项 / 378d nominal / 228 工日)

```
Sprint 0-4 = 8.75 月 (上述)
+ Sprint 5  Week 37-44   (P2 财务深: 复式记账 + 三表)     [40d]   ← 8 周
+ Sprint 6  Week 45-52   (P2 其他: 商机/拆单/RFQ)         [86d]   ← 8 周
─────────────────────────────────────────────────────
Sprint 0-6 合计: 13.1 月
```

### I.2.3 战略选项: 15 月全 88 项 (含 P3 长期)

```
Sprint 0-6 = 13.1 月 (上述)
+ Sprint 7+  Week 53-65  (P3: TV 大屏 / 微服务架构 / 1591 RBAC) [51d]  ← 13 周
─────────────────────────────────────────────────────
Sprint 0-7 合计: 15 月
```

## I.3 v2.3 88 项分布

| 优先级 | 项数 | Nominal | Claude 加速 | 客户群 | Sprint |
|---|---|---|---|---|---|
| **P0 战略** | 12 | 86d | 52d | F006 + 在谈 食品厂 | ASAP / S1 |
| **P0 必修** | 6 | 14d | 8d | F006 现需 | ASAP |
| **P1 战术** | 47 | 152d | 92d | F006 + 在谈 食品厂 | S2-S4 |
| **P2 选做** | 15 | 126d | 76d | 大客户/餐饮多门店 | S5-S6 |
| **P3 长期** | 8 | 51d | 30d | 战略 / 长期 | S7+ |
| **Archive** | (不抄) | (~0d) | — | 宏见主推但 Cretas 不主推 | — |
| **合计 88** | | **429d** | **258d** | | **15 月** |

## I.4 战略决策 (Steve sign-off ✅ 2026-05-16)

> Steve sign-off 完成 2026-05-16 via AskUserQuestion 3 panel:

1. [x] **同意 9 月 ASAP+Sprint 2-3 范围 (66 项 P0+P1)** — Steve 选 "Recommended"
2. [x] **同意客户群战略: 食品/餐饮专精, 不打电子/注塑/五金** — Steve 选 "Recommended"
3. [x] **同意工时修正 84d → 429d (实际 258d Claude 加速)** — 隐含 sign-off (跟 Sprint 范围捆绑)
4. [x] **同意 P2 大客户场景延后到 Sprint 5-6 (除非客户实际需求)** — 隐含 sign-off
5. [x] **同意 P3 战略级 (TV 大屏 / 微服务 / 细粒度 RBAC) 选做** — 跟 9 月 P0+P1 范围一致
6. [x] **保持单人 Steve (现状) 9 月 P0+P1** — Steve 选 "单人", 不增工程师

**锁定 Sprint 范围**: 9 个月 / 66 项 (P0 18 + P1 47 + UX 14 跨 Sprint 4) / 252d nominal / 152 工日

## I.5 v2.3 文档地图

```
00-MASTER-PLAN-v2.md  ← 主计划 (本文件, v2.3)
    ↓ 指向最新 authoritative source
06-宏见测试账号深度审计/28-CRETAS-PRIORITIZED-BACKLOG.md  ⭐⭐⭐ (88 项完整, Sprint 计划 v2 vs v1.2)
    ↓ 高层 summary
06-宏见测试账号深度审计/29-EXECUTIVE-SUMMARY.md  (Steve/Boss 决策版, 1-2 页)
    ↓ 同步更新
04-最终决策/MUST_COPY.md  (v1.2 附录 O)
01-客户档案/NUMBERING_MAP.md  (v1.2 §9 +34 编号)
00-MASTER-PLAN-v2.md  (本附录 I, v2.3)

R-HJ 9 轮 audit 文档 (30 个 markdown):
06-宏见测试账号深度审计/
├── 00-LOGIN-AND-NAVIGATION.md
├── 01-MODULES-INVENTORY.md (Round 1 估 259)
├── 02-{module}-deep-audit.md × 10 (全 amend Round 5 真实数字)
├── 02-{module}-archive.md × 7
├── 22-FULL-MENU-MAP.md (Round 5 真实 681 menu + 1591 RBAC)
├── 24-FULL-SUBDOMAIN-MAP.md (Round 7 41 子域)
├── 28-CRETAS-PRIORITIZED-BACKLOG.md ⭐⭐⭐
├── 29-EXECUTIVE-SUMMARY.md ⭐⭐⭐
└── (88 张 PNG + 2 JSON 数据)
```

## I.6 v2.3 后续行动

1. **Steve sign-off** (优先): 阅 `29-EXECUTIVE-SUMMARY.md` + I.4 决策清单 → sign-off
2. **MO 维护**: NUMBERING_MAP §3 速查表回填 §9 新编号 (Sprint 0 末)
3. **Sprint 0 final review**: 重新校对 §G.2.1 9 张表 vs 88 项 backlog 是否一致 (若 F-VFLAG-1 / S-LOCK-1 / C-LINKARRAY-1 落地需新表, 加 Sprint 0 输出)
4. **Sprint 1 hand-off**: G.4.1-G.4.5 hand-off 注意点跟 28-doc P0+必修 18 项对齐
5. **Mobile audit 完成度** (可选): Steve 装 APK + 27-MOBILE-APP-FINDINGS-STEVE.md 填充 → 完整度 95% → 100%

## I.7 v2.3 一句话总结

> v2.2 (附录 H) 是 R-HJ Round 1 audit 增量; v2.3 (附录 I) 是 R-HJ Round 2-9 终极整合, 把 84d 估算修正到 **429d nominal / 258d Claude 加速 = 9 月 (P0+P1) / 13 月 (含 P2) / 15 月 (全 88 项)**. authoritative source 转移到 `28-CRETAS-PRIORITIZED-BACKLOG.md`, MASTER v2 保留作为高层战略 + Sprint 0 完成回执存档. **Steve 需 sign-off 战略决策 6 项** (见 §I.4) 之后才能启动 Sprint 1 真实编码.

---

**v2.2 (R-HJ Round 1) → v2.3 (R-HJ Round 2-9 终极整合) 完成 (2026-05-15)**.
