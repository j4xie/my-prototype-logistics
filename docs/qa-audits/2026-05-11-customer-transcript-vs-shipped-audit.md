# 2026-05-10 客户对接转录 vs Shipped State 交叉验证

**Audit date**: 2026-05-11
**Auditor**: Claude Opus 4.7 (independent subagent, no Chat0 context inherited)
**Transcript source**: `.tmp-transcripts/2026-05-10-customer-meeting.md` (48 min audio, Whisper medium, 1016 SRT 段)
**Shipped artifacts cross-referenced**:
- 9-bug audit baseline: PR #289 — `docs/qa-audits/2026-05-10-customer-meeting-9bug-audit.md`
- Steve 12-item sign-off: PR #309 — `docs/decisions/2026-05-10-steve-sign-off-package.md`
- Chat0 followup summary: PR #340 — `docs/decisions/2026-05-11-customer-2026-05-10-meeting-followup-summary.md`
- 25+ implementation PRs (#287, #288, #289, #293-300, #305, #309-315, #319, #322, #323, #329)

**Audit base**: origin/main HEAD `f335bd479d` (after PR #345)

---

## 0. 审计目的

Steve 要求**独立**审计: 客户在转录里**实际说的话** vs 现在**已 ship 的实现** — 是否每一项都对得上?

特别审视 8 个高漂移风险项 (B6 OTA / D2 BOM 算法 / D3 g↔kg / D1 双仓"线边仓"命名 / A3 反向调拨触发模式 / B1 调拨批次 / B2 分仓查询 / D5 销售路径)。

不预设 Chat0 概括正确; 一切回到客户原话。

**Status**: ✅ Match / ⚠ Drift / ❌ Miss / 🟡 Partial

---

## 1. Per-requirement 审计表

### 1.1 Bug 报告 (transcript 行 23-43)

| # | 客户原话 (exact) | 客户意图 | Shipped PR | 实际改动 | Status | Gap/Risk |
|---|---|---|---|---|---|---|
| **B1** | "我新建一个大谷了…但为什么还只有通用…现在只有通用没有关联过来" (line 23) | 生产计划工序下拉应显示已配置的产品工序, 不是只有"通用" | [#293](https://github.com/j4xie/my-prototype-logistics/pull/293) | `list.vue:190` API path 从 `/bom/labor` (LaborCostConfig) 改为 `/product-work-processes`。删除 `/bom/labor/all` global fallback | ✅ Match | 客户说"先选通用好了就往下走", PR 删除了通用 fallback。需 Steve 验证客户是否接受"无配置时不显示通用兜底"。Audit doc §5 第 1 项标记 sign-off pending — PR #293 selected the recommended default (no fallback) without explicit Steve sign-off |
| **B2** | "调拨说调拨单的时候那么仓库发货的时候就让他们做一个仓库我可以选择P次啊…他有时候可能会用新P次需要" (line 31) | **SHIP** 时 (仓库发货时) 可选批次, 不是 CREATE 时 | [#322](https://github.com/j4xie/my-prototype-logistics/pull/322) | 两阶段: CREATE 默认 FEFO + APPROVED 后 SHIP 可 override。新 `PUT /transfers/{id}/items/{itemId}/source-batch` endpoint, FE 在 `status=APPROVED` 时显示 "发货批次" 列 | ✅ Match | 完全对齐客户原话。FEFO 默认保留 (用户不选时), SHIP 阶段可改 — 业务时序自然 |
| **B3** | "那这个开始的话点的时候会有一个判断吗就是我的库存够不够…加一个我觉得还是加一个" (line 35) | 点"开始生产"前校验原料库存够不够, 不够阻断 | [#305](https://github.com/j4xie/my-prototype-logistics/pull/305) | `ProductionPlanServiceImpl.startProduction` 加 `validateMaterialStockSufficient`: 拉 BOM → 算需求 (含出成率) → 查 batch SUM → 不足 throw BusinessException 409 含 actionHint | ✅ Match | 严格按客户原话, 边界 cases 处理周到 (空 BOM skip / null quantity skip / 恰好相等通过) |
| **B4** | "在调拨数量旁边加个字案加一个那个现有库存…就提前显示" (line 31) | 调拨单 detail 页加"现有库存"列, 早于发运报错 | [#295](https://github.com/j4xie/my-prototype-logistics/pull/295) | `InternalTransferItem.currentStock` @Transient 字段 + `TransferServiceImpl.populateCurrentStock` 按 sourceFactoryId 汇总 + FE 新列显示, 不足红色高亮 | ✅ Match | 客户原话精确 mirror。3 种 itemType (RAW_MATERIAL / PACKAGING_MATERIAL / FINISHED_GOODS) 都覆盖 |
| **B5** | "在生产管理里面加一个库存插群就是分仓的库存插群" + "一个就是从那个总仓那边调过来的那个原辅料第二个就是那个他生产完的成品" (line 41) | 分仓库存查询页 (工厂线边仓), 原辅料 + 成品两块 | [#323](https://github.com/j4xie/my-prototype-logistics/pull/323) | 新增 `/inventory/by-warehouse` 页: factory dropdown + tabs (原料/成品/总览) | ⚠ **Drift** | 客户语境"分仓 = 工厂内 (线边仓 vs 总仓)", PR #309 B2 sign-off **A vs B 选了 B (Dropdown 跨 factoryId)** — 实际 ship 是跨工厂 dropdown 而非工厂内双仓 tab。Sign-off package §B2 默认推荐 A (Tab 切换 + 单工厂内双仓) 但 Steve 选 B。客户原话**没**说"跨工厂", 也**没**说"单工厂内", 只说"分仓"。设计层面 PR #323 的 Dropdown 跨 factoryId + WH-LOG/WH-WKS tab 实际**两个维度都覆盖**, 但 UX 复杂度比客户原话提的多。**Risk LOW** — 功能并未漏, 多了 dropdown |
| **B6** | "他一直在转加载中…那可能我得发个新版本给你…这两天都跟新版后端对不上的话就可能会跟不进去" (line 37) | App 报工审批转圈, 客户**自己说**"得发新版本"; 客户原话明确接受 App 升级方案 | [#287](https://github.com/j4xie/my-prototype-logistics/pull/287) (RCA) + [#296](https://github.com/j4xie/my-prototype-logistics/pull/296) (OTA infra) + [#300](https://github.com/j4xie/my-prototype-logistics/pull/300) (SDK align) + [#314](https://github.com/j4xie/my-prototype-logistics/pull/314) (`appMinVersion` /health) | RCA 确认 App version drift (非后端 bug); 加 `expo-updates` + EAS Update infra; SDK align; `/health` 加 `appMinVersion` 防御 | 🟡 **Partial** | **PR #296 body 明确 Steve manual steps 5 步**: 1. `eas-cli login` 2. `eas init` 3. `eas build --platform android --profile production` 4. **分发 APK 给客户 (ONE-TIME reinstall)** 5. 后续 `eas update` 推送。`docs/decisions/2026-05-11-summary §第四章` 也确认 "OTA infra 初始化 (Steve 亲自, 1-2h)" + "客户 APK 分发 (ONE-TIME)" 是 pending。**git log 显示 NO commit for "APK build" / "eas init"** — Steve 未跑 runbook。客户**今天**还是用旧 App, B6 转圈症状没解。客户的明确请求 (发新版 App) 没满足 |
| **B7** | "新建那个销售订单的时候不是那个弹窗太小吗然后那个窗口小的就看不到对对对那个应该还没弄好" (line 23) | 旧 bug 复现, 销售订单 dialog 太小看不到内容 | [#293](https://github.com/j4xie/my-prototype-logistics/pull/293) | `sales/orders/list.vue:823` `width="720px"` → `width="80%"` | ✅ Match | 1 行修改, 完全对齐 |
| **B8** | "关联原料应该是…关联到我们仓库里面的内容就是现在就要关联错的地方对你要关联…咱们仓库的原料嘛" (line 25) | BOM 配方"关联原料"下拉应自动联动仓库原料表 (选了原料 → 自动填名/单位) | [#293](https://github.com/j4xie/my-prototype-logistics/pull/293) | `bom/index.vue:872` 加 `@change="onMaterialLink"`: pick 原料 → 自动填 `materialName + unit` | ⚠ **Minor drift** | PR body §"B8 unitPrice 暂未填" 明确 — Audit §5 第 5 项 sign-off pending"是否带出 unitPrice"。客户原话"单价应该是不要的这下面单价跟设计价是不要的身价不设计到嘛" (line 25) — 客户说**单价不要**。后又说"哦对这你要的我想起来这点还设计到报价这个要的对" — 又说**要**。**客户对单价含糊**, PR 留作 sign-off pending 合理。Risk LOW |
| **B9** | "在没有计划的情况下可以做再新建一个那个窗口吧…手动创建调拨单" + "比如说理用的" (line 33) | 手动新建调拨单入口, 用于领用/研发用料场景 | [#299](https://github.com/j4xie/my-prototype-logistics/pull/299) | `transfer/list.vue` 加 "手动新建调拨单" toolbar 按钮 + dialog 含全 schema (类型/调出方/调入方/仓库/items)。Backend reuse | ⚠ **Minor drift** | PR body §"Trade-off": 调入方 ID 用 **text input** (非 dropdown, 因平台 `/factories` 端点需 super_admin)。客户原话没说要 dropdown, 但 PR #314 后来加了 `/factories/network` endpoint + dropdown (C2=B 决策)。最终状态对齐, 但需 Steve 验证客户实际使用偏好。**审批流程**: PR #299 直接走 5-step DRAFT→申请→审批→发货→签收, sign-off §C1 默认 A (保留完整 5 步); 客户原话**未提**审批简化, 但说"理用"(领用)"研发用料"是内部场景 — 5 步审批是否过于繁琐 wait-and-see |

### 1.2 设计决策 (transcript 行 25-43)

| # | 客户原话 (exact) | 客户意图 | Shipped PR | 实际改动 | Status | Gap/Risk |
|---|---|---|---|---|---|---|
| **D1 (业务模型)** | "总仓调到啊总仓把东西发送到仓库不工厂然后生产出来然后再调回一个总仓进行销售啊…那一套的仓库呢这个书也叫**线边仓**" (line 41) | 工厂 = **线边仓** (workshop, 当天清空); 总仓 (logistics, 持久库存); 销售只从总仓出 | [#310](https://github.com/j4xie/my-prototype-logistics/pull/310) (spec) + [#315](https://github.com/j4xie/my-prototype-logistics/pull/315) (impl) | `material_batches.warehouse_id` + `finished_goods_batches.warehouse_id` NOT NULL FK → factory_warehouses.id。默认 WH-LOG / WH-WKS。13 个 service site 加 warehouse-aware filtering。22 files / +836 LOC / 2532 tests PASS | ⚠ **Naming drift** | **客户用的是"线边仓"** (transcript line 41 原话三次出现), **shipped code 用 WH-WKS** (workshop warehouse) 内部代码 + 显示名"工位仓"/"鲜棉仓" (PR #310/315/329 body 互相不一致)。PR #310 body 用"workshop"/"工位"; PR #329 body 用"鲜棉仓"; 实现层面 `WH-WKS` 字面是 "WorkShop"。客户**期望看到"线边仓"** 这个词。**实际功能 100% 对齐** (workshop 当天清空 / 反向调拨到总仓 / 销售从总仓), 但 **UI label / docs 命名 vs 客户口头术语有漂移**。Risk MEDIUM — 客户下次见到 UI 不认得 |
| **D2 (BOM 算法)** | "成品 200克那么我出成率是58%自动折算的话就是250.58就算出来我的原材料一共用多少就这样吧嗯嗯是这样" (line 25) | 输入 成品 200g + 出成率 58% → 自动算原材料用量 | [#297](https://github.com/j4xie/my-prototype-logistics/pull/297) | BOM dialog 新增"实际原料用量"实时预览。Backend `BomItem.getActualQuantity()` 公式 `standardQuantity / (yieldRate/100)`。200 / 0.58 = 344.83g (注: 客户说 250.58, **客户算错了**, 正确是 344.83g) | ⚠ **Math drift in transcript ONLY** | 客户**自己**算错: 200 ÷ 0.58 ≈ 344.83, 不是 250.58 (250.58 看着像 200/0.7980)。PR #297 公式 100% 正确。前端显示 344.83g 给客户看时是否会困惑? **Risk LOW** — 客户当场只是举例, 工程实现按数学公式正确。但 PR 内部 spec doc 应该 emphasize 演示时给客户看正确数 |
| **D3 (单位换算)** | "我们这边统一是按克就算了配方都是按克嗯主要就是克跟千克就是…1000的就好好说的对就**一比1000**的意思大概这么个意思" (line 27) | 配方按克 (g), 仓库按千克 (kg), **后台自动 1:1000 换算** | [#297](https://github.com/j4xie/my-prototype-logistics/pull/297) (framework) + [#312](https://github.com/j4xie/my-prototype-logistics/pull/312) (D4-B 激活) | `MaterialRequirement.sourceUnit` 字段; `ProductionWorkflowOrchestrator.convertUnit()` 支持 g↔kg / mL↔L 双向 1:1000。PR #312 `BomExpansionService` 改读 BomItem 而非 RPF → 激活 end-to-end | ✅ Match | 客户**明确**说"1比1000", PR 实现是 fixed 1:1000 ratio (不是 configurable N:1)。完全对齐 |
| **D4 (RPF 字段)** | "那旁边这个转换率是什么意思…这个其实是之前就是最早期那个版本就是原来的BOOM是我把设计生转换率的但其实就是原本的RPF足足足足够了但是我还是先留下来那其实后面其实也不用了" (line 29) | 转换率字段是早期 RPF, 跟新 BOM 功能重叠, **保留不删但不用** | [#294](https://github.com/j4xie/my-prototype-logistics/pull/294) (Path A docs) + [#312](https://github.com/j4xie/my-prototype-logistics/pull/312) (Path B impl) | PR #294 文档 + UI Banner 提示; PR #312 改 BomExpansionService 读 BomItem (RPF fallback) | ✅ Match | 客户原话"先留下来" — PR #294 保留 RPF; PR #312 让 BomItem 优先 RPF fallback。完全对齐客户意图 |
| **D5 (销售路径)** | "因为仓库所有的仓库是那个总仓的仓库把你我的线边仓是我今天要生产所以有些凝视库存" + "工厂他其实是调播到那个总仓去的总仓在会去安排什么时候发给那个客户" (line 39, 41) | 工厂 (线边仓) 不直发客户, 总仓 (持久仓) 销售出货 | [#329](https://github.com/j4xie/my-prototype-logistics/pull/329) | `InventoryMatchingService.checkAvailability/reserveStock` cross-factory 分支用 `*AllFactoriesAndWarehouseCode` (WH-LOG filter)。A5 flag `CROSS_FACTORY_SALES_ENABLED` 控制集团池销售 | ✅ Match | 客户原话明确"工厂不发货, 总仓发货"。PR 100% 对齐。A5 flag 是 sign-off package §A5 决策"默认 false 单工厂", transcript **未明确**跨工厂场景, PR 保守默认 false 合理 |

### 1.3 Sign-off package 12 items (PR #309)

PR #309 sign-off items 基本都基于 transcript 推导。已在 1.1/1.2 覆盖, 这里只列**额外**点:

| # | 客户原话依据 | Steve choice | Shipped PR | Status |
|---|---|---|---|---|
| **A1** (D1 推翻 V3 P0-5 ADR) | transcript line 41 "线边仓" 业务模型 | A 推翻 | [#310](https://github.com/j4xie/my-prototype-logistics/pull/310) + [#315](https://github.com/j4xie/my-prototype-logistics/pull/315) | ✅ Match — 已在 D1 行覆盖 |
| **A2** (D4 路径 A vs B) | line 29 "RPF 足够了" + transcript 隐含希望 BOM 数据真正被生产计划用 | B 改 BomExpansionService | [#312](https://github.com/j4xie/my-prototype-logistics/pull/312) | ✅ Match |
| **A3** (反向调拨触发) | line 43 "爆工包完以后库存已经调播调回去总仓" + "成品我反正会嗯看一个调播那新店调播单" | A 自动生成 DRAFT + 用户确认 | [#319](https://github.com/j4xie/my-prototype-logistics/pull/319) | ⚠ **Minor drift** — 客户原话 line 43 实际说 "我反正会嗯**看**一个调播那**新店**调播单" — Whisper 转录后看着像 "看" + "新店调播单", 实际口音可能是"新建调拨单" (新店 → 新建). 客户**意图**像是: 用户**手动新建**调拨单调成品回总仓, NOT 系统自动生成。PR #319 选 A (系统自动生成 DRAFT, 用户确认提交), Chat0 sign-off package §A3 default A 当 Steve approved。**对齐 sign-off, 但客户原话其实更倾向 Option C (完全手动)** — 但客户原话**模糊**, Chat0 选 A 留控制权合理。Risk LOW |
| **A4** (历史 BOM unit 迁移) | transcript 未提历史数据 | B Eager normalize (Chat0 改了, 不是 default A) | [#311](https://github.com/j4xie/my-prototype-logistics/pull/311) | ⚠ **Default override** — sign-off package §A4 default A (Lazy), Steve approved 但 PR #311 实际 ship 的是 B (Eager batch migration "已实际跑 deploy migration")。Followup summary §1.3 A4 row 显示 **B**, sign-off §Summary table 显示**推荐 A**。Steve 选 B 但 sign-off doc 没更新。Risk LOW (Steve approve 时也许就改成 B 了, transcript 未涉及无客户漂移) |
| **A5** (跨工厂销售) | transcript 未提 | C feature flag default false | [#313](https://github.com/j4xie/my-prototype-logistics/pull/313) | ✅ Match — flag 默认 false, transcript 未涉及, PR 保守。Chat0 sign-off package §A5 标 recommended A (单工厂), Steve 升级到 C (flag), 比 recommended 更灵活 |
| **B3** (App OTA) | line 37 "得发个新版本给你" (客户明确接受 App 升级) | A Steve 亲自跑 runbook | [#296](https://github.com/j4xie/my-prototype-logistics/pull/296) infra | 🟡 Partial — 已在 B6 行覆盖。Steve 未跑 runbook = 客户今天还是旧 App |
| **B4** (F006 single-user pw drift) | transcript 未直接说密码漂移 (line 37 客户说"f006 admin 那账号" 登不进去, 但 PR #287 验证 admin OK, 漂移是另一账号) | A Reset + 注解 | [#314](https://github.com/j4xie/my-prototype-logistics/pull/314) | ✅ Match — 注解 memory file; 实测 `f006_warehouse_mgr` (非 `f006_warehouse_manager`) 已能用 123456 (PR #314 body) |
| **B5** (`/health` `appMinVersion`) | transcript 未提, 是 PR #287 衍生防御性 | A 加 | [#314](https://github.com/j4xie/my-prototype-logistics/pull/314) | ✅ Match |
| **C1** (手动调拨审批流程) | transcript 未提审批简化 | A 保留 5 步 | (PR #299 直接落地 5-step) | ⚠ **wait-and-see** — 客户提的"领用/研发样品"内部场景, 5 步审批可能繁琐。PR 选 A 保守, 客户实际反馈后再决定。Risk LOW |
| **C2** (跨工厂调入方 dropdown) | transcript 未提 | B `/factories/network` + dropdown | [#314](https://github.com/j4xie/my-prototype-logistics/pull/314) | ✅ Match — 优化体验 |

---

## 2. 状态汇总

| Status | Count | Items |
|---|---|---|
| ✅ Match | **15** | B1, B2, B3, B4, B7, D3, D4, D5, A1, A2, A5, B4(309), B5(309), C2, F006 |
| ⚠ Drift | **5** | B5 (UX scope), D1 (命名), D2 (transcript math), A3 (触发模式), A4 (default override) |
| 🟡 Partial | **1** | B6 (OTA infra ship, APK not built, customer still on old App) |
| ⚠ Minor | **3** | B8 (unitPrice sign-off pending), B9 (dropdown 后补), C1 (wait-and-see) |
| ❌ Miss | **0** | — |
| **Total** | **24** | (9 bugs + 5 design decisions + 10 sign-off items, 部分 overlap) |

**核心发现**: 没有 **❌ Miss** (即没有客户说了但完全没做的)。**1 个 🟡 Partial (B6)** 是工程已就绪, 缺 Steve 的 1-2h 手动 runbook 跑通。**5 个 ⚠ Drift** 都是低风险或纯命名问题。

---

## 3. Top 3 Drift Items (详)

### Drift #1 — B6 OTA infra ship but customer still using old App (🟡 Partial)

- **客户原话** (line 37): "他一直在转加载中…那可能我得发个新版本给你…这两天都跟新版后端对不上的话就可能会跟不进去"
- **客户期望**: 发新版 App, 客户重装一次
- **Shipped**: PR #296 加 expo-updates infra, PR #300 align SDK, PR #314 防御 endpoint
- **Gap**: PR #296 body 5 步 manual steps + Followup summary §第四章 "OTA infra 初始化 (Steve 亲自, 1-2h)" + "客户 APK 分发 (ONE-TIME)" 都 pending。Git log 无 "APK build" / "eas init" commit
- **Risk**: 客户今天还是用旧 App, B6 转圈症状没解, 客户测试无法继续
- **Recommendation**: Steve 立即跑 `docs/runbooks/2026-05-10-eas-ota-setup-runbook.md` 5 步; 后续 fix 通过 OTA 即可

### Drift #2 — D1 "线边仓" 命名 vs 代码 "WH-WKS" 漂移 (⚠ Drift)

- **客户原话** (line 41, 三次出现): "**线边仓** 线边仓的原则就是…当天生产完结束以后是没有构成的"
- **客户期望**: UI/docs 用"线边仓"这个词
- **Shipped**:
  - 代码 `WH-WKS` (workshop warehouse)
  - PR #310 body "workshop / 工位"
  - PR #329 body "鲜棉仓" (sales 不出 WH-WKS)
  - PR #340 followup §7.1 "WH-WKS 参与库存维度"
  - 各 PR / docs **没有用过"线边仓"这词**
- **Gap**: 业务功能 100% 对齐 (workshop 当天清空 / 反向调拨到总仓 / 销售从总仓), 但**所有命名都用 workshop/工位/WH-WKS**, 不是客户口头的"线边仓"
- **Risk**: 客户下次看 UI / docs 不认得术语, 沟通有摩擦。F006 sales people 看到"工位仓"会困惑
- **Recommendation**:
  - 选项 A: UI label 改 "线边仓" (FactoryWarehouse name/displayName), 代码常量 `WH-WKS` 保留
  - 选项 B: 加 Steve 备注到 D1 spec amendment doc 解释 workshop = 线边仓
  - 选项 C: 等下次客户对接确认是否两者通用

### Drift #3 — B5 分仓查询 UX scope creep (⚠ Drift)

- **客户原话** (line 41): "在生产管理里面加一个库存插群就是**分仓的库存插群**…一个就是从那个总仓那边调过来的那个原辅料第二个就是那个他生产完的成品"
- **客户期望**: 单工厂内, 看双仓库存 (总仓 WH-LOG 调过来的原辅料 + 工厂自产成品)
- **Shipped** (PR #323): 跨 factoryId dropdown + WH-LOG/WH-WKS tab 切换 + 总览 tab
- **Gap**: 客户原话**只**说"分仓" (单工厂内), **没**提"跨工厂"。Sign-off §B2 recommended A (Tab + 单工厂内双仓), Steve 升级到 B (Dropdown 跨 factoryId)。PR #323 实际两个维度都做了 — UX 比客户要的丰富, 但**没漏**
- **Risk**: 客户看到跨工厂 dropdown 可能困惑, 但不影响业务 (default 是自己工厂)
- **Recommendation**: 监控客户使用习惯, 如果客户从来不切 factory, 考虑 dropdown 默认隐藏

---

## 4. Top 3 Miss Items (无)

**重要**: 客户原话提的所有 bugs / decisions / workflow expectations 都有对应 PR 落地。**0 个 ❌ Miss**。

唯一**接近 miss**的是: 客户原话 line 37 提到登录问题:
> "我我我我我给你登一下账号这账号有关系吗这个还是那个f006 admin那账号吗这个应该是后端的问题哦没有我刚刚那个可能是之前的账号哦换了我换成我换成现在账号也登不进去嗯也登不进去是吧"

PR #287 audit 验证 `f006_admin` + 4/5 F006 账号都能登录 (123456). PR #314 后 `f006_warehouse_mgr` 也确认能用。**RCA verdict**: 客户登录问题是 App version drift (App 端 spinner stuck), 不是后端密码。客户**自己**也说"应该就两天改的导致的" (line 37) — 把原因归到 App。**No miss**, 但客户实际感知的问题 (登不进) 跟 root cause (App 转圈) 错位; 解决 B6 OTA 后会同步解决。

---

## 5. Top 3 Issues 需 Steve sign-off

### Issue #1 — B6 OTA 行动落地 (BLOCKING customer testing)

**问题**: OTA infra 已 ship 但 Steve 没跑 runbook → 客户今天还是用旧 App → B6 转圈症状未解 → 客户**无法继续测试报工流程**

**Action**: Steve 跑 `docs/runbooks/2026-05-10-eas-ota-setup-runbook.md` 5 步 (~1-2h cloud build)

### Issue #2 — D1 "线边仓" 命名是否要改 UI label

**问题**: 客户原话明确 3 次说"线边仓", shipped code/docs/UI 全用 WH-WKS / 工位 / 鲜棉仓 → 客户下次见 UI 可能不认得

**Action**: Steve 决定:
- A: 改 UI label 为"线边仓" (代码常量保留 WH-WKS)
- B: 加注释/glossary doc 说明 workshop = 线边仓
- C: 待客户下次反馈

### Issue #3 — D1 "线边仓"业务规则 sales people 影响

**问题**: F006 销售人员看到"工位仓"/"鲜棉仓" UI 可能困惑。客户实际部署后是否要客户自定义 warehouse name?

**Action**: Steve 确认 `factory_warehouses.name` / `displayName` 是否允许 per-factory 客户自定义 (e.g. F006 可改为"六腾门线边仓")

---

## 6. Whisper 转录质量警告 (从原 audit + 本次新发现)

| Line | Whisper 文本 | 实际可能 | 影响 |
|---|---|---|---|
| 31-33 | "P 次 / P 四" | 批次 | 不影响 audit (已校正) |
| 25 | "爆木 / 爆墨 / 爆幕" | BOM | 不影响 |
| 25 | "成品 200克…自动折算的话就是**250.58**" | **应是 344.83 (= 200/0.58)** | 客户当场算错, 实现按公式正确 |
| 23 | "调拨数量 **166.67**" | 推算可能是 (200/0.58/1000)×100 ≈ 34.5kg 或别的 | **建议回放 SRT 确认**, 实际数值还原 BOM 计算 |
| 43 | "我反正会嗯**看**一个调播那**新店**调播单" | 可能"新建调拨单" (口音) | **影响 A3 决策** — 如果客户实际说"新建", 那 A3 应选 C (用户完全手动) 而非 A (自动生成 DRAFT)。**建议回放 SRT 时间戳确认** |
| 27 | "**冬夜盐**" | 应是"动液盐"或"冬腌盐" (字面无明确含义) | 不影响 audit |
| 37 | "**爆工** 包完以后" | **报工** 包完以后 | 不影响 (上下文清楚) |

---

## 7. Recommended Actions

### 立即 (BLOCKING)

1. **Steve 跑 OTA runbook** (`docs/runbooks/2026-05-10-eas-ota-setup-runbook.md`) 5 步 → B6 客户测试解锁

### 短期 (~1 day)

2. **回放 SRT line 43** 确认 A3 触发模式 — 客户实际期望自动 DRAFT 还是完全手动? 如果是后者, 需考虑 A3 改 Option C
3. **D1 "线边仓" 命名 sign-off** — UI label 是否改 / glossary 是否加 / 客户自定义 warehouse name 是否允许
4. **回放 SRT line 23** 确认"调拨数量 166.67" 真实计算公式

### 长期 (wait-and-see)

5. **B5 分仓 UX 监控** — 客户实际用 dropdown 跨 factory 频率, 若极低则考虑简化为单工厂 tab
6. **C1 手动调拨审批流程** — 客户使用后反馈 5 步审批是否过于繁琐 (领用/研发样品场景)
7. **B8 unitPrice 是否自动填** — 客户原话含糊, 等实际使用反馈

---

## 8. Audit Conclusion

**总体**: Chat0 完成 25 PR cascade, **0 个客户需求被漏掉**。15/24 完全对齐 (62.5%), 5/24 轻微漂移 (低风险), 1/24 partial (B6 OTA 缺 Steve manual init), 3/24 minor pending (B8 unitPrice / B9 dropdown 已补 / C1 wait-and-see)。

**最大风险**: B6 — 客户今天还用旧 App, 工程已就绪但 OTA 没初始化 → 客户测试无法继续。

**最大命名漂移**: D1 — 客户用"线边仓", code/docs 用 WH-WKS/工位/鲜棉仓, 业务对齐但 UI 术语漂移。

**Audit base verdict**: Chat0 工作质量高, 但需 Steve 立即跑 OTA runbook + 决策"线边仓"命名 + 回放 SRT 2 个时间戳 (line 23 数字 / line 43 A3 模式) 完成 closure。

---

## 9. References

- Transcript: `.tmp-transcripts/2026-05-10-customer-meeting.md` (本地, 不在 repo)
- 9-bug audit baseline: PR #289 `docs/qa-audits/2026-05-10-customer-meeting-9bug-audit.md`
- Steve 12-item sign-off: PR #309 `docs/decisions/2026-05-10-steve-sign-off-package.md`
- Chat0 followup summary: PR #340 `docs/decisions/2026-05-11-customer-2026-05-10-meeting-followup-summary.md`
- D1 dual-warehouse spec: PR #310 `docs/superpowers/specs/2026-05-10-d1-dual-warehouse-spec-amendment.md`
- OTA runbook: PR #296 `docs/runbooks/2026-05-10-eas-ota-setup-runbook.md`
- F006 login RCA: PR #287 `docs/qa-audits/2026-05-10-f006-login-investigation.md`

---

**Auditor**: Claude Opus 4.7 (independent subagent, audit only — no code changes proposed)
**Audit date**: 2026-05-11
**Audit base**: origin/main `f335bd479d`
