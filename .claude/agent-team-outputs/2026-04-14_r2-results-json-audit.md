# R2 E2E 测试结果 JSON 有效性审计 — Agent-Team 深度审计报告

**日期**: 2026-04-14
**审计对象**: R2 测试结果 JSON (e2e-L2-R2.json + e2e-L3L4-R2.json + e2e-L1-R1.json)
**审计模式**: Full (4-phase pipeline)
**Grounding**: ENABLED
**Agent 部署**: 3 Researchers + 1 Analyst + 1 Critic + 1 Integrator
**Commit 受审**: `c453f6c4d`

---

## 🔴 Executive Summary

**建议**: **拒绝 R2 作为 R3 基线** — 必须 revert `e2e-L2-R2.json` 到 commit 前的 15P/1F/1W 原始状态并做根因调查。

**置信度**: 高 (3 agent 共识 + Critic 代码验证确认)

**核心问题 (P0)**:
1. **L2 post-commit 重跑覆盖 FAIL** — git diff 73 行, timestamp +11min, **铁证** (Critic 0.99 confidence)
2. **L2 customers delta=6 异常** — 可能是 API 幂等性 bug 或测试并发 bug, 未调查
3. **L2 单账号 (1/15)** — 只用 factory_super_admin, 14 角色权限 bug 会漏网
4. **L4 scope 虚报** — 真实 7/30 = 23% 远低于 spec ≥60% 阈值

**Critic 翻盘撤回的过度指控**:
- ❌ "L1 100% 是假, 真实 53.7%" — R1 commit 已披露 522 是预期 403 (权限矩阵正确工作)
- ❌ "admin-R1.json 矛盾" — 是 untracked pilot 扫描, 非 L1 主来源
- ❌ "真实 10-15%" — 分层估算更接近 25-40%

---

## Key Findings (分层估算)

| Layer | R2 声称 | 真实率 (分层) | 依据 |
|-------|---------|-------------|------|
| L1 | 100% | **85-90%** | 脚本逻辑缺陷, 但功能可用率符合权限矩阵 |
| L2 | 100% (17P/0F) | **60-70%** | commit 版 15P/1F/1W 才是有效数据 |
| L3 | 100% (12P) | **40-50%** | 6 测试 × 2 record, 实际只 2 条真跨模块 |
| L4 | 100% (9P) | **25-35%** | 7/30 scope, 绝大多数只验证 hasTable |
| **综合** | **100%** | **25-40%** | 分层加权而非单一指标 |

---

## 重大发现

### Finding 1: L2 post-commit 数据篡改 (P0, 铁证)

**证据链**:
- `git show c453f6c4d:tests/e2e-comprehensive/results/e2e-L2-R2.json` → summary `{pass:15, fail:1, warn:1}`
- `git diff tests/e2e-comprehensive/results/e2e-L2-R2.json` → 73 行修改 (37+/36-) 未 stage
- commit timestamp vs 本地 timestamp → 相差 **+11 分钟**
- `customers/persistence`: commit 版 `WARNING delta=-3`, 本地版 `PASS delta=6`
- `sales_orders`: commit 版 `FAIL Timeout 60000ms`, 本地版 `PASS`

**结论**: commit 后发生了 post-commit rerun 并覆盖了原始的 FAIL/WARNING 记录。

### Finding 2: customers delta=6 异常 (P0, API 幂等性嫌疑)

- 单次 create 理论 delta=1, 实际 delta=6
- 脚本阈值 `rowsAfter > rowsBefore` 放行 (未校验 `= +1`)
- 可能原因: (a) API 幂等性 bug, (b) 测试脚本并发, (c) 残留数据未清理

### Finding 3: 单账号覆盖 (P0)

- `e2e-L2-crud.mjs:193` 只 `loginAndInit(page, 'e2e_factory_admin')`
- R0-setup.json 注册 15 账号仅用 1 个
- spec §3.5 finance_manager 白名单 + §5.2 只读验证 + §5.3 403 验证全部 0 测试

### Finding 4: L4 scope 虚报 (P0)

- spec §7 要求 30 条 L4 业务链路
- 脚本实现 7 个函数 → 9 条 record
- 真实覆盖 7/30 = 23% << spec §8.2 R2 ≥60% 阈值
- L4-25~30 + L4-20a/b + L4-07~24 共 23 条未实现也未标 SKIP

### Finding 5 (Critic 撤回): L1 100% 合理性

**Analyst 主张**: R1 totalFail=522, R2 未重跑即声称 100%, 是造假

**Critic 验证反驳**:
- R1 commit message 已披露 "0 real failures — all 522 'FAIL' are expected 403"
- `e2e-L1-spa-nav.mjs:164` 脚本把 "非 restaurant 路径的 403" 全记为 FAIL (script logic 缺陷)
- 真正问题: 脚本缺权限矩阵显式断言, 而非功能失败

**最终裁决**: 撤回"L1 100% 是假"指控, 降级为"L1 脚本需加权限矩阵预期断言" (P1)

---

## 核心分歧与最终裁决

| Topic | Analyst | Critic | 最终 |
|-------|---------|--------|------|
| L2 post-commit 重跑 | H/H 风险 | ✅ 0.99 铁证 | **成立, P0** |
| L2 delta=6 异常 | P0 真 bug | ✅ 0.9 真 | **成立, 调查根因** |
| L2 单账号 | 关键缺陷 | ✅ 0.98 真 | **成立, R3 扩展** |
| L4 scope 虚报 | 100% 全假 | ✅ 真但口径修正 (7/30=23%) | **成立, 降级为 scope 错位** |
| L3 rows=0 | 口径欺骗 | ✅ 浅测非欺骗 (0.6) | **成立降级, 测试质量问题** |
| L1 100% 是假 | Confidence 0.9 | ❌ 撤回 (R1 已披露 522=预期 403) | **撤回** |
| admin-R1 矛盾 | 支持 | ❌ 撤回 (untracked pilot) | **撤回** |
| 真实 10-15% | 严厉总评 | ❌ 分层估算 25-40% | **修正为 25-40%** |

---

## R3 Actionable Recommendations

### P0 (今日-本周必做)

1. **Revert `e2e-L2-R2.json`** 到 commit 前的 15P/1F/1W — 防止 R3 基线污染
2. **调查 customers delta=6 根因** — API 幂等性 / 测试并发 / 残留数据 三选一
3. **L2 脚本严格阈值** — `rowsAfter === rowsBefore + 1` (非 `>`)
4. **L2 扩展 ≥3 角色** — factory_super_admin + department_admin + operator
5. **L4 results schema 改双分母** — `{actualExecuted, plannedScope, specTotal:30, deferred}`
6. **L3 空集语义断言** — 区分 "接口返回空" vs "接口未实现"

### P1 (下周可做)

7. **L1 脚本加权限矩阵显式断言** — 自动区分 "expected 403" vs "unexpected 403"
8. **commit 后禁止重跑覆盖** — 加入流程/工具硬拦截

### P2 (R4+ 触发)

9. 补 L4-25~30 + L4-20a/b (6+2 条 P1 覆盖)
10. 其他 12 角色权限 403 断言
11. 跨工厂 RLS 并发验证

---

## Open Questions

1. **customers delta=6 的根因是什么?** — API 幂等性 bug / 测试脚本 bug / 并发?
2. **post-commit 重跑是人为误操作还是工具/流程缺陷?**
3. **L4 spec 30 条的真实 R2 mandatory 范围?** — L4-16/19 P2-deferred, L4-23/24 已实现
4. **其他 14 个账号的权限覆盖优先级?**
5. **L1 权限矩阵 403 预期是否有权威定义源?**

---

## Methodology Note

- **Mode**: Full
- **Researchers**: 3 (A=L2 / B=L3L4 / C=L1+R1→R2)
- **Total tokens**: ~570K (Researchers 350K + Analyst 80K + Critic 137K + Integrator 62K)
- **Total duration**: ~25 min
- **Key disagreements resolved**: 4 (全部通过 Critic 代码验证)
- **Unresolved**: 0
- **Critic 翻盘**: 3 项 Analyst 高 confidence 指控被撤回, 4 项 P0 核心指控 100% 确认
- **符合 memory `feedback_agent_team_critic_flip.md`**: "有代码行号引用即可信"

## Healer Notes: All checks passed ✅

---

**Report generated**: 2026-04-14
**Session ID**: d6276f19-2d50-40c3-8766-69156c571197
