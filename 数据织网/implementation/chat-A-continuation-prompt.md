# Chat A Continuation Prompt — 复制下面整段到新 chat

**用法**: 打开新 Claude Code chat (在 `C:\Users\Steve\my-prototype-logistics` 仓库 root), 粘贴下面 ============ 之间的整个内容到第一条消息.

---

============ COPY START ============

# 数据织网 Sub-Project A 实施 — 接续 Day 2

我是新 chat, 接续之前另一个 chat 完成的 Day 0 (ALIAS pre-flight audit) + Day 1 (ALIAS 搬家 + 扩展). 现在要开始 Day 2-3.

## 必读 (按顺序读, 不要跳)

请用 Read 工具按顺序读以下文件, **不要 paraphrase, 完整读取**:

1. `数据织网/00-实施Ready总结.md` — 全局背景 (PM 对齐用)
2. `数据织网/01-总览路线图.md` — 总规划 (15-21 周完整版, MVP-A 5-6 周)
3. `数据织网/02-A-能力驱动渲染.md` v1.5 — A spec **权威源** (1782+ 行), 必须按它来
4. `数据织网/implementation/day0-result.md` — 上一 chat 的 Day 0 结果 (这是你的起点)
5. `backend/python/smartbi/canonical/aliases.py` — Day 1 已搬好的 ALIAS dict (26 canonical fields)
6. `.claude/rules/concurrent-edit-safety.md` — **关键!** Day 0 已经发生过一次 Apr 11 事故同模式, 必须遵守
7. `CLAUDE.md` — 项目根 README (仅看顶部 100 行了解架构)

## 当前状态 (你接手的起点)

### 已完成 (commit `a18f4c393` + `b1e429838`)

- ✅ **Day 0 ALIAS pre-flight audit**:
  - prod 0/9 factory 有完整 bill_flow shape (反而多数是 product_summary)
  - 命中率详见 `day0-result.md`
- ✅ **Day 1 ALIAS 搬家 + 扩展**:
  - `smartbi/canonical/aliases.py` 新建, 26 canonical fields
  - `scripts/backfill_silver.py` 改用 `from smartbi.canonical.aliases import ALIAS_TO_ATTR`
  - `tests/test_backfill_silver.py` 不需改 (向后兼容别名 `_ALIAS_TO_ATTR`)
  - 02-A spec 升 v1.5

### 待做 (Day 2-13)

按 02-A spec §7 实施分阶段计划:

**Phase 1: 基础设施 (Day 2-5)**:
- Day 2: `smartbi/capability/` 模块骨架 + 单测空跑
  - `calculator.py` (CapabilityCalculator class)
  - `contract.py` (RequiresSpec dataclass + RequiresSpec.is_satisfied_by / .missing_fields)
  - `api.py` (FastAPI router /api/smartbi/capability/{factory_id})
  - `tests/` (空文件, 等 Day 3 填)
- Day 3: CapabilityCalculator 实现 + 单测全绿
  - 含 §3.1 修订后的 SQL (NULLIF + advisory_xact_lock + sentinel + lazy memo + inflight + invalidation_gen)
  - 索引 migration (§3.0.1)
- Day 4: FastAPI endpoint + main.py 注册 + e2e curl 验证

**Phase 2: 模板 metadata (Day 5-7)** — 给现有 44 templates 加 `requires` ClassVar

**Phase 3: Vue 前端 (Day 7-10)** — composable + CapabilityGate + UnlockMoreCTA + Dashboard 改造

**Phase 4: 集成 + 测试 + 部署 (Day 11-13)** — E2E + Test soak + Prod 灰度 (F001 + RES_3101_009)

## 关键设计决策 (已落实, **不再讨论**)

| # | 决策 | 02-A spec 章节 |
|---|---|---|
| placeholder mode | **默认 placeholder** (帮客户理解), 关键卡显式 hide | §5.2 |
| 灰度首批 factory | F001 + RES_3101_009 (2 家) | §9.2 |
| requires schema | canonical English (`store_name` 等) + ALIAS resolver 兼容现有中文 | §2.1 |
| sentinel scheme | `source_upload_id=0` for 非 upload 来源 (manual/system) | §2.1 / §3.1 |
| Multi-worker | 当前 worker=1 OK, 后期切 Redis | §3.4 |
| RLS scope | `set_config(..., true)` + `async with conn.transaction()` | §3.1 |

## 实施约束

1. **遵循 .claude/rules/** 全部规则, 特别是:
   - `concurrent-edit-safety.md` — **大 commit 用 foreground 不用 background**, commit 前 `git status --short` 验证
   - `api-response-handling.md` — `{success, data, message}` 统一格式
   - `python-services-architecture.md` — Python 仅 8083 端口, 不分新端口
   - `database-entity-sync.md` — PostgreSQL, FORCE RLS 所有 dim_*/fact_*/agg_* 表
   - `field-naming-convention.md` — entity camelCase, DB snake_case, JSON camelCase
   - `server-operations.md` — 双环境 prod 10010+8083 / test 10011+8084, **重大改动先 test 后 prod**
   - `CREDENTIAL-MANAGEMENT.md` — 凭证从 .env 不 hardcode

2. **Subagent 并行策略** — 在本 chat 内用 Task tool 派 subagent 并行做:
   - 后端 Python (`smartbi/capability/`)
   - 前端 Vue (`web-admin/src/composables/useCapability` + 组件)
   - 测试
   - 文档同步

3. **Commit 节奏** (按 02-A §7 milestone):
   - Day 3 commit: capability/ 模块骨架 + 单测全绿
   - Day 5 commit: FastAPI 端点 + 模板 metadata 部分
   - Day 10 commit: Dashboard.vue + 30 卡 wrap 完成
   - Day 13 commit: M1 全过, prod 灰度上线

4. **Smoke Gate (M1 5 项必过)**:
   - 商品汇总上传 → Dashboard 隐藏 date 系列卡片 + 显 CTA
   - 账单流水上传 → 全部 KPI 卡片渲染
   - 同 factory 多种上传 → capability 字段并集
   - 删除 upload → capability 重算
   - Multi-tenant 隔离: F001 不影响 F002

5. **遇到问题立即 ask user, 不擅自决定**:
   - spec 有错或不一致
   - 02-A v1.4 §13 已知未决 11 项 (BU1-12 之类)
   - prod 改动前的最终确认

## 第一步立即做

读完上面 7 个必读文件后, **立即执行**:

1. 验证 Day 1 工作仍有效:
   - `python -X utf8 -c "from smartbi.canonical.aliases import ALIAS_TO_ATTR; print(len(ALIAS_TO_ATTR))"` 应输出 ~110
   - `pytest backend/python/tests/test_backfill_silver.py -x` 应全绿 (向后兼容)

2. 开始 Phase 1 Day 2:
   - 派 subagent #1: 写 `smartbi/capability/contract.py` (RequiresSpec dataclass + 单测)
   - 派 subagent #2: 写 `smartbi/capability/calculator.py` 骨架 (类签名 + 注释 placeholder)
   - 派 subagent #3: 写 `smartbi/capability/api.py` 骨架 (FastAPI router + endpoint stub)
   - 主 chat: 监督 + 协调 + 把 3 路 subagent 输出 mock 拼起来

3. 阶段性 commit (Day 2 末):
   - `feat(数据织网): A Day 2 — capability/ 模块骨架 + RequiresSpec + 单测`

## 与用户的沟通

- 用 **简短中文** 报告进度, 不要长 markdown
- 关键 milestone 暂停问 user (Day 3 单测全绿后 / Day 5 endpoint up 后 / Day 13 ship 前)
- spec 有疑问立即问, 不假设
- prod 改动前必须 user 明确同意

## 不要做的事

- ❌ 不要重写 spec — 02-A v1.5 是权威源, 实施按它来
- ❌ 不要修改 ALIAS_TO_ATTR (Day 1 已搬好, 保持不动)
- ❌ 不要在 prod 上做未测试的改动 (server-operations.md 强制 test 先行)
- ❌ 不要 push 到 origin — 等 user 明确说"push" 才推
- ❌ 不要做 spec out-of-scope 的事 (例如多 sheet 智能合并是 B 范围)

## 紧急联络

如果遇到 spec 写错 / Bug 阻塞 / Day 0 之外又有 prod 数据 surprise, 先停下来报告 user.

---

**现在请开始**: 读完 7 个必读文件, 然后立即执行"第一步立即做"的 3 个 subagent + 主 chat 协调.

============ COPY END ============

---

## 你 (steve) 在新 chat 启动后要做的

1. 把上面 ============ 之间的整段复制粘贴到新 chat
2. 等 implementer 读完 7 个文件, 它会报告 "Day 1 验证 OK, 开始 Day 2"
3. 不需要回什么, 让它继续跑 Day 2 subagent
4. Day 2 commit 后它会暂停问你 review

## 大约什么时候你会被打扰

| 时间 | implementer 暂停问 |
|---|---|
| Day 2 末 (~1-2 小时) | "Day 2 commit OK, review 一下骨架?" |
| Day 3 末 (~2-3 小时) | "Day 3 commit OK, 单测全绿, 是否进 Day 4?" |
| Day 5 末 | "Phase 2 模板 metadata 完成, 50 处 requires 标了" |
| Day 10 末 | "Vue 30 卡 wrap 完成, 看 test 环境效果?" |
| Day 13 末 | "M1 5 项 smoke 全过, 是否 ship prod?" |

**正常** Implementation 期间 implementer 应该自己跑大部分时间不打扰你. 你只需要在 milestone 拍板.
