# 数据织网 实施指南

设计阶段已完成 (5 个 spec, 11 轮独立审计). 本目录给 implementer 用.

## 启动顺序

```
Day 0   ──┬─ Chat A 启动 (基于 chat-A-starter.md)
          │  └─ ALIAS pre-flight audit
          │
Day 4   ──┴─ Chat B 启动 (基于 chat-B-starter.md, 等 A 的 ALIAS commit 后)
              └─ Phase 0 标注 (Day 0-3 可与 A 完全并行)
              └─ Phase 1 baseline (Day 4 起需 A 的契约)

Week 7-9     A + B 完成 M1 / M2
Week 9-15    Chat C 启动 (chat-C-starter.md 待写)
Week 15-18   Chat D 启动 (chat-D-starter.md 待写)
```

**总计**: 15-21 周 (单工) / **10-14 周 (A+B 并行)** / **5-6 周 (MVP-A only)**

## 文件清单

| 文件 | 用途 |
|---|---|
| `README.md` | 本文档 |
| `chat-A-starter.md` | Chat A 启动 prompt (粘贴到新 chat) |
| `chat-B-starter.md` | Chat B 启动 prompt (A Day 4+ 后启动) |
| `chat-C-starter.md` | (待写, B 完成后再写) |
| `chat-D-starter.md` | (待写, C 完成后再写) |

## 启动 Chat A 步骤

1. 打开新 Claude Code chat (在 `C:\Users\Steve\my-prototype-logistics` 仓库)
2. 复制 `chat-A-starter.md` 中的 "Prompt to paste" 区块
3. 粘贴到新 chat 的第一条消息
4. implementer 自动开始 Phase 0 (ALIAS pre-flight audit)

## 启动 Chat B 步骤

**等待条件**: A chat 已 commit:
- `smartbi/canonical/aliases.py` 存在 (ALIAS 搬家完成)
- `smartbi/capability/contract.py` 存在 (RequiresSpec 定义)
- A chat 报告 "Day 3 完成 contract API 骨架"

**满足条件后**:
1. 打开**第 2 个新** Claude Code chat (同仓库)
2. 复制 `chat-B-starter.md` 中的 "Prompt to paste"
3. 粘贴启动

## 跨 chat 协调

- A chat 和 B chat **不要修改同一文件** (违反 `.claude/rules/concurrent-edit-safety.md`)
- A: `smartbi/capability/` + `web-admin/src/composables/useCapability.ts` + `Dashboard.vue`
- B: `smartbi/canonical/` + 新建 `smartbi/canonical/writers/` + 新建 dim/fact 表
- 共享: 只读 `smartbi/canonical/aliases.py` (A 写, B 只 import 不改)

## 紧急联络 / 决策 escalation

- 标注一致率 < 0.7 (Cohen kappa) → user 决定是否重做 SOP
- B1 dev set 准确率 88-90% 边缘 → user 决定走 B2 与否
- ALIAS 命中率 < 80% → user 决定先扩 ALIAS (B 工作前置) 还是接受空 capability
- LLM cost 超 ¥10K/月 → user 决定切档 2 (¥18K) 或砍 agent_insights
- 灰度名单扩展时机 → user 拍 (默认 7 天 0 incident → 加 5 家)

## 已完成的设计文档 (不要重写)

| 文件 | 版本 | 行数 | 状态 |
|---|---|---|---|
| `数据织网/00-实施Ready总结.md` | - | 265 | PM 对齐 |
| `数据织网/01-总览路线图.md` | v1.2 | 838+ | 总规划 |
| `数据织网/02-A-能力驱动渲染.md` | v1.4 | 1762 | 4 轮审计 |
| `数据织网/03-B-实体解析与形态路由.md` | v1.2 | 2208 | 2 轮审计 |
| `数据织网/04-C-字段血统与继承.md` | v1.4 | 1438 | 4 轮审计 |
| `数据织网/05-D-联邦查询引擎.md` | v1.1 | 1047 | 1 轮审计 |

如果在实施时发现 spec 有错或不一致, **不要擅自修改 spec**, 立即反馈给 user 决策.

## Smoke Gate 验收标准

| Milestone | Smoke 项数 | spec 引用 |
|---|---|---|
| M1 (A 完成) | 5 项 | 02-A §7 + §8.3 |
| M2 (B 完成) | 7 项 | 03-B §10 Phase 5 + §11.5 |
| M3 (C 完成) | 7 项 | 04-C §7 P5 + §8.3 |
| M4 (D 完成) | 6 项 | 05-D §7 P4 + §8.3 |

每个 milestone smoke 不全绿, **不允许进下一阶段**.
