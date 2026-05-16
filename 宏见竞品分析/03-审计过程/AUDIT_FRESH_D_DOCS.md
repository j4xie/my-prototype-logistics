# AUDIT_FRESH_D_DOCS — 13 份文档跨文档一致性审计

> **审计方法**: 通读 REPORT/REVIEW/AUDIT/AUDIT_X/AUDIT_Y/AUDIT_Z/STRATEGY/GAPS/V1/V2_HD/V3/EXECUTION_PLAN/BORROW_LIST 13 份 md, 比对相互之间在工时估算 / 已有缺失判断 / 推荐与证据脱钩 / 销售话术红线 / 优先级排序 / 名词混乱 6 个维度的不一致。
>
> **审计员**: Claude (Opus 4.7, 1M ctx)
> **审计日期**: 2026-05-14
> **诚实声明**: 本审计**不重做内容审计**, 只关注一致性。13 份文档中, REPORT/REVIEW 是早期粗稿, AUDIT/AUDIT_X/Y/Z 是硬证据审计, V1/V2HD/V3 是后续逆向修正, STRATEGY/GAPS/EXECUTION_PLAN/BORROW_LIST 是综合输出。
>
> **重要结果**: 一致性问题严重, 13 份文档中只有 EXECUTION_PLAN 和 BORROW_LIST (最新的两份, 都于 2026-05-14 02:16-02:30 写) 算"最终版"。其它 11 份很多已被后续修正但**仍可被读到**, 极易误导读者。

---

## §1. Type 1 — 工时估算不一致

### Finding 1.1 — 销售→生产链路 Skill (S1) 工时跨文档差异 **3-15 倍**

| 文档 | 工时估算 | 关键引文 |
|---|---|---|
| REVIEW.md §F-2 | **1-2 人天** | "✅ 真能落地 · 🟢 高 · 已有 90% 零件 ... 需要的是新 SalesToProductionSkill 编排" |
| REPORT.md §五 借鉴点1 | **5 人天** | "后端 3 人天、前端 2 人天" (建议 demo) |
| AUDIT.md §F-1 | **6-7 人天** | "审计后真实工时 ... 6-7 天是可信的最低工时", 含 4 个 stub 修复 |
| REVIEW.md §F (修正版) | **2 周 (10-14 天)** | "✅ 写一个 SalesToProductionSkill + 在 AIChatScreen 加 chain-card 渲染 — 2 周" |
| EXECUTION_PLAN.md P1-T1 | **7 人天** | 与 AUDIT.md 一致 |
| BORROW_LIST.md S1 | **7 人天** | 一致 |

**判定**: REVIEW.md 内部就**前后矛盾**: §E 表说"3-5 天工作量", §F 又说"2 周"。AUDIT.md 是基于 file:line 审计后的硬证据值, 应作准。但 **REVIEW.md 内的矛盾未在任何文档里被显式标记** → 读者翻 REVIEW 会被误导。

### Finding 1.2 — Slot-filling 工时分裂 5x

| 文档 | 工时 | 引文 |
|---|---|---|
| REVIEW.md §E 方案4 | **3 天** "把所有 create-Tool 的 slot 定义补全" |
| AUDIT.md §F-4 | **8-12 人天** "后端逻辑根本没实现 ... 真实工时 8-12 人天" |
| STRATEGY.md §C-3 缺口2 | **8-12 人天** (与 AUDIT 一致) |
| EXECUTION_PLAN.md | 未在 Phase 1-3 中明确列出, "12.2 销售话术红线" 提"除非补 8-12 天" |

**判定**: REVIEW 的 3 天是基于**错误假设**(前端有就以为后端有), AUDIT 揭穿后, REVIEW 没被改写。读者读 REVIEW 仍会以为 3 天能搞定。

### Finding 1.3 — 视觉报工 PoC 工时不可比

| 文档 | 表述 | 实际工时含义 |
|---|---|---|
| REPORT.md §六 方案2 | 仅说 "ISAPI 区域检测 + 工人识别已有", 未估工时 | 隐含: 几天能改 |
| REVIEW.md §E 方案2 | "需要先做 PoC: 选客户工厂的 1 条产线试 30 天, 看准确率能否 ≥ 90%" | 不含开发 |
| AUDIT.md §F-2 | "开发本身 10-15 人天 ... + 真实工厂运行 PoC 30 天" | 开发 + PoC |
| STRATEGY.md §C-3 缺口3 | "10-15 人天 + 30 天 PoC" (与 AUDIT 一致) |
| EXECUTION_PLAN.md | 整个 Phase 3 P3 都没此项, 已从 P1 降级到 "高风险" | 暂缓 |

**判定**: REPORT 给客户演示时, 销售看到方案 2 会以为是 demo 就绪能力——但 AUDIT 已降级到"30% 完成度 + 准确率风险"。**REPORT 没标 ⚠️ 降级警告**。

### Finding 1.4 — 总工时累计严重不一致

| 文档 | 总工时声称 |
|---|---|
| REPORT.md §九 | 未给总工时 |
| REVIEW.md §F | 仅给单项 |
| AUDIT.md §G | P0+P1+P2 大概 50 人天 |
| STRATEGY.md §D | "9.5 人天" 修死代码 + "17-18 人天" Phase 1 |
| GAPS.md §七 | Sprint 1+2 = "39-63 人天 ≈ 12-16 周" |
| V1_AUDIO_INVENTORY.md §4 | "Sprint 1+2 修正后 = 86-140 天 (~17-28 周)" |
| V2_HD_INVENTORY.md §5.3 | "P0+P1+P2 = 258-398 人天 (~13-20 月)" |
| EXECUTION_PLAN.md §0.1 | "~220 人天 = 6 个月" |
| BORROW_LIST.md §12 | "P1 ~42 + P2 ~131 + P3 ~75" = ~248 (与 EXEC 接近) |

**判定**: 同一项目, 总工时跨文档 **2.6 倍差异** (50 vs 398)。V2 HD 是最新乐观估计(258-398), EXECUTION 是裁剪后 220, BORROW 是 248。**STRATEGY 9.5 人天 + AUDIT 50 人天**完全脱离 V2 HD 真实工时, 但仍在文档中。

---

## §2. Type 2 — 已有 / 缺失判断不一致

### Finding 2.1 — 报价单 (G1) 完全相反的判断

| 文档 | 判断 | 引文 |
|---|---|---|
| REPORT.md §四 | "完全缺失" | "未发现报价单实体或打印模板系统" |
| REVIEW.md §D-1 | "❌ 实体缺失" | "完全缺失 ... 销售前置流程断" |
| AUDIT.md §D | "完全缺失" (沿用 REVIEW) | (未单独列, 但默认前述) |
| GAPS.md §一 G1 | "❌ 完全缺失, 没有 Quote/Quotation 实体或前端" | (复制 REVIEW) |
| V3_CRETAS_REVERSE.md §1 G1 | "❌ → ✅ **完全有**" | "`entity/sales/OperationalQuote.java:52` 完整状态机" + Controller + Repository + Service 全套 |
| STRATEGY.md §C-3 | 仍列在"缺口"清单 "5-8 人天" |
| EXECUTION_PLAN.md P1-T2 | "后端齐全, 前端无 Quote 屏幕需要新建 — 4.5 人天" |
| BORROW_LIST.md S2 | "⚪ Cretas 后端已有, 仅需 UI 暴露" 4.5 人天 |

**判定**: REPORT/REVIEW/AUDIT/GAPS **4 份文档都错判** "报价单完全缺失"。V3 用 file:line 证据证伪。EXECUTION_PLAN 接受 V3 结论但**没回头修 REPORT/REVIEW/AUDIT/GAPS**——读者翻这 4 份会被误导, 错估 5-8 天 vs 实际 4.5 天。

### Finding 2.2 — 行业 Feature Flag (G22) 同样问题

| 文档 | 判断 |
|---|---|
| GAPS.md §五 G22 | "⚠️ 有 RBAC 和角色, 但**未做行业初始化模板**", 5-8 人天 |
| V3_CRETAS_REVERSE.md §1 G22 | "⚠️ → ✅ **完整实现**", `entity/IndustryTemplatePackage.java:31` + `FactoryTypeBlueprint.java` + `BlueprintListScreen.tsx` 全栈 |
| STRATEGY.md, EXECUTION_PLAN.md §0.3 | 接受 V3 结论 |
| BORROW_LIST.md C5 | "⚪ 后端已有, 需扩展到 50+ 模块开关" 5 人天 |

**判定**: GAPS.md 严重低估 Cretas 已有能力。但 **GAPS.md 仍是 EXECUTION_PLAN §13 "文档地图" 中的链接来源之一**, 读者依然会读到错误结论。

### Finding 2.3 — 7 项 GAPS 误报集中在 V3 修正中

EXECUTION_PLAN §0.3 列了"V3 audit 的关键修正"——但只列 7 项 (G1/G4/G7/G13/G17/G20/G22)。V3 §3 §2 实际声称证伪 12 条 (含 G2/G5/G6/G14/G15 部分证伪)。

**判定**: EXECUTION_PLAN 接受了 V3 结论但漏掉 5 项部分证伪 (G2 客户记忆价已有 PriceList.customerId / G14 已有 4 维实体 / G15 FIFO+指定批次都有)。这导致 EXECUTION_PLAN P1-T3 G2 客户记忆价仍按"新建表"估 3 人天 (V3 §1 G2 说"修复工时 1-2 人天")。

### Finding 2.4 — Skill 数量 16 vs 18 vs 16+

| 文档 | 数字 |
|---|---|
| CLAUDE.md 项目说明 | "16 个内置 Skill" |
| AUDIT.md §C | "实际 18 个" |
| AUDIT_Y_CANVAS.md | "18 个 Skill 里没有 sales→production→purchase 跨域" |
| AUDIT_Z_AICHAT_E2E.md §1 步骤 5 | "16 个内置 Skill + 数据库 SmartBiSkill" |
| AUDIT_Z_AICHAT_E2E.md §2 真5 | "注册 **16+** 内置 Skill" |
| STRATEGY.md §C-1 优势 2 | "18 个 Skill" + "**18 个 Skill 实际 18 个**" §A-7 注 |
| EXECUTION_PLAN.md / BORROW_LIST.md | 未提具体数字 |

**判定**: 同次审计内部矛盾——AUDIT 说 18, AUDIT_Z 同一作者写 16。最终 STRATEGY 选 18 但**没解释 18 vs 16 的差异究竟在哪**(是不是 SmartBiSkill + 内置 16 = 17, 还是 18 个内置?)。

---

## §3. Type 3 — 推荐 vs 证据脱钩

### Finding 3.1 — REPORT.md §五 借鉴点 5/6 推荐基于错判

REPORT.md §五 借鉴点 5 "报价单 + 打印模板系统":
> "**Cretas 现状: 完全没有**"

REPORT.md §五 借鉴点 6 "同产品 × 多客户价目表":
> "**Cretas 现状: PriceListScreen.tsx 有价格表入口, 但未实现按客户的价格记忆**"

V3 §1 G1 + G2 已证伪两项都有后端。**REPORT 没更新, 没标 ⚠️ "见 V3"**。

### Finding 3.2 — REVIEW.md §F-4 推荐 "立即做 slot-filling" 基于死代码

REVIEW.md §F 立即做清单:
> "6. ✅ **补全 create-Tool slot 定义** + 推送密度提升 — 让 AIChat 覆盖更多场景"

AUDIT.md §B-1 证伪:
> "后端 `IntentExecutorServiceImpl` 中 grep `NEED_CLARIFICATION` / `NEED_MORE_INFO` / `clarificationQuestions` 全部 0 匹配 ... 整个澄清/缺参追问链是死代码 ... 真实工时 8-12 人天"

**判定**: REVIEW 把 slot-filling 列为"短期立即做", 但实际是 8-12 天新工程。AUDIT 修正后, REVIEW 没标 ⚠️ 撤回, 仍在文档里。

### Finding 3.3 — REPORT.md §六 方案 4 "Slot-filling NEED_CLARIFICATION 已就绪"

REPORT.md §六 方案 4:
> "**实现要点**: 现有 `slotFillingHandler` 在 `IntentExecutorService` 中已就绪"

AUDIT.md §B-1: 此函数**完全不存在** (grep 0 匹配)。

**判定**: REPORT §六 方案 4 是**完全脱钩的推荐**——读者会以为是"扩展 slot 定义"小工作, 实际是新建子系统。STRATEGY.md §E-2 已修正 "❌ 不要说 AI 会问您缺什么参数", 但 REPORT 没改。

### Finding 3.4 — REVIEW.md §E 方案 1 可信度评估自相矛盾

REVIEW §E 表:
> "方案 1 一句话销售→生产→采购全链路: ✅ 真能 · 🟢 高可信度 · 已有 90% 零件"

AUDIT.md §F-1 揭露:
> "ProcessingBatchCreateTool 不关联 salesOrderId ... 是销售→生产链最大断点"
> "ProcessingBatchCreateTool 不自动生成 Label ... 扫码报工的核心连接没接上"
> "缺料分析逻辑分散在 4 处, 没有统一入口"

**判定**: REVIEW "90% 零件"夸大——AUDIT 找到 4 个 stub。零件有, 编排接线缺。EXECUTION_PLAN 接受了 AUDIT 结论(7 天含 stub 修复), 但 REVIEW 仍存。

### Finding 3.5 — AILayoutAssistant 是真 AI 的暗示

REPORT.md 完全没提 Canvas 系统 (Canvas 在 AUDIT_Y 第一次审计才发现)。
REVIEW.md 完全没提 Canvas。
GAPS.md 完全没提 Canvas。

AUDIT_Y_CANVAS.md §1.3 揭露:
> "DecorationServiceImpl.java:207 显式 modelUsed("rule-based") ... 完全没调 LLM ... AILayoutAssistant 看着像 ChatGPT ... 但后端没接 LLM。所谓"AI 一句话改首页"是骗局"

STRATEGY.md §A-1 接受。
EXECUTION_PLAN.md P0-T2 修复 4 人天。

**判定**: REPORT/REVIEW/GAPS 三份文档都没提 Canvas, 但 BORROW_LIST/EXECUTION_PLAN 中 Canvas 修复占 Phase 0 大头。说明前 3 份文档**遗漏了 Cretas 的一整个子系统**。

---

## §4. Type 4 — 销售话术红线遗漏

### Finding 4.1 — 销售话术只在 STRATEGY 末尾出现, 其它 3 份"可以演示"清单互相打架

STRATEGY.md §E-2 "不能说的":
> ❌ "AI 会问您缺什么参数" — Slot-filling 后端未实现
> ❌ "多轮对话记住上下文" — sessionId 不传
> ❌ "智能布局是 AI 决策" — rule-based
> ❌ "5 分钟 Redis 缓存" — Caffeine

但是:

REPORT.md §六 方案 4 推销"NEED_CLARIFICATION 路径已就绪" — **与 STRATEGY E-2 第 1 条直接冲突**, 没标红线。

REPORT.md §六 方案 1 第一段:
> "Agent: → 识别 SHIPMENT 场景 + 解析参数 → 调用 ShipmentCreateTool 创建预销售单 → 调用 MaterialBatchQueryTool 查库存 → 缺料 320 kg → 调用 BomExpansionTool ... 富卡片渲染"

AUDIT.md §E 揭露 4 个 stub, 这段链路**目前不能跑通** (BomExpansionTool 抛异常, ProcessingBatchCreateTool 不关联 salesOrderId)。
**REPORT 没标"修完才能演"。**

AUDIT_Z_AICHAT_E2E.md §2 不能拿去 demo:
> "candidates 字段前后端不对齐 ... 业务意图无真 token 流 ... AI 缓存层非 Redis"

**4 项不能演示的, 只在 AUDIT_Z 和 STRATEGY 提到, REPORT/REVIEW/GAPS 都没标。**

### Finding 4.2 — EXECUTION_PLAN §12.2 完整列了红线, 但散落

EXECUTION_PLAN §12.2 "不能说的"列了 4 项, 与 STRATEGY §E-2 一致。
EXECUTION_PLAN §12.3 "可以说的(修完 Phase 1 后)"列了 5 项。
BORROW_LIST.md 无此节。

**判定**: 销售话术红线**只在 STRATEGY + EXECUTION_PLAN 出现, 其他 11 份文档没有任何警告区。** REPORT.md 是 13 份文档的入门 (因为只有它叫 "REPORT"), 读者从 REPORT 进来, **完全感受不到 ⚠️ 红线**。

### Finding 4.3 — Voucher 凭证体系一致 (但工时差异大)

REVIEW.md §E "会计凭证模板": "23 类业务凭证模板 ... 缺 Voucher 模板系统。优先级 P2"
AUDIT.md §D + §G: "缺 Voucher 凭证 ... 15-20 人天 ... 仅当目标客户群明确要求"
V2_HD_INVENTORY §B10: "30-40 人天才完整" (含长期待摊/票据/汇率/固定资产/备用金)
EXECUTION_PLAN P3-T11: "AR/AP 凭证基础 ... 15 天" (仅 2 类业务, 不做完整 23 类)
BORROW_LIST F2: "15 人天"

**判定**: 凭证体系范围**严重不一致** (15 天部分版 vs 30-40 天完整版)。EXECUTION_PLAN 选了部分版, 但 V2 HD 完整版数据未被反驳, 留下了 future scope creep 风险。

---

## §5. Type 5 — 优先级排序矛盾

### Finding 5.1 — Slot-filling 优先级翻转

| 文档 | 优先级 |
|---|---|
| REPORT.md §九 | "立即 (1-2 周): 方案 4 把所有 create Tool 的 slot 定义补全" |
| REVIEW.md §F | "短期 1-2 月: 补全 create-Tool slot 定义" |
| AUDIT.md §G | "🟠 中期 2-3 月: Slot-filling 多轮对话 (审计才发现是新工程, 不是收尾)" |
| STRATEGY.md §D-4 | "🟡 中期 (2-3 月): Slot-filling 后端" |
| EXECUTION_PLAN.md | **完全没列在 Phase 1-3** |
| BORROW_LIST.md | **完全没列** |

**判定**: REPORT/REVIEW 把它列为短期, AUDIT/STRATEGY 降到中期, EXECUTION/BORROW 直接砍掉。**REPORT 仍在文档**, 读者会按"立即"做就翻车。

### Finding 5.2 — G19 凭证体系 P2 vs P3 vs 暂缓

| 文档 | 优先级 |
|---|---|
| REVIEW.md §E | "P2 ... 仅当客户实际是 30-50 人小厂...凭证是给会计交报税用的" |
| AUDIT.md §G | "🔴 长期 / 高风险: 会计 Voucher 凭证体系" |
| GAPS.md §四 G19 | "**P3** — 仅当目标客户群明确要求税务凭证" |
| V2_HD_INVENTORY.md §5.2 | "Sprint 3 (P2): G19 会计凭证体系 30-40 天" |
| EXECUTION_PLAN.md §5.2 | "暂缓项: 完整 23 类会计凭证 (G19 完整版) 仅当客户群明确要求" |
| BORROW_LIST.md F2 | "Phase 3" (即 P3) |

**判定**: REVIEW P2 vs GAPS P3 vs V2_HD P2 (重新升回) vs EXECUTION 暂缓。**G19 在 4 个不同优先级之间反复横跳**。

### Finding 5.3 — 视觉自动报工大降级

| 文档 | 优先级 |
|---|---|
| REPORT.md §六 方案 2 | 立即/短期 "方案 2 视觉自动报工 PoC" |
| REVIEW.md §F 短期 | "短期 1-2 月: 视觉报工 PoC 选 1 个食品厂客户跑试点" |
| AUDIT.md §G | "🔴 长期 / 高风险: 视觉自动报工 (先 PoC 1 条产线 30 天再决定)" |
| STRATEGY.md §D-4 | "🟡 中期 (2-3 月): 视觉报工 PoC" |
| EXECUTION_PLAN.md §6.1 | "已降级到 Phase 3 + PoC 30 天" (实际未在 Phase 3 详列) |
| BORROW_LIST.md | **完全没列** |

**判定**: 销售话术 STRATEGY §E-1 仍说 "可以说: 我们能用摄像头看到工人...(标 PoC 阶段, 30 天试点)"——但 EXECUTION 已降级到不做。**销售话术与执行计划脱钩**。

---

## §6. Type 6 — 名词混乱

### Finding 6.1 — 嵌件 vs 委外 12 模块顶部菜单错读

| 文档 | 名词 |
|---|---|
| REPORT.md §二 0:00 | "**嵌件管理**" |
| REVIEW.md | 沿用 "嵌件" |
| AUDIT_X_UI_UX.md §1 | "嵌件管理" 未修正 |
| STRATEGY.md §B-1 | "**嵌件**" 未修正 |
| V2_HD_INVENTORY.md §1 修正 1 | **明确修正**: "顶部 12 模块的'嵌件管理'应为'**委外管理**'" |
| EXECUTION_PLAN.md / BORROW_LIST.md | 没用此名词 |

**判定**: V2_HD 已 HD 验证修正为"委外管理", 但 REPORT/REVIEW/AUDIT_X/STRATEGY 4 份**仍写嵌件**。委外管理是 EXECUTION_PLAN.md §5.2 "暂缓项 G50" + V2 §G_NEW_15 真实存在的子模块——名词混乱直接影响后续讨论。

### Finding 6.2 — 编号体系混乱 G vs F vs G_NEW vs S/M/H/W

| 编号 | 出处 |
|---|---|
| G1-G23 | GAPS.md (原始) |
| G24-G46 | V1_AUDIO_INVENTORY.md (V1 漏项) |
| G_NEW_1-G_NEW_20 (即 G47-G66) | V2_HD_INVENTORY.md (V2 HD 新发现) |
| F1-F58 | V1_AUDIO_INVENTORY.md (音频提及) |
| B1-B15 | V2_HD_INVENTORY.md (细化) |
| S1-S10, P1-P5, M1-M9, W1-W10, F1-F7, H1-H9, Q1-Q4, E1-E4, C1-C8, U1-U8 | BORROW_LIST.md (重新编号) |

**判定**: BORROW_LIST 用全新一套编号 (S/P/M/W/F/H/Q/E/C/U), **未给出与 G/F/G_NEW 的双向映射**, 仅在每条偶尔提"详见 GAPS Gxx"。读者要追溯任一项的原始证据极困难。例如 BORROW_LIST S1 对应 GAPS G1 错判 报价单? — 实际 S1 是销售三向分流, 对应 V2_HD G_NEW_1。

### Finding 6.3 — 文档优先级标语自相矛盾

REPORT.md 末尾: 暗示自己是主报告。
REVIEW.md §产出物 (v2): "**REVIEW.md ← 本评审报告(替代 REPORT.md 作为主文档)**"
AUDIT.md 开头: "AUDIT > REVIEW > REPORT"
STRATEGY.md 开头: "STRATEGY > AUDIT > REVIEW > REPORT"
STRATEGY.md §产出物清单: "**报告优先级**: STRATEGY > AUDIT > AUDIT_X/Y/Z > REVIEW > REPORT"
EXECUTION_PLAN.md §13 文档地图: "优先级阅读: EXECUTION_PLAN → STRATEGY → 需要细节时查具体 AUDIT"
BORROW_LIST.md §15 关联文档: 列了 7 份但未给优先级

**判定**: 4 次"地位升级"——REVIEW 替 REPORT, AUDIT 替 REVIEW, STRATEGY 替 AUDIT, EXECUTION_PLAN 替 STRATEGY。**没有任何文档列了"已被取代/可忽略"的列表**。读者翻第一份 REPORT.md 会以为它仍权威。

### Finding 6.4 — "声明 vs 实际"陈述漏洞

STRATEGY.md §A-6: "5 分钟 Redis 缓存"实际是 JVM Caffeine。
AUDIT_Z §2: "5 分钟 TTL 是 IntentResultCache (Caffeine), 不是 Redis ... 没有 Redis 层托管 AI 结果"。
REPORT.md / REVIEW.md / GAPS.md / EXECUTION_PLAN.md: **完全没提**。
CLAUDE.md (作为权威项目说明文件): 也没改回此处。

**判定**: 销售话术红线 #4 "❌ 不要说 5 分钟 Redis 缓存"——但 13 份文档中只有 STRATEGY + AUDIT_Z 提到此错。EXECUTION_PLAN §12.2 引用了这条红线, 但底层证据不在 EXECUTION_PLAN 中, 读者翻不到时容易"重新发现"这个错误声明。

---

## §7. 总结建议

### 7.1 应该 retire / 标记 "DEPRECATED" 的文档

| 文档 | 状态 | 建议 |
|---|---|---|
| **REPORT.md** | 已被 4 份后续文档替代 (REVIEW/AUDIT/STRATEGY/EXEC) | 文件头加 `> ⚠️ DEPRECATED — 见 EXECUTION_PLAN.md 和 STRATEGY.md。本文 §六方案4/5、§五借鉴点5/6 含已证伪推荐, 仅作素材参考` |
| **REVIEW.md** | 已被 AUDIT/STRATEGY 修正 (§E 表 4 处错判) | 同上, 加 ⚠️ DEPRECATED 头, 标明 §E 表 vs §F 内部矛盾 + §F-4 slot-filling 评估错误 |
| **GAPS.md** | 23 条里 12 条被 V3 证伪 | 加 ⚠️ HEAVILY REVISED 头, 顶部加链接 "见 V3 §1 修正" + 标记证伪条目 (G1/G4/G7/G13/G17/G19/G20/G22 已有) |
| **AUDIT.md** | 已被 STRATEGY 整合, 但仍有独立价值 (硬证据) | 保留, 加 superseding 链接到 STRATEGY |

### 7.2 应该 merge 的重复文档

| 重复对 | 建议 |
|---|---|
| V1_AUDIO_INVENTORY + V2_HD_INVENTORY | 都是"宏见有什么 vs Cretas 有什么"逆向清单, 合并为 V_INVENTORY (按 G/F/G_NEW 统一编号) |
| AUDIT_X (UI/UX) + V2_HD (UI 模式) | UI 模式分散两处, V2_HD §3-5 已部分包含 AUDIT_X §2-3 内容, 可整合 |
| storyboard.md + storyboard_v2.md + storyboard_hd.md | 3 份 storyboard 重复, 保留 hd, retire 前 2 |

### 7.3 应该新增的文档

1. **DOCS_MAP.md (文档地图)** — 列 13 份文档当前状态 (ACTIVE / DEPRECATED / DRAFT) + 读者入口 + 最新优先级。这正是本 AUDIT_FRESH_D_DOCS 应填补的元层缺。
2. **SALES_REDLINE.md (销售话术红线)** — 抽出 STRATEGY §E-1/E-2 + EXECUTION §12.2/12.3 + V3 §2 独家优势 = 给销售看的单一权威清单, 含每条话术的"证据 + 风险 + 修复 PR"链接。
3. **NUMBERING_MAP.md (编号映射表)** — G1-G66 ↔ S/P/M/W/F/H/Q/E/C/U ↔ F1-F58 ↔ B1-B15 ↔ EXECUTION PHASE 任务码, 任一项可双向追溯。
4. **CHANGELOG_AUDIT.md (审计差异日志)** — 记录"REVIEW 说 X, AUDIT 改成 Y, V3 改成 Z, 最终 EXEC 用 Z" 的迭代链, 防止读者翻旧文档时陷入已被否定的结论。

### 7.4 后续不重复犯错的护栏

| 反模式 | 护栏 |
|---|---|
| 每份新文档自称"替代旧版" | 强制要求新文档**显式标 retire 旧版的具体段落**, 不是抽象的"修正" |
| 编号体系自由命名 | 锁定 G1-Gxx + F1-Fxx 永不重命名, 新增只往后扩 |
| 工时估算单点 | 强制 "REVIEW 3 天 → AUDIT 8-12 天" 双轨注明, 不只写最新值 |
| 销售话术散落 | 维护 SALES_REDLINE 作为单一源头, 所有 demo/PPT/客户邮件引用它 |
| 已证伪推荐留在文档 | 已证伪段落加 `~~删除线~~ + ⚠️ 见 V3 §X.Y` 内联标记 |

---

## §8. 不一致条目数汇总

| 类型 | 发现数 |
|---|---|
| Type 1 工时估算不一致 | 4 处 (S1 链路 / Slot-filling / 视觉报工 / 总工时) |
| Type 2 已有/缺失判断不一致 | 4 处 (报价单 / Feature Flag / GAPS 整体 / Skill 数) |
| Type 3 推荐 vs 证据脱钩 | 5 处 (REPORT 借鉴点5/6 / REVIEW slot立即做 / REPORT 方案4 / REVIEW E 表 / Canvas 未提) |
| Type 4 销售话术红线遗漏 | 3 处 (4项不能说没传到 REPORT / REPORT 方案1 没标修复后才能演 / 凭证范围) |
| Type 5 优先级排序矛盾 | 3 处 (Slot-filling P0/P1/P2/砍 / G19 P2/P3/暂缓 / 视觉报工降级与话术不同步) |
| Type 6 名词混乱 | 4 处 (嵌件 vs 委外 / G/F/S 编号 / 4 次"取代"声明 / Redis vs Caffeine 散落) |
| **总计** | **23 处不一致** |

**结论**: 13 份文档累积了 23 处可识别的跨文档不一致。其中 **REPORT.md 是最大风险源** (作为系列入口, 含 4 处已证伪推荐 + 0 个 ⚠️ DEPRECATED 标记), **GAPS.md 是第二大风险源** (12/23 条被证伪但 7.3 KB 文档未改写)。EXECUTION_PLAN.md + BORROW_LIST.md (最新 2 份, 2026-05-14 02:16-02:30) 是最终权威, 但缺少回头修旧文档的纪律。

— 报告完 —

参考来源: REPORT.md / REVIEW.md / AUDIT.md / AUDIT_X_UI_UX.md / AUDIT_Y_CANVAS.md / AUDIT_Z_AICHAT_E2E.md / STRATEGY.md / GAPS.md / V1_AUDIO_INVENTORY.md / V2_HD_INVENTORY.md / V3_CRETAS_REVERSE.md / EXECUTION_PLAN.md / BORROW_LIST.md
