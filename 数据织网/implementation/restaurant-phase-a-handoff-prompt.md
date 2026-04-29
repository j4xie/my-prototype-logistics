# 餐饮 Phase A — Handoff Prompt for 新 Chat

**生成时间**: Apr 28 2026
**当前 branch**: `e2e/v1-framework`
**Plan commit**: `2b841c8b7`

---

## 目的 (Why this work matters)

**让 F002 / R_BEJ / qhj_prod 三个真餐饮工厂能在生产里跑数据闭环.**

**当前痛点 (~60% 可用)**:
1. **数据断流**: hourly cron ETL 失败后无重试. admin 看不到失败原因. 用户上传 Excel 后看不到自己数据状态.
2. **看不见缺什么**: 餐饮端没有"工厂 6 模块完整度多少%" 视图. 用户不知道哪里需补数据.
3. **admin 队列积压**: dish/store/staff/ingredient normalize 冲突 + PII 没统一界面给 admin 处理.

**Phase A 攻这 3 个洞 → 餐饮 ~75% (能 demo + 早期客户跑数据闭环).**

Phase B (LLM 自学习 normalizer) 和 Phase C (餐饮专属高级图表) 留下一轮 brainstorm.

---

## 实施路径

| 阶段 | 工作量 | 输出 |
|---|---|---|
| **W0 Spike** | 3 天 | 真 schema verify + normalizer hit rate + C handoff 协调 → 决定 spec v3 是否需要 |
| **W1 (A-1)** | 1 周 | ETL admin trigger + 重试 + 失败日志表 + admin status 页 |
| **W2 (A-2)** | 1 周 | 餐饮完整度页 (6 模块 + factoryAge 公平公式 + 5min cache) |
| **W3-4 (A-3)** | 2 周 | 共享数据质量队列 (8 entity_type + 4-eye + 批量 + Java admin-count) |
| **W4-5** | 0.5 周 | 3 smoke E2E + F002/R_BEJ/qhj_prod 真窗 verify |

**总**: 4-5 周单人, ~3500-4000 行 (含测试).

---

## 关键文件 (全部已 commit)

- **Plan** (主文件): `数据织网/implementation/restaurant-phase-a-plan-2026-04-28.md` (2803 行 / 21 tasks)
- **Spec v2** (post-audit): `数据织网/implementation/restaurant-phase-a-only-2026-04-28-design.md` (558 行)
- **Spec v1 历史**: `数据织网/implementation/restaurant-phase-ab-2026-04-28-design.md` (含 30% 错误假设, 仅参考别用)
- **Architecture ADR**: `数据织网/implementation/post-day30-architecture-gap.md`
- **Chart audit ADR**: `数据织网/implementation/post-day30-chart-audit-findings.md`

---

## ⚠️ W0 Spike 必做不可跳

3 个 spike 输出**决定 W1+ 是否需要 spec v3**. v1 spec 因为没 W0 就直接写, audit 抓出 30% 假设错 (5 P0 + 11 P1).

**W0.1 — Schema verify** (半天):
- SSH 47.100.235.168, 在 smartbi_db 跑 `\d entity_resolution_admin_queue`
- 看真列名 / CHECK constraint / 现有 row 数
- 如果列名跟 spec v2 §2.3 对不上 → 写 W0 spike report 标记差异 → 决定是否 spec v3

**W0.2 — Normalizer hit rate** (1 天):
- 跑 `dish_name_normalizer.py` 在 RES_3101_009 真菜品数据 (~200 行)
- 出 hit rate 报告 (命中 / 漏掉的样本)
- **路径决策**: <60% 命中 → 必做 Phase B (LLM); 60-85% → A 完成后 brainstorm B; >85% → A 够用, 暂停 B

**W0.3 — C handoff 协调** (1 天):
- 数据织网 C session 是否已落 `field_conflict` entity_type
- 决定: 协-α 复用 C / 协-β 我加 / 协-γ 各自做 — 锁路径

---

## 执行模式 (Subagent-Driven)

**REQUIRED SUB-SKILL**: `superpowers:subagent-driven-development`

每个 task 派一个 fresh subagent 干完, 主 chat 做 review. 21 tasks → 21 个 subagent 派遣 (W0 4 个比较短, A-1 6 个, A-2 2 个, A-3 6 个, smoke 3 个).

每完成一个 task 就用 `superpowers:requesting-code-review` 派 code-reviewer 抽查 — 防 30% 假设错的事再发生.

---

## 真窗 verify 三工厂 (W4-5 必做)

| 工厂 | 凭证 | 重点 |
|---|---|---|
| **F002 (餐饮管理 默认)** | 默认登录 | 完整度页 6 模块 + admin 工厂列表 + 数据质量队列 store/product |
| **R_BEJ** | buerjun_admin / 123456 | BEJ 1081 行营业数据反映在完整度页, 历史 admin queue row 显示 |
| **qhj_prod** | XMX 真客户 (test env) | 完整度页满 coverage + AI Query 真数据闭环 |

测试环境: `http://139.196.165.140:8097` (web-admin) + `:10011` (Java) + `:8084` (Python)
生产: `:8086` (web-admin) + `:10010` (Java) + `:8083` (Python) — Phase A 完成后再考虑部 prod

---

## 启动命令 (新 chat 第一句话)

```
请读 数据织网/implementation/restaurant-phase-a-plan-2026-04-28.md
跟 数据织网/implementation/restaurant-phase-a-only-2026-04-28-design.md (spec v2),
然后用 superpowers:subagent-driven-development 实施.

⚠️ W0 spike 必做, 不要跳过直接进 W1.
从 Task 0.1 (entity_resolution_admin_queue schema verify) 开始.
```

---

## 完整复制粘贴 prompt (给新 chat 第一条消息)

请直接粘贴下面整个块到新 chat:

```
我要继续实施餐饮端 Phase A. 请读以下 3 个文件然后用 superpowers:subagent-driven-development 走 task-by-task:

1. 数据织网/implementation/restaurant-phase-a-plan-2026-04-28.md (主 plan, 2803 行 21 tasks)
2. 数据织网/implementation/restaurant-phase-a-only-2026-04-28-design.md (spec v2)
3. 数据织网/implementation/restaurant-phase-a-handoff-prompt.md (背景 + 目的)

目的: 让 F002/R_BEJ/qhj_prod 三个真餐饮工厂能在生产里跑数据闭环 (~60% → ~75%).
当前 branch: e2e/v1-framework, 起点 commit: 2b841c8b7.

⚠️ W0 spike (Section 0, Task 0.1-0.4) 必做不可跳. v1 spec 因为没 W0 直接写, audit 抓出 30% 假设错 (5 P0). 从 Task 0.1 开始 (entity_resolution_admin_queue 真 schema verify on 47.100.235.168 smartbi_db).

每完成一个 task 派 superpowers:code-reviewer 抽查. 4-5 周单人工作量.
```

---

## After Phase A 完成

1. 更新 memory: 写 `project_apr28_restaurant_phase_a_complete.md` 含 commit hash 列表 + 真窗 verify 截图引用
2. Brainstorm Phase B (基于 W0.2 normalizer hit rate 报告)
3. Phase C placeholder 排到 Month 2

---

**作者**: Claude Opus 4.7 + Steve (brainstorm + audit + writing-plans + handoff)
