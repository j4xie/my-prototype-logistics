# UX Continuation Handoff — 2026-04-24

> **For next chat**: this session shipped 14 UX fixes to prod. Use this doc to pick up. Read `tests/e2e-comprehensive/results/qa-2026-04-23/ux/FINDINGS.md` for the original full audit + screenshots.

## What's already shipped ON PROD today (14 commits, branch `e2e/v1-framework`)

| # | Commit | Fix |
|---|---|---|
| 1 | `a37f57c78` | P0-4: 清 "邓总救命组合" / "鼎鲜火锅·义乌" 开发代号 |
| 2 | `a37f57c78` | P0-5: Gold card 默认 period 空 fallback 链 |
| 3 | `fe4639a66` | P0-2: Dashboard 不 auto-swap 到 smoke upload (¥4,500 假 KPI) |
| 4 | `fe4639a66` | P0-3: Dashboard 不显 1001.0/李四 pseudo 数据 |
| 5 | `59c49f785` | P0-1 partial: Finance "毛利率低于行业基准" 假预警抑制 |
| 6 | `59c49f785` | P1-10: 销售订单 restaurant tenant 空表 alert |
| 7 | `59c49f785` | P1-11: 趋势 3 个 0 值 chart 对 restaurant 隐藏 |
| 8 | `cf736b926` | P0-1 full: Finance 顶部 Gold 营收/订单/客单价/门店 KPI |
| 9 | `4043c88c1` | P1-13: RestaurantV2 期间不再硬编码 2026-02 |
| 10 | `88583da0a` | P2-15: Gold 预览 button 橙→灰 |
| 11 | `88583da0a` | P2-16: RestaurantV2 empty state 缩小 (image-size 80px) |
| 12 | `88583da0a` | P2-17: TemplateCard 来源日期移到 footer |
| 13 | `88583da0a` | P2-18: Dashboard 区域销售分布空时整 col 隐藏 |
| 14 | `9a5e806d3` | P1-14: Trends Gold fallback localStorage cache (500-700ms 省) |

**Debunked (not bugs)**: P1-6 随 P0-2 自解 / P1-8 低分辨率截图误读 / P1-12 已默认 365 天

---

## 剩余 UX Finding (持续关注,不紧急)

### 1. 经营驾驶舱 "暂无数据" 出现 5 次

**现象**: qhj_prod 登录进入经营驾驶舱, 当月 (2026-04) Silver 无 POS 数据, 页面上多个 section 都显 "暂无数据":
- 顶部大 empty state "当前没有可分析的数据,请先上传 Excel 文件"
- 4 KPI cards 全 `--`
- 销售趋势 / 产品类别占比 "暂无图表"
- (区域销售分布已 P2-18 修复,为空时隐藏)

**判定**: 这是**正确的**空状态设计, 不是 bug. 当月无数据就是空. 底部 Week 6 TemplateGrid 仍展示 2025 全年真 Gold 数据 (¥3.62 亿 利润 / 青花椒门店 Top N) — 用户滚到底部能看到.

**可考虑的优化 (非紧急)**:
- 顶部 empty state 可加一个 "切换到 2025 全年" 快捷按钮, 让用户一键看到历史数据
- 或者默认 date range 先 fallback 到有数据的最近区间 (类似 Trends fallback 链)

---

## 建议新 chat 探索方向

### A. 继续深挖 UX Bug (低优先但价值高)

1. **Dashboard 顶部 empty state 改 fallback 到历史数据** — 同 Trends/RestaurantV2 fallback 链模式。用户首次访问不应看"请上传 Excel"而应直接展示已有历史数据。
2. **Finance "成本/应收/应付/预算" 4 个 tab 对 restaurant tenant 仍显 0 元** — 已做 "利润" tab Gold flip (commit `cf736b926`), 其他 4 个 tab 同逻辑未做。决策: 要 Gold-flip 这些 tab, 还是对 restaurant tenant 直接隐藏这 4 个 tab?
3. **客户管理 /sales/customers 页对 restaurant tenant 体验** — 未审计, 可能也有空表/假数据类问题。
4. **Equipment / RD / Quality 各模块首页对 restaurant tenant** — 跨模块审计, 可能有类似"不适用但仍显示"的错位问题。
5. **Restaurant V2 "跑 V2 分析" 按钮点击后的 loading/error UX** — 未测过失败场景 (如 Python 分析超时)。

### B. 性能深挖 (上次 P1-14 只做了 Trends cache)

1. **Dashboard + Finance 第一次加载完整 network waterfall** — Python 是否冷启? TemplateGrid 4 个 template 能否并行改批量?
2. **大 upload (200K qhj) 的 excel 上传 UX** — 进度条真实性? 失败降级?
3. **AI Query (智能问答) 首次 LLM 冷启耗时** — 30s+ 时用户焦虑, 是否加 streaming / 进度?
4. **Bundle splitting 重评** — 目前 echarts 1.25MB 最大 chunk, 可进一步 tree-shake?

### C. 跨租户 / 跨角色 UX

1. **manufacturing 租户 (F001/F002) 的 Finance/Trends 体验** — 本轮 UX 审计主要在 restaurant (qhj), manufacturing 侧可能有相反问题 (Gold 数据为空显错)。
2. **non-super_admin 角色** (operator / viewer / finance_manager) 的权限感知界面 — 缺失功能是否清晰告知?
3. **Canvas 模块权限 vs 实际 UI 可见性** 一致性审计 (Bug #364 / #371 的延伸)。

### D. 新功能 / v2 基建 (非 UX 类)

1. **v1.3 点评评论 ingestion** (spec §0.3 Week 11-12) — 需 fact_review + dim_store_alias + 评论文本分析
2. **v2 dim_customer + user_pseudo_id 提取** (spec `2026-04-23-v2-dim-customer-design.md`) — 需产品决策
3. **accounting_import Bronze adapter** (v2 unblock 成本分析) — 需客户定 Excel 模板
4. **Bug #371 残余 3 controller** (Equipment/Vehicle/ProductType) 的 RBAC gap — 需权限注册表扩 `equipment:read` 等新码

---

## 开新 chat 时做的起步动作

1. **读**:
   - 本文档 (handoff)
   - `docs/plans/2026-04-23-post-session-real-window-qa-plan.md` (原 QA plan)
   - `tests/e2e-comprehensive/results/qa-2026-04-23/ux/FINDINGS.md` (原 18-finding 审计)
   - `d:\xwechat_files\wxid_a2m0bim6zcm212_82ca\msg\file\2026-04\qa-prompt(2).txt` (qa-prompt v2.3 hard rules)
2. **确认环境**: 测试应在 `https://admin.cretaceousfuture.com` prod 或 test vhost `139.196.165.140:8097`, qhj_prod / 123456 登录
3. **Playwright 隔离硬规则**: `chromium.launch({ headless: true })` + 零 userDataDir + 零 MCP browser_* 工具 — 与其他 chat Playwright 并行无冲突
4. **test-first 硬规则**: 任何 prod 部署必须用户明确说 "部 prod"; 脚本默认 `--env test`
5. **Concurrent edit 风险**: Apr 24 教训 — commit 前必 `git status --short` 核对 staged 范围, 防 lint-staged / husky auto-stage 并发 session 文件

---

## 技术状态快照 (2026-04-24 16:35)

- **分支**: `e2e/v1-framework` (HEAD `9a5e806d3` 已 push origin)
- **Prod Java**: blue `10010` EnvironmentFile=.env.prod · green `10020` 对齐 (Apr 23 session)
- **Prod Python**: 8083 `SMARTBI_AGENT_LAYER_ENABLED=true` · narrative_cache pruner armed (每小时)
- **Prod Web**: `admin.cretaceousfuture.com` 今日 bundle 已部署
- **Test vhost**: `139.196.165.140:8097` (test DB / 47:10011 / 47:8084)
- **Silver 数据**:
  - F001 (manufacturing, test seeded POS ~¥20.64M/140K orders)
  - RES_3101_009 (qhj_prod, real 2025 青花椒 ¥20.57M/140K orders/8 stores)
  - 其他 restaurants seeded in prod (RES_31* series)
- **v1.1+v1.2 Gold 覆盖**: 5/9 模块 (财务/Dashboard/KPI/趋势/销售订单) + 2 drop (开票/出货) + 5 defer (收款/进销存/成品库存/客户管理/成本分析)

---

**本 session 作者**: Claude Opus 4.7 (1M ctx, max effort)
**下 session 建议**: 开始可先跑一次 UX 审计脚本 `tests/e2e-comprehensive/qa-ux-audit-2026-04-23.mjs` 作为 baseline, 看有无新 finding, 然后挑 A/B/C/D 其一推进。
