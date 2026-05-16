# Sprint 1 Fix K3 — MaterialAbaca RBAC 补全 + SecurityUtils 改用

**任务**: 修 Sprint 1 #649 (W-ABA-1) merge 漏修的 RBAC + 自定义 JWT parse
**PR**: https://github.com/j4xie/my-prototype-logistics/pull/668
**分支**: `fix/sprint1-rbac-abaca` (base = `origin/main @ cd3d37eaa`)
**Owner**: Chat K3
**实际工时**: ~50 分钟 (低于 3h 预期)

## 完成 (2026-05-15 15:50)

- ✅ 创 worktree `../my-prototype-logistics-sprint1-fix-k3` from `origin/main @ cd3d37eaa`
- ✅ 实际 endpoint 数 = **6** (非 dispatch 文案的 8 — 跟 SCHEMA_DESIGN §2.1 + controller class doc 对齐)
- ✅ 6 endpoint 全部加 `@RequirePermission`:
  - `GET /` (listByBatch) → `{procurement:read_write, procurement:read}`
  - `GET /{id}` (getById) → `{procurement:read_write, procurement:read}`
  - `POST /` (create) → `procurement:read_write`
  - `POST /batch` (createBatch) → `procurement:read_write`
  - `PUT /{id}/verify` (verify) → `procurement:read_write`
  - `DELETE /{id}` (softDelete) → `procurement:read_write`
- ✅ 删除自定义 `currentUserId(authorization)` helper 方法
- ✅ 删除所有 `@RequestHeader("Authorization") String authorization` 参数 (3 处: create / createBatch / verify)
- ✅ 改用 `SecurityUtils.getCurrentUserId()` (4 处: create / createBatch / verify; softDelete 不需 userId)
- ✅ 移除 import: `TokenUtils`, `MobileService`, `@RequestHeader`
- ✅ Service 层既有 invariant 保留 (belt+suspenders): 双签拒同人复核 / 已复核拒删 / `findByIdAndFactoryId` factory 隔离
- ✅ 新增 `MaterialAbacaControllerRBACTest.java` 单测 11 个:
  - **AnnotationAudit** (7 反射): 6 endpoint @RequirePermission 锁 + 验证 controller 不再注入 `@RequestHeader Authorization`
  - **ServiceInvariant** (4 Mockito): 双签拒同人 / 合法不同人复核 / 跨厂 isolation / 已复核拒删
- ✅ `mvn test -Dtest=MaterialAbacaControllerRBACTest` PASS (11/11, 2.18s)
- ✅ Commit `7cde074a1` 通过 husky hooks (encoding check + lint-staged)
- ✅ 显式 pathspec 提交 (不 `git add .`, 防 K1/K2 文件污染)
- ✅ PR #668 推送 + ready for organizer review

## 验证证据

| DoD 项 | 命令 | 结果 |
|--------|------|------|
| 6 endpoint @RequirePermission | reflection test `AnnotationAudit` | 7/7 PASS |
| 删自定义 JWT parse | grep `currentUserId\|@RequestHeader.*Authorization\|TokenUtils\|MobileService` controller | 0 hit |
| SecurityUtils.getCurrentUserId 改用 | grep + AnnotationAudit `controllerDoesNotInjectAuthorizationHeader` | 4 occurrence + test PASS |
| 双签拒同人 | `verify_rejectsSelfSignedByWeigher` | PASS (BusinessException "不能由称重员") |
| 合法不同人复核 | `verify_acceptsDifferentVerifier` | PASS (setVerifiedBy/At) |
| 跨厂 isolation | `verify_factoryIsolated` | PASS (BusinessException "不存在或无权访问") |
| 已复核拒删 | `softDelete_rejectsVerifiedRecord` | PASS (BusinessException "已复核") |
| mvn test PASS | `./mvnw test -Dtest=MaterialAbacaControllerRBACTest` | `Tests run: 11, Failures: 0, Errors: 0` |

## 备注

- **Dispatch 文案数字 drift**: 文案说 "8 endpoint", 实际 controller (class JavaDoc + 代码) 是 6 endpoint. 跟 SCHEMA_DESIGN.md §2.1 对齐. 已在 PR body + commit msg 显式注明.
- **Sprint 1 #649 仍存的 belt 层**: `AbacaQuantityLogService` `findByIdAndFactoryId` / `verify` L118-120 / `softDelete` L131-133 invariant 不动. Service 层是 controller RBAC 误删的兜底.
- **K1 / K2 并行无冲突**: K3 只动 1 controller + 1 新测试. K1 (Flyway 重排) / K2 (Attachment + Print) 文件路径 0 交集.
- **未做也无需做**: 实际部署 RBAC 跑通 (CI 起 Spring 全栈不在本 PR 范围, deploy-test 时由 organizer 跑 5-role 角色 matrix 验证) / Frontend 端的 procurement permission 检查 (前端 RBAC 在 R6 RBAC 框架内, 不属 W-ABA-1).
- **遵守规则**: 不改 service 业务逻辑 / 显式 pathspec commit / 禁 `as any` (Java 无此问题) / 禁静默吞错 / 不在本 chat 战略讨论.

## 下一步 (organizer)

1. Review PR #668 (diff 应为 controller refactor + 1 新测试, 净 +246 / -22)
2. CI `java-build-test` 应通过 (本地全量 build + 11 tests PASS)
3. Admin-merge 后 deploy-test 跑 5-role 角色矩阵 (warehouse_mgr → 403; procurement_op → 200; 同人双签 → 400)
4. Merge 后 Sprint 1 #649 PR_AUDIT 的 🟠 必修项可关闭
