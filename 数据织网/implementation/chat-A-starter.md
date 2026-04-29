# Chat A 启动 prompt — 数据织网 Sub-Project A 实施

**用法**: 复制下面整个 "Prompt to paste" 区块到一个**新 Claude Code chat** (在同一仓库 root: `C:\Users\Steve\my-prototype-logistics`).

---

## Prompt to paste

```
我要实施 数据织网 (Data Fabric) Sub-Project A: 能力驱动渲染契约层.

## 背景

设计文档已完成 4 轮独立审计, 实施 ready. 关键文档:
- `数据织网/00-实施Ready总结.md` — 全局背景 + 4 sub-project 关系
- `数据织网/02-A-能力驱动渲染.md` v1.4 (1762 行) — A spec 权威源
- `数据织网/01-总览路线图.md` v1.2 — 总体规划

A 的工作量 2-2.5 周, 与 B 并行启动. A 是 B/C/D 的契约层.

## 立即开始

请按 02-A spec §7 的 Phase 0-4 实施计划开干. 第一步是 **Phase 0 (Day 0)** ALIAS pre-flight audit:

1. 查 prod (47.100.235.168 cretas_prod_db) 的 12 个 factory 的 smart_bi_pg_field_definitions
2. 统计每个 original_name 在 _ALIAS_TO_ATTR 字典里的命中率
3. 如果 ≥ 80% 命中 → 进 Day 1
4. 如果 < 80% → 必须先扩 ALIAS_TO_ATTR 表才能继续 (这是 hard gate, 不能跳过)

## 实施约束

1. **遵循 CLAUDE.md + .claude/rules/** 中所有规则, 特别是:
   - api-response-handling (统一 success/data/message 格式)
   - typescript-type-safety (无 as any)
   - jwt-token-handling (SecureStore 不 AsyncStorage)
   - database-entity-sync (PostgreSQL, JPA Entity = DB schema)
   - field-naming-convention (entity camelCase, DB snake_case, JSON camelCase)
   - server-operations (双环境 prod 10010+8083 / test 10011+8084, 重大改动先 test 后 prod)
   - concurrent-edit-safety (大 commit foreground 不 background, commit 前 git status)
   - python-services-architecture (Python 仅 8083 端口, 不分新端口)

2. **关键设计决策** (02-A v1.4 §10 已落实, 不再讨论):
   - placeholder mode 默认 placeholder (不是 hide)
   - 灰度首批 factory: F001 + RES_3101_009 (2 家)
   - requires schema 用 canonical English (store_name 等), ALIAS resolver 兼容现有中文 applies()
   - 多 sheet xlsx 智能合并已移交 B (A 不做)

3. **subagent 并行策略**: 在 chat 内部用 Task tool 派 subagent 并行做:
   - 后端 Python (smartbi/capability/)
   - 前端 Vue (web-admin/src/composables/useCapability + 组件)
   - 测试
   - 文档 / 类型定义同步

4. **smoke gate**: 完成 5 项 M1 验证才能 ship 到 prod (见 02-A spec §7 + §8.3):
   - 商品汇总上传 → Dashboard 隐藏 date 系列卡片 + 显 CTA
   - 账单流水上传 → 全部 KPI 卡片渲染
   - 同 factory 多种上传 → capability 字段并集
   - 删除 upload → capability 重算
   - Multi-tenant 隔离: F001 不影响 F002

5. **部署**: 先 test (10011+8084) 验证 ≥ 24h, 再 prod (10010+8083) 灰度 (后端 GRADUAL_ROLLOUT_FACTORIES 2 家起步, 7 天 0 incident 后扩 5 家, 再 7 天后全部 12 家).

6. **commit 节奏**: 按 02-A spec §7 的每 Phase 至少 1 个 commit (含 WIP). 关键 milestone:
   - Day 1 commit: ALIAS pre-flight audit 报告
   - Day 5 commit: capability/ 模块骨架 + 单测全绿
   - Day 10 commit: Dashboard.vue + 30 卡 wrap 完成
   - Day 13 commit: M1 全过, prod 灰度上线

## 注意事项

- A 已知未决 (02-A v1.4 §13) 留给 implementer 的 11 项 — 实施时遇到立即 ask user, 不擅自决定.
- 如果发现 v1.4 spec 有错或不一致, **立即停下来反馈**, 不强行实施错误设计.
- M1 5 项 smoke 没全过, **不允许进 M2** (即不允许 B chat 开始消费 A 的 contract).

## 立即开始

第一步: 查 prod 跑 ALIAS pre-flight audit, 给我命中率报告. 如果命中率 ≥ 80%, 进 Day 1; 否则讨论扩 ALIAS_TO_ATTR.
```

---

## Chat A 实施期间, 用户 (你) 需要做什么

1. **Day 0 之后**: implementer 报告 ALIAS 命中率. 你确认 ≥ 80% 才让 Day 1 启动.

2. **Day 5**: implementer 完成 backend, 让你 review test 环境 capability API 端点输出.

3. **Day 10**: implementer 完成 frontend, 让你看 Dashboard 在 test 环境的实际渲染效果.

4. **Day 13**: implementer 跑完 M1 5 项 smoke 报告, 你拍板是否 ship prod.

5. **Day 13+**: prod 灰度 7 天观察, 没 incident 再扩名单.

## 实施期间常见问题

| 问题 | 应对 |
|---|---|
| ALIAS 命中率 < 80% | 不进 Day 1, 先扩 ALIAS 表 (B 工作的子集前置, 1-2 天) |
| Dashboard 改造引发 element-plus 布局 bug | 灰度 50% 监控, 立即回滚到 fail-open mode (feature flag) |
| Vue 组件 build 失败 | 检查 `VITE_*` 前缀 (不是 VUE_APP_*), CARD_MANIFEST CI lint 是否通过 |
| RLS 测试不通过 | session 级 set_config 用了 `false`? 必须 `true` + transaction 包裹 (见 spec §3.3) |
| 灰度名单要扩 | 7 天 0 incident → 加 top 5; 再 7 天 → 全部 12 家 |

---

## 完成交付物

A 实施完成时, 你应该有:
- ✅ `smartbi/capability/` 模块 (calculator.py + contract.py + api.py + tests)
- ✅ `smartbi/canonical/aliases.py` (从 scripts/backfill_silver.py 搬出来)
- ✅ `web-admin/src/composables/useCapability.ts`
- ✅ `web-admin/src/components/CapabilityGate.vue` + `UnlockMoreCTA.vue`
- ✅ `web-admin/src/capability/card-manifest.ts` (~30 个卡 metadata)
- ✅ ~80 处 metadata 标注 (44 templates + 30 卡 + admin 审计页)
- ✅ E2E 5 项 smoke 全绿
- ✅ Test 环境 24h soak + Prod 灰度 (F001+RES_3101_009)

---

**重要**: B chat 必须等 A 的 contract schema (ALIAS + RequiresSpec + capability_response 接口) commit 后才启动. 见 `chat-B-starter.md` 的依赖说明.
