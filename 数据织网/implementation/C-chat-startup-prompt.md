# C Chat 启动 Prompt — 数据织网 Sub-Project C (Day 6 起步)

**版本**: v1
**日期**: Apr 26 2026
**用法**: 把下面 `---` 之间的内容整段复制到新 Chat 作为第一条消息发给 Claude。
**何时启动**: B sub-project 已 0→prod ship (commit `a383b4610`)。C Day 1-5 已 commit (`bb5bfc4cc`),test smartbi_db migration applied,16 unit + 4 e2e PASS。下一会话从 Day 6 起。

---

# 数据织网 Sub-Project C 实施 — 接续 Day 6

我是新 chat,接续之前 chat 完成的 B 整套 prod ship + C Day 1-5 起步。前 chat 已散场。

## 必读 (按顺序读, 不要跳)

请用 Read 工具按顺序读以下文件, **不要 paraphrase, 完整读取**:

1. `数据织网/04-C-字段血统与继承.md` v1.3 — **C spec 权威源** (~1500 行), 必须按它来
2. `数据织网/implementation/C-day6-blockers.md` — **Day 6 必先解决的 7 项 blocker** (audit 抓出 + Day 1-5 已修 2 项)
3. `数据织网/03-B-实体解析与形态路由.md` v1.2 — B spec (C 依赖 B 的 entity_id + writers + Sheet Merger)
4. `数据织网/02-A-能力驱动渲染.md` v1.6 — A 已 ship 状态 + 与 C 的契约接口 (Trust UI 需 update A's CapabilityCalculator?)
5. `数据织网/implementation/B-M2-smoke-gate-checklist.md` — B prod 灰度状态 (B prod live, C 还没 prod)
6. `backend/python/smartbi/canonical/provenance/__init__.py` — Day 1-5 已 ship 的 ProvenanceValue/write_provenance/read_authoritative_value
7. `backend/python/smartbi/canonical/provenance/types.py` — ProvenanceValue dataclass
8. `backend/python/smartbi/canonical/provenance/writer.py` — Day 1-5 实现 + Day 6+ TODOs (advisory_lock + valid_to filter)
9. `backend/python/smartbi/database/migrations/V20260430_01__c_field_provenance.sql` — 已 apply test only
10. `backend/python/smartbi/canonical/concurrency.py` — B 的 with_factory_serialization (C 复用 advisory_xact_lock 模式,但用 namespace 99 区分)
11. `backend/python/smartbi/canonical/silver_writers/base.py` — BaseWriter 是 C Day 6+ dual-write hook 接入点
12. `.claude/rules/concurrent-edit-safety.md` — **关键!** 多 chat 并发常态
13. `.claude/rules/server-operations.md` — **重大改动先 test 后 prod** + apply migration 流程
14. `CLAUDE.md` — 项目根 README (顶部 100 行了解架构)

## 当前状态 (你接手的起点 = C Day 6)

### 已 commit + push 到 origin/e2e/v1-framework

| Commit | 内容 | 状态 |
|---|---|---|
| `bb5bfc4cc` | C Day 1-5 — field_provenance schema + writer + types + 16 unit tests | test smartbi_db only |
| `a383b4610` | audit fix-pack — token leak + 4 provenance e2e + closed-loop happy-path pin + Day 6 blockers doc | test only (B 部分 prod live) |

### B 已 prod live (你不要碰)

B Sub-Project 完整 prod ship (Apr 26 ~7:35 PM NY):
- 9 migrations applied to test smartbi_db
- 7 migrations applied to prod smartbi_prod_db (V20260426_01..V20260429_01)
- Python service deployed with `SMARTBI_ENABLE_SHEET_MERGER=true` + `SMARTBI_ENABLE_B_WRITERS=true`
- Production flow: Bronze upload → field_definitions → run_silver_dual_write (legacy fact_pos_*) → run_sheet_merge (merge_*) → run_b_writers → route_upload → ProductSummary/Review/Finance/Inventory writers

C Sub-Project ALSO needs to wire into B writers (Day 6+ dual-write hook). When you do this, **don't break B** — gate behind a new env flag `SMARTBI_ENABLE_PROVENANCE=false` 默认 OFF until Day 6+ work is verified.

## C Day 6+ 路线图 (per spec §11 + roadmap)

| Day | 内容 | 复杂度 | 本会话 scope |
|---|---|---|---|
| 6-7 | **3 个 Day 6 blockers** (advisory_lock 内嵌 + valid_to 过滤 + 列扩展 migration) | SMALL | ✅ 必做先 |
| 8-12 | 冲突解决规则 + 30% diff threshold + factory_provenance_config 表 + admin_queue 'field_conflict' entity_type | MEDIUM | ✅ 主体 |
| 13-15 | 继承 cascade engine (BOM cost → sales gross profit) | MEDIUM | 中等优先级 |
| 16-22 | BF1-3 backfill 1.31M fact_pos_item 行 (~3 hr 后台) | LARGE (耗时但代码小) | 推荐 |
| 23-30 | Trust Indicator UI (Vue) + factory_provenance_config admin UI + RBAC | LARGE (frontend) | 一会话不够 |
| 31-32 | M3 7 项 smoke + ship C prod (BF4 cutover) | SMALL | 等所有 above ready |

**单会话现实 scope**: Day 6-7 (blockers) + Day 8-12 (conflict resolution + 30% diff + B writer dual-write hook) — ~3-5 hr 工作。Day 13-30 留下次会话。

## Day 6 必做 (per blockers doc)

### Blocker 1: write_provenance 必须内嵌 advisory_xact_lock

per spec C-3 / NS-3:
```python
import hashlib

async def write_provenance(conn, factory_id, entity_type, entity_id, field_name, ...):
    # 内嵌 lock — 防止 5 writers × N 开发者忘加
    lock_key = int(hashlib.md5(
        f"{factory_id}|{entity_type}|{entity_id}|{field_name}".encode()
    ).hexdigest()[:8], 16) % (2**31)
    await conn.execute("SELECT pg_advisory_xact_lock($1, $2)", 99, lock_key)
    # 然后 INSERT (caller 已在 transaction 内)
```

namespace `99` 区分 B 的 1-arg lock。

### Blocker 2: read_authoritative_value 必须过滤 valid_to

```python
where.append("(valid_to IS NULL OR valid_to >= $N)")
# as_of 默认 today (date.today())
```

### Blocker 3: Migration V20260501_01 加 3 列

```sql
ALTER TABLE field_provenance
    ADD COLUMN IF NOT EXISTS confidence_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS superseded_reason TEXT,
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);

-- backfill 现有行 (test smartbi_db 当前应该 0 行)
UPDATE field_provenance
   SET confidence_method = mapper_method  -- 兜底
 WHERE confidence_method IS NULL;

-- GRANT (mirrors V20260428_03 + V20260430_01 pattern)
-- 不需要,因为 ALTER TABLE 自动继承既有 GRANT
```

## Day 8-12 主体工作 (after blockers)

### 1. factory_provenance_config 表 (per spec §3.5 + Q1+Q2 user decisions)

```sql
CREATE TABLE factory_provenance_config (
    factory_id VARCHAR(50) PRIMARY KEY REFERENCES factories(factory_id) ON DELETE CASCADE,
    diff_threshold NUMERIC(4,4) NOT NULL DEFAULT 0.3000,  -- 30%
    priority_chain JSONB NOT NULL DEFAULT '["manual", "pos_excel_review", "pos_excel", "inferred", "industry_default"]'::jsonb,
    time_inheritance_window_days INT NOT NULL DEFAULT 7,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE factory_provenance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_provenance_config FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON factory_provenance_config
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
```

### 2. 冲突解决引擎 (per spec §3.2 + §3.3 + §3.4)

`smartbi/canonical/provenance/conflict_resolver.py`:
- `resolve_conflict(conn, factory_id, entity_type, entity_id, field_name) -> ProvenanceValue` (查 config + walk priority chain + supersede 旧行)
- `_get_factory_config(factory_id)` 5min TTL cache (复用 A 模式)
- `_compute_priority(value, config_chain)` 运行时 priority 数 (per spec C-6 — `source_priority` 列已删,运行时计算)
- 30% diff 自动入 admin queue ('field_conflict' entity_type 需先扩 V20260428_02 CHECK)

### 3. B Writer dual-write hook (5 writers)

每个 writer.write() 在 commit 前调:
```python
from smartbi.canonical.provenance import write_provenance

# 在 ProductSummaryWriter.write 中,resolve store/product 后:
await write_provenance(
    conn, factory_id=factory_id,
    entity_type="store", entity_id=store_id,
    field_name="brand_inferred",
    field_value=brand_value, confidence=resolve_confidence,
    source_type="pos_excel",
    mapper_method="rule",  # 或 "embedding" 或 "llm"
    source_upload_id=upload_id,
)
```

5 writers × ~3-5 fields 每 writer = ~20 hook 点。每个 writer 单独 commit 渐进。

**门控**: 加 env `SMARTBI_ENABLE_PROVENANCE=false` 默认 OFF,Day 6-7 验证后才开。

## 关键设计决策 (已落实,不再讨论)

| # | 决策 | 04-C spec 章节 |
|---|---|---|
| Q1 | 30% 阈值 factory-level 可配 (默认 30%, range 10-50%) | §3.5 |
| Q2 | 优先级链 factory-level 可配 (admin UI 重排) | §3.5 |
| Q3 | industry_default hardcode 27 品类 + factory override | §4.4 |
| Q4 | vacuum 用 Postgres autovacuum 默认 | §1.4 |
| Q5 | superseded 历史永久保留 (partial index 解性能) | §2.2 |
| C-1 | UNIQUE NULL 陷阱 → sentinel + COALESCE partial unique | §2.2 |
| C-2 | source_upload_id ON DELETE RESTRICT | §2.1 |
| C-3 | per-row advisory_xact_lock(99::int, hash::int) | §3.3 |
| C-4 | backfill_progress checkpoint 表 | §11.5 |
| C-6 | priority 持久化删除 → 运行时 JOIN config | §3.2 |
| C-7 | 30% diff 安全 (current=0/string/array 分别处理) | §3.3 |
| NC-1 | confidence NUMERIC(5,4) (允许 1.0) | §2.2 |

## 实施约束

1. **遵循 .claude/rules/** 全部规则 (concurrent-edit-safety + server-operations + database-entity-sync + python-services-architecture + CREDENTIAL-MANAGEMENT)

2. **DON'T BREAK B prod**:
   - B prod 服务 8083 在跑,Sheet Merger + b_writers env=true 启用
   - 加 provenance hook 时**默认 OFF** (`SMARTBI_ENABLE_PROVENANCE=false`)
   - test smartbi_db 验证 → 真灰度 → prod env flip

3. **subagent 并行策略**: 用 superpowers:subagent-driven-development skill 派 subagent。Day 6 blockers 1+2 可一个 subagent,blocker 3 (migration) 可独立或合并

4. **Commit 节奏**:
   - Day 6 blockers fix: 1 commit (writer + migration + test)
   - Day 8-9 conflict resolver: 1 commit
   - Day 10-12 dual-write hook (1 writer at a time): 5 commits
   - 每 commit 末跑 e2e on real PG (现成 fixture in test_data_fabric_e2e.py)

5. **每会话末必做**: superpowers:code-reviewer holistic audit + push origin

6. **Migration apply** 顺序 (test 先,prod M3 ship 时统一):
   - V20260501_01 (Day 6 blocker 3): 加 3 列
   - V20260501_02 (Day 8): factory_provenance_config 表
   - V20260501_03 (Day 8): admin_queue CHECK 加 'field_conflict' entity_type

## 第一步立即做

读完 14 个必读文件后, **立即执行**:

1. **验证 Day 1-5 状态** (你依赖):
   ```bash
   cd backend/python && python -m pytest tests/test_provenance.py 2>&1 | tail -3
   ```
   应输出 `16 passed` (或类似) — Day 1-5 单测仍通过。

2. **读 C-day6-blockers.md** 完整 — 7 项,Day 1-5 已修 2 项 (#6 e2e tests + #7 None valid_from bug),剩 5 项 (#1-3 GATING,#4-5 NIT)。

3. **派 subagent: Day 6 blockers fix**:
   - 修 writer.py: 内嵌 pg_advisory_xact_lock(99, hash)
   - 修 writer.py: read_authoritative_value 加 valid_to 过滤
   - 加 V20260501_01 migration: confidence_method + superseded_reason + created_by 列
   - 单测覆盖
   - 阶段 commit: `feat(数据织网 C): Day 6 blockers — advisory_lock + valid_to filter + columns`

4. **B prod 监控顺手** (可选,1 min):
   ```bash
   # 验证 B 服务还活着
   ssh root@47.100.235.168 "curl -fsS http://localhost:8083/health | head -1"

   # 看 24h 内 B 数据流
   ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_prod_db -c \
     \"SELECT merge_status, COUNT(*) FROM smart_bi_pg_excel_uploads \
       WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY 1;\""
   ```
   非阻塞,如发现异常告知 user。

## 与用户的沟通

- 用 **简短中文** 报告进度,不要长 markdown
- 关键 milestone 暂停问 user (Day 6 blockers ready / Day 12 dual-write hook ready / Day 22 backfill complete / Day 30 ship prod 前)
- spec 有疑问立即问,不假设
- prod 改动前必须 user 明确同意 (`server-operations.md` 强制 test 先行)

## 不要做的事

- ❌ 不要重写 spec — 04-C v1.3 是权威源
- ❌ 不要修 B prod live 代码 (除非真 bug + user 确认)
- ❌ 不要在 prod 上做未测试的改动
- ❌ 不要 push 到 origin — 等 user 明确说 "push" 才推
- ❌ 不要重做 Day 1-5 工作 (已 commit + 已 apply test smartbi_db)
- ❌ 不要"顺便修" B 残留 follow-up (full conn-passing refactor 仍 deferred,本会话不做)
- ❌ 不要做 04-C spec out-of-scope 的事 (D 联邦查询是 D 范围)

## 推荐节奏

- **第 1 hr** Day 6 blockers (3 项) + V20260501_01 apply test smartbi_db
- **第 2 hr** factory_provenance_config 表 (V20260501_02) + 冲突解决引擎核心 (3.2/3.3/3.4)
- **第 3-4 hr** B writer dual-write hook (5 writers,渐进 commit)
- **第 5 hr** spec + code review + commit + push (会话末 superpowers audit)

总 4-5 hr,完成 Day 6-12 (~spec 6 天工作量)。Day 13+ 留下次会话。

## 紧急联络 / 与 B chat 协调

B 已 prod live,B chat 散场。如果你:
- 改 B writers (provenance dual-write hook) → 加门控 env flag `SMARTBI_ENABLE_PROVENANCE=false` 默认 OFF + 在 test 验证 → 渐进灰度
- 改 entity_resolution / shape_router / sheet_merger → 不应,C 不动 B 这些核心
- 看 B prod observation log → ssh root@47.100.235.168 "tail /var/log/cretas-python.log" (read-only OK)

如果 B prod 抓出 bug:
- Hotfix in this chat OK (你在做 C 但 B bug 紧急修也合理)
- Memory 要更,标 "C chat hotfixed B bug ..."

---

**现在请开始**: 读完 14 个必读文件,然后立即执行"第一步立即做"的 4 个步骤 (verify Day 1-5 + 读 blockers doc + 派 subagent + B prod 监控可选)。
