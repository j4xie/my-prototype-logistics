# Canvas E2E Delivery Round D1 — Plan

**日期**: 2026-04-15 (post R5 commit `f90650e77`, skill-v3 commit `825b70dba`)
**前置**: R1-R5 test framework 已闭环, PR #6 已开. 本轮处理生产交付 + R6 backlog.
**类型**: Delivery Round (not a test round) — 按新加的 depth-first-e2e Rule 10 执行

---

## D1 scope

### D1-1: PR #6 审查流程 (human-owned, Claude supports)

- **Status**: OPEN, base=main, head=e2e/v1-framework
- **Link**: https://github.com/j4xie/my-prototype-logistics/pull/6
- **53 commits** (mixed canvas R1-R5 + e2e-comprehensive R5-R17 + skill evolution + various fixes)
- **Review strategy决定** (用户选择):
  - Option A: Review & merge whole (简单, review 负担大)
  - Option B: 要求 chat A + chat B 各自拆 sub-PR (lead time 长, 但 review quality 高)
  - Option C: Just merge (trust the history, low risk given branch has merged before)

**Claude 能做**: 回应 review comments, 修 reviewer 发现的问题, 重新 run E2E 如果 review 要求.
**Claude 不能做**: 代替 user 决定 review strategy, 代替 reviewer approve.

### D1-2: 生产部署 canvas R1-R5 fixes (high priority — bugs are live)

**Backend 改动 summary** (所有 R1-R5 累积):
- `DynamicFieldController.java` — verifyParentOwnership on sub-table + custom-fields endpoints
- `DynamicFieldService.java` — `@Transactional` on setDynamicFields + parent_id type-aware helpers
- `DynamicTableService.java` — `@Transactional` on addRow/updateRow/deleteRow + type-aware parent_id cast
- `DDLExecutor.java` — new sub-tables use parent table's id type for parent_id column

**部署步骤** (执行时按此顺序):
1. Confirm PR #6 is reviewed + approved (blocker)
2. Merge PR #6 to main
3. Production deploy: `bash scripts/deploy/deploy-backend.sh --env prod`
4. Health check: `curl http://localhost:10010/api/mobile/health` (via prod SSH tunnel if needed)
5. Smoke test: manually trigger one sub-table POST against a real prod sales_order to verify fix works for VARCHAR-id parents
6. Monitor logs for 30 min: `ssh root@47.100.235.168 "tail -f /www/wwwroot/cretas/cretas-prod.log"`
7. Rollback plan: `ssh root@47.100.235.168 "cd /www/wwwroot/cretas && cp aims-0.0.1-SNAPSHOT.jar.bak.<prev> aims-0.0.1-SNAPSHOT.jar && systemctl restart cretas-backend"`

**Owner**: User / DevOps
**Timeline**: post-PR-merge, during low-traffic window
**Risk**: LOW (fixes are scoped, test env has 3 independent 91/91 runs, 8 service callers audited by R5-② Critic)
**Rollback trigger**: any of — deploy health check fail, smoke test fail, error rate spike in 30 min

### D1-3: R6 backlog tickets (convert markdown → tracked tickets)

当前 backlog 仅存在于 `tests/canvas-security-e2e/EVIDENCE.md §14/§15` 和 R5 audit doc. 这违反 Rule 10.4 (tickets not markdown bullets). 需要:

**Ticket 1**: AggregateFormulaExecutor UUID cast fix
- **Source**: R4/R5 backlog item #1
- **File**: `backend/.../engine/AggregateFormulaExecutor.java:87-91, 142-146`
- **Work**: (a) build aggregate formula deep test harness (1-2 天), (b) apply same type-aware parent_id pattern as R4 fix (30 min)
- **Blocker**: harness must exist before fix can be verified
- **P0** because customer-facing aggregate formulas on VARCHAR-id parent tables currently throw HTTP 500

**Ticket 2**: `setDynamicFields setClauses.isEmpty()` Option B 实施
- **Source**: R5 ADR-1 in EVIDENCE.md §14
- **File**: `backend/.../engine/DynamicFieldService.java:204-237`
- **Work**: (a) 8-caller audit (MaterialBatchServiceImpl / ProductionPlanServiceImpl / SalesServiceImpl / etc., 1 天), (b) 实施 throw BusinessException, (c) feature flag `cretas.canvas.strict-field-validation` + grace period
- **P1** breaking change, needs careful rollout

**Ticket 3**: 生产 sub-table orphan back-migration
- **Source**: R5 ADR-2 in EVIDENCE.md §15
- **Target**: prod `sales_order_prepayment_records_items` — 2 orphan UUID-parent_id rows
- **SQL**: 已写 (EVIDENCE.md §15, Option C: clean + ALTER)
- **Blocker**: DBA maintenance window
- **P2** data cleanup, not customer-blocking (sub-table already unusable)

**Action**: 用户 / PM 把这 3 条转成 GitHub Issues 或 Linear tickets. Claude 可以起草 issue body 如果需要.

### D1-4: CI integration (lower priority but Rule 10.5 requires status)

**Current state**: canvas-security-e2e 套件手动触发 (`bash tests/canvas-security-e2e/run-all.sh`), 需要 SSH tunnel + E2E_WEB_URL + test env 后端. 不在 CI.

**3 options**:
- **Option A**: 完整 CI 集成 — GitHub Actions runner 需要连到 test env (SSH tunnel, 网络配置), 2-3 天工作
- **Option B**: 部分 CI — 只跑 backend unit tests (快, cheap), 手动跑 E2E on demand
- **Option C**: Document-only — ADR 说明"E2E 手动 on demand, 每次 PR 人工 run one"

**Recommended**: **Option B + C 组合**. Option A 投入产出比不高 (E2E 需要多环境协调, CI 容易 flake).

**Action**: 写 ADR `docs/plans/canvas-e2e-ci-strategy.md` 记录决策.

### D1-5: 74 legacy 测试 depth retrofit (lowest priority)

Rule 1 要求所有测试有 depth 标签. 74 条 legacy 测试 (R1 前) 全部未标. R5 audit 里我分类为 smoke 但没 commit 这个分类到代码.

**Work**: 在每个 `rc.log(testId, status, evidence)` 调用的 evidence 字符串加 `[depth=smoke]` / `[depth=medium]` / `[depth=deep]` 前缀, 按 journey 批量处理.

**Cost**: 1-2 小时.
**Benefit**: LOW (现有测试 behavior 不变, 只是 metadata 合规)
**Action**: 延后, 有余力时处理. NOT R6 P0.

---

## D1 Rule 10 checklist (for this round)

| Item | Status |
|---|---|
| Branch pushed to remote | ✅ `git push origin e2e/v1-framework` executed (pre-PR) |
| PR opened | ✅ [PR #6](https://github.com/j4xie/my-prototype-logistics/pull/6) |
| Production deployment plan | ✅ D1-2 above documents owner + steps + rollback + risk + trigger |
| R{N+1} backlog as tickets | ⏳ **Pending user action** — 3 tickets drafted (D1-3), need conversion to GitHub Issues |
| CI integration status | ⏳ **Pending ADR** — D1-4 recommends Option B+C, ADR to be written |

D1 is Rule 10 compliant **in plan form**. Actual closure of items 4-5 still requires user action (create tickets, decide CI strategy).

---

## D1 Exit criteria

- [x] PR opened
- [ ] PR reviewed + approved (user decision)
- [ ] PR merged to main
- [ ] Prod deploy executed (via deploy-backend.sh --env prod)
- [ ] Prod smoke test PASS
- [ ] 3 R6 tickets created in tracker
- [ ] CI ADR written

**Claude 的角色**: 起草 ticket body + ADR, 跑验证命令, 回应 review. 实际审批/merge/prod deploy 动作 = user.

---

## Next action (immediately)

1. ✅ DONE: skill Rule 10 committed (`825b70dba`)
2. ✅ DONE: branch pushed
3. ✅ DONE: PR #6 opened with honest mega-PR body
4. **USER**: 决定 PR review strategy (Option A/B/C 在 D1-1 里)
5. **CLAUDE (可选)**: 起草 3 个 R6 ticket body + CI ADR — 用户说话启动
6. **USER**: 审批 + merge + prod deploy

---

**Status**: D1 plan written. Actual delivery pending user decisions (review strategy, ticket creation, prod deploy window).
