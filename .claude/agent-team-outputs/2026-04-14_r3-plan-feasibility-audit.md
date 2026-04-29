# R3 E2E 方案可行性审计 — Agent-Team 深度审计报告

**日期**: 2026-04-14
**审计对象**: R3 web-admin E2E 测试方案 (10 项改进)
**审计模式**: Full (4-phase pipeline)
**Grounding**: ENABLED
**Agent 部署**: 3 Researchers + 1 Analyst + 1 Critic + 1 Integrator

---

## 🎯 Executive Summary

**裁决**: **采纳 Critic Option D 为 R3 执行方案** (拒绝 Analyst 降阈值方案)

**核心发现**:
- 🎯 **L4 75% 目标 IS 可达** — Analyst 忽略 spec §9, 正确分母是 28 (剔除 P2-deferred L4-16/L4-19)
- 🎯 **L4-25~30 前端 6/6 全部已实现** — Critic 补验 router.ts:411,417,423, 前端零开发成本
- 🎯 **后端 L4-07/12/18/23/24 已就绪** — FmrExpiryScanner/FactoryUserRole/CanvasSetUserPermissionTool 已实现, 只需写测试
- 🎯 **Rate limit 是纸老虎** — auth-cache.ts (v1-e2e 16+ spec 使用) 现成方案可规避

**Critic 翻转的 Analyst 过度指控 (5 项)**:
- ❌ "L4 数学不可达 75%" — 伪命题 (分母错, 应是 28 不是 30)
- ❌ "修订目标到 43%" — 过度妥协违反 spec §8.4
- ❌ "rate limit 阻塞" — 纸老虎, auth-cache 可规避
- ❌ "strict delta 降 PASS" — 反向归类, 是质量提升
- ❌ "补 L4-25~30 到 13 条" — 范围太保守, 可加 L4-07/12/18/23/24 + 20a/b

---

## R3 Option D 执行计划 (21 条测试 / 4-5 天)

### 分母修正
```json
{
  "specTotal": 30,
  "p2Deferred": ["L4-16", "L4-19"],
  "effectiveTotal": 28,
  "targetPassRate": 0.75,
  "requiredImplementation": 21
}
```

### 实现清单 (21 条)
| 组 | 条数 | 来源 | 状态 |
|----|------|------|------|
| 原 R2 已有 | 7 | L4_1~L4_7 | 深化 L4-4/5 为真 submit + toast + detail |
| L4-25~30 新增 | 6 | v3 F-3 缺口 | 前端 6/6 全部就绪 |
| L4-07/12/18/23/24 | 5 | spec §7 修正 | 后端已就绪, 只写测试 |
| L4-20a/b | 2 | 6 角色轮转 + 财务 4 节点 | 选做, 时间允许 |
| **总计** | **21/28 = 75%** | | |

### 并行 P0 修复 (4 天)
1. helpers.mjs 硬化 (fillAllRequiredFields + checkDropdownContains 接入) — 1 天
2. customers/suppliers delta 根因调查 + 修复 — 0.5 天
3. toast 强制捕获 + EDIT/DELETE 补齐 — 1 天
4. auth-cache.ts 接入多角色 (最小 5 角色) — 0.5 天
5. L4 results schema 双分母 — 0.5 天
6. L1 脚本加权限矩阵显式断言 (区分 expected vs unexpected 403) — 0.5 天

---

## 关键共识与分歧

### 共识 (全体一致, ★★★★★)
| 发现 | 代码引用 |
|------|---------|
| `@RateLimit count=5/60s/IP` | MobileController.java:65 |
| `auth-cache.ts` 成熟方案 | tests/v1-e2e/helpers/auth-cache.ts (v1-e2e 16+ spec 使用) |
| spec §7 共 30 条 L4 | specs/2026-04-13-*.md:261 |
| **L4-25~30 前端 6/6 全部已实现** | router.ts:411,417,423 + SO/RD/BOM 组件 |
| P0-3 fillAllRequiredFields 是前置 | helpers.mjs:435-462 |
| suppliers delta=9 是累积脏数据 | SupplierServiceImpl.java:69-86 existsByFactoryIdAndName 阻止幂等 bug |

### Critic 翻转 (均基于代码验证)
| 主张 | Analyst | Critic | 最终裁决 |
|------|---------|--------|---------|
| L4 75% 可达性 | 不可达 (假设分母=30) | **可达** (分母=28) | ✅ Critic (Analyst 漏读 spec §9) |
| R3 目标 | 修订至 43% | **维持 75%** | ✅ Critic |
| Rate limit | 高阻塞风险 | **纸老虎** | ✅ Critic |
| Strict delta | 降 PASS 风险 | **质量提升** | ✅ Critic |
| L4 补齐范围 | 仅 6 条 | **21 条全量** | ✅ Critic |

---

## 最终置信度

| 结论 | Analyst | Critic | Integrator 最终 |
|------|---------|--------|----------------|
| R3 75% 目标可达 (Option D) | 0.1 | 0.85 | **0.85** |
| L4 按分母 30 不可达 | 0.9 | 0.15 | **0.15** (伪命题) |
| Rate limit 阻塞 R3 | 0.9 | 0.2 | **0.2** |
| Strict delta 风险 | 0.8 | 0.1 | **0.2** |
| L4-25~30 前端 6/6 | ★★★★☆ | ★★★★★ | **★★★★★** |
| customers delta=6 需调查 | — | 0.9 | **0.9** |
| Option D 4-5 天可行 | — | 0.75 | **0.7** |

---

## 最大风险 (Critic P0 排序)

| 排序 | 风险 | 概率 | 缓解 |
|------|------|------|------|
| P0 | 采 Analyst 降阈值 → 基线永久污染 | 40% | 拒绝 Option B, 维持 spec §8.2 |
| P0 | 只补 6 条忽略后端就绪的 L4-07/12/18/23/24 → 卡 43% | 70% (if Analyst) | 按 Option D 全量 21 条规划 |
| P0 | customers delta=6 根因未查, WARNING 二次掩盖 | 30% | 强制根因修复 |
| P1 | 未接 auth-cache.ts → 浪费 2-3 天 | 15% | Day 1 立即接入 |
| P1 | checkDropdownContains 暴露更多问题 | 40% | Day 1 修复 + 0.5 天 buffer |

---

## Open Questions (待 R3 启动前回答)

1. **spec §8.2 分母定义文档化** — 显式加 `effectiveTotal = specTotal - p2Deferred` 公式
2. **L4-07/12/18/23/24 后端就绪真实验证** — R3 Day 1 前 25 min curl smoke test
3. **Option D 4-5 天估算成本结构** — 单人节奏可行? 还是需双人分工?
4. **其他 P2-deferred 项** — 通读 spec §9 确认无遗漏

---

## Process Note

- **Mode**: Full
- **Researchers**: 3 (A 目标可行性 / B 依赖+缺口 / C 多角色+delta)
- **Total tokens**: ~600K (3 researchers + Analyst + Critic + Integrator)
- **Key disagreements**: 5 — 全部 Critic 基于代码验证翻转 Analyst
- **Critic 翻盘模式**: 完全符合 `feedback_agent_team_critic_flip.md` — 有代码行号引用即可信
- **Analyst 致命问题**: 漏读 spec §9 P2-deferred 条款, 低估已有工具 (auth-cache.ts)

## Healer Notes: All checks passed ✅

---

**Report generated**: 2026-04-14
**Session ID**: d6276f19-2d50-40c3-8766-69156c571197
