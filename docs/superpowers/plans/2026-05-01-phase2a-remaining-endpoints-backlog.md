# Phase 2A 剩余 endpoints backlog map

> 给后续 chat 提供 Phase 2A SmartBI Java→Python port 的**剩余工作清单**, 避免重新探索.
>
> **写作日期**: 2026-05-01
> **当前 main HEAD**: `8031f2644` (PR #30 C1 fix merged 后)
> **Phase 2A 范围锁定** (`project_apr30_tool_skill_stays_java.md`): 仅 SmartBI analysis/ops endpoints byte-shape Python port. 不含 337 tools / 16 Skill / AIIntentService — 全留 Java.

---

## 1. Phase 2A scope 范围

**In scope** (port to Python):
- `SmartBIAnalysisController` (`/api/mobile/{factoryId}/smart-bi/*`) — 26 endpoint
- `SmartBIDashboardController` (`/api/mobile/{factoryId}/smart-bi/dashboard*` + `/data-date-range`) — 11 endpoint, 部分

**Out of scope** (留 Java):
- `SmartBIConfigController` (41 endpoint, 配置管理 + reload, 不是分析逻辑)
- `SmartBIUploadController` (13 endpoint, Excel 解析已有独立 Python `/api/excel/*` 路由)
- `SmartBIPublicDemoController` (10 endpoint, demo 站, 数据非生产)
- `IntentAnalysisController` (27 endpoint, AI 意图入口, 留 Java per Phase 2B 锁定)

**Counting 标准**: 每个 endpoint 计为 1, 但 `analysisType` 参数路径每个 sub-type 计为 1 (因为 byte-shape gate 是 per-type 录制 goldens).

---

## 2. SmartBIAnalysisController endpoints inventory (26 endpoints)

### 2.1 ✅ 已 ship 到 main (Phase 2A 已完成 ~14 endpoints, ~28%)

| # | Java endpoint | Python ported | PR | 备注 |
|---|---|---|---|---|
| 1 | `GET /analysis/finance` (composite) | ✅ | #13 | `analysisType=null` → composite |
| 2 | `GET /analysis/finance?analysisType=payable` | ✅ | #18 | per-type |
| 3 | `GET /analysis/finance?analysisType=profit` | ✅ | #21 + #22 | per-type + sales fallback |
| 4 | `GET /analysis/finance?analysisType=cost` | ✅ | #25 + #28 | per-type + arithmetic depth tests |
| 5 | `GET /analysis/sales` (foundation) | ✅ | #14 | foundation only |
| 6 | `GET /analysis/sales?analysisType=gold` | ✅ | #14 | gold layer |
| 7 | `GET /analysis/sales?analysisType=overview` | ✅ | #15 | overview |
| 8 | `GET /analysis/sales?analysisType=rankings` | ✅ | #20 | top-10 ranking |
| 9 | `GET /analysis/sales?analysisType=trend` | ✅ | #20 | DAY bucketing only |
| 10 | `GET /alerts` | ✅ | #14 | 4 alert types (sales/finance/dept/aggregator) |
| 11 | `GET /recommendations` | ✅ | (batch) | |
| 12 | `GET /query-templates` | ✅ | (batch) | GET only (CRUD 其他未 port) |
| 13 | `GET /datasource/list` | ✅ | (batch) | |
| 14 | `GET /data-date-range` (Dashboard) | ✅ | (batch) | dashboard.py |

### 2.2 🚧 Sister chat in-flight (`phase2a/finance-sub-endpoints` 本地 worktree, 未 push)

| # | Java endpoint | 状态 |
|---|---|---|
| 15 | `GET /analysis/finance/budget-achievement` | ✅ impl + tests + goldens (本地 dc4033229+) |
| 16 | `GET /analysis/finance/yoy-mom?periodType=MONTH/QUARTER` | 🚧 yoy-mom 4 sub-impl 已写, 待 route + goldens |
| 17 | `GET /analysis/finance/category-comparison?year=&compareYear=` | ❌ 未开始 |

> **不要碰**: sister chat 在 `.worktrees/phase2a-finance-sub-endpoints` 本地 worktree 工作, 完成后会 push + 开 PR.

### 2.3 ❌ 未开始的 backlog (~9-12 endpoints, 实际 sub-type 展开 ~35+)

| # | Java endpoint | sub-types | 预计 endpoint 数 | 风险 |
|---|---|---|---|---|
| 18 | `GET /analysis/finance?analysisType=receivable` | `metrics + agingChart` | 1 (per-type) | LOW (cost/profit 模式可复用) |
| 19 | `GET /analysis/finance?analysisType=budget` | `metrics + comparisonChart` | 1 (per-type) | LOW |
| 20 | `GET /analysis/department` | composite + 多 type? | 1-3 | MED (新 Java service 域) |
| 21 | `GET /analysis/region` | composite + 多 type? | 1-3 | MED (按地区聚合) |
| 22 | `GET /analysis/production` | composite + 多 type? | 1-5 | HIGH (车间生产逻辑复杂) |
| 23 | `GET /analysis/quality` | composite + 多 type? | 1-3 | MED (质检统计) |
| 24 | `GET /analysis/inventory` | composite + 多 type? | 1-5 | HIGH (库存动态查询) |
| 25 | `GET /analysis/procurement` | composite + 多 type? | 1-3 | MED (采购统计) |
| 26 | `POST /query` | NL→SQL 通用查询 | 1 | **VERY HIGH** (依赖 LLM + Tool-Skill, 可能 out-of-scope) |
| 27 | `POST /drill-down` | 钻取分析 | 1 | HIGH (依赖 hierarchy + 多表 join) |
| 28 | `GET /incentive-plan/{targetType}/{targetId}` | | 1 | MED |
| 29 | `POST /datasource/upload` (multipart) | Excel 上传 | 1 | LOW (跟 Excel 模块共享) |
| 30 | `GET /datasource/{id}/preview` | | 1 | LOW |
| 31 | `POST /datasource/apply` | 应用数据源 | 1 | MED |
| 32 | `GET /datasource/{id}/fields` | | 1 | LOW |
| 33 | `GET /datasource/{id}/history` | | 1 | LOW |
| 34 | `POST /query-templates` | 创建模板 | 1 | LOW (CRUD 标准) |
| 35 | `PUT /query-templates/{id}` | 更新模板 | 1 | LOW |
| 36 | `DELETE /query-templates/{id}` | 删除模板 | 1 | LOW |

**SmartBIDashboardController (10 endpoint, 部分 in scope)**:

| # | Java endpoint | 状态 | 备注 |
|---|---|---|---|
| 37 | `GET /dashboard` | ❌ | 主 dashboard 数据 |
| 38 | `GET /dashboard/executive` | ❌ | 执行级 dashboard |
| 39 | `GET /dashboard/executive/insights` | ❌ | LLM 洞察 (Java 已实现) |
| 40 | `GET /dashboard/executive/insights/custom` | ❌ | 自定义 |
| 41 | `GET /dashboard/executive/insights/custom/stream` | ❌ | SSE 流式 (Python SSE 较新, 风险 MED) |
| 42 | `GET /dashboard/executive/custom` | ❌ | |
| 43 | `GET /analysis/dynamic` | ❌ | 动态分析 |
| 44 | `GET /analysis/dynamic/kpis` | ❌ | KPI |
| 45 | `POST /generate-adaptive-charts` | ❌ | 适应性图表 |
| 46 | `POST /generate-chart` | ❌ | 单图表 |

总计: **~30 endpoints 未 port** (含 sub-type 展开是 ~38-50 byte-shape gates).

---

## 3. 优先级 + 工作量

### Tier 1 (LOW risk, 高 ROI, sister chat 模板可复用) — 推荐先做

| 端点 | 估时 | 模板 |
|---|---|---|
| /finance?type=receivable | 4-6h | cost/profit pattern 直接复用 |
| /finance?type=budget | 4-6h | 同上 |
| /datasource/{id}/preview/fields/history | 1-2h each | 简单 query, 标准 byte-shape |
| /query-templates POST/PUT/DELETE | 2-3h each | CRUD, 标准 |
| /incentive-plan | 3-4h | metric 查询 |

**Tier 1 总计**: ~25-35h, 可分 4-6 个 chat 平行做.

### Tier 2 (MED risk, 新 Java service 域, 需 spec audit)

| 端点 | 估时 | 风险 |
|---|---|---|
| /analysis/department | 8-12h | 新域 |
| /analysis/region | 6-10h | 按地区聚合, schema 待验 |
| /analysis/quality | 8-12h | 质检统计 |
| /analysis/procurement | 8-12h | 采购统计 |
| /datasource/apply | 4-6h | 数据源应用逻辑 |

**Tier 2 总计**: ~35-50h, 每个 sub-domain 独立 chat (跟 finance/sales 同 4 轮 audit pattern).

### Tier 3 (HIGH risk, 大工程)

| 端点 | 估时 | 风险 |
|---|---|---|
| /analysis/production | 15-25h | 车间生产逻辑复杂, 多 entity join |
| /analysis/inventory | 12-20h | 库存动态查询 + RLS |
| /drill-down | 15-25h | hierarchy + 跨表钻取, 现有 Java 复杂度高 |

**Tier 3 总计**: ~45-70h, 需独立 spec brainstorm + 长 chat impl.

### Tier 4 (VERY HIGH risk, 可能 out-of-scope)

| 端点 | 估时 | 决定 |
|---|---|---|
| /query (NL→SQL) | 30+h | **建议 out of scope**, 留 Java (依赖 Tool-Skill + LLM 链路, 跟 Phase 2B AI 系统耦合) |
| /dashboard/executive/insights/custom/stream (SSE) | 20+h | SSE Python (FastAPI sse_starlette) 模式较新, 视需求评估 |

### Dashboard 子集

| 端点 | 估时 |
|---|---|
| /dashboard, /dashboard/executive (无 stream) | 20-30h 总计 (静态 + LLM insight) |
| /generate-adaptive-charts, /generate-chart | 8-12h 总计 (chart_builder 已存在 Python 端) |

**Dashboard 总计**: ~30-45h.

---

## 4. 推荐 sequence

**Wave 1** (sister chat finance-sub-endpoints push 完后, 立即可启动):
- receivable + budget per-type (各一个 chat, 共 2 chat)
- 总计 ~10-12h, 让 finance 子域 5/5 全完成

**Wave 2** (Tier 1 收尾, 平行):
- /datasource/* + /query-templates CRUD (4-6 endpoint)
- 一个 chat 包圆, ~10-15h
- ROI 高 (CRUD 标准)

**Wave 3** (Tier 2, 平行):
- /analysis/department + /region + /quality + /procurement
- 4 个独立 chat, 各 spec → plan → impl, ~8-12h each
- 跟 finance/sales pattern 一致

**Wave 4** (Tier 3, 串行):
- /analysis/production (单独长 chat)
- /analysis/inventory (单独长 chat)
- /drill-down (单独长 chat)

**最后**:
- Dashboard endpoints (按需评估, 部分可能不需要 port — Java→Python 收益不明显)
- /query NL→SQL: **建议 out of scope**
- /query-templates CRUD 中的 PUT/DELETE: 评估业务需求, CRUD 收益低

---

## 5. 各端点推荐 spec 模板

复用 `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md` 模板:
- §1 Java side reference (controller method + service method 完整签名)
- §2 Java JSON shape (录 F999 + F001 goldens)
- §3 Python side spec (path + body shape + sub-types)
- §4 Helpers + algorithm (per-period bucketing, growth rate 等)
- §5 Test plan (byte gates + arithmetic depth)
- §6 Risks + 边界 (NULL handling, NaN, date boundary)
- §7 4 轮 audit (self-review / spec reviewer / cross-spec / final impl reviewer)

---

## 6. 已知 patterns + rules

(参考 `.claude/rules/python-java-port.md` 7 rules)

- **Rule 1**: Null fallback 用 `is not None` 三元 (不 `or`)
- **Rule 2**: WEEK period key 用 calendar year `d.year` (不 `isocalendar()[0]`)
- **Rule 3**: Function signature 1:1 mirror Java
- **Rule 4**: `_decimal_to_number` helper for BigDecimal serialization
- **Rule 5**: 共享 SQL helpers `SELECT *`
- **Rule 6**: 输入边界 None-check (新 helper 强制)
- **Rule 7**: 浮点阈值用 `Decimal` 比较

特别注意 (本 chat 项目):
- Python 3.8 compat: `_to_thread` shim (不要 `asyncio.to_thread`)
- Concurrent edit safety: `git commit -m "..." -- <paths>` (rule 5b)
- Decimal serialization: FastAPI 默认 Decimal→str, 用 `_decimal_to_number` helper

---

## 7. Phase 2A 整体进度估算

- ✅ 已 ship: 14 endpoints (~28%)
- 🚧 in-flight (sister chat): 3 endpoints (budget-achievement done + yoy-mom WIP + category-comparison pending)
- ❌ backlog: ~30 endpoints (Tier 1+2+3+4 + Dashboard, 估 ~140-200h 工作量)

**Phase 2A 完整收尾估时**: 5-7 个有效 chat × 8-15h/chat = ~50-100h. 若并行 3-4 个 chat 同时进行, 实际墙钟 1-2 周.

**Phase 2A 100% 完成后**: 才能考虑翻 nginx cutover (T6 of original Phase 2A spec) 把 `/api/mobile/{factoryId}/smart-bi/analysis/*` 路由从 Java 切到 Python.

---

## 8. 给下一个 chat 的 marching order

```
我要推 Phase 2A 的 receivable per-type (Wave 1).

1. cd 到主 worktree, 创建 worktree:
   git worktree add .worktrees/phase2a-finance-receivable
2. 模板:
   - spec: docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md
   - plan: docs/superpowers/plans/2026-04-30-phase2a-analysis-finance-cost-pr-a.md
   只把 cost 替换成 receivable, Java service 改成 financeAnalysisService.getReceivableMetrics()
   + getReceivableAgingChart()
3. brainstorm 2-3 轮找出 receivable-specific 边界 (aging buckets 30/60/90/120 天)
4. spec 4 轮 audit (self / reviewer / cross-spec / final)
5. plan 14-task 分解
6. 实施 + push + 开 PR

参考已 ship 的 cost (PR #25 + #28) 模板, 80% 工作量复用.

不要碰: phase2a/finance-sub-endpoints worktree (sister chat 在做 budget-achievement / yoy-mom / category-comparison)
```
