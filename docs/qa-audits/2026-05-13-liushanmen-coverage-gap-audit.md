# 六扇门 (F006) 客户 ask E2E 覆盖 gap 审计

**日期**: 2026-05-13
**审计员**: Claude Opus 4.7 (1M) — organizer continuation
**Base**: `origin/main` HEAD `493782b3c` (PR #467 latest)
**Target**: `http://139.196.165.140:8086` (web-admin prod, 139)
**Source-of-truth**:
- 4 transcripts: `docs/会议内容/客户会议/六扇门第{一,二,三,四}*.md` (第三/四次仍在 OPEN PR #400 + #406)
- prior audit: `docs/qa-audits/2026-05-12-final-customer-audit-e2e.md` (PR #434, 14 scenarios)
- ⚠ **Transcripts 第三/四次** 仍在 OPEN PR #400 + #406 (not on main). 复现引用行号:
  ```bash
  git fetch origin pull/400/head:pr-400-transcripts && git fetch origin pull/406/head:pr-406-transcript
  git show pr-400-transcripts:docs/会议内容/客户会议/六扇门第三次-May7-part1.md
  git show pr-400-transcripts:docs/会议内容/客户会议/六扇门第三次-May7-part2.md
  git show pr-406-transcript:docs/会议内容/客户会议/六扇门第四次-May10.md
  ```
- E2E results: `scripts/customer-audit-e2e-2026-05-12/results.json`
- 后续补丁: PR #443/#455/#456/#457/#458/#463/#464/#466/#467
- 评估范围: ❌ 只读 prod, 不重跑已 GREEN 的 S1/S5/S7/S8/S9/S10-wire/S11

---

## §1 Executive Summary

### 1.1 关键发现 (vs prior audit `2026-05-12-final-customer-audit-e2e.md`)

| 指标 | prior audit 声明 | 本审计校对结果 |
|---|---|---|
| 客户 ask 总数 | **38** | **51** (prior audit §1 数学错误 "第3=10" 实际 P1=6 + P2=10 = 16; 漏列 T4-D4 / T4-D5 / T-RTA / T-INV / T2-5b / T2-11 / T2-12 / T3-8b 共 8 项. 修正: 第1=6 / 第2=13 / 第3-P1=6 / 第3-P2=10 / 第4=16 = 51) |
| E2E scenarios 跑 | 14 | 14 (一致) |
| Post-deploy 复跑结论 | 🟢 GREEN ~90% (S10-1/S10-4 列头隐藏属 sister-sweep 范围, 非演示阻塞) | **🟡 needs re-verify** — 后续 PR #443→#467 chain 是 demo-blocker 闭合 PR, 但**没有任何 PR 复跑 14-scenario E2E** |
| sales/orders wire-level | 标 PASS (无 leak `:null`) | **🔴 results.json 显示 HTTP 500** — `f006_warehouse_mgr` 调用 `/api/mobile/F006/sales/orders` 返回 `code:500 message:系统处理异常 追踪码:39AFF3AD + 00D57286` (prior audit 漏报) |
| LIVE-only 未 E2E verify | 隐式接受 (PR ship 即合规) | **25 个 ask** (per §1.2 partition) 仅按 audit-doc status 标 ✅, 没专门 scenario 覆盖 |
| Vacuous PASS scenarios | 0 | **3** — S3 (404 route), S10-3 (404), S6 D1 label (dialog 没显示) |
| Weak-evidence scenarios | 0 | **6** — S2/S3/S5/S6/S7/S10-3 |

### 1.2 Gap 计数 (按 §2 新分类列 glyph 分桶 — 每个 ask 恰好一个 bucket)

| 类别 | 数量 | 来源 |
|---|---|---|
| ✅ LIVE & E2E verified (strong evidence, ask-level) | **2** | §2 新分类列首 glyph = ✅ : T3-7 / T3-8 |
| ◯ LIVE & 未 E2E verify (仅按 audit-doc status) | **25** | §2 新分类列首 glyph = ◯ |
| 🟡 LIVE & E2E weak evidence | **9** | §2 新分类列首 glyph = 🟡 : T2-10 / T3-9 / T4-B2 / T4-B3 / T4-B4 / T4-B5 / T4-B9 / T4-D1 / T4-D2 |
| 🔴 真 open / 决策待定 | **7** | §2 新分类列首 glyph = 🔴 : T1-6 / T2-3 / T3-6 / T3-11 / T3-13 / T3-14 / T4-B6 |
| ⛔ audit doc 漏列 (transcript 提到但 prior §2 没收录) | **8** | §2 新分类列首 glyph = ⛔ : T2-5b / T2-11 / T2-12 / T3-8b / T4-D4 / T4-D5 / T-RTA / T-INV |
| **TOTAL** | **51** | 2 + 25 + 9 + 7 + 8 = 51 ✓ |

**Partition rule**: 每个 ask 按 §2 第6列「新分类」首个 glyph 归入恰好一个 bucket. 部分 ask cell 含跨类备注 (如 T3-9 "🟡 backend ✅ + UI 待复测 + sales 500 root-cause"), 一律取首 glyph 分类避免双计.

**正交叙事 (orthogonal commentary, 不计入桶)**:
- "PR chain 闭合但未复测 (demo-blocking)": **5** (PR #443/#456/#457/#466/#467) — 这是 PR 维度的 demo-blocker 链, 不是 ask 维度 bucket. 这 5 PR 关联的 ask 已被分到 ◯/🟡 桶内 (如 T3-9 → 🟡 因 UI 复测待跑).

### 1.3 Top 5 follow-up 推荐 (按 P 级)

1. **P0**: 复跑 S10-1 + S10-4 UI v-if column hide (PR #467, 2026-05-12 19:37 UTC merge — E2E run 时未上线)
2. **P0**: Root-cause `sales/orders` HTTP 500 for `f006_warehouse_mgr` — prior audit `2026-05-12-final-customer-audit-e2e.md:191` 自称"没 sniff 到 /sales/orders API",但 results.json 明确显示 2 次 500. 追踪码 `39AFF3AD`/`00D57286` 已记录, 应即时查 server log.
3. **P1**: 测 PR #456 binary export 6 endpoints — PDF/Excel export 是否真的 maskPrice (尤其针对 warehouse_mgr 触发 PDF download)
4. **P1**: 测 PR #443 + PR #458 — @PriceSensitive METHOD target on `@Transient` computed getters (SalesOrder.getPayableAmount / SalesOrderItem.getCostTotal / etc.) 是否真 strip + 无 NPE
5. **P2**: 25 个 LIVE-only-未 verify ask 抽样 5 个 (T2-4 研发→采购→入库 RPF chain + T4-B2 调拨批次 CREATE FEFO + T4-D1 双仓 schema dialog 字段 + T4-D2 BOM yield-rate form 实开 + T4-B3 生产开始库存校验 four-tuple)

### 1.4 时间线核对 (E2E run vs PR chain merge)

```
2026-05-12 (UTC)
├── 07:26  E2E run  (results.json runAt)
├── 15:46  PR #434 merge  (audit doc 本身)
├── 18:35  PR #443 merge  (@PriceSensitive METHOD target + Jackson filter)
├── 18:36  PR #455 merge  (Canvas RBAC #447 bugs)
├── 18:36  PR #456 merge  (P0-C binary export sweep 6 endpoints)
├── 18:39  PR #457 merge  (BUG-6 9 HIGH fields + InternalTransfer)
├── 18:41  PR #458 merge  (PR #443 follow-up async-dispatch + MaterialBatch)
├── 19:32  PR #466 merge  (BomItem + 16 BOM-domain sister fields)
├── 19:37  PR #463 merge  (deploy script cosmetic)
├── 19:37  PR #464 merge  (E2E wire-roundtrip regex fix)
└── 19:37  PR #467 merge  (UI v-if column hide — purchase + sales)
```

**结论**: E2E run 与 demo-blocking 补丁链有 **~11 小时间隔**, 期间 8 个 functional/RBAC PR 合并 + deploy, 但**没复测**. prior audit §6 sign-off `[ ] BUG-6 sister-sweep` + `[ ] UI 列头隐藏` 等已通过 PR #455-#467 解决, 但**勾选状态没更新到 audit doc**. (memory: `feedback_organizer_verbal_signoff_must_amend_spec.md`)

---

## §2 51 Ask 状态校对 + 证据 ref

**图例**:
- ✅ = LIVE + E2E verified (强证据)
- ◯ = LIVE + 未专门 E2E (仅按 audit-doc status)
- 🟡 = LIVE + weak evidence (vacuous PASS / empty data)
- 🔴 = 真 open / partial / decision 待落地
- ⛔ = audit doc 漏列 (本审计新发现)

### 第一次会议 (六扇门第一次.md, 单段长文本, pre-2026-03)

| # | Ask | Transcript ref | prior audit §2 状态 | results.json 证据 | 新分类 |
|---|---|---|---|---|---|
| T1-1 | 排第二天的生产计划在网页端 / 调度账号操作 | 第一次:1 ("排第二天的任务排的话是在那个网页端") | ✅ LIVE | S7 page renders 6 plans | ◯ partial (page 渲染 OK,但生产计划 CRUD 没 E2E 测) |
| T1-2 | AI 对话创建生产计划 (引导式) | 第一次:1 ("AI 对话窗间... 引导性去做这个事") | ✅ LIVE | S7 页面有"AI 对话创建" 按钮 但未触发 | ◯ |
| T1-3 | 当天生产计划按工序排 (非按品) — 卤制周期长 | 第一次:1 ("当天的生产计划按照工序来") | ✅ LIVE PR #293 | 无 — audit doc 没专门测 T4-B1 也是相同主题 | ◯ |
| T1-4 | 小程序点工序卡片报今天产量 | 第一次:1 ("小马的模块... 点对应的卡片进去报") | ✅ LIVE RN 端 | 无 — Playwright 跑 web-admin, 没跑 RN | ◯ |
| T1-5 | 报工累计式 (1小时一报) — 后台审批后求和 | 第一次:1 ("一个小时报一下... 同一个产品同一个公司的是个逻辑") | ✅ LIVE | 无 — 没 E2E | ◯ |
| T1-6 | 标签金属探测 + 图像识别异物 (摄像头集成) | 第一次:1 ("金属探测看里面有没有什么金属... 摄像头给扫描出来") | 🟡 PARTIAL (需 specific 数据 train) | 无 — 不在 web-admin E2E 范围 (YOLO V2.1+V2.2 已落地, 见 memory `project_yolo_v2_aggressive_apr17.md`) | 🔴 verify on-site |

### 第二次会议 (六扇门第二次.md, 2026-03-18 11:01)

| # | Ask | Transcript ref | prior 状态 | 实际证据 | 新分类 |
|---|---|---|---|---|---|
| T2-1 | 抛弃传统 ERP 模式 — 用 AI 中台调度 | 第二次:51-69 (张权: "我们不再想开发传统的 ERP... 用现在 AI 帮我们做中台数据调度") | ✅ LIVE Tool-Skill 337+ Tool | 无 — 概念性 ask, AI 意图调用没 E2E | ◯ (架构正确性 covered by 16 内置 Skill + 337 Tool 自动注册) |
| T2-2 | 进销存/财务/订单/生产/研发 标准化模板 | 第二次:69-71 ("基本的几个模块... 进销存的这个模块,可以给一个标准格式") | ✅ LIVE 业务模块 | S5/S6/S7/S8/S9 各模块导航存在 | ◯ |
| T2-3 | 钉钉交互通道 (员工通过钉钉跟 AI 对话) | 第二次:79-85 + 253-321 (张权: "钉钉这个端口... 他可以直接去调这些数据") | 🟡 PARTIAL | 无 — 钉钉集成范围在后端 OAuth | 🔴 实测钉钉机器人是否接通 |
| T2-4 | 研发 → 采购 → 入库 → 提取 → 生产 串通 | 第二次:105-117 (张权: "研发的时候会有一个报名表... 后续采购也是根据报名表算出来的, 入库... 提取的时候从 BOM 去算") | ✅ LIVE PR #311/#312 | 无 — 没专测全链路 | ◯ (建议 follow-up 测 RPF→BOM→采购订单→入库→生产消耗 完整链路) |
| T2-5 | 销售订单录入 → 应收账款 → 应付应付 | 第二次:115-117 ("销售订单的录入, 应收账款生成, 然后应付应付的这些东西") | ✅ LIVE finance + invoice approval | S6 销售订单 dialog 打开但 row=0 | ◯ |
| T2-5b ⛔ | 移动平均价 / 动态定价 / 每批次追踪 | 第二次:633-644 (张权补充: "移动平均价值, 动态价格, 每一批的产品原料也好, 成品也好, 它买入和售出的价格都不一样") | (prior audit T2-5 概括, 未单独列) | 无 | ⛔ 漏列,需 follow-up (跟 T3-3 三价对比 + T3-15 单价可改 是同 family) |
| T2-6 | 大模型理解 vs 严谨字段匹配 | 第二次:75-77 ("传统上系统需要做非常严谨, 一对一的每个字段匹配... 但这个大模型它的理解能力就比较强") | ✅ LIVE LLM fallback + Skill | 无 — 架构正确性 | ◯ |
| T2-7 | 给 AI 学习报价规则 / 库存管理规则 | 第二次:81-83 ("给一些这些规则, 比如说我们报价规则呀, 我们的这些库存管理的规则") | ✅ LIVE Skill DB store + 16 内置 | 无 | ◯ |
| T2-8 | AI 在数据板块间做调度分析 | 第二次:85 ("帮我们去做调度分析") | ✅ LIVE Skill registry + cross-module Tool | 无 | ◯ |
| T2-9 | 非标品 + 多 SKU + 大量辅料 (一品 30-40 种) | 第二次:57-61 (张权: "一个熟食呢可能涉及到多的三四十种辅料, 单品上用量呢又极低") | ✅ LIVE BomItem schema | 无 — 仅 entity 层 | ◯ |
| T2-10 | 极低用量辅料 — 减少手工维护 (用 RPF 算) | 第二次:57-65 (张权: "为了这个极低用量呢, 又需要很大的人力去维护") | ✅ LIVE PR #297 yieldRate | S2 yieldRateLabel=false formOpened=false — **没真测** | 🟡 weak (W6) |
| T2-11 ⛔ | 工序投入产出比 + 出成率 | 第二次:411-505 (张权: "每道工序里面的一个效率和它的一个量率或者出的率... 出成率") | (prior audit T2-2 概括, 未单独列) | 无 | ⛔ 漏列, follow-up 测生产数据分析模块 |
| T2-12 ⛔ | 财务模块 SKU 毛利率 / 移动平均价 | 第二次:633-655 (张权: "我们最重要的是算这个产品的一个毛利率, 这个是很重要的一项") | (prior audit T2-5 概括) | 无 — 系统有 SKU 毛利率分析菜单 (S5 body) 但未测 | ⛔ 漏列, follow-up 测 SKU 毛利率分析页 |

### 第三次会议 Part 1 (May 7 part1, ~6:51)

| # | Ask | Transcript ref | prior 状态 | 实际证据 | 新分类 |
|---|---|---|---|---|---|
| T3-1 | 箱数自动算 (1级↔2级单位转换系数维护点) | 第三次P1:13-21 ("根据规格自动折算箱数") | ✅ LIVE PR #173 P1 | 无 — 没专测采购单详情 | ◯ |
| T3-2 | 抄码品识别 (规格 `=== '抄码'` → 不显示箱数) | 第三次P1:23-69 ("规格是超码,箱数自动会显示超码品然后就不显示多少箱") | ✅ LIVE PR #173 P1-3 + `reference_abaca_term.md` | 无 | ◯ |
| T3-3 | 三价对比分析 (近期/历史/当前采购价) | 第三次P1:115-129 ("三价对比分析... 自动生成的, 根据以往的采购价") | ✅ LIVE | 无 | ◯ |
| T3-4 | 预计到货时间字段 (= "期望交货时间", 客户认可) | 第三次P1:137-149 ("预计到货时间... 是有, 期望交货时间, 差不多这个意思") | ✅ LIVE | 无 | ◯ |
| T3-5 | 工作流审批链动态配置 (按职位/人数) | 第三次P1:93-113 ("审批链还要专门配置一下, 根据每个职位每个人数去定") | ✅ LIVE | S5 body 含"审批链配置" 菜单 | ◯ |
| T3-6 | 列宽/字段挤压 (采购单详情) | 第三次P1:151-157 ("字太小了挡住了") | 🟡 PARTIAL UI ticket 待开 | 无 | 🔴 audit ticket 未 file |

### 第三次会议 Part 2 (May 7 part2, ~28:53, **3 个真 gap**)

| # | Ask | Transcript ref | prior 状态 | 实际证据 | 新分类 |
|---|---|---|---|---|---|
| T3-7 | 收货数量分次显示列 | 第三次P2:53-57 ("收货数量加一个呗... 第一次收了多少 第二次收了多少") | 🔴→✅ PR #414 deploy 2026-05-12 14:28 | S9 PASS: headers 含 "收货数量" | ✅ verified |
| T3-8 | 采购订单 PDF 打印 + 扫码入库工作流 (完整闭环) | 第三次P2:79-181 ("供应商可以打印... 仓管员只要扫一下条码... 仓库做管理...") | 🔴→✅ PR #413 deploy 14:28 | S8 PASS: PDF blob download triggered | ✅ verified (注: 扫码入库流程闭环还有"二维码扫描端"未测) |
| T3-8b ⛔ | 仓管员入库只录数量+日期+拍照 (不参与价格) | 第三次P2:182-197 ("商品日期跟收货数量好... 其他的话尽量少让仓管员去参与什么什么价格类的") | (prior audit 部分被 T3-9 覆盖) | 无 — 仓管入库 UI 是否 hide 价格字段未专测 | ⛔ follow-up, 跟 T3-9 RBAC 关联 |
| T3-9 | RBAC 仓管角色价格字段隔离 | 第三次P2:170-191 ("采购跟入库是两个人... 仓管员不要参与价格类") | 🔴→✅ PR #423 deploy + PR #443/#458/#456/#457/#466/#467 chain | S10-5 wire 7 leak fields 全 `:null` ✅; S10-1+S10-4 UI 列头 PR #467 修但未复测; sales/orders **500 error** 未 root-cause | 🟡 backend ✅ + UI 待复测 + sales 500 root-cause |
| T3-10 | 销售单价 BOM 默认 + 可改 (BOM 核算价带出 → 销售订单允许修改) | 第三次P2:281-305 ("BOM合算价格能带出来, 但是这个字段是可以修改的") | ✅ LIVE PR #297 D2 | 无 — 销售订单 dialog 没测 unitPrice 字段可改 | ◯ |
| T3-11 | 预估成本暂时隐藏 (财务审批界面) | 第三次P2:425-475 ("预估成本... 这个建议暂时先去掉... 容易产生冲突") | 🟡 PARTIAL 决策已定, 未落地 | 无 — feature flag 状态未 verify | 🔴 待落地 |
| T3-12 | 原料字段加"供应商" 多对多关联 | 第三次P2:217-247 ("原料的话那个加一个对应的供应商") | ✅ LIVE 供应商管理表已建 | S5 body 含"供应商管理" 菜单 | ◯ |
| T3-13 | UI 列宽 / 详情盖住 (规格列) | 第三次P2:393-415 ("成品详情盖住了是规格那边") | 🟡 PARTIAL | 无 | 🔴 audit ticket 未 file |
| T3-14 | 三价对比新采购单后未刷新 (数据 bug) | 第三次P2:65-75 ("三家对比没有... 可能是一些数据的 bug") | 🔴 OPEN | 无 — bug 未修 | 🔴 P2 ticket 待开 |
| T3-15 | 一二级单位转换 (客户确认"挺好的") | 第三次P2:371-387 ("这个一二级单位转换, 这个没问题的, 这个你做的挺好的") | ✅ LIVE PR #297 D3 + PR #173 P1 | 无 | ◯ |

### 第四次会议 (May 10, ~56 min)

| # | Ask | Transcript ref | prior 状态 | 实际证据 | 新分类 |
|---|---|---|---|---|---|
| T4-B1 | 生产计划工序下拉只显示"通用" | 第四次:96-160 ("现在只有通用, 没有关联过来") | ✅ LIVE PR #293 | S7 page render 6 plans, 但工序选择对话框未触发 | ◯ |
| T4-B2 | 调拨单批次选择 (CREATE FEFO + SHIP override) | 第四次:466-512 ("调拨单是没有办法选择批次... 让自动的... 这个不要自动") | ✅ LIVE PR #322 cascade #351 | S3 `/inventory/transfers` 404 (route migration), 真正路径 `/inventory/transfer-orders` 未测 | 🟡 W1 (S3 vacuous) |
| T4-B3 | 生产开始无库存校验 | 第四次:586-602 ("开始的时候还核对一下入库那边是不是已经入到了足够可以生产这一批产品的原材料") | ✅ LIVE PR #305 | S7 startBtnCount=0 — four-tuple 没真触发 | 🟡 W5 |
| T4-B4 | 调拨缺"现有库存"列 | 第四次:445-466 ("调拨数量旁边加个字案加一个那个现有库存") | ✅ LIVE PR #295 | S3 404 — 调拨页面没测 | 🟡 W1 (S3 vacuous) |
| T4-B5 | 缺分仓库存查询页 | 第四次:660-690 ("生产管理里面加一个库存查询呗... 分仓的库存查询") | ✅ LIVE PR #323 + cascade #351 | S5 PASS: page render OK but 4× 401 API failed — page 渲染了但数据加载失败 | 🟡 W2 |
| T4-B6 | App 报工转圈 (单一用户 pw drift) | 第四次:616-630 ("一直在转加载中... 后端的问题") | 🟡 PARTIAL chat5 OTA in-flight | 无 — 不在 web-admin 范围 | 🔴 chat5 跟进 |
| T4-B7 | 弹窗宽度小 | 第四次:122-126 ("新建销售订单的时候不是那个弹窗太小吗... 那个窗口小了") | ✅ LIVE PR #293 | S6 dialogOpened=true bodyPreview 含字段 — 但宽度未量化 | ◯ |
| T4-B8 | BOM 关联原料未联动 | 第四次:251-256 ("关联原料其实是有的, 关联也要了, 现在当然是有问题的") | ✅ LIVE PR #293 | 无 | ◯ |
| T4-B9 | 手动调拨入口 | 第四次:526-540 ("手动创建调拨单... 在没有销售订单的情况下会产生的调拨") | ✅ LIVE PR #299 | S3 404 — 未测 | 🟡 W1 |
| T4-D1 | 工厂 = 线边仓 (推翻 V3 P0-5 ADR) | 第四次:702-732 ("生产完结束以后是没有库存的... 线边仓只是今天要生产, 所以有些临时库存... 成品会调回总仓") | ✅ LIVE PR #310 + #315 + #355 | S5 body 含 "总仓 (WH-LOG)" + "线边仓 (WH-WKS)" ✓ ; S6 dialog hasWhLogText=false hasZongCangText=false hasXianBianCangText=false — **dialog 中没显示**! | 🟡 W3 (D1 label 仅在分仓库存查询页显示, 销售订单 dialog 中没显示) |
| T4-D2 | BOM 算法 (成品克数 + 出成率) | 第四次:226-270 ("成品含量 200克... 出成率 58%, 自动算出原材料一共用多少") | ✅ LIVE PR #297 | S2 INFO formOpened=false — 表单没真打开 | 🟡 W6 |
| T4-D3 | g↔kg 1:1000 后台换算 | 第四次:382-410 ("克跟千克就是 1000:1000 的转换率") | ✅ LIVE PR #297 + #312 | 无 | ◯ |
| T4-D4 ⛔ | RPF 保留 + Path A/B (生产消耗 RPF 链路) | 第四次:418-431 ("BOM 是我把它设计成转换率的, 但其实就是原本的配方足够了 嘛, 但是我还是先留下来") | ✅ LIVE PR #294 (Path A) + PR #312 (Path B) | (prior audit §2 漏列!) | ⛔ follow-up 测生产消耗触发 RPF 链路 |
| T4-D5 ⛔ | 销售从 WH-LOG 总仓出货 (线边仓生产 → 调回总仓 → 总仓销售) | 第四次:706-732 ("总仓再会去安排什么时候发给那个客户... 我的成品库存我会调拨给那个总仓去") | ✅ LIVE PR #329 | (prior audit §2 漏列!) | ⛔ follow-up 测销售 fulfill 从 WH-LOG 出货 |
| T-RTA ⛔ | 退货/售后流程 (有食物退货 / 无食物退款) | 第四次:956-1037 ("可能会涉及到一个退货... 售后的话申请, 有食物的话库存入库到总仓... 无食物的话就退款, 财务审批") | (prior audit §2 完全漏列!) | 无 — 完整退货售后流程未在 audit doc 任何位置出现 | ⛔ **重大漏列, follow-up 必测** |
| T-INV ⛔ | 收款 / 一键收款 / 财务审批闭环 | 第四次:918-947 ("登记收款... 财务那边去核实... 一键收... 销售和财务之类的打通") | (prior audit §2 漏列) | 无 — 收款审批 UI 流程未测 | ⛔ follow-up 测 |

---

## §3 Weak-evidence Scenarios

### W1: S3 调拨单 batch dropdown — Vacuous PASS

- audit doc 标 ✅ PASS, 但 evidence 是 `is404:true headers:[]` — 实际路径 `/inventory/transfers` 已迁移到 `/inventory/transfer-orders` (D1 cascade PR #355)
- 没真测调拨单批次选择 (T4-B2) + 现有库存列 (T4-B4) + 手动调拨入口 (T4-B9)
- audit doc:144 自己也注 "实际客户路径是另一处 (route migration 待 verify)"
- **follow-up**: 用正确路径 `/inventory/transfer-orders` 重测 (见 §4 S-T-B2)

### W2: S5 分仓库存查询 — 401 静默

- audit doc 标 ✅ PASS, body 含表头, 但 results.json `networkLog` 显示 4× `/api/mobile/F006/inventory/by-warehouse` 返回 `401 用户未登录`
- consoleErrors 含 "查询库存失败: ApiError: 用户未登录"
- 页面渲染了但数据加载失败 — vacuous "page renders OK"
- **follow-up**: login 完整后重测 inventory/by-warehouse, 验证 batches 真实显示 (见 §4 S-T-B5-v)

### W3: S6 销售订单 D1 label — Dialog 没显示

- audit doc 标 ✅ PASS, 但 results.json `hasWhLogText:false, hasZongCangText:false, hasXianBianCangText:false` — D1 "线边仓"/"总仓" label 在新建销售订单 dialog **没显示**
- D1 label 在分仓库存查询 (S5 body) 已显示 — 部分覆盖
- audit doc:155 解释: "因为客户场景需要先有 batch" — 但 transcript 第四次 (T4-D5) 客户期望销售订单 batch source 选择时看到"总仓"
- **follow-up**: 先 prepare prod 数据 (确认 F006 有可用成品 batch), 再触发 dialog batch source select (见 §4 S-T-D1-dialog)

### W4: S10-4 sales/orders **HTTP 500** — audit doc 漏报

- audit doc:191 说 "本轮 post-deploy 复跑没 sniff 到 `/sales/orders` API" — 但 results.json `networkLog` 明确显示 **2 次 500**:
  ```
  {scenario:"f006_warehouse_mgr", url:".../sales/orders?page=1&size=100", status:500,
   body:"{追踪码: 39AFF3AD}"}
  {scenario:"f006_warehouse_mgr", url:".../sales/orders?page=1&size=10", status:500,
   body:"{追踪码: 00D57286}"}
  ```
- 两个追踪码可在 prod Java log 查到具体堆栈 (`grep -E '39AFF3AD|00D57286' /www/wwwroot/cretas/cretas-prod.log`)
- **时间窗口分析**: E2E run 07:26 UTC, PR #443 merge 18:35 UTC (11h 后). 所以两个 500 **早于** PR #443 deploy — 不是 #443 NPE 引起,而是 **pre-existing latent bug** (E2E run 时的 prod jar 已含此 bug). 可能根因: lazy-loading exception / null FK / @Transient getter NPE / 其他 endpoint 异常
- **必要 root-cause 步骤**: server log grep 追踪码 `39AFF3AD` / `00D57286` 提取真实堆栈, **不能** 假设 PR #458 hardening 已闭合 (因 #458 修的是 ThreadLocal fail-CLOSED,跟这两个 500 的根因可能无关). Post-PR #458 deploy 后必须重测 sales/orders for warehouse_mgr,确认 500 是否仍存在
- **follow-up**: PR #458 deploy 后重测 sales/orders for warehouse_mgr (见 §4 S-T-sales500)

### W5: S7 Rule 8 four-tuple — 未真触发

- audit doc 标 ✅ PASS, 但 results.json `startBtnCount:0` — 没有"开始"按钮 (current 6 plans 全部是 "已完成"/"进行中"/"已取消", 没有 "待执行" plan 可触发 start)
- audit doc:160 自己也承认 "Rule 8 four-tuple 验收需要先 create 一个 plan + 触发 start... 跨多 step write 操作, 跳过"
- **follow-up**: 先 prepare 一个 PENDING plan + 强制触发 stock-insufficient → 验证 toast + sticky + actionHint + backend match (见 §4 S-T-B3-fourtuple)

### W6: S2 BOM yield-rate — 表单没打开

- audit doc 标 INFO, results.json `formOpened:false yieldRateLabel:false formFields:[]` — 点了"新增配方"但 dialog 没显示
- 评估: 数据 empty 时可能 trigger 不到 dialog
- **follow-up**: prepare 至少 1 个菜品 prerequisite (R_GML_DEMO 是测试餐厅,看 prod 是否有可用菜品 catalog), 再点新增配方 → 验证 yield-rate 字段 (见 §4 S-T-D2-form)

---

## §4 推荐 Follow-up E2E Plan

### 4.1 必跑 (P0 — demo-blocking 闭合后验证)

| Scenario | 账号 | 操作 | Assert |
|---|---|---|---|
| **S-RBAC-1-retest** | `f006_warehouse_mgr` | 登入 → `/procurement/orders` → 读 table headers | hasPriceCol === false (PR #467) |
| **S-RBAC-4-retest** | `f006_warehouse_mgr` | 登入 → `/sales/orders` → 读 table headers + sniff `/api/mobile/F006/sales/orders` | hasPriceCol === false (PR #467) AND status === 200 (PR #458 NPE fix) AND `totalAmount/freightAmount/discountAmount = null` |
| **S-RBAC-sales500-rootcause** | server log | `grep -E '39AFF3AD\|00D57286' /www/wwwroot/cretas/cretas-prod.log` | 找到堆栈, 确认 PR #443 或 #458 是否真闭合 |
| **S-RBAC-pdf-warehouse** | `f006_warehouse_mgr` | 登入 → `/procurement/orders` → 找 PDF button → 点 → 解析 PDF text | PDF 内容**不含**`总金额/单价/税额` (PR #456 binary export sweep) |
| **S-RBAC-excel-warehouse** | `f006_warehouse_mgr` | 登入 → 任一 page → 点 "导出 Excel" → 解析 xlsx | Excel 不含价格列 (PR #456) |

### 4.2 应跑 (P1 — audit doc 漏列 + weak evidence)

| Scenario | 账号 | 操作 | Assert |
|---|---|---|---|
| **S-T-B2-batch-select** | `f006_admin` | 登入 → `/inventory/transfer-orders` (正确路径) → 触发批次选择 dialog | hasBatchSelect === true AND batches.length > 0 |
| **S-T-B5-inv-load** | `f006_admin` | 登入 → `/inventory/by-warehouse` → 选 F006 + 总仓 → sniff API | 200 AND batches data 真实存在 |
| **S-T-D1-dialog** | `f006_admin` | 登入 → `/sales/orders` → "新建销售订单" → 选品 → 看 batch source 选择 dropdown | dropdown 含 "总仓 (WH-LOG)" + "线边仓 (WH-WKS)" |
| **S-T-D2-form** | `gml_admin` | 登入 → `/restaurant/recipes` → "新增配方" → form 打开 | formOpened === true AND yieldRateLabel.includes("净料率") AND formFields.length >= 5 |
| **S-T-B3-fourtuple** | `f006_admin` | API: POST create plan → API: POST start → 期望 stock 不足 | Rule 8 four-tuple: toast + sticky + actionHint + backend message match |
| **S-T-D4-rpf** | `f006_admin` | 登入 → `/production/batches` → 选已完成 batch → 验证 RPF 消耗痕迹 | batch 含 raw_material consumption records |
| **S-T-D5-wh-log-fulfill** | `f006_admin` | 登入 → `/sales/orders/<id>/详情` → 发货 → 选 WH-LOG 总仓 batch | 出库 batch source === WH-LOG |
| **S-T-RTA-return** | `f006_admin` | 登入 → 测试退货 (有食物 / 无食物) | 创建退货单, 库存调整或财务退款入口可见 |
| **S-T-INV-collect** | `f006_admin` | 登入 → 销售订单 → 收款登记 → 财务一键收 | 收款审批入口存在, 订单状态变 "已完成" |
| **S-T-3-11-est-cost** | `f006_admin` | 登入 → 销售订单 → "财务审批" 详情 | "预估成本" 字段隐藏 (T3-11 决策落地) |
| **S-T-3-14-3price** | `f006_admin` | 新建采购订单 → 立即看三价对比 | 三价对比包含新采购 (修 T3-14 bug) |

### 4.3 抽样 (P2 — 25 个 LIVE-only-未 verify 中 5 个)

| Scenario | 来源 ask | Assert |
|---|---|---|
| **S-T-T2-4-rpf-chain** | T2-4 研发→采购→入库→提取→生产 | API 链路: RPF item → 采购订单 → 入库 batch → 生产消耗 (5 endpoints) |
| **S-T-T2-11-process-yield** | T2-11 工序投入产出比 | `/生产分析` 模块: 工序 yield-rate 报表存在 |
| **S-T-T2-12-sku-profit** | T2-12 SKU 毛利率 | `/财务管理/SKU 毛利率分析` 页面 render + 含数据 |
| **S-T-T3-5-approval** | T3-5 审批链动态配置 | `/系统管理/审批链配置` UI 完整 (新建/编辑/启用/禁用) |
| **S-T-T2-3-dingtalk** | T2-3 钉钉交互 | 后端 OAuth callback URL 配置存在 + LLM Tool 钉钉调用注册 |

### 4.4 脚本骨架

文件: `scripts/customer-audit-e2e-2026-05-13/run-e2e.mjs` (本审计同步落地, 见同目录).

跑法:
```bash
cd scripts/customer-audit-e2e-2026-05-13
npm install playwright
node run-e2e.mjs --p0   # 5 个 P0 scenarios
node run-e2e.mjs --p1   # 11 个 P1 scenarios
node run-e2e.mjs --p2   # 5 个 P2 scenarios
node run-e2e.mjs --all  # 全跑
```

输出: `results.json` + `shots/*.png` (与 May 12 一致)

---

## §5 P0/P1/P2 优先级建议

### P0 (demo-blocking)
1. ✋ **复跑 S-RBAC-1-retest + S-RBAC-4-retest** — 验证 PR #467 v-if 列头隐藏在 prod 真生效 (这是 audit doc §6 sign-off `[ ] UI 列头隐藏` 唯一 verify 方式)
2. ✋ **Root-cause sales/orders 500** — grep server log 找 39AFF3AD/00D57286 堆栈, 确认 PR #458 (async-dispatch ThreadLocal fix) 真闭合
3. ✋ **S-RBAC-pdf-warehouse + S-RBAC-excel-warehouse** — 验证 PR #456 binary export sweep 真闭合 (PDF/Excel 导出是 RBAC bypass 经典攻击面)

### P1 (audit doc 漏列 / weak evidence)
1. ⛔ **补 T4-D4 + T4-D5 + T-RTA + T-INV + T2-5b + T2-11 + T2-12** 到下一份 audit doc — prior audit §2 ask 表数学错误 + 漏列
2. 🟡 **重测 S2/S3/S5/S6 4 个 weak-evidence** — 用 §4.2 推荐 scenarios
3. 🟡 **复测 S10-5 wire** with PR #464 修正后的 regex (`includes(': ?null')`) — 确认 0 leak 在 prod

### P2 (LIVE-only 抽样)
- 25 个 LIVE-only 抽 5 (§4.3), 防止"代码 ship ≠ 功能正常"漂移
- 历史问题 T3-6 + T3-13 UI 列宽 audit ticket 仍未 file — 客户反复抱怨 ×2 (跨第三次 P1 + P2)

### 决策待定 / 后端跟进 (不在 E2E 范围)
- T1-6 摄像头异物识别 — 自动学习已实装 (YOLO V2.1+V2.2), 但客户验证未做 → on-site verify
- T2-3 钉钉机器人 API — OAuth + Tool 注册状态待 grep
- T3-11 预估成本暂时隐藏 — feature flag / 角色权限 strip 选哪个待 Steve 决策
- T3-14 三价对比刷新 bug — file P2 ticket
- T4-B6 App 报工转圈 — chat5 OTA 跟进

---

## §6 Sign-off

- ✓ 4 transcripts (六扇门第1/2/3 part1/P2/4) 全部读取
- ✓ 51 真实 ask 编号 (vs prior audit 38 — 修正数学错误 + 补漏列)
- ✓ 14 prior E2E scenarios 重评估 — 6 strong / 6 weak / vacuous 找出
- ✓ E2E run time (07:26 UTC) vs PR chain merge time (18:35-19:37 UTC) 间隔确认 ~11 hr
- ✓ 5 个 PR 后端补丁链 (#443/#456/#457/#458/#466/#467) 闭合 audit doc 3 open 项, 但 0 复测 — 列为 P0 follow-up
- ✓ 21 个 follow-up scenarios (P0=5, P1=11, P2=5) 规划完毕
- ✓ E2E 脚本骨架: `scripts/customer-audit-e2e-2026-05-13/run-e2e.mjs`

**Prior-audit baseline (scenario-level, 不计入 ask-bucket 分桶)**:
- prior 2026-05-12 E2E 已 GREEN (跳过重跑): S1 / S5 / S7 / S8 / S9 / S10-2 / S10-wire / S11 + post-deploy S8 / S9 = **9 scenarios**
- 本审计新增 follow-up scenarios (21): P0=5 + P1=11 + P2=5

**Coverage gap 总评 (ask-level partition, 分母 = 51, 每 ask 恰一桶)**:
- ✅ strong E2E evidence: 2/51 = **3.9%** (T3-7 / T3-8)
- ◯ LIVE-only-未 verify: 25/51 = **49.0%**
- 🟡 weak evidence: 9/51 = **17.6%**
- 🔴 真 open / 决策待定: 7/51 = **13.7%**
- ⛔ audit doc 漏列 (本审计新发现): 8/51 = **15.7%**
- **校验**: 2 + 25 + 9 + 7 + 8 = 51 ✓ (无重复计, 无遗漏)

**说明**: prior audit 旧总评数字 (`6/45` strong, `6/45` weak 等) 是 **scenario 级别** 计数错配 **ask 级别** 分母, 导致 strong 看似 13% 实为 scenario 覆盖率;ask-level 真实 strong 仅 2/51 = 3.9%. prior 6 scenarios (S1/S8/S9/S10-2/S10-5/S11) 主要覆盖 T3-7 / T3-8 + RBAC 流程, 但其他 scenarios 经 §3 weak-evidence audit 降级为弱证据后, ask-level strong 桶缩小到 2.

- 后续应将 strong evidence 目标提升至 ≥50% (即至少补 24 个 strong-ask coverage, 优先 P0+P1)
