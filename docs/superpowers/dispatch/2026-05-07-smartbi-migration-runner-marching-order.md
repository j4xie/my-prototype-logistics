# ⚡ IMMEDIATE — smartbi migration auto-runner (Phase A → D)

**From**: organizer chat (Phase 2A T6 cutover)
**Date**: 2026-05-06
**Spec ref**: `docs/superpowers/specs/2026-05-07-smartbi-migration-runner-spec.md`
**Trigger**: Task #30 事故 (8 个 data fabric C 系列 migrations prod 漏跑,T6.2 canary 4h 才发现)
**Block**: T6.4 100% factories cutover (硬要求,不阻塞 T6.2/T6.3 但**应该** T6.3 GO 之前完成 Phase A+B+C)
**Parallel with**: task #29 sister chat (uvicorn workers PR-1) — 唯一交集是 `deploy-smartbi-python.sh`,先到先服务,后到 rebase

---

## 你的任务

按 spec 实施 4 个 PR (按顺序),每 phase done 后 ping organizer 决定是否进下个。

最终 deliverable:
1. `smartbi_migrations` tracking 表 in 两个 smartbi 数据库
2. `scripts/migrations/apply-smartbi-migrations.sh` runner script
3. `scripts/deploy/deploy-smartbi-python.sh` 加 Step 3.5 自动跑
4. `.claude/rules/server-operations.md` 加 hard rule + memory entry

---

## Step 0 — Worktree 隔离 (强制)

```bash
cd C:\Users\Steve\my-prototype-logistics
git fetch origin
git worktree add .worktrees/smartbi-migration-runner -b ops-smartbi-migration-runner origin/main
cd .worktrees/smartbi-migration-runner
pwd
git branch --show-current
```

---

## Step 1 — 阅读

- `docs/superpowers/specs/2026-05-07-smartbi-migration-runner-spec.md` 全篇 (核心设计)
- 内存 `reference_smartbi_prod_db_migration_gap.md` (task #30 事故经过)
- `scripts/deploy/deploy-smartbi-python.sh` 现状 (要改 Step 3.5)
- `backend/python/smartbi/database/migrations/V20260430_01__c_field_provenance.sql` (sample migration 文件了解 convention)

---

## PR-A: Tracker 表 + backfill

### A.1 创建 bootstrap migration

写 `backend/python/smartbi/database/migrations/V20260507_01__smartbi_migrations_tracker.sql`:

```sql
-- Bootstrap: 创建 smartbi_migrations 跟踪表本身
-- 这个 migration 是 chicken-and-egg case — runner 需要这表才能跑,所以
-- 部署 script 在跑 runner 之前先 psql -f 这个文件一次。
-- 之后这文件 will be marked as applied via INSERT ON CONFLICT,正常 idempotent。

CREATE TABLE IF NOT EXISTS smartbi_migrations (
    version VARCHAR(100) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by VARCHAR(100) DEFAULT current_user,
    duration_ms INT
);

CREATE INDEX IF NOT EXISTS idx_smartbi_migrations_applied_at
    ON smartbi_migrations(applied_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON smartbi_migrations TO smartbi_user;

-- Rollback: DROP TABLE IF EXISTS smartbi_migrations;
```

### A.2 写 backfill 脚本

`scripts/migrations/backfill-applied.sh`:

```bash
#!/usr/bin/env bash
# 一次性脚本: mark 当前已 applied 的 V 前缀 migrations 进 tracker。
# Usage: backfill-applied.sh <test|prod>

set -euo pipefail
ENV="${1:-}"
case "$ENV" in
  test) DB=smartbi_db ;;
  prod) DB=smartbi_prod_db ;;
  *) echo "Usage: $0 <test|prod>"; exit 2 ;;
esac

MIGS_DIR=/www/wwwroot/cretas/code/backend/python/smartbi/database/migrations
count=0
for f in $MIGS_DIR/V*.sql; do
    [ -f "$f" ] || continue
    fname=$(basename "$f")
    ver=$(echo "$fname" | grep -oE '^V[0-9]+_[0-9]+')
    [ -n "$ver" ] || { echo "skip $fname (无法解析 version)"; continue; }
    checksum=$(sha256sum "$f" | cut -d' ' -f1)
    sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -c "
        INSERT INTO smartbi_migrations (version, filename, checksum, applied_by)
        VALUES ('$ver', '$fname', '$checksum', 'backfill-2026-05-07')
        ON CONFLICT (version) DO NOTHING
    " >/dev/null
    count=$((count + 1))
done
echo "[backfill] env=$ENV recorded $count V-prefix migrations"
```

### A.3 应用 + verify

1. 先 deploy bootstrap migration to test:
   ```bash
   ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -f /www/wwwroot/cretas/code/backend/python/smartbi/database/migrations/V20260507_01__smartbi_migrations_tracker.sql"
   ssh root@47.100.235.168 "bash /www/wwwroot/cretas/code/scripts/migrations/backfill-applied.sh test"
   ssh root@47.100.235.168 "sudo -u postgres psql -d smartbi_db -tAc 'SELECT version, applied_at FROM smartbi_migrations ORDER BY version'"
   ```
2. Verify ~50+ V 前缀 entries (count `ls backend/python/smartbi/database/migrations/V*.sql | wc -l`)
3. Prod 同样 (但**先 ping organizer 确认** 再动 prod)
4. ⚠️ Prod 应用前先 backup 已经存在 (今晨 03:00 daily backup 覆盖)

### A.4 Commit + ping

```bash
git add backend/python/smartbi/database/migrations/V20260507_01__smartbi_migrations_tracker.sql scripts/migrations/backfill-applied.sh
git status --short  # ← 验证只这两个文件
git commit -- backend/python/smartbi/database/migrations/V20260507_01__smartbi_migrations_tracker.sql scripts/migrations/backfill-applied.sh \
  -m "feat(migrations): smartbi_migrations tracker table + backfill script"
git push -u origin ops-smartbi-migration-runner
gh pr create --title "PR-A: smartbi migrations tracker + backfill" \
  --body "Phase A of migration runner spec. Adds tracking table + one-time backfill of existing V-prefix migrations as already-applied."
```

Ping: `PR-A done, PR <URL>. Test env tracker has N entries. Awaiting GO for prod backfill.`

---

## PR-B: Runner script

### B.1 写 `scripts/migrations/apply-smartbi-migrations.sh`

详细设计见 spec §3.4 + §3.6。关键点:

- bash + psql,不用 Python 避免循环依赖
- Per migration: 单 transaction (`BEGIN; ...; INSERT INTO smartbi_migrations; COMMIT;`)
- Sort by `ls V*.sql | sort` (字典序)
- 已 applied 的 SELECT version 命中,checksum 对照 → 一致 skip / 不一致 fail loud
- `--dry-run`: 用 `BEGIN; ... ROLLBACK;`
- `--target VERSION`: 处理到此 version 即停
- `set -euo pipefail` + `ON_ERROR_STOP=1`
- 退出码 0/1/2 per spec

### B.2 单元测试 (用临时 docker postgres)

`scripts/migrations/test-runner.sh`:

```bash
#!/usr/bin/env bash
# 起 docker postgres,跑 6 个测试 case:
# 1. 全 fresh (无 tracker 表) → bootstrap + apply 全部
# 2. 已 backfill,运行 → 全 skip
# 3. 加新 V20260601_01__test.sql → apply 1 个
# 4. 改已 applied 的文件 → checksum mismatch fail
# 5. 故意 broken SQL → tx rollback,tracker 不更新
# 6. --dry-run → 不写表,但检查能 detect 新 migration
```

每 case PASS 显示 `OK`,FAIL 显示 `FAIL: reason`。所有 PASS 才进 PR-C。

### B.3 Commit + ping

PR-B 含 runner script + 测试 script + sample fixtures (如有)。Ping organizer 看测试 output。

---

## PR-C: Deploy hook

### C.1 改 `scripts/deploy/deploy-smartbi-python.sh`

在 Step 3 之后插入 Step 3.5:

```bash
# Step 3.5: Apply pending smartbi migrations (per spec 2026-05-07)
if [[ "$SKIP_MIGRATIONS" != "1" ]]; then
    echo "[$(date '+%H:%M:%S')] [deploy] applying pending migrations to env=$ENV"
    if ! ssh root@$SERVER bash /www/wwwroot/cretas/code/scripts/migrations/apply-smartbi-migrations.sh --env $ENV; then
        echo "[$(date '+%H:%M:%S')] [deploy] migration FAILED — Python service NOT restarted, ABORTING"
        exit 1
    fi
else
    echo "[$(date '+%H:%M:%S')] [deploy] SKIP_MIGRATIONS=1 set, skipping migrations"
fi
```

`SKIP_MIGRATIONS` env 是 escape hatch (避免 deploy 时本身有问题,例如 runner 脚本 bug,可以临时跳过)。

### C.2 Verify on test env

```bash
./scripts/deploy/deploy-smartbi-python.sh --env test
# 看 deploy log 应输出:
#   [deploy] applying pending migrations to env=test
#   [migrations] target env=test, db=smartbi_db
#   [migrations] all up-to-date
```

### C.3 Add a test migration to verify auto-apply

写 `backend/python/smartbi/database/migrations/V20260507_02__test_runner.sql`:

```sql
-- Smoke test for runner. No-op idempotent.
-- 验证 deploy hook 真的能发现新 migration 并应用。
SELECT 1 AS runner_test;
```

Deploy test env 一次,verify deploy log:
```
[migrations] applying V20260507_02__test_runner.sql ...
[migrations] V20260507_02 applied in <N>ms
```

Tracker 表里有 V20260507_02 行 → SUCCESS。

### C.4 ⚠️ Coordinate with task #29 sister chat

`scripts/deploy/deploy-smartbi-python.sh` 也是 task #29 sister chat 可能动的文件 (PR-3 prod cutover 时改 systemd ExecStart 会附带改 deploy script?其实不会,他们改的是 systemd service 文件)。但**先 git fetch + verify** 再 push,如有 conflict trivial rebase。

### C.5 Commit + ping

PR-C done 后 ping organizer 验证 deploy test env smoke success。

---

## PR-D: 文档化

### D.1 `.claude/rules/server-operations.md` 加 hard rule

新增 section "## Smartbi 数据库 schema 变更":

```markdown
## Smartbi 数据库 schema 变更

**所有** smartbi 数据库 schema 变更**必须**:
1. 写 `backend/python/smartbi/database/migrations/V<YYYYMMDD>_<NN>__<description>.sql`
2. 部署通过 `./scripts/deploy/deploy-smartbi-python.sh --env <env>` 自动 apply

**禁止** 手动 ssh + psql 直接跑 DDL (除非紧急 hotfix,完后立即:
1. 把 SQL 落 V*.sql 文件
2. 手动 INSERT 进 smartbi_migrations tracker (per spec §3.8 escape hatch)

如果 schema 在 prod / test 之间出现 drift (本期 task #30 事故),立即:
1. `comm -23 <(test schema) <(prod schema)` 找差异
2. 单一 transaction (BEGIN; ALL; COMMIT;) apply 缺失 migrations 到落后的 env
3. Backfill tracker 表
```

### D.2 写 memory `reference_smartbi_migration_runner.md`

简短 memory:
- Title + description
- 引用 spec 路径
- CLI 用法摘要
- 5 个 known operating procedure (deploy / dry-run / target / manual escape / backfill)

### D.3 Update MEMORY.md index

加一行指向新 reference memory。

### D.4 Commit + ping

PR-D done 后 task #31 整体 close,organizer 验证 task #30 follow-up 收尾。

---

## 风险 + Stop-and-ping

| 触发条件 | Action |
|---|---|
| Backfill 时发现 prod schema 跟 test 不一致 | **STOP** ping organizer,说明哪几个表/列差异 |
| Runner script 单元测试有 case fail | **STOP** ping organizer,贴 test output |
| Deploy hook 跑测试 env 时 abort 错误 | **STOP** ping organizer,贴 deploy log |
| 任何 prod 受影响信号 (除非 PR-A 已批准 prod 应用) | **STOP** 立即 ping |
| Migration tracker 表 already exists 跟 spec 设计不一致 (sb 之前已建过) | **STOP** verify schema,可能要调整 |

---

## ⛔ 禁止事项 (in scope)

1. **不动** Java Flyway (`backend/java/.../db/migration/`)
2. **不动** Python startup 代码 (main.py lifespan)
3. **不引入** alembic / Sequel Pro / 其他外部 migration 框架
4. **不在主 worktree** 工作 (强制 `.worktrees/smartbi-migration-runner/`)
5. **不并行 4 phase** — 顺序 PR-A → PR-B → PR-C → PR-D,每 phase ping organizer 确认才进下个
6. **不 prod backfill / deploy hook prod test** 没有 organizer GO

---

## Resumption checklist (中断后接手)

- [ ] `cd .worktrees/smartbi-migration-runner && pwd` 确认路径
- [ ] `git status` + `git log --oneline -5` 看进度
- [ ] `gh pr list --head ops-smartbi-migration-runner` 看 PR 状态
- [ ] 决定从哪个 phase 接手
