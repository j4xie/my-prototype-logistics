## Final Integrated Report

**Topic**: Canvas E2E R2 方案审计 — 最终整合
**Date**: 2026-04-14
**Branch**: e2e/v1-framework
**Integrator**: 以 Critic 为基线翻盘 Analyst 方案 A，采纳方案 B

---

### Executive Summary

- **Recommendation (拒绝方案 A，采纳方案 B)**: R2 的 P0 **不是**批量移除 `factory_super_admin`。真正 P0 是 **(1)** 验证 CanvasAIController 2 处 (chat/apply-diffs) 的 `@RequireRole` 是否仍保持 R1 行为；**(2)** 单独打一个 drift PR，把 commit `46d1925a3` 里新增的 `hasSensitiveOp` 前端 guard 所对应的 **AI 入口** 后端配齐 — 只动 CanvasAIController，**不碰** ConfigController / BusinessRule / DynamicField / TriggerChain / ConfigChangeSet 这 32 处工厂配置工作流端点。
- **Confidence**: **High (★★★★★)** — Critic 有直接代码证据 (j1-lifecycle.mjs:275 + aiPrompt grep + CanvasAIController 仅 2 处 vs ConfigController 14 处)，R-B 证据链断裂已被代码确证 (aiPrompt 无 Canvas 写入路径)。
- **Key Risk (强行执行方案 A)**: R1 回归 ≥ 4 测试必挂 (J1-B1/C/D + 传导)；factory_super_admin 失去配置发布权 = 产品级角色变更；`factoryId != PLATFORM` 工厂模式事实上瘫痪。
- **Timeline Impact**: 方案 B 实际工作量 0.5-1 天 (纯前端 1 行对齐 + 2 处后端审视 + 1 份 ADR)，方案 A 名义半天实际 3-5 天且会烧掉 R1 绿灯。
- **Cost/Effort**: 方案 B = Low；方案 A = High (回归修复 + 产品决策 + 角色矩阵重写)。

---

### Consensus & Disagreements

| Topic | Researcher | Analyst | Critic | Final Verdict |
|-------|-----------|---------|--------|---------------|
| 34 处 `@RequireRole` 分布 | R-A: CanvasAI 2 / Config 14 / BusinessRule 5 / ChangeSet 5 / DynField 4 / TriggerChain 4 | 视作单一"前后端分裂"整体修复 | 其中 32 处是工厂配置工作流，语义非 AI | **采纳 Critic** — 2 类端点不同业务域，不得合并处理 |
| commit 46d1925a3 范围 | R-A: 1 行 router:733 前端 guard | "46d1925a3 只改 1 行前端 → 后端欠" → 方案 A 补齐 | 作者只改 1 行说明他本人认为后端不该动 | **采纳 Critic** — 反推意图不可强加，drift 修复需独立决策 |
| 生产 Canvas AI 流量 | R-B: F001 admin 10 次/7d，aiPrompt=NULL | "零业务影响" | aiPrompt 字段是死代码，查询必 0，证据链坍塌 | **采纳 Critic** — R-B 证据 **Invalidated**，不构成决策依据 |
| R1 兼容性 | R-C: e2e_* 账号 active，所有 R2 断言可执行 | "方案 A 与 R1 70/70 兼容" | j1-lifecycle.mjs:275 + canvas-test-helpers.mjs:28 直接反驳 — J1-B1 用 restaurant_admin1 (factory_super_admin) 断言 200 | **采纳 Critic** — J1-B1/C/D 必 403 FAIL |
| PLATFORM_ADMIN_ROLES 白名单 | R-A: 包含 super_admin, platform_admin, developer, platform_super_admin | 方案 A 完成 46d1925a3 分裂收敛 | 白名单作用在 `factoryId=PLATFORM` 场景，工厂 mode 仍需 factory_super_admin | **采纳 Critic** — 双模式 (platform/factory) 必须双角色支持 |
| "方案 A 纯机械替换" 可行性 | — | High | 32 处 ConfigController/etc 跨越 publish/approve/rollback/import/export，**业务语义各异** | **Refuted** |

**Unresolved**: 无 — 三项 High 反驳全部基于代码级证据，Critic 胜。

---

### Detailed Analysis

#### 1. 方案 A 的三个基座全部坍塌

**基座 #1 "完成 46d1925a3"**: 方案 A 把 `46d1925a3` 前端单行 guard 扩展为 "34 处后端强制对齐" 的根据是 **"分裂就要收敛"** 的审美直觉，而非作者意图。代码证据显示作者只改了前端 1 行，既没加 migration 也没改后端 controller —— 这本身就是最强的 "作者认为后端不动" 信号。把前端 UI guard 反推为后端契约是方向反转：前端 guard 只决定菜单显示/按钮可见，它 **不是** 后端授权模型的 source of truth。

**基座 #2 "R-B 零流量证据"**: R-B 结论 "config_change_log 30 天 aiPrompt IS NOT NULL 返回 0" 来源于 SQL 计数，表面无懈可击，但 **`ConfigChangeLog.setAiPrompt()` 在整个 Canvas 写链路上从未被调用**：

- `grep setAiPrompt` 在整个 java 源树只有 3 处：`DecorationServiceImpl:192 / :348` 和 `LowcodeServiceImpl:153`。
- 前两处操作 **`FactoryHomeLayout`**（首页装饰），非 `ConfigChangeLog`。
- 第三处操作 **`LowcodePageConfig`**（低代码页），仍非 `ConfigChangeLog`。
- `CanvasAIController` **不引用 `ConfigChangeLogRepository`**（R-A 文件列表无 import）。
- `FactoryConfigServiceImpl.logChange()` 产出 `ConfigChangeLog` 时不 set `aiPrompt`。

所以不管真实 Canvas AI 调用多少次，`config_change_log.ai_prompt` 永远是 NULL。R-B 查的是一个 **从未被写过的列**，结果 "0" 毫无证明力 —— 这是 **Absence-of-evidence** 谬误：没看到流量 ≠ 没有流量。R-B 正确的查询应当是 `intent_history` / Canvas AI 专用审计表 / CanvasAIController 访问日志，但都未执行。

**结论**: R-B 不能作为 "零业务影响" 的证据，方案 A 的 "零风险" 论据随之崩塌。

**基座 #3 "R1 70/70 兼容"**: 直接代码级反驳——

```
tests/canvas-security-e2e/canvas-test-helpers.mjs:28
  export const ADMIN_A = 'restaurant_admin1';  // F002 factory_super_admin

tests/canvas-security-e2e/j1-lifecycle.mjs:272-281
  async function phaseB1_publish(token) {    // token = ADMIN_A
    const res = await apiPost(`${F}/config/publish?...`, {}, token);
    if (res.status === 200) { rc.log('J1-B1', 'PASS', ...); }
    else { rc.log('J1-B1', 'FAIL', ...); }
  }
```

`/config/publish` 在 `ConfigController.java:123` 强制 `@RequireRole({"factory_super_admin"})`。方案 A 把这里改为 `{"platform_admin", "permission_admin"}` 之后：

- **J1-B1** restaurant_admin1 (factory_super_admin) → 403 → FAIL
- **J1-C** (toggle+publish 连锁) → FAIL
- **J1-D** (rollback+publish 连锁) → FAIL
- **J1-E** (其他 publish 依赖) → 传导 FAIL

至少 4 个 R1 绿灯测试必挂，可能 6+。Analyst 的 "与 R1 70/70 兼容" 是未验证断言。

#### 2. 工厂 mode vs 平台 mode — 被 Analyst 忽略的双轨架构

Critic 指出 Canvas V3 存在双模式：

- **Platform mode** (`factoryId=PLATFORM`): 平台级画布/模板，`JwtAuthInterceptor` 对 PLATFORM token bypass `@RequireRole`（R-C 实测 hr_admin1 403 = 正常，因其工厂 token 不走 bypass）。
- **Factory mode** (`factoryId=F001..F006`): 工厂级配置发布，需要 `factory_super_admin` 作为工厂内最高权（"工厂侧的 root"）。

方案 A 把 `factory_super_admin` 从 `@RequireRole` 移除 = **杀死工厂模式**，所有工厂内部的 publish/toggle/rollback/approve/import/export 必须下放到平台管理员。这是客户绝不会接受的产品变更：工厂不可能为每次配置发布都等待平台管理员介入。

Analyst 在规划方案 A 时没有识别这个双模式，因此方案 A 在语义上是错的 —— 不是补洞，是拆墙。

#### 3. 真正的 drift 边界 — 应该对齐什么

R-A 的 34 处分布表给出清晰的语义边界：

| Controller | @RequireRole 数量 | 业务域 | 方案 B 处理 |
|-----------|------------------|-------|-----------|
| **CanvasAIController** | 2 | **AI 入口** — chat / apply-diffs | ✅ 审视 (可能保留现状或收紧) |
| ConfigController | 14 | 工厂配置工作流 — publish/approve/rollback/import/export | ❌ 不动 (工厂 mode 必需) |
| BusinessRuleController | 5 | 业务规则 CRUD | ❌ 不动 |
| ConfigChangeSetController | 5 | 变更集审批 | ❌ 不动 |
| DynamicFieldController | 4 | 动态字段 DDL | ❌ 不动 |
| TriggerChainController | 4 | 触发链配置 | ❌ 不动 |

commit `46d1925a3` 前端 `hasSensitiveOp` guard 影响的是 **AI 助手入口是否允许触发敏感指令**，语义对位点只有 CanvasAIController 的 2 处。这 2 处本身已经用 `{"factory_super_admin", "permission_admin"}`，与 J1 (factory_super_admin 发布) 兼容 —— 实际上 **可能根本不需要后端修改**，只需一份 ADR 说明 "前端 guard 是 UX 优化层，后端 @RequireRole 是契约层，双层独立生效"。

#### 4. 为什么 R2 P0 不是角色矩阵

- **R1 已 ALL PASS** (70/70)，角色矩阵已被 R1 的 L1 + J5 双向覆盖。
- R2 的真正缺口（见 MEMORY.md）是 **toast 检测不稳 + L4 链路深度不够**，这两条与 @RequireRole 无关。
- R-A 声称 "33/33 canvas 写端点前后端分裂" 把 ConfigController 的工厂工作流误计入 "canvas 写"，因 Canvas V3 用 config 表作为底座。这是 **命名混淆**：Canvas 语义 ≠ ConfigController HTTP 端点语义。方案 A 基于错误计数，方案 B 基于正确的业务域划分。

---

### Confidence Assessment

| Conclusion | Confidence | Based On | Evidence Basis |
|-----------|------------|----------|----------------|
| 方案 A "完成 46d1925a3" **Refuted** | ★★★★★ | Critic 代码反推 + commit diff 证据 | 代码验证 + 外部共识 |
| 方案 A "R1 70/70 兼容" **Refuted** | ★★★★★ | j1-lifecycle.mjs:275 + canvas-test-helpers.mjs:28 已二次 Grep 验证 | 代码验证 + 外部共识 |
| R-B "零流量证据" **Invalidated** | ★★★★★ | `setAiPrompt` grep 仅 3 处，全在 Decoration/Lowcode，CanvasAIController 不 import ChangeLogRepository | 仅代码验证 |
| 双模式 (platform/factory) 存在 | ★★★★☆ | Critic 架构论据 + R-C JwtAuthInterceptor bypass 实测 | 仅代码验证 |
| ConfigController 32 处是工厂工作流 | ★★★★★ | 端点名称 (publish/approve/rollback) + @RequireRole 值 `factory_super_admin` 单角色模式 | 仅代码验证 |
| CanvasAIController 仅 2 处与 AI guard 语义对位 | ★★★★★ | R-A 分布表 + CanvasAIController grep (104 / 145 两行) | 仅代码验证 |
| 方案 B (最小 2 处或 0 处) 可行 | ★★★★☆ | Critic 推荐 + R-C 断言可执行 + 双模式兼容 | 仅代码验证 |
| 方案 A 实际工作量 3-5 天 | ★★★☆☆ | 类比经验 + 回归修复 + 产品决策链路 | 仅外部来源 |
| 生产真实 Canvas AI 流量 | ★☆☆☆☆ | R-B 查错列，**仍未知** | 尚未验证 |

---

### R2 最终 Action List (Revised — 基于 Critic 的方案 B)

#### Immediate (本次 R2 循环必做)

1. **[无需代码改动] 正式拒绝方案 A**
   在 `docs/plans/v3-gap-ledger.md` 添加 ADR "2026-04-14 R2 Scope — Canvas @RequireRole drift"，明确：
   - 不执行机械替换 (Analyst 方案 A)
   - 保留 ConfigController/BusinessRule/DynamicField/TriggerChain/ConfigChangeSet 32 处 `factory_super_admin` 现状
   - Rationale: (a) R-B 证据链坍塌 (b) J1-B1/C/D 回归 (c) 工厂 mode 产品需求
   - 记录本报告作为决策依据

2. **[局部修改] R2 P0 其一 — CanvasAIController 2 处审视 (0-1 行改动)**
   - Read `CanvasAIController.java:104` 和 `:145`
   - 确认当前 `@RequireRole({"factory_super_admin", "permission_admin"})` 是否与 R1 J1-B1 的 restaurant_admin1 期望一致
   - 若一致 → **0 行改动**，只写 ADR 说明 "前端 hasSensitiveOp guard 是 UX 层，后端 @RequireRole 是契约层"
   - 若不一致 → 写明具体偏差，单独 PR 修复，**不与其他 32 处打包**

3. **[局部修改] R2 P0 其二 — toast 检测改进 (MEMORY.md 已列)**
   - 原本就是 R2 的主 P0，从 tasks #53-#59 开始
   - 与 @RequireRole drift 完全解耦，不受本报告结论影响

4. **[局部修改] R2 P0 其三 — L4 链路深化 (MEMORY.md 已列)**
   - 同样与 drift 无关，推进 J3/J6 或 restaurant 端深度场景

#### Short-term (本周内)

5. **[架构级审视，但不立即执行] 补齐真实 Canvas AI 流量证据**
   R-B 的 `aiPrompt IS NOT NULL` 查错列。正确查询应改为：
   - `intent_history` 表按 `intent_code LIKE 'CANVAS%'`
   - CanvasAIController 访问日志 (需确认是否有专用 logger)
   - AI dialog 历史表
   若确实 < 10 调用/7d → 下一轮可考虑 **单独针对 CanvasAIController 2 处** 的角色收紧；若 > 100 调用/7d → 绝对不动。

6. **[无需代码改动] 更新 agent-team 规范**
   记录本次事故作为 **Critic 翻盘成功案例** 加入 `feedback_agent_team_critic_flip.md`：
   - Analyst 方案基于 "审美直觉" (分裂就要收敛) + 未验证 R1 兼容性断言 + 接受 R-B 证据无 code verification
   - Critic 三项直接代码证据 (aiPrompt grep / j1-lifecycle.mjs:275 / CanvasAIController vs ConfigController 端点差异) 翻盘
   - 规则: "前后端一致性问题" 必须按 **业务域** 划分，不能按 **端点计数** 合并

#### Conditional (若发生特定条件)

7. **[局部修改] 若生产 Canvas AI 流量证据显示 < 10 次/7d 且无工厂模式依赖** → 下一轮才可能考虑单独收紧 CanvasAIController，需新 PR + 新审计循环。

8. **[架构级] 若产品决策要求彻底移除 factory_super_admin** → 必须先做：
   - 角色矩阵重新设计 (需客户确认)
   - Migration: factory_super_admin 用户批量降级
   - R1 + R2 全量重跑
   - 至少 2-3 周工期
   **当前无此决策需求**。

---

### Open Questions

1. **生产 Canvas AI 真实流量到底多少？** R-B 查错列，实际调用频次仍未知。查询应改为 `intent_history` 或 `canvas_ai_dialog_history`（需先确认表名存在）。
2. **Platform mode 和 Factory mode 的 JWT 区分机制完整语义？** R-C 提到 `JwtAuthInterceptor bypass` 仅限 `factoryId=PLATFORM`，但 `PLATFORM_ADMIN_ROLES` 白名单跨模式行为未完整确认。
3. **`hasSensitiveOp` 前端 guard (46d1925a3 commit) 的完整语义**：它检查哪些操作？是否与 CanvasAIController `apply-diffs` 的"敏感变更检测"等价？Analyst/Critic 都没充分考察 `router:733` 上下文。
4. **ConfigChangeLog.aiPrompt 为什么存在？** 字段已定义但从未写入，可能是历史规划字段或迁移残留。建议 R-A 追查 git blame 定位作者意图 —— 若确认废弃，单独 PR 删掉字段 + migration，避免未来其他 session 重复掉进这个坑。

---

### Regression 风险 — 方案 A 若强行实施

| 阶段 | 影响 | 严重性 |
|------|------|--------|
| **立即 (第一次 `mvn test`)** | 本地单测可能绿，因单测通常不覆盖 @RequireRole 角色矩阵 | Low (误导性绿灯) |
| **部署 test 10011 后 R1 回跑** | J1-B1 (publish 断言 200) → 403 → FAIL。J1-C (toggle+publish) + J1-D (rollback+publish) 连锁 FAIL。J1-E 其他 publish 依赖传导 FAIL | **High — 至少 4 测试挂，可能 6+** |
| **R1 审计状态** | 从 70/70 回落至 ~64/70，E2E 绿灯碑失守，`docs/plans/v3-gap-ledger.md` 需回退标记 | **High — 士气 + 决策信心双打击** |
| **生产部署后** | 所有 `factory_super_admin` 用户无法发布/审批/回滚自己工厂的配置，必须上升至平台管理员。任何 factory_super_admin 主导的 publish 工作流立即冻结 | **Critical — 产品事故** |
| **客户通报** | 需要解释 "为什么上周能发布配置这周不能了"，且合理修复路径是 **回滚方案 A** | **Critical — 信任危机** |
| **连锁反应** | Canvas V3 双模式架构 (platform/factory) 被事实上拆掉一半，后续所有 Canvas 功能都需重新评估角色语义 | **Critical — 架构级债** |
| **修复成本** | `git revert` + R1 重跑验证 + 事后复盘 ADR + 客户解释 | 1-2 天 + 信任成本 |

**总评**: 方案 A 是典型的 **"看起来合理的机械重构" 毁掉一个绿灯周期**。R-B 证据坍塌 + R1 兼容性未验证 + 工厂 mode 未识别 = **三重漏审**，执行后损失巨大，且本来完全可避免。

---

### Methodology Note

- **Researchers deployed**: 3 (R-A 代码审计 / R-B 生产流量 / R-C E2E 执行环境)
- **Sources consulted**: Researcher outputs + Analyst output + Critic output + Integrator 2 次代码 Grep 二次验证 (j1-lifecycle.mjs + canvas-test-helpers.mjs + setAiPrompt grep + CanvasAIController/ConfigController @RequireRole 分布)
- **Key disagreements resolved**: 6 (见 Consensus 表)
- **Unresolved disagreements**: 0 — Critic 的三项 High 反驳全部基于 Integrator 亲自验证的代码证据，Analyst 方案 A 无代码级反证据可抗辩
- **Critic 翻盘数**: 3 (refuted #1, refuted #2 即 R1 兼容, invalidated R-B 证据链)
- **Integrator 二次代码验证**: 4 次 Grep/Read，全部支持 Critic 立场
- **最终采纳**: Critic 的方案 B (最小 2 处或 0 处)
- **规则应用**: `feedback_agent_team_critic_flip.md` — "Critic 有具体文件行号引用就可信，客户可见失败优先选 Critic 立场"；`feedback_subagent_code_search_unreliable.md` — Analyst 方案 A 的 "34 处机械替换" 基于 R-A 的端点计数，未进行业务域验证，属于 "子 agent 结论当假设" 未二次验证的典型错误

---

**决策**: 拒绝方案 A，采纳方案 B。R2 主线继续执行 toast 检测改进 + L4 链路深化，与 drift 讨论完全解耦。drift 问题降级为一份 ADR + 1 次针对 CanvasAIController 2 处的独立审视，可能 0 行代码改动。

**下一步**: 关闭本报告 → 回到 MEMORY.md `e2e_r1_execution` 记录的 R2 tasks #53-#59，按原计划推进。
