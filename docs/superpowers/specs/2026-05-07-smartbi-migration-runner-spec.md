# SmartBI Migration Runner — Spec

**Author**: Phase 2A T6 organizer chat
**Date**: 2026-05-06
**Trigger**: Task #30 — `field_provenance` 表 prod 缺失,8 个 data fabric C 系列 migrations 当初部署漏跑,T6.2 canary 4h 才发现 (9 errors / 5698 hits)
**Memory ref**: `reference_smartbi_prod_db_migration_gap.md`

---

## 1. 背景

### 1.1 当前状态 (broken)

`backend/python/smartbi/database/migrations/` 目录有 **56 个 SQL files**,**无自动化 runner**:
- Java Flyway (`backend/java/cretas-api/src/main/resources/db/migration/`) 范围只是 cretas_prod_db,**不接管** smartbi 目录
- Python startup (`main.py` lifespan) 不应用 migrations,只调 `test_connection()`
- 部署 script `scripts/deploy/deploy-smartbi-python.sh` 只 rsync 代码 + 重启服务,不跑 SQL
- 实际操作: 开发者手动 `ssh + psql -f` 应用,容易漏

### 1.2 Task #30 事故经过

数据织网 Sub-Project C (Apr 30 - May 2 2026) 落地 8 个 migrations:
- 4 张表 (`field_provenance` / `factory_provenance_config` / `backfill_progress` / `restaurant_etl_failures`)
- 5 个 ALTER (extension columns / check constraints / column widen / sentinel row)

Test env (smartbi_db) 当时手动 apply 了。Prod (smartbi_prod_db) **漏跑**。

T6.2 canary 早晨监控日志发现 9 errors / 5698 hits (0.158%) — 全部来自 `/api/smartbi/gold/top-products` LEFT JOIN `field_provenance` 的 `UndefinedTableError` 500。User-facing 端点 graceful fallback 200 OK,但内部数据 trust indicators 在 prod 一直缺失。

2026-05-06 06:38 CST 单一 BEGIN/COMMIT 应用 8 migrations to smartbi_prod_db,schema parity restored,0 errors post-fix。

### 1.3 为何会再发生

每个新 sub-project 加 SQL 都要开发者**记得**:
- 同时跑 test + prod
- 跑顺序对
- 失败时回滚

没有 enforce 机制 → 必然偶尔漏。

---

## 2. Goals + Non-Goals

### Goals

1. **Zero drift** between smartbi_db (test) 和 smartbi_prod_db (prod) schema
2. **Idempotent**: 重复跑不重复执行已应用 migrations
3. **Observable**: 部署日志看到 "applied N migrations" 或 "all up-to-date"
4. **Atomic**: 一个 migration 失败 → tx rollback + deploy 中断
5. **Discoverable**: 任何人 `ls + grep` 就知道哪些 applied
6. **Backwards compat**: 紧急 `psql -f` manual apply 仍 work,跟 runner 不冲突

### Non-goals

- 不改 Java Flyway (cretas_prod_db migrations 仍走原路径)
- 不引入 alembic / Sequel Pro / 其他外部 migration framework (over-engineering)
- 不在 Python startup 时跑 (避免 multi-worker race + 启动慢)
- 不做 down migration (回滚靠 SQL 文件末尾的 rollback comment 段,手动)
- 不做跨数据库 migration (smartbi 跟 cretas 各自管自己)

---

## 3. Design

### 3.1 Approach: Deploy hook + tracking table

部署时机: **`deploy-smartbi-python.sh` Step 3.5** (after rsync code, before restart Python service)。

```
deploy-smartbi-python.sh flow:
  Step 1: pre-deploy backup
  Step 2: rsync code
  Step 3: rsync scripts/  (already added per task #23)
  Step 3.5: 【新】 apply pending migrations  ← 本 spec 新增
  Step 4: restart cretas-python
  Step 5: smoke test
```

部署后 Python restart 前 schema 已就绪,避免 Python startup 时打 missing-table 错。

### 3.2 Tracking 表 schema

新建表 `smartbi_migrations` in **每个** smartbi 数据库 (smartbi_db + smartbi_prod_db):

```sql
CREATE TABLE IF NOT EXISTS smartbi_migrations (
    filename VARCHAR(255) PRIMARY KEY,
    version VARCHAR(100) NOT NULL,
    checksum CHAR(64) NOT NULL,            -- SHA-256 of file content (catches accidental edits to applied migrations)
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by VARCHAR(100) DEFAULT current_user,
    duration_ms INT
);

CREATE INDEX IF NOT EXISTS idx_smartbi_migrations_applied_at ON smartbi_migrations(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_smartbi_migrations_version ON smartbi_migrations(version);
```

**Why filename PK (not version PK)**: PR-A impl found `V20260427_01` is already used by **two unrelated files** in the existing codebase: `V20260427_01__chat_session_v3_history.sql` (smartbi v3 multi-turn) and `V20260427_01__extend_admin_queue_entity_types.sql` (data fabric B Day 5). With version PK, the second file's `INSERT ... ON CONFLICT (version) DO NOTHING` silently skips during backfill — and the runner later tries to RE-APPLY it (DDL already-exists error). filename PK keeps both as distinct rows. version becomes a regular column with secondary index for lookups. Future dupes auto-handled. Decision pinned in PR-A `c986425a6` (#98).

**Why checksum**: 若开发者改了已应用的 migration 文件 (常见错误,以为"还没 apply 我改一下"),runner 启动时 hash mismatch → fail loud。

### 3.3 Migration 文件命名 convention (现状已 OK)

```
V<YYYYMMDD>_<NN>__<description>.sql
```

Examples (已存在):
- `V20260430_01__c_field_provenance.sql`
- `V20260501_01__c_provenance_columns_extension.sql`

**Sort order**: 字典序 (V20260430_01 < V20260430_02 < V20260501_01...) — 同 Flyway 标准,无歧义。

**Legacy 文件 (非 V 前缀)** in 现有 56 个文件中:
- `2026_04_22_tenant_rls_smoke.sql`, `20260408_restaurant_reviews.sql`, `create_dashboard_layouts.sql` 等

这些已应用 baseline,**不让 runner 管**。**只让 runner 管 V 前缀**。

### 3.4 Apply 算法 (per migration file)

```
for file in sorted(glob("V*.sql")):
    filename = basename(file)              # "V20260430_01__c_field_provenance.sql"
    version = parse_version(filename)      # "V20260430_01"
    checksum = sha256(file_content)

    # Lookup by filename (PR-A switched PK from version → filename, see §3.2)
    existing = SELECT checksum FROM smartbi_migrations WHERE filename = $1
    if existing:
        if existing != checksum:
            FAIL: "Migration $filename checksum mismatch (applied with different content)"
        else:
            continue (skip)
    else:
        BEGIN TX
            execute file content
            INSERT INTO smartbi_migrations (filename, version, checksum)
                VALUES ($1, $2, $3)
        COMMIT TX
        # duration_ms recorded post-commit via separate UPDATE (wall-clock, best-effort).
```

PR-B `ee1077f30` (#100) impl note: psql exits 3 on `ON_ERROR_STOP` (SQL error). Spec §3.6 demands SQL error → exit 1, so impl captures via `psql ... <<EOF || apply_status=$?` and converts to `return 1`. Caught during initial test-runner.sh execution (Test 5 failed as exit 3, fixed inline).

**Concurrency**: 部署期间不会有第二个 deploy 同时跑 (deploy 是手动触发 + lockfile)。runtime 不在 Python startup 跑,所以无 multi-worker race。

### 3.5 Backfill (one-time)

对每个 env (test + prod),把当前**已存在** schema 的 V 前缀 migrations mark 为 already-applied,避免 runner 第一次跑想重新执行:

```bash
# 一次性脚本: scripts/migrations/backfill-applied.sh
for f in backend/python/smartbi/database/migrations/V*.sql; do
    fname=$(basename $f)                                    # "V20260430_01__c_field_provenance.sql"
    ver=$(echo "$fname" | grep -oE '^V[0-9]+_[0-9]+')       # "V20260430_01"
    checksum=$(sha256sum $f | cut -d' ' -f1)
    psql -d $DB -c "INSERT INTO smartbi_migrations (filename, version, checksum, applied_by)
                    VALUES ('$fname', '$ver', '$checksum', 'backfill-2026-05-07')
                    ON CONFLICT (filename) DO NOTHING"
done
```

PR-A backfill processed **34 V-prefix files** in each env (33 historic + bootstrap V20260507_01).
V20260427_01 dupe correctly recorded as 2 separate filename rows (per §3.2 filename PK rationale).

⚠️ Backfill 只在**已确认 schema 已正确**的 env 跑。Test env 已确认 OK (73 表,跟 prod 现在 parity 后一致)。Prod env 在 task #30 应用 8 migrations 后也 parity OK,可以 backfill。

### 3.6 CLI

新建 `scripts/migrations/apply-smartbi-migrations.sh`:

```bash
Usage:
  apply-smartbi-migrations.sh --env <test|prod|all> [--dry-run] [--target VERSION]

Options:
  --env       Target environment (test=smartbi_db, prod=smartbi_prod_db)
  --dry-run   Show what would apply but don't execute (BEGIN; ... ROLLBACK;)
  --target    Apply up to this version (inclusive). Default: all pending.

Exit code:
  0 — all up-to-date or all applied successfully
  1 — checksum mismatch / SQL error / DB unreachable
  2 — usage error

Output:
  [migrations] target env=prod, db=smartbi_prod_db
  [migrations] discovered 8 V-prefix files
  [migrations] applied: 8 / 8 already in tracker, skipping
  [migrations] all up-to-date

OR:
  [migrations] target env=test, db=smartbi_db
  [migrations] discovered 9 V-prefix files (1 new)
  [migrations] applying V20260507_01__new_thing.sql ...
  [migrations] V20260507_01 applied in 234ms
  [migrations] applied: 1, skipped: 8
```

### 3.7 Deploy hook integration

`scripts/deploy/deploy-smartbi-python.sh` 改动 (在 Step 3 后插入):

```bash
# Step 3.5: Apply pending smartbi migrations (per spec 2026-05-07)
echo "[deploy] applying pending migrations to env=$ENV"
ssh root@$SERVER bash /www/wwwroot/cretas/code/scripts/migrations/apply-smartbi-migrations.sh --env $ENV
if [ $? -ne 0 ]; then
    echo "[deploy] migration failed, ABORTING (Python service NOT restarted)"
    exit 1
fi
```

**Critical**: 失败时**不**继续重启 Python — 让旧 schema + 旧代码继续跑,人工介入修。

### 3.8 Manual escape hatch (compatibility)

紧急情况 (e.g., 半夜 prod down 需要立刻 apply 一个 hotfix migration):

```bash
# Step 1: 直接 psql apply
ssh root@server "sudo -u postgres psql -d smartbi_prod_db -f hotfix.sql"

# Step 2: 手动 record into tracking table (filename PK per §3.2)
ssh root@server "sudo -u postgres psql -d smartbi_prod_db -c \"
    INSERT INTO smartbi_migrations (filename, version, checksum, applied_by)
    VALUES ('V20260507_99__hotfix.sql', 'V20260507_99', '$(sha256sum hotfix.sql | cut -d' ' -f1)', 'manual-emergency')
    ON CONFLICT (filename) DO NOTHING
\""
```

下次 deploy 跑 runner 时会发现 tracker 里有,跳过。

**Alternative escape**: `SKIP_MIGRATIONS=1 ./scripts/deploy/deploy-smartbi-python.sh --env prod` bypasses the entire Step 3.5 (use only when the runner itself is broken).

---

## 4. Implementation phases

### Phase A: Tracking 表 + backfill (PR-A)

1. 写 `V20260507_01__smartbi_migrations_tracker.sql` (the bootstrap migration creating the tracker table itself)
   - 注意 chicken-and-egg: 这个文件**不能**靠 runner apply,要 deploy script 直接 psql 应用一次
2. 写 `scripts/migrations/backfill-applied.sh`
3. Test env 应用 V20260507_01 + backfill,验证 tracker 表里有 ~8 V 前缀 entries
4. Prod env 同样
5. Verify schema diff prod vs test 仍 parity

### Phase B: Runner script (PR-B)

1. 写 `scripts/migrations/apply-smartbi-migrations.sh` (~150 行 bash)
2. 单元测试:
   - dry-run 模式 verify 不写
   - 已 applied 的 skip
   - 新 migration apply + tracker 更新
   - checksum mismatch fail
   - SQL 错误 transaction rollback + tracker 不更新
   - 测试用 docker postgres 隔离
3. 文档化 in `.claude/rules/server-operations.md`

### Phase C: Deploy hook (PR-C)

1. 改 `scripts/deploy/deploy-smartbi-python.sh` 加 Step 3.5
2. 部 test env 一次,verify deploy log 输出 "all up-to-date"
3. 加新 migration `V20260508_01__test_runner.sql` (空 SQL + verify),deploy 验证 runner 真的应用了
4. 部 prod env 同样验证

### Phase D: 文档化 + memory (PR-D)

1. 加 hard rule to `.claude/rules/server-operations.md`:
   > 所有 smartbi 数据库 schema 变更**必须**走 `backend/python/smartbi/database/migrations/V*.sql` + 跑 `apply-smartbi-migrations.sh`,**不能**手动 psql -f 跑 schema DDL (除紧急 hotfix,完后立即补 tracker entry)
2. 写 memory `reference_smartbi_migration_runner.md`
3. 更新 `feedback_default_test_only_deploy.md` 之类 deploy 流程 rule 引用新 hook

---

## 5. 风险 + 缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Backfill 漏 mark 已 applied 的 migration | runner 第一次跑会 try re-apply → ALTER 失败 | Phase A backfill 脚本 sha256 全文件,跟 schema diff 对照过确认 |
| Checksum 算法不一致 | 文件 LF/CRLF 转换误 trigger mismatch | 强制 LF (gitattributes),sha256 用 utf-8 binary read |
| Multi-server deploy 并发 | 不会发生 (deploy 是单点 ssh + lockfile) | N/A |
| Runner script bug 一次部署 fail | deploy 中断,人工介入 apply | dry-run 模式 + Phase B 单元测试 |
| Python startup 时遇到 schema 缺失 | deploy 失败时 startup 报错 → systemd Restart=always 死循环 | deploy hook 失败**不**重启 Python,旧服务继续跑 |
| 紧急 hotfix manual psql + 忘记 record tracker | 下次 runner 想 re-apply | doc 强调 + escape hatch 流程清楚 |

---

## 6. Out of scope

- Cross-database migration coordination (cretas_prod_db Java Flyway 仍独立)
- Down migration runner (回滚仍手动)
- 时间机器 / branch-aware migration (e.g. apply only to specific branch)
- Sealing 已应用 migration 文件让其只读 (gitattributes-based?  暂不做)

---

## 7. Success criteria

- [ ] 跨 test/prod schema 一致 (`comm -23` 输出空)
- [ ] `apply-smartbi-migrations.sh --dry-run --env prod` 1 周后仍输出 "all up-to-date" (没有手动绕过)
- [ ] 下个新 sub-project 加 migration 时 deploy 自动应用,**零**人工干预
- [ ] T6.3+ 不再因为 schema drift 出现 prod-only error

---

## 8. Resumption checklist (sister chat 接手)

- [ ] Read 这份 spec + `reference_smartbi_prod_db_migration_gap.md`
- [ ] 在 `.worktrees/smartbi-migration-runner/` 起 branch `ops-smartbi-migration-runner`
- [ ] Phase A: tracker 表 + backfill (PR-A)
- [ ] Phase B: runner script + 单元测试 (PR-B)
- [ ] Phase C: deploy hook (PR-C)
- [ ] Phase D: 文档 + memory (PR-D)
- [ ] 完成后 ping organizer 验证 + close task #30 follow-up

---

## 9. Coordination notes

- 此 spec **不阻塞** T6.2/T6.3 cutover。但**应该** T6.3 GO 之前完成 Phase A+B+C,避免 T6.4 (100% factories) 时再发生 schema drift 事故。
- Sister chat 与 uvicorn-workers (PR-1) sister chat 可以**并行**,两份 plan 互不冲突。
- 有冲突的话 (e.g. 两边都改 `deploy-smartbi-python.sh`) → 先到先服务,后到 rebase。
