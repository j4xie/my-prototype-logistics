## Final Integrated Report

### Executive Summary

- **真正 R2 P0**: (1) 修 `CanvasAIController.@RequireRole` 与前端 router 权限矩阵对齐 (生产面 security bug); (2) 改造 J3-S10 账号参数化并扩 J5-L4 抓前后端矩阵分裂; (3) CI 门禁 — router/@RequireRole 变更必须触发 canvas-security-e2e.
- **Recommendation**: 严格采纳 Critic 修订立场, **废弃** Analyst 原 P0-b "Phase C 业务门禁" (已被代码证伪 — `@RequireModule` 零使用, 是产品功能不存在, 不是测试缺口).
- **Confidence**: High (Critic 有具体文件行号代码验证, 翻盘有据).
- **Key Risk**: restaurant_admin1 等角色可绕过前端直接调 canvas AI API — 46d1925a3 只改前端 router 未改后端 `@RequireRole`, **前后端权限矩阵分裂**.
- **Timeline/Cost**: P0-a/b/c 合计 ~2-3 人天; Phase C 业务门禁 1 人天**调研** (不做开发, 先定性产品语义).

---

### Consensus vs Disagreement 映射

| Topic | Researcher | Analyst | Critic | Final Verdict |
|-------|-----------|---------|--------|--------------|
| J3-S10 FAIL 根因 | commit `46d1925a3` 改 router meta.roles | 策略性回归, 非 bug | 同意是策略回归, 但"策略回归"口径软化 CI discipline 缺失 | **策略回归 + CI 门禁缺失** 两者都成立 |
| R0→R1 无其他 testId 漂移 | 确认 (R-B) | 支持"净进步" | 用户视角 65/65→69/70+1 FAIL 出现红色, "净进步"站不住 | **净进步口径保留但降级**, 同时承认 CI 纪律缺失 |
| Phase C 是否 smoke | DB 有 F002 v50→v51 实际记录, 非 smoke | 真实 toggle, 但未验业务门禁 | `@RequireModule` 全 controller 0 使用, `isModuleEnabled()` 仅 ModuleEnabledAspect 1 处调用 (零注解 = 零触发) | **Phase C 真 toggle 属实; 业务门禁是产品功能不存在** |
| Analyst P0-b (补 Phase C 业务门禁) | — | 列为 R2 P0 | 空中楼阁, 代码证伪, 降 P2 先调研 | **采纳 Critic: 降 P2, 先 1 人天定性产品语义, 不进 R2 开发** |
| 前后端权限矩阵分裂 | R-A 只提到 router meta 变更 | 未检出 | CanvasAIController.java:104 `@RequireRole` 仍含 `factory_super_admin` — 生产面 security bug | **新 P0, 优先级高于 J3-S10** |
| CI 门禁 | — | 未检出 | 46d1925a3 commit stat 只 touch router, 未跑 canvas-security-e2e → 17h 盲飞 | **新 P0** |

---

### Final Confidence Levels

| Conclusion | Confidence | Evidence Basis | Based On |
|-----------|------------|----------------|----------|
| J3-S10 FAIL = commit `46d1925a3` 导致的策略回归 | ★★★★★ High | 代码验证 + 多 agent 共识 | R-A 文件行号 + R-B testId 对比 + Analyst/Critic 一致 |
| 前后端权限矩阵分裂 (CanvasAIController `@RequireRole` 未同步 router) | ★★★★★ High | 仅代码验证 | Critic 指出 `CanvasAIController.java:104` 仍含 `factory_super_admin` 与 `router.ts:733` 分裂 |
| R1 "净进步" (通过率 98.6% 达标) | ★★★☆☆ Low-Med | 仅代码验证 | Researcher 数据支持, 但 Critic 正确指出用户视角出现红色 + CI discipline 问题 |
| Analyst 原 P0-b 业务门禁是真实缺口 | ★☆☆☆☆ Very Low | 代码验证反证 | Critic `@RequireModule` 全 controller 0 使用证伪, 是产品功能不存在 |
| Phase C toggle 非 smoke (DB 有 v50/v51 实际记录) | ★★★★☆ High | 代码验证 | R-C DB 层证实 |
| CI 门禁缺失 (router/@RequireRole 变更未触发 canvas-security-e2e) | ★★★★☆ High | 仅代码验证 | Critic commit stat 分析 |

---

### R2 Action List (严格采纳 Critic 修订立场)

#### P0-a · J3-S10 改造 — 账号参数化 + 正向断言 [局部修改, ~0.5 人天]
- `tests/canvas-security-e2e/j3-consumer.mjs:182` 改为反向断言: restaurant_admin1 应**被拒**访问 canvas-editor
- 新增 platform_admin 账号正向断言: 应**可访问** canvas-editor
- 扩 J5-L4 新断言: 抓前后端权限矩阵分裂 (router meta.roles vs `@RequireRole` 必须一致)

#### P0-b · 修 CanvasAIController.@RequireRole 对齐 router (新, 代替 Analyst 原 P0-b) [局部修改, ~0.5-1 人天]
- `CanvasAIController.java:104` 移除 `factory_super_admin`, 对齐 `router.ts:733` 的 `[platform_admin, permission_admin]`
- **或** 明确反向决策: 后端矩阵是准, 前端 router 回滚 — 需产品明确 canvas AI API 的目标用户
- 全量 grep 其他 canvas 相关 `@RequireRole` / `@PreAuthorize`, 排除同类分裂

#### P0-c · CI 门禁 — router/@RequireRole 变更触发 canvas-security-e2e [局部修改, ~0.5-1 人天]
- GitHub Actions workflow 或 pre-commit hook: 检测 `frontend/web-admin/src/router/**` 或 `backend/java/cretas-api/src/main/java/**/controller/Canvas*` 变更时, 强制跑 `tests/canvas-security-e2e`
- 不通过不准合并, 防止下次再出 `46d1925a3` 类 17h 盲飞

#### ~~Analyst 原 P0-b · Phase C 业务门禁~~ → 降 P2 [无需代码改动, ~1 人天调研]
- **不进 R2 开发** — 先 1 人天调研: Phase C toggle 的产品语义是什么?
- 选项: (A) toggle 只控模块菜单可见性 — 当前已生效 (B) toggle 应控 API 层访问 — 需先全量铺 `@RequireModule` (架构级, 单独立项)
- 产品明确 (A) 或 (B) 之前, 不追加 E2E 断言, 避免白忙

---

### Open Questions

1. **canvas AI API 的目标用户决策**: router 改成 `[platform_admin, permission_admin]` 是刻意 (缩小权限) 还是误改 (本意不含 factory_super_admin)? 决定 P0-b 是前端回滚还是后端修正. **必须先问产品再动代码**.
2. **`@RequireModule` 产品意图**: 该注解存在但零使用 — 是历史废弃 (应删) 还是规划中未铺开 (应立项)? 决定 Phase C 业务门禁是否进 roadmap.
3. **R2 盲区扩展**: R1 FAIL 只有 1 个, 未达"≥10 FAIL 暴露盲区"目标 — R2 是否主动增加负向断言密度 (cross-tenant / 过期 token / 权限降级)?
4. **CanvasAIController 外的其他 controller 是否也有类似分裂**: 建议 R2 前跑一次全量矩阵审计 (前端 router meta.roles vs 后端 `@RequireRole`) 输出 diff 表.

---

### Regression 表: R0 → R1 差异

| 维度 | R0 | R1 | 差异性质 |
|------|-----|-----|---------|
| 总测试数 | 65 | 70 (+5 Phase C) | 扩 |
| PASS | 65 | 69 | +4 (新增 Phase C - 1 回归) |
| FAIL | 0 | 1 (J3-S10) | 新红 |
| 通过率 | 100% | 98.6% | 下降但仍达标 |
| testId 漂移 | — | 0 (R-B 确认) | 纯净 |
| 触发变更 | — | commit `46d1925a3` (Apr 13 18:23) | router meta.roles 策略调整 |
| 后端 controller `@RequireRole` | 含 `factory_super_admin` | 仍含 `factory_super_admin` (未同步) | **前后端矩阵分裂 — 生产面 security bug** |
| Phase C DB 记录 | N/A | F002 traceability v50 enabled=f → v51 enabled=t 实际 toggle | 非 smoke |
| `@RequireModule` 使用率 | 0% | 0% | 产品功能不存在 |
| CI 门禁 (canvas-security-e2e 对 router/controller 变更) | 无 | 无 | **缺失持续 17h 盲飞** |

**用户视角净变化**: 绿屏 → 1 红. 虽然通过率下降 <2%, 但 CI discipline 失守 (`46d1925a3` 未触发 canvas-security-e2e), 需从 R2 开始补门禁.

---

### Methodology Note

- Researchers deployed: 3 (R-A 根因定位 / R-B testId 漂移对比 / R-C Phase C DB 层验证)
- Critic 代码验证翻盘: 2 处 (Analyst P0-b 证伪 + 新 P0 前后端分裂发现)
- Key disagreements resolved: 3 (Analyst P0-b 降级 / 新增 P0 前后端分裂 / 新增 P0 CI 门禁)
- Unresolved disagreements: 0 (Critic 代码证据充分, Analyst 立场可修正)
- 遵守规则: Never ignore the Critic — Critic 翻盘立场全量保留, Analyst 原 P0-b 明确标注降级原因.
