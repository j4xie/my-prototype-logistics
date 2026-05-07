# ⚡ IMMEDIATE — Phase A scope discovery + spec writing (task #24 finance past-year fallback)

**From**: organizer chat (Phase 2A T6 cutover)
**Date**: 2026-05-06
**Task**: #24 finance past-year fallback content (Java emits kpiCards/top_stores Python omits)
**Phase A scope**: 仅 spec discovery + writing,**不实施代码改动**
**Phase B/C/D**: 等 organizer 审 spec 后单独派,**当前 marching order 不含**

---

## 背景

T6.1 dryrun 100% match 是基于 F001 当前年份数据 (`/api/mobile/F001/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-05-07`)。但 retrospective 文档 (`docs/superpowers/plans/2026-05-07-phase2a-retrospective.md` line 122-124) 标记了一个**未解决的功能 gap**:

> **#24 finance past-year fallback** — Sister-chat scope (~200-400 LOC). Java reads fact_pos_transaction Gold; Python doesn't.

具体是说: 当 finance endpoint 接到 past-year 日期范围 (e.g. `startDate=2024-01-01&endDate=2024-12-31`) 时:
- **Java** 走 `GoldDashboardBuilder.java` 读 Gold layer 的 `top_stores` / `kpiCards` (来自 fact_pos_transaction)
- **Python** `analysis_finance.py` 现状不一定走同样 Gold path,past-year fallback 输出 shape 可能 omit 这些字段

T6.1 dryrun 没 catch 因为 dryrun 只测 current year (2026)。但 T6.3 50% factories 流量进来后,user 有可能选 past-year date range,Python 输出会跟 Java diverge → byte-shape parity 破裂。

**T6.3 GO 之前应该 fix**,但不是绝对 hard block (user-facing 端点 graceful fallback 仍 200 OK,只是 shape 简化)。

---

## 你的 Phase A 任务

**只做 scope + 写 spec**,**不动代码**。Deliverable:

1. 一份 spec doc `docs/superpowers/specs/2026-05-07-phase2a-finance-past-year-fallback-spec.md`
2. 录 F999 + F001 **past-year** finance goldens 到 `tests/fixtures/java-smartbi-golden/`
3. PR + ping organizer 审 spec 后 GO Phase B

---

## Step 0 — Worktree 隔离 (强制)

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/finance-past-year -b ops-finance-past-year origin/main
cd .worktrees/finance-past-year
pwd
git branch --show-current
```

---

## Step 1 — Reference docs

**Templates** (Phase 2A finance specs 作模板,看格式 + section 结构):
- `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md`
- `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md`
- `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-foundation-design.md`

**Rules**:
- `.claude/rules/python-java-port.md` — 12 codified Java→Python port rules (重点 Rule 4 / 8 / 9 / 10 / 11 / 12)

**Tools**:
- `scripts/record-java-golden.sh` — 录 goldens (CLI: factory_id / endpoint / args)
- `tests/fixtures/java-smartbi-golden/` — golden 存放位置,文件名 convention `analysis-finance-{F999|F001}-{type}.json`

---

## Step 2 — Phase A 探索任务

### 2.1 Java path discovery (深读)

Read 这些文件搞清楚 Java 端 finance past-year 走什么路径:

```
backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/
├── GoldDashboardBuilder.java          ← top_stores / kpiCards from gold map
├── impl/FinanceAnalysisServiceImpl.java  ← getFinanceOverview 主入口
└── DynamicAnalysisService.java         ← kpiCards DTO definition
```

回答以下问题 (写进 spec §1.1):
- `GoldDashboardBuilder` 在 `getFinanceOverview` 哪个分支被调用?
- `gold` map 来源是什么? (查 Service 层 query)
- `fact_pos_transaction` 是 view? table? Gold ETL 输出?
- Gold layer query 怎么过滤 past-year date range?
- `top_stores` 在 Gold 是 pre-computed 还是 query-time aggregate?

### 2.2 Python current state discovery

Read 现状:
```
backend/python/smartbi_compat/api/analysis_finance.py L1-200, L1500-1700
```

回答 (写进 spec §1.2):
- Python `getFinanceOverview` 等价端点叫什么? (`/api/mobile/{factoryId}/smart-bi/analysis/finance`)
- 当前在 past-year 时返回什么? (kpiCards=[]? metricCards=null? rankings={}?)
- empty-state shape 在 L1585-1600 (golden A.5) 显示了什么?
- 走的是 SmartBiFinanceData ORM 还是 Gold layer?

### 2.3 Diff identification (录 goldens)

录 F999 + F001 past-year goldens (date range = 2024-01-01 → 2024-12-31,F999 是 empty / F001 是 real data):

```bash
# Verify 当前 prod env Java (10010) 输出
./scripts/record-java-golden.sh F999 F999 \
  /api/mobile/F999/smart-bi/analysis/finance "startDate=2024-01-01&endDate=2024-12-31" \
  > tests/fixtures/java-smartbi-golden/analysis-finance-F999-past-year.json

./scripts/record-java-golden.sh F001 F001 \
  /api/mobile/F001/smart-bi/analysis/finance "startDate=2024-01-01&endDate=2024-12-31" \
  > tests/fixtures/java-smartbi-golden/analysis-finance-F001-past-year.json
```

录完比对当前 Python 输出 (调 Python 8083 同样 endpoint):
```bash
TOKEN=$(获取 F001 token,参见 PR-1 spike marching order 第 3 步)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8083/api/mobile/F001/smart-bi/analysis/finance?startDate=2024-01-01&endDate=2024-12-31" \
  > /tmp/python-F001-past-year.json
```

⛔ DO NOT 通过 139 nginx canary route 触发 Python — 那会污染 prod log + 干扰 T6.2 metrics。直接 SSH 47 + curl localhost:8083。

Diff Java vs Python (写进 spec §1.3):
- `kpiCards` 字段差异 (length / shape)
- `top_stores` 字段是否 present
- 其他 field-level diff (Rule 8 key order / Rule 9 Lombok null emit / Rule 11 microsecond)

### 2.4 Implementation plan 写进 spec

按 Phase 2A finance sister-chat ports 的 PR 拆法 (e.g. profit chat PR-A impl + PR-B tests):

- **PR-B**: Mirror Java fact_pos_transaction Gold reads in Python (~200 LOC 估)
  - 加 `_query_gold_finance_summary(factory_id, start_date, end_date)` helper
  - 在 finance dispatch 里 detect past-year condition,走 Gold path
  - Output kpiCards / top_stores 跟 Java 一致

- **PR-C**: Tests
  - F999/F001 past-year goldens (Phase A 已录)
  - Arithmetic depth tests
  - Edge: cross-year date range (2024-12-15 → 2025-01-15)

具体内容由 Phase B/C/D marching order 给出 (现在不写 impl 细节)。

### 2.5 Risks + Out-of-scope (per spec template)

- **Risks**: Gold layer 数据可能不 fresh (per restaurant_etl_task hourly cadence). Past-year 数据 stable 但本年初的 query 可能 stale 1h.
- **Out of scope**:
  - 不动 Java 端
  - 不修 fact_pos_transaction view 本身
  - 不改 Gold ETL 频率 (那是 Phase 4.5 work)
  - 不动 SmartBiFinanceData ORM path (现年路径)

---

## Step 3 — 写 spec

文件: `docs/superpowers/specs/2026-05-07-phase2a-finance-past-year-fallback-spec.md`

按 `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md` 模板格式。Section 必含:

```
1. 背景
   1.1 Java path
   1.2 Python current state
   1.3 Shape diff (cite F999/F001 past-year goldens)

2. Goals + Non-goals

3. Design
   3.1 Approach (Gold path detection condition)
   3.2 Data flow (Java side → Python mirror)
   3.3 Function signatures (per Rule 3 mirror Java 1:1)
   3.4 Output shape (per Rule 8 key order, Rule 9 Lombok null emit)
   3.5 Decimal handling (per Rule 4 _decimal_to_number)
   3.6 Date handling (per Rule 11 _java_isoformat)

4. Implementation phases (PR-B / PR-C / PR-D 拆分)

5. Risks + 缓解

6. Out of scope

7. Success criteria (byte-shape parity test, dict_eq, prod metrics)

8. Resumption checklist
```

参考 `python-java-port.md` Rule 1-12 自我审计 spec 是否覆盖所有已知坑。

---

## Step 4 — Commit + PR + ping

⛔ HOLD: 不要在 Phase A 写**任何**实施代码 (即不改 `backend/python/smartbi_compat/api/analysis_finance.py`)。Spec doc + golden files + 比对结果是 only deliverable。

```bash
git add docs/superpowers/specs/2026-05-07-phase2a-finance-past-year-fallback-spec.md
git add tests/fixtures/java-smartbi-golden/analysis-finance-F999-past-year.json
git add tests/fixtures/java-smartbi-golden/analysis-finance-F001-past-year.json
git status --short  # ← 验证只 3 个文件
git commit -- docs/superpowers/specs/2026-05-07-phase2a-finance-past-year-fallback-spec.md \
  tests/fixtures/java-smartbi-golden/analysis-finance-F999-past-year.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-F001-past-year.json \
  -m "spec(phase2a): finance past-year fallback discovery + F999/F001 goldens (Phase A)"
git push -u origin ops-finance-past-year
gh pr create --title "Phase A: finance past-year fallback spec + goldens (task #24)" \
  --body "Phase A scope discovery + spec writing for task #24. No code impl. Awaiting organizer GO for Phase B impl."
```

Ping organizer:
> Phase A done. PR <URL>. Spec written. F999/F001 past-year goldens recorded. Key diff identified: <1-2 line summary of what Python omits vs Java>. Awaiting GO for Phase B impl marching order.

---

## ⛔ HOLD blocks (per feedback_sister_chat_phase_skip_ping memory)

| Block | Trigger |
|---|---|
| ⛔ Don't proceed to Phase B (impl) before organizer审 spec + 给 GO | Phase A only writes spec, Phase B/C/D 单独 marching order |
| ⛔ DO NOT modify `backend/python/smartbi_compat/api/analysis_finance.py` | 这是 Phase B 工作 |
| ⛔ DO NOT touch prod (8083) anything | Phase A 只 read Java prod 录 goldens, 不写 prod |
| ⛔ DO NOT touch T6.2 canary nginx route | nginx config / vhost backup / etc. 不动 |
| ⛔ DO NOT trigger Python 8083 via 139 nginx | 直接 SSH 47 + curl localhost:8083 (避免污染 T6.2 metrics) |
| ⛔ DO NOT 改 cretas-python.service or .env.prod | systemd/env 不动 |

---

## Stop-and-ping 触发条件

立即 ping organizer:
- Java 10010 录 golden 时 401/403 (token 失效)
- Java 10010 record 时 5xx (说明 Java 端有 bug,不是 Python)
- F001 past-year date range 实际**没有数据** (test factory,可能 2024 年没数据)
- `GoldDashboardBuilder` 在 Java code 找不到 `gold` map source (Gold ETL Service 在哪)
- `fact_pos_transaction` 在 PG 不存在 (跟 task #30 类似的 schema gap?)
- Phase 2A finance specs 模板跟 task #24 性质冲突 (e.g. 没有同等 sub-endpoint pattern)
- Python 现状已经 mirror Java path 但 spec assume 没 (re-discover 后发现假设错)
- 任何意外发现 (e.g. fact_pos_transaction 是 Java JdbcTemplate raw query 而不是 Gold view)

---

## ⛔ 禁止事项

1. **不写 impl 代码** — 只 spec + goldens
2. **不动 prod**
3. **不并行 Phase A/B** — Phase A 完整 ping organizer 等 GO 才进 B
4. **不在主 worktree 工作** — 用 `.worktrees/finance-past-year/`
5. **不通过 T6.2 canary 触发 Python** — 直接 SSH curl localhost
6. **不假设** Java path / Python state — read code verify

---

## Resumption checklist

- [ ] `cd .worktrees/finance-past-year && git pull origin main` (拿最新 main)
- [ ] Read 这 marching order
- [ ] Step 1 reference docs 浏览
- [ ] Step 2.1 Java path discovery
- [ ] Step 2.2 Python current state
- [ ] Step 2.3 录 F999/F001 past-year goldens + Python diff
- [ ] Step 2.4 implementation plan 写进 spec
- [ ] Step 2.5 risks + out-of-scope
- [ ] Step 3 写完整 spec
- [ ] Step 4 commit + push + PR + ping organizer
- [ ] **STOP** 等 organizer GO 才进 Phase B (会发新 marching order)

---

## 注意: 这个 task 可能**比想像简单**

Audit 我自己的描述可能过度复杂化 task #24:
- "Java reads fact_pos_transaction Gold; Python doesn't" 可能实际是 Java 走 SmartBiFinanceData ORM 当 past-year 数据缺失时 fallback 一段简化逻辑(简化 emit kpiCards/top_stores),Python 没 mirror 该 fallback。**不一定**真的涉及 Gold layer。

如果 Phase A 探索后发现 task #24 实际上**很小** (e.g. 仅 fallback shape mirror 50 LOC),不是 200-400 LOC,**老实告诉 organizer**,不要膨胀 spec。Right-sized spec is best spec.
