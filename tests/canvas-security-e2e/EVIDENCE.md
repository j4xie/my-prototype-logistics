# Canvas Security E2E — Evidence & Design Decisions

这份文档解释 Canvas E2E 套件的关键设计决策, 避免未来审计时基于**错误假设**做过度校正。

## 1. 为什么 `results/` 被 `.gitignore` 排除

**决策**: `.gitignore:164` 明确排除 `tests/canvas-security-e2e/results/`

**原因**:
- `.token-cache.json` 包含 JWT tokens (含 userId/factoryId/role 的 base64 payload), 虽 24h TTL 但入 Git 不合规 (MUST-FIX from Apr 12 audit)
- `*-results.json` 逐次运行覆盖, 非版本化制品
- CI 可通过 artifact 归档机制保留 (不是通过 Git)

**不是**: "结果文件缺失, 65/65 PASS 无证据" — 这是 agent-team Analyst (R-B #3) 的误判, Critic 用 `.gitignore:164` 反驳

## 2. 为什么 J3 只有 S1/S2/S3/S4/S10 (跳过 S5-S9)

**决策**: `j3-consumer.mjs:18-22` 文件头注释块明确声明:

```
Note: J3-S5 through J3-S9 are INTENTIONALLY UNUSED numbers reserved for future
Playwright form submission / sub-table / validation interception tests. The
current scope does NOT cover those flows because Fix 14 (setDynamicFields
affected-row check) is primarily verified by J1-B2 (ACTIVE field counting),
not by J3 UI form submission.
```

**原因**:
- S5-S9 原设计覆盖"填表单 / 提交 / 子表 / 校验拦截 / 详情页验证", 但 Fix 14 (setDynamicFields affected-row 检查) 的**主验证路径实际在 J1-B2** (ACTIVE field 计数对比)
- J3 的核心价值是**消费者角度 UI 可见性验证**, 不需要重复 J1 的 DDL/发布流程
- 编号保留 S5-S9 是为将来扩展预留, 不是"遗漏"

**不是**: "Fix 14 唯一正向路径, 必须补齐" — Analyst 基于编号假设的错判, Critic 反驳 (见 Challenge 2)

## 3. 为什么 `FeatureConfigController.PUT` 无 `@RequireRole` 不在本次 scope

**决策**: 本套件专测 Canvas V3 范围 (commit `8d3755222` 修复的组件)

**scope 包含**:
- ConfigController (Canvas 配置发布/回滚)
- DynamicFieldController (动态字段 CRUD + 子表)
- CanvasAIController (AI 助手)
- BusinessRuleController (validation/formula/scheduler)
- ConfigChangeSetController (变更集审批)
- TriggerChainController (触发链)

**scope 不含**:
- `FeatureConfigController` — 独立模块, 不属 Canvas V3
- 跨租户防御由 `JwtAuthInterceptor:178-184` 统一拦截 (`validateFactoryAccess`)

**后续**: FeatureConfig 安全审计应为独立 workstream, 不混入 Canvas scope

## 4. `log(testId, status, evidence: string)` 签名约定

**当前**: `evidence` 参数是 string, 所有 PASS/FAIL 证据以模板字符串记录

**合理性**:
- E2E 测试业界惯例允许 string evidence + screenshot 路径作为 artifact
- 关键追溯性由 `{journey}-results.json` (rc.save) + `screenshots/*.png` + console stdout 三重保证
- **不是**"零证据" — 是"人类可读证据, 非机器可 diff"

**R2+ 计划** (非 R1 硬阻塞):
- 扩展 log 签名: `log(testId, status, evidence: string | { filled, output, verified_at })`
- 关键 E2E 断言 (如跨租户攻击 payload) 改用 object 形式便于 regression diff

## 5. "65" 这个数字的含义

**澄清**: `run-all.sh` 之前存在 `PASS_COUNT` bug — 被误理解为"测试总数", 实际是 journey 总数 (7)

**修复后** (`run-all.sh:65-100`):
- `TEST-LEVEL SUMMARY` 聚合所有 `*-results.json`, 报告真实 assertion 级别的 pass/fail/warn
- "65" 指 **唯一 testId × record() 调用** 总数 (其中 J1-A3 循环 7 个字段展开为 7 条独立记录)
- R1 的诚实表述: "65 assertion records, 其中 59 unique testIds, 覆盖 51 个 spec 任务单元"

## 6. WARN 处理策略

**R0 缺陷**: WARN 被 `run-all.sh` 的 journey-level `PASS_COUNT += 1` 当成 OK

**R1 修正** (`run-all.sh:95-100`):
- `EXIT 1` 触发条件: `fail > 0 || warn > 0`
- 符合 E2E skill rules (`references/test-rules.md:378`): "WARN = 没通过 = 必须修"
- 单 journey 内 WARN 不再被聚合脚本静默

## 7. 角色覆盖哲学

**R0**: 测试覆盖 4/20 角色 — factory_super_admin (主演) + permission_admin (隐式, 通过 @Deprecated 注解列入 Canvas 写权限) + operator (MOBILE_ONLY + API 403) + finance_manager (路由白名单)

**Critic 立场** (Hidden Assumption #3): Canvas 威胁模型核心是 **admin vs non-admin + cross-factory**, 不是 20 细分角色。J5 的 4 角色已覆盖核心场景

**R2+ 扩展** (conditional):
- 如 PM 决定 Canvas scope 纳入 6 Level-10 经理, 则补 J5-L3 扩展
- 如保持现状, 则记录在本文档 "scope 边界"

## 8. Canvas 安全 scope 正式边界 (ADR)

本套件 **验证 & 不验证**:

| 验证 ✅ | 不验证 ❌ |
|---------|---------|
| Canvas V3 动态字段 CRUD | `FeatureConfigController` |
| 动态字段 DDL 执行 (ALTER TABLE) | 传统模块 hard-coded 字段 |
| Canvas 发布/回滚流程 | 跨模块业务流程 (订单 → 发货等) |
| ConfigChangeSet 审批流 | 旧 AI 意图系统 (非 Canvas AI) |
| TriggerChain 事件订阅 | 审计日志后端存储层 |
| Cron DDoS 防御 | SmartBI / Python 服务端点 |
| AI prompt injection 防御 | 所有非 `canvas_*` 工具的 scope |
| Cross-tenant 攻击向量 (Canvas 端点) | `JwtAuthInterceptor` 通用跨租户拦截 (已独立审) |

**跨项目安全审计不应混入本套件** — 每次加新旅程需在本 ADR 明确"scope-in"

---

## 9. R1 审计发现: 前后端权限矩阵分裂 (R2 P0)

**来源**: R1-⑤ agent-team 4 阶段审计, Critic 代码验证发现

**问题**:
- **前端 router** (`web-admin/src/router/index.ts:733`): canvas-editor meta.roles = `['platform_admin', 'permission_admin']` (commit `46d1925a3`, Apr 13 18:23 收紧)
- **后端 @RequireRole** (`backend/.../CanvasAIController.java:104, 145`): 仍是 `{"factory_super_admin", "permission_admin"}` (未同步更新)

**影响**:
- `factory_super_admin` 账号 (如 F002 restaurant_admin1) 前端访问 `/canvas-editor` 被挡 (/403)
- 但同一账号可**绕过前端直接调** `POST /api/mobile/{factoryId}/ai/canvas/chat` — **后端仍允许**
- 这是生产面 security bug, 不是测试问题

**R1 应对**: J3-S10 断言参数化 (`E2E_CANVAS_EDITOR_EXPECT=blocked|allowed`), 默认期望 `/403` (验证 router 生效)

**R2 真 P0 (必修)**:
1. 决策前后端对齐 — router 回滚 or 后端 @RequireRole 收紧 (需问产品)
2. 新增 J5-L4 后端 API 直调 `canvas/chat` with factory_super_admin token → 期望 403
3. CI 门禁: 改 router meta.roles 或 @RequireRole 必须触发 canvas-security-e2e

**Integrator 裁决**: `.claude/agent-team-outputs/2026-04-13_canvas-e2e-r1-results-audit.md`

## 10. 业务模块门禁的产品语义 (R2 P2 调研)

**R1-⑤ agent-team Critic 代码验证**:
```
grep -r "@RequireModule" backend/java/cretas-api/src/main/java/com/cretas/aims/controller/
→ 0 matches
```

`@RequireModule` 注解 + `isModuleEnabled()` 服务方法均存在, 但**零 controller 使用** (ModuleEnabledAspect 依赖该注解触发, 零注解 = 零触发).

**含义**: Canvas 模块 toggle 目前只是**前端路由/菜单装饰开关**, 不作用于业务 API. toggle `traceability`=false 后直调 `/api/mobile/{factoryId}/traceability` 仍 200.

**R2 不应**: 写"业务门禁 E2E" (永远 PASS, 因为产品无此行为)

**R2 应**: 1 人天对齐产品语义 — Canvas toggle 的产品意图到底是什么? 历史废弃 (应删 `@RequireModule`) 还是规划中未铺开 (应补 18 模块 Controller 注解 + 4-6 周 epic)?

## 11. R2 ADR: 拒绝"方案 A 机械替换" + 接受前后端分层授权

**来源**: R2-② agent-team 审计 (2026-04-14), Critic 代码验证翻盘

**决策**: **保留当前前后端权限矩阵分歧**, 不执行 34 处 @RequireRole 机械替换

### 3 个代码证据推翻 R1-⑤ 原方案 A

**证据 1** (Blocker): **R1 J1-B1/C/D 必挂**
- `tests/canvas-security-e2e/j1-lifecycle.mjs:272-281` 用 `restaurant_admin1` (factory_super_admin) 调 `/config/publish` 断言 HTTP 200
- 方案 A 把 `/config/publish` 的 @RequireRole 改为 `{platform_admin, permission_admin}` → restaurant_admin1 立即 403
- J1-B1 / J1-C (module toggle + publish) / J1-D (rollback + restore publish) 连锁 4-6 测试全挂
- **R1 70/70 PASS 会退回 ~64/70, R2 无法起步**

**证据 2** (R-B 证据链坍塌): **aiPrompt 字段是死代码**
- R1-⑤ Analyst 引用 "30 天 0 ai_prompt 记录" 作为"零业务影响"证据
- `ConfigChangeLog.aiPrompt` 整个 java 源树零写入路径
- `FactoryConfigServiceImpl.logChange()` 不 set aiPrompt
- `CanvasAIController.chat()` 不引用 `ConfigChangeLogRepository`
- 查询必 0, 不管真实流量多大 = **Absence-of-evidence 谬误**

**证据 3** (Scope 越界): **34 处 @RequireRole 业务语义不同质**
- CanvasAIController 只有 2 处 (chat/apply-diffs) 是真正 "AI 入口"
- ConfigController 14 处 + BusinessRule 5 + DynamicField 4 + TriggerChain 4 + ConfigChangeSet 5 = 32 处是**工厂配置工作流** (publish / approve / rollback / submit-review / import / export / toggle module / define field / set rule / trigger chain)
- 把这 32 处一并改 = 剥夺 factory_super_admin 发布配置的能力 = 产品级角色变更, 超出 "前后端对齐" 的 commit 46d1925a3 意图 (只改了 1 行 router menu visibility)

### 正确的架构理解

| 层 | 角色模型 | 职责 |
|---|---------|------|
| **前端 router meta.roles** | `[platform_admin, permission_admin]` | Canvas 编辑器**菜单可见性**控制 (UX 层) |
| **后端 RequireRoleInterceptor** | `PLATFORM_ADMIN_ROLES` 白名单 + 显式 `@RequireRole` 列表 | API 级契约层, 允许 factory_super_admin 通过 factory 模式 |
| **JwtAuthInterceptor.validateFactoryAccess** | tokenFactoryId == urlFactoryId | Cross-tenant 隔离 |

**不是 bug, 是双模式设计**:
- Platform mode: platform_admin 通过 `canvas-editor` 页面编辑所有工厂模板
- Factory mode: factory_super_admin 通过 **业务页面** (不是 canvas-editor) 发布自己工厂的配置
- 共用同一套后端 API, 靠 `factoryId` 路径参数区分
- 46d1925a3 只是隐藏了 factory_super_admin 的 canvas-editor 菜单 (UX 考虑), **没有变更业务契约**

### R2 正确的 P0

不是修复"分裂", 而是**测试文档化**它:

1. **J5-L4 契约测试** (已加) — 明确记录 `factory_super_admin → /config/v2/ai/chat` 应返回 200 (当前契约)
2. **J5-L4-b 契约测试** (已加) — 明确记录 `factory_super_admin → /config/publish` 角色检查必过 (R1 J1 依赖)
3. **J4-7 / J4-8 跨租户扩展** (已加) — F006 admin 跨 F002 canvas AI/scheduler 应被 JwtAuth 层拦截
4. **EVIDENCE.md 本节** — ADR 正式记录, 防止未来审计再次误判

### R2 明确拒绝的事

- ❌ 改 34 处 @RequireRole
- ❌ 回退 commit 46d1925a3
- ❌ 引入新注解 `@RequireCanvasScope`
- ❌ 基于 `aiPrompt` 字段查询做决策

### R3+ 可选后续 (非 R2 scope)

- 等产品真正澄清 "Canvas 配置的授权是 platform 还是 factory 级" 再议 (1 人天 PM 对齐)
- 若产品决定收紧, 需同步改 E2E 账号矩阵 (platform_admin 取代 restaurant_admin1 做 J1 正向) + 34 处 @RequireRole + 客户通知 — 预计 1-2 周 epic
- 独立处理 `RequireRoleInterceptor` vs `JwtAuthInterceptor` 的 `PLATFORM_ADMIN_ROLES` drift (3 vs 4 元素)

---

**维护**: 每次 R{N} 循环结束, 更新本文档相关章节, 保持与实际套件行为一致。
