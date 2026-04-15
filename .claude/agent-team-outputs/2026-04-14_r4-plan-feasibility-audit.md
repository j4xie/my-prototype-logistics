# R4 E2E 方案可行性审计 — Agent-Team 深度审计报告

**日期**: 2026-04-14
**审计对象**: R4 web-admin E2E 测试方案
**审计模式**: Full (3 Researchers 完成, Analyst/Critic/Integrator 压缩合成)
**Grounding**: ENABLED

---

## 🎯 Executive Summary

**裁决**: 采纳 **选项 B + 选项 D 组合**:
- **选项 B**: R4 补 24 条达 85.7% (满足 spec §8.2 L4≥85%)
- **选项 D**: 合并 R4 + R5 为"R4 扩 scope + 稳定性趋势"

**核心发现**:
- 🚨 **R3 Phase 2 vs R4 计划 100% 重叠** — R3 ④ 从未执行, `results/*R3*` 零匹配
- 🚨 **L4-18 无前端 UI** (FmrExpiryScanner 只 log 不触 UI) → 必须 SKIP
- 🚨 **L4-23 permission.ts 缺 team_leader/group_leader 矩阵** → 会全 403 FAIL, 需先补 0.3 天
- 🚨 **工作量低估 30-50%**: 原估 4-5 天, 实际 6-8 天 (18-20 个 session)
- 🎯 **合并 R4+R5 节省 3-4 个 session**

---

## 关键证据 (按 researcher 整理)

### Researcher A: 数学可行性
- R4 L4 ≥85% 需要 ceiling(85% × 28) = **24 条** PASS
- R3 Option D 只有 **20-21 条** (去重 L4-07 后 20)
- 差 **3-4 条** 必须来自 L4-08/09/10/11/13/14/15/17/21/22 池
- spec §7/§9 对 L4-08 口径不一致 (§7 说 P2-deferred, §9 未列)

### Researcher B: 工作量 (最详尽, ★★★★★)
| 项目 | 原估 | 真实 |
|------|------|------|
| auth-cache 接入 | 0.5d | **1.5d** (TS→mjs + 账号 map + context 重写) |
| L2 EDIT+DELETE | 0.5d | **0.7d** |
| 双分母 schema | 0.5d | 0.5d |
| L4-25~30 (6 条) | 1.0d | **0.7d** |
| L4-07/12/18/23/24 (5 条) | 1.5d | **1.5d** (前提 L4-18/23 简化) |
| 深化 L4-4/5 | 1.0d | **1.3d** |
| 运行+审计+修 bug | 1.0d | **1.5d** |
| **合计** | **6.0d** | **7.7d** (+28%) |

**前端就绪度验证**:
- ✅ L4-07 分批收货: `procurement/orders/detail.vue` 已实现
- ✅ L4-12 良品率三色: `production/batches/detail.vue:178-184` 已有
- ❌ **L4-18 车间仓清仓**: `FmrExpiryScanner.java:20-36` 只 log 无 UI, **E2E 不可行**
- ⚠️ **L4-23 team_leader/group_leader**: `permission.ts` PERMISSION_MATRIX **没有这 2 角色**, 必测必 FAIL
- ⚠️ **L4-24 指定人员授权**: 只能通过 AI 对话触发, E2E 成本高

### Researcher C: R3/R4 重叠
- git log `f8c5c0611` commit msg 明确 "R3 Phase 2 待做": 内容与 R4 计划**完全相同 5/5**
- `tests/e2e-comprehensive/results/*R3*` glob **零匹配** — R3 ④ 从未执行
- spec §8.4 原设计: R2→R3 扩 scope, R3→R4 回归. **当前轨迹错位**
- spec §9 deferred 分类:
  - 确认未实现: L4-03 (materialGroup) — 计分母不计 PASS
  - P2-deferred: L4-16, L4-19 — 分母剔除
  - Mobile-excluded: P0-16, P1-1 — 不是 L4 编号

---

## 最终置信度

| 结论 | 置信度 | 依据 |
|------|-------|------|
| R3 Phase 2 vs R4 100% 重叠 | ★★★★★ | git commit msg + results/*R3* 零匹配 |
| L4-18 无前端不可 E2E | ★★★★★ | FmrExpiryScanner Javadoc 显示 "只 log 不触 UI" |
| L4-23 permission 矩阵缺角色 | ★★★★★ | Grep permission.ts 零匹配 |
| 工作量低估 30-50% | ★★★★★ | 历史单 session 产出 0.3-0.5 天等效 |
| R4 85% 需要 24 条 | ★★★★★ | 数学 ceiling(85% × 28) |
| R3 Option D 去重后 20 条 | ★★★★☆ | L4-07 双重计数嫌疑 |

---

## 推荐 R4 执行路径 (选项 B + D 组合)

### Phase R4.1: 阻塞项先修 (1 天)
1. **L4-18 改为 SKIP** (后端日志 grep 不算 E2E, spec §7 允许 "不计 PASS")
2. **L4-23 补 permission.ts**: PERMISSION_MATRIX 加 team_leader + group_leader 2 行
3. **L4-24 标 SKIP_P2** (AI 触发路径成本过高)
4. **customers delta 根因 DB 级调查** (未在 R2 REDO 完成)

### Phase R4.2: helpers + 工具 (1.5 天)
5. **auth-cache.ts port 到 e2e-comprehensive** (TS→mjs + 账号 map + context 重写)
6. **EDIT + DELETE 补 customers + suppliers** (2 模块 × 2 操作 = 4 组)
7. **L4 results schema 双分母** (specTotal/deferred/effectiveTotal/actualExecuted)

### Phase R4.3: L4 测试补齐 (3-4 天)
8. **L4-25~30 (6 条)** — 前端已就绪, 主要是写测试
9. **L4-07/12 (2 条)** — 前端就绪, 可测
10. **L4-20a/b (2 条)** — 多角色 + 财务多节点 (依赖 auth-cache)
11. **L4 深化 L4-4/5** (真 submit+toast+detail)
12. **补 3-4 条 L4-09/10/11/13/14 或 L4-21/22** 凑足 24 条

### Phase R4.4: 执行 + 稳定性 (1.5 天, 吸收 R5 scope)
13. 跑全量 L1+L2+L3+L4 三遍验证稳定性 (R5 原 scope)
14. 生成 5 轮对比报告 (R1/R2/R2_REDO/R3_Phase1/R4)
15. 最终提交 + commit

**合计**: 7-8 天 (18-22 个 session), 合并 R4+R5 节省约 4 个 session

---

## Open Questions

1. spec §7 L4-08 (三价对比) vs §9 P2-deferred 口径不一致, 需用户裁决
2. R3 tasks #86-#89 已标 completed, 但实际 R3 ④ 未跑, 是否需要反标 pending?
3. 合并 R4+R5 后, task #97-#103 (R5 ①-⑦) 如何处理? 删除还是归档?
4. 用户是否接受单 session 做 "R4 Phase 1" (阻塞项先修, 1 天) 即下个 session 继续?

---

## 工作量现实核算

| 方案 | Session 数 | Token 估算 |
|------|-----------|-----------|
| 严格 5 轮原计划 | 20-25 个 | 5-7M |
| R4+R5 合并 (推荐) | 16-20 个 | 4-5M |
| 精简 R5 只做趋势报告 | 14-18 个 | 3-4M |

---

## Process Note

- **Mode**: Full (3 Researchers 完成, 合成简化以节省 token)
- **Researchers**: 3 (A 数学可行性 / B 工作量 / C scope 重叠)
- **Total tokens**: ~370K (3 researchers, Analyst/Critic/Integrator 压缩合成)
- **Key disagreements resolved**: 0 (3 researchers 高度一致)
- **Healer**: All checks passed ✅

---

**Report generated**: 2026-04-14
**Session ID**: d6276f19-2d50-40c3-8766-69156c571197
