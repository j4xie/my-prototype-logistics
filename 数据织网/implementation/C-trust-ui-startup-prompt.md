# C Chat 启动 Prompt — 数据织网 Sub-Project C Day 23-30 (Trust UI + admin config)

**版本**: v1
**日期**: Apr 27 2026
**用法**: 把下面 `---` 之间的内容整段复制到新 Chat 作为第一条消息发给 Claude。
**何时启动**: BF1 ship + audit-clean 完成 (18 commits all on origin/e2e/v1-framework). Day 17-22 (BF2 prod execution + BF3 1-week soak + BF4 cutover) 是 ops + 日历等待,不是 coding session — 留给 DBA + 维护窗口 + 你的安排。本 session 直接做 Day 23-30 frontend Trust UI work。

---

# 数据织网 Sub-Project C Day 23-30 — Trust UI + admin config 实施

我是新 chat,接续前 chat 完成的 Day 6-16 + Phase A/B/1/2 + cascade engine + BF1 backfill + audit fix。前 chat 已散场。

## 必读 (按顺序读, 不要跳)

1. `数据织网/04-C-字段血统与继承.md` v1.4 — **C spec 权威源** (~1500 行), 重点读 §6 Trust Indicator UI (lines ~925-1102, 含 §6.1 / §6.2 / §6.3 / §6.4)
2. `数据织网/implementation/C-pre-prod-blockers.md` — 完整状态 + Phase A+B+1+2 closure + Day 17+ 路线图
3. `数据织网/02-A-能力驱动渲染.md` v1.6 — A 已 prod live, Trust UI 集成需了解 A 的 useCapability composable / CapabilityGate 模式
4. `web-admin/src/views/Dashboard.vue` — 现有 KPI 卡片包装位置 (Phase B Day 9 已加 CapabilityGate, Trust UI 加在 KPICard footer slot)
5. `backend/python/smartbi/canonical/provenance/__init__.py` — 后端 cascade API: compute_dish_margin / read_authoritative_value / get_industry_default
6. `backend/python/smartbi/canonical/provenance/cascade.py` — compute_dish_margin returns dict with confidence + cost_source + cost_confidence + sales_confidence
7. `数据织网/implementation/C-day6-blockers.md` + `C-chat-startup-prompt.md` — 历史上下文 (前 2 chat 怎么开始的)
8. `.claude/rules/concurrent-edit-safety.md` — **Rule 5: commit 前 git status 锁 scope** (本会话发生过 2 次 race 事故, 务必小心)
9. `.claude/rules/server-operations.md` — test 先 prod 后,Vue 前端只 deploy web-admin
10. `CLAUDE.md` — 项目根 README

## 当前状态 (你接手的起点 = Day 23)

### 已 ship 到 origin/e2e/v1-framework (18 C commits)

| Phase | Commit | 内容 |
|---|---|---|
| Day 6 | `498a8ab56` | advisory_lock 内嵌 + valid_to filter + V20260501_01 加 3 列 |
| Day 8-9 | `71eb50170` | factory_provenance_config + admin_queue field_conflict + conflict_resolver.py |
| Day 10 | `07f11a2cc` | _writer_hook.py + SMARTBI_ENABLE_PROVENANCE env flag |
| Day 11 | `2a031611b` | ProductSummaryWriter dual-write hook |
| Day 12 | `08f3c78e2` | ReviewWriter dual-write hook |
| Day 12 | `163478942` | FinanceWriter dual-write hook |
| Day 12 | `e5771d90b` | InventoryWriter dual-write hook |
| Day 12 | `4b82c98c0` | dual-write e2e |
| docs | `f81652857` | C-pre-prod-blockers.md initial |
| Phase A | `db72592e5` | C2 race fix + I1+I4+I5+I6+I7 cleanup |
| Phase B | `a3dbbfccd` | C1 multi-dim anchor (compound `@store_<id>` + finance rollup) |
| docs | `5e8f73910` | blockers doc Phase A+B closure |
| Phase 1 | `2d07b4520` | IMP-1 spec §3.1.5 + IMP-2/3/4/MIN-3 |
| Phase 2 | `7836c3c87` | Day 13-15 cascade engine (compute_dish_margin + industry_default + 时间继承) |
| Phase 2 follow-up | `812f09ebd` | I-A cache divergence + I-B expired-recipe e2e |
| docs | `048d6c56a` | blockers doc Phase 1+2 closure |
| Day 16 BF1 | `55cc7bf1c` | backfill_progress + backfill_provenance.py 4 mappers |
| BF1 audit fix | `b8ee122f5` | C1 RLS startup guard + I1 review upload_id + I2 ascii + I5 flag refuse |

### 测试 + Migrations
- **192 tests PASS** (138 baseline + 34 backfill + 5 e2e + 等等, 全 real PG via SSH tunnel)
- 5 migrations applied **test smartbi_db only**:
  - V20260430_01 (field_provenance schema)
  - V20260501_01 (3 audit columns)
  - V20260501_02 (factory_provenance_config)
  - V20260501_03 (admin_queue field_conflict)
  - V20260502_01 (field_name VARCHAR widen 100→200)
  - V20260502_02 (backfill_progress)
- **Prod smartbi_prod_db: 0 migrations applied** (Day 17+ DBA 任务)

### 关键开关

- `SMARTBI_ENABLE_PROVENANCE` 默认 OFF — 4 B writer hooks inert in prod
- 灰度 cohort: `RES_3101_009` 单 friendly customer (per A 灰度 + IMP-3 doc)

## Day 17-22 不是本 session 范围 (ops 任务,留 DBA)

✅ 已 ready: backfill 脚本 + RLS guard + flag-on refuse
❌ 留 DBA: BF2 prod 跑 + BF3 1-week soak + BF4 cutover + 5 migrations apply prod

## Day 23-30 本 session scope — Trust UI + admin config

per spec §6 Trust Indicator UI:

### Day 23 — TrustIndicator.vue 组件 (~1 hr + 单测)

**新文件**: `web-admin/src/components/TrustIndicator.vue`

per spec §6.1 (lines ~929-950):

```vue
<script setup lang="ts">
defineProps<{
  confidence: number;       // 0-1
  source: string;           // 'bill_flow' / 'industry_default' / etc
  cellAuditUrl?: string;    // 跳到详细 lineage 页
}>();
</script>

<template>
  <div class="trust-indicator">
    <el-tag :type="confidence > 0.85 ? 'success' : confidence > 0.7 ? 'warning' : 'info'">
      {{ confidenceLabel }}
    </el-tag>
    <span class="source-badge">[{{ sourceLabel(source) }}]</span>
    <el-button v-if="cellAuditUrl" link size="small" @click="$emit('audit')">
      查看来源
    </el-button>
  </div>
</template>
```

加 `sourceLabel` 函数翻译 source_type → 中文友好名:
- `manual` → "客户手动确认"
- `bill_flow` → "账单流水"
- `product_summary` → "商品汇总"
- `review` → "评论数据"
- `inferred` → "AI 推断"
- `industry_default` → "行业默认值"

加 vitest 单测 ~5 个 (高/中/低 confidence label / source 翻译 / cellAuditUrl optional).

### Day 24-25 — 卡片集成 TrustIndicator (~2 hr)

每个 KPI 卡片 footer slot 加:

```vue
<KPICard label="客单价" :value="avgBillValue.value" unit="¥">
  <template #footer>
    <TrustIndicator
      :confidence="avgBillValue.confidence"
      :source="avgBillValue.source"
      :cell-audit-url="`/audit/cell?type=product&id=${encodeURIComponent(avgBillValue.entityId)}&field=${encodeURIComponent(avgBillValue.field)}`"
    />
  </template>
</KPICard>
```

**Scope**: 现有 ~30 个 Dashboard 卡片 (Phase B Day 9 已加 CapabilityGate, 现加 TrustIndicator). 估计 30 卡片 × 2 行 = ~60 行 edits 跨 5-8 文件.

需要后端 API 返回 `confidence` + `source` + `entityId` + `field` 字段. 看现有 KPI API 是否已 expose; 如未, **需先后端先加**.

**注意**: TrustIndicator 应只在 Phase B 4 writers 写过的字段显示 (有 provenance 的). 老数据没 provenance → 不显示 TrustIndicator (fallback 老体验).

### Day 26 — Cell 审计页 (`/audit/cell`)

per spec §6.3 (lines ~993-1049):

**新 router entry**: `/audit/cell?type=<entity_type>&id=<entity_id>&field=<field_name>`

**新 view**: `web-admin/src/views/system/data-fabric/cell-audit.vue`

显示:
- 当前权威值 + source + confidence + valid_from/valid_to
- 历史 superseded 链 (按 created_at DESC)
- 每行: source, value, priority, confidence, written_at, written_by
- Sentinel upload_id=0 显友好"客户手动 / 行业默认"不显 file_name (per NC-4)

**API call**: 新增后端 endpoint `GET /api/smartbi/provenance/audit?factory_id=X&entity_type=Y&entity_id=Z&field=W` 返完整 lineage.

**RBAC**: 仅 admin / 超级管理员可看 (per S-18 audit log).

### Day 27 — Admin 配置页 (factory_provenance_config UI)

per spec §6.4 (lines ~1053-1102):

**新 view**: `web-admin/src/views/system/data-fabric/provenance-config.vue`

3 个 panel:
1. **差异阈值** (Q1) — slider 5%-50%, 默认 30%
2. **来源优先级表** (Q2) — table 显示 6 source 全局默认 + factory override input
3. **行业默认成本率** (Q3) — table 显示 27 categories,factory override input

**API**: `PUT /api/smartbi/factory-config/provenance` body 含 3 JSONB.

**调用 invalidate_factory_config_cache()** 后端 (已实现于 conflict_resolver.py).

**权限**: 仅 admin。

### Day 28 — 集成 + 单测 + lint

- 新 view 加进 router + sidebar (`/system/data-fabric/cell-audit`, `/system/data-fabric/provenance-config`)
- TrustIndicator vitest 测试
- audit page + config page 各 1 个 vitest (mock API)

### Day 29 — Test 部署 + 24h soak

- Build web-admin → deploy 到 test 环境 (`139:8097`)
- 手测 5-10 个真客户 factory 的 Dashboard 看 TrustIndicator 显示

### Day 30 — Prod 灰度 + Monitor

- Deploy web-admin 到 `139:8086`
- 监控 1 周 capability-watch.log + 用户反馈

## 实施约束

1. **遵循 .claude/rules/** 全部规则 — 特别是 concurrent-edit-safety Rule 5 (前 chat 发生 2 次 race 事故)
2. **DON'T BREAK B prod / Day 6-16 work**:
   - 不要修 backend/python provenance/ + silver_writers/ + scripts/ 任何已 ship 代码 (除非真 bug)
   - 不要修 04-C 04-A spec 已 v1.x ship 内容 (除非 doc-only 加 §)
   - 加新代码,不重写现有
3. **Frontend 只动 web-admin**, 不动 React Native (frontend/CretasFoodTrace)
4. **Subagent 并行策略**: 用 superpowers:subagent-driven-development 派 subagent。Trust UI 3 组件 (TrustIndicator + audit page + config page) 可一个 subagent 包,卡片集成 1 个 subagent
5. **Commit 节奏**:
   - Day 23 TrustIndicator: 1 commit
   - Day 24-25 卡片集成: 1-2 commits (per ~10 卡片 batch)
   - Day 26 audit page: 1 commit
   - Day 27 config page: 1 commit
   - Day 28-30 集成 + deploy: 1 commit
6. **每会话末**: superpowers:requesting-code-review 审 + push origin (前 chat 已建立此节奏)
7. **真测试**: vitest 测组件 + Playwright (如有) 测真窗口 — 不要假 mock 一切

## 第一步立即做

读完 10 个必读文件后, **立即执行**:

1. **验证现状**:
   ```bash
   cd backend/python && python -m pytest tests/test_provenance.py tests/test_conflict_resolver.py tests/test_writer_hook.py tests/test_*provenance_hook.py tests/test_cascade.py tests/test_backfill_provenance.py 2>&1 | tail -3
   # 期望 130+ unit PASS
   ```

2. **检查 git status 干净** (前 chat push 全部):
   ```bash
   git log --oneline origin/e2e/v1-framework..HEAD
   # 期望 0 commits ahead
   ```

3. **派 subagent: Day 23 TrustIndicator 组件**:
   - 实施 `web-admin/src/components/TrustIndicator.vue`
   - 加 vitest 单测
   - commit `feat(数据织网 C): Day 23 — TrustIndicator.vue component`

4. **B prod / C 后端监控顺手** (可选):
   ```bash
   ssh root@47.100.235.168 "curl -fsS http://localhost:8083/health | head -1"
   # B prod 仍 healthy
   ```

## 与用户的沟通

- 用 **简短中文** 报告进度,不要长 markdown
- 关键 milestone 暂停问 user (Day 23 component ready / Day 25 cards integrated / Day 27 admin page ready / Day 30 deploy 前)
- spec 有疑问立即问,不假设
- prod deploy (web-admin) 必须 user 明确同意
- **本 session 不动 prod smartbi_prod_db migrations** (Day 17+ DBA 任务,你只做 frontend)

## 不要做的事

- ❌ 不要重写 spec
- ❌ 不要修 backend/python 已 ship 代码 (除非 doc-only 加 §)
- ❌ 不要在 prod 上做未测试的改动
- ❌ 不要 push 到 origin — 等 user 明确说 "push" 才推
- ❌ 不要重做 Day 6-16 工作
- ❌ 不要"顺便修" pre-existing 5 个 dim_review_summary FK e2e failures (与 C 无关,Day 16+ B-side cleanup)
- ❌ 不要做 D 子项目 (federated query, 不在 C 范围)
- ❌ 不要碰 BF2 prod execution / migrations apply (DBA 任务)

## 推荐节奏

- **第 1 hr** Day 23 TrustIndicator 组件 + vitest + commit + 后端 KPI API 检查 (是否 expose confidence/source)
- **第 2-3 hr** Day 24-25 ~30 卡片集成 (subagent dispatch + 渐进 commit)
- **第 4 hr** Day 26 cell audit 页 + 后端 endpoint
- **第 5 hr** Day 27 factory_provenance_config 配置页 + 后端 PUT endpoint
- **第 6 hr** Day 28 集成 + lint + 整体 review
- **第 7 hr** Day 29-30 test deploy + spec + push (会话末 superpowers audit)

总 ~6-7 hr,完成 Day 23-30 (~spec 8 天工作量)。如果时间紧, 优先 Day 23-25 (TrustIndicator + 卡片) 让 prod 看到效果, audit + config 页留下次。

---

**现在请开始**: 读完 10 个必读文件,然后立即执行"第一步立即做"的 4 个步骤。
