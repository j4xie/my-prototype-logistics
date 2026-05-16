# Sprint 1 Fix K1 — Flyway V20260516 重排

**任务**: 修 Sprint 1 main 上 5 个 Flyway 版本号冲突 (3 个 V20260516_02 + 2 个 V20260516_03)
**PR**: https://github.com/j4xie/my-prototype-logistics/pull/667
**分支**: `fix/sprint1-flyway-renumber` (base = origin/main @ cd3d37eaa)
**Owner**: Chat K1
**实际工时**: ~30 分钟 (远低于 2h 预期)

## 完成 (2026-05-15 15:42)

- ✅ 创 worktree `../my-prototype-logistics-sprint1-fix-k1` from origin/main
- ✅ 5 个 git mv 执行 (零 SQL 内容改动):
  - `V20260516_02__bom_redesign.sql` → `_03`
  - `V20260516_03__bom_intent_configs.sql` → `_04`
  - `V20260516_02__print_document_intent.sql` → `_05`
  - `V20260516_03__work_process_tasks.sql` → `_06`
  - `V20260516_04__work_process_intents.sql` → `_07`
- ✅ ls 验证 7 个唯一版本号 (`_01__attachment` / `_02__abaca` / `_03__bom_redesign` / `_04__bom_intent_configs` / `_05__print_document_intent` / `_06__work_process_tasks` / `_07__work_process_intents`)
- ✅ `mvn compile` PASS (2387 源文件, BUILD SUCCESS, 1:20)
- ✅ `git log --follow V20260516_03__bom_redesign.sql` 显示 #656 原始 commit (rename 100% similarity, history 完整)
- ✅ Commit `57ea4ffb1` 通过 husky hooks (encoding check + lint-staged)
- ✅ 显式 pathspec 提交 (不 `git add .`, 防并行 chat 文件污染)
- ✅ PR #667 推送 + ready for organizer review

## 验证证据

| DoD 项 | 命令 | 结果 |
|--------|------|------|
| 7 个唯一版本号 | `ls backend/.../flyway/V20260516_*.sql` | 7 文件全部 unique |
| mvn compile PASS | `./mvnw.cmd compile -DskipTests` | `BUILD SUCCESS` |
| rename history | `git log --follow V20260516_03__bom_redesign.sql` | 显示 #656 source commit |
| 仅 5 个 rename | `git status` | 5 renamed entries, 0 其他 |
| Flyway scan OK | (推断, mvn compile 包含 resources copy) | 549 resources copied 无 error |

## 备注

- **Track B1 follow-up (不在本 PR 范围)**: `feature/asap-track-b1-c-ai-1` 分支有 `V20260516_01__abaca_dingtalk.sql`, 本 PR merge 后跟现有 `V20260516_01__attachment.sql` 会产生 _01 冲突。Track B1 PR 后续 rename 需 owner 处理。
- **K2 / K3 并行无冲突**: K1 只动 flyway 目录, 不动业务代码, 跟 K2/K3 不会同改同文件。
- **未做也无需做**: SQL 内容审计 (本 PR 零内容改动) / 业务代码引用扫 (Flyway 文件名不被代码引用, 只被 Flyway 框架按版本号顺序读取) / E2E (空 DB rerun 即 schema 重建, 后续 deploy 时通过 SmokeTest 验证)。

## 下一步 (organizer)

1. Review PR #667 (diff 应为纯 rename, similarity=100%)
2. Admin-merge (CI java-build-test 应直接 PASS)
3. Merge 后 prod deploy 即可解除 Flyway 启动阻塞
