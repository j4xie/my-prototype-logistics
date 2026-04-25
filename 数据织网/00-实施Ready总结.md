# 数据织网 (Data Fabric) — 实施 Ready 总结

**日期**: 2026-04-25
**状态**: ✅ 5 个 spec 全部审计完成, 实施 ready
**总工作量**: 15-21 周 (单工) / 10-14 周 (多人并行) / 5-6 周 (MVP-A)

---

## 1. 5 个 spec 状态

| # | 文件 | 最终版本 | 长度 | 审计轮数 | 状态 |
|---|---|---|---|---|---|
| 01 | 总览路线图 | v1.2 (含全部同步) | 838+ 行 | (随 sub 同步) | ✅ Ready |
| 02 | A 能力驱动渲染 | **v1.4** | 1,762 行 | **4 轮** | ✅ Ready |
| 03 | B 实体解析 + 形态路由 | **v1.2** | 2,208 行 | **2 轮** | ✅ Ready |
| 04 | C 字段血统与继承 | **v1.4** | 1,438 行 | **4 轮** | ✅ Ready |
| 05 | D 联邦查询引擎 | **v1.1** | 1,047 行 | **1 轮** | ✅ Ready |

**总计**: ~7,300 行设计文档, 累计 11 轮独立审计.

---

## 2. 5-6 周 MVP-A 内容

如果不能等完整版 15-21 周, 推荐先上 MVP-A:

| Sub-Project 部分 | 内容 | 工作量 |
|---|---|---|
| **A 全部** | 契约层 + Capability gate + Trust Indicator | 2-2.5 周 |
| **B-baseline 部分** | DeterministicAgent + EmbeddingAgent (2 个) + Shape Detector + Router | 1.5-2 周 |
| 4 形态中的 2 个 | 商品汇总 + 评论 (财务 + 库存留后) | ~1 周 |
| 标注 SOP + 并发模型 | 4 天 + 0.5 周 | 1 周 |
| **MVP-A 总** | | **5-6 周** |

**MVP-A 不含**: Multi-Agent RAG B2 升级 / C 字段血统 / D 联邦查询.

**MVP-A 上线后能给客户的**:
- 任何 CSV 上传不再误导 (capability gate)
- 商品汇总 / 评论 自动识别路由
- 跨上传"唏嘛香金虹桥店" 自动识别为同一家店
- 4 个 MVP 模板可用 (商品 Top 10 + 评分趋势 + 月度收支 + 库存预警)

---

## 3. 完整版 15-21 周分解

| Sub-Project | 工作量 (单工) | 关键依赖 |
|---|---|---|
| A | 2-2.5 周 | 无 (与 B 并行) |
| B (含 Sheet Merger + 标注 + 并发 + 4 MVP 模板) | 6-9 周 | A 契约 |
| C (含 §11.5 回填 + Factory Config UI) | 4.5-6 周 | B entity_id |
| D (Query Planner + SQL Generator + 高频 20 模板迁移) | 2.5-3 周 | C provenance |
| **合计 (单工)** | **15-21 周** | |
| 多人并行 (A 与 B 并行 + 内部 subagent) | **10-14 周** | |

---

## 4. LLM 月度成本 (P50, 100 tenants)

```
模板缓存 50% 命中     ¥0
直接 SQL              ¥0
Query Planner qwen-plus  20K × ¥0.04 = ¥800
Query Planner qwen-max   5K × ¥0.30 = ¥1,500
Entity LLM 仲裁           10K × ¥0.012 = ¥120
Shape Detector           500 × ¥0.018 = ¥9
Embedding                50K × ¥0.00004 = ¥2
agent_insights (Week 5 现有)   600K × ¥0.012 = ¥7,200
─────────────────────────────────────
P50 合计                          ¥9,631 / 月
```

**单 tenant ¥96/月**, 客单价 ¥500-2000 → LLM 占 5-19% (健康).

**预算 cap**:
- 档位 1 (默认): ¥10,000/月
- 档位 2 (平衡): ¥18,000/月 (config flag toggle)
- 自动切档触发: 7 天滚动 > ¥15K → 切档 2

**P90**: ¥35,000 (cache 30% + Planner 80% + agent_insights 80%)

---

## 5. 关键技术决策 (用户已拍)

### A spec
- ✅ 命名 "数据织网" / Data Fabric
- ✅ requires schema 用 canonical English (`store_name` 等) + ALIAS resolver
- ✅ placeholder mode 默认 (帮客户理解, 关键卡显式 hide)
- ✅ 灰度首批 F001 + RES_3101_009 (2 家)

### B spec
- ✅ Multi-Agent 渐进 (B1 baseline 2 agent ≥ 88% holdout 才 ship, < 88% 进 B2 升级)
- ✅ STAFF 实体半自动 (同 store 第一次自动 INSERT, 跨 store 重名进 admin)
- ✅ Sheet Merger 用 simple `merge_status` 列 (不依赖 C, B 自包含)

### C spec
- ✅ 30% 阈值 factory-level 可配 (10-50%)
- ✅ 优先级表 factory-level 可调 (admin UI 重排)
- ✅ industry_default hardcode 27 品类 + factory override
- ✅ vacuum 用 Postgres autovacuum 默认
- ✅ superseded 历史永久保留

### D spec
- ⏸️ LLM 模型选型 (默认 qwen-plus + qwen-max 仅复杂)
- ⏸️ DSL 高频前 20 模板迁移
- ⏸️ confidence 加权平均 (主 measure 1.0, dim 0.5)
- ⏸️ Plan cache 24h TTL + capability-aware key

---

## 6. 实施前置条件 / 已知未决

### 必须前置完成
- A 的 ALIAS_TO_ATTR 搬到 `smartbi/canonical/aliases.py` (Day 1 of A)
- A 的 `pre-flight ALIAS coverage audit` (Day 0 of A, < 80% 不能进 Day 1)

### 留给 implementer (各 spec §13)
- A 11 项 (BU1-12, 含 GDPR / lifespan / tenant_ctx 等)
- B 12 项 (BU1-12, 含 currency / bilingual / staff 跨店合并 等)
- C 10 项 (CU1-10, 含 sentinel migration / multi-worker cache / GDPR 等)
- D 6 项 (DU1-6)

### 后期产品化 (不阻塞 MVP)
- 国际化 (多币种 / 多时区 / 多语言)
- POS API connector (客如云 / 银豹 / 二维火 / 美团)
- Cross-tenant benchmark
- Streaming 查询 (Week 5 SSE 已支持)

---

## 7. 实施建议

### 实施顺序

```
Week 1-2.5:  A (单独跑)
Week 1-9:    B (与 A 部分并行, A 先 ship 契约 schema 后 B 启动)
Week 9-15:   C (B 完成后启动)
Week 15-21:  D (C 完成后启动)
```

### 实施 chat 策略

**4 个 sub-project 用 4 个独立 chat**, 每个 chat 内部用 subagent 并行:

| chat | sub-project | 内部 subagent |
|---|---|---|
| Chat A | A 契约层 | Python 后端 + Vue 前端 + 测试 + admin UI |
| Chat B | B 实体解析 | 5 个 agent + Shape Detector + Router + 4 writer + 测试 |
| Chat C | C 字段血统 | schema + writer 改造 + cascade + UI + backfill + 测试 |
| Chat D | D 联邦查询 | planner + SQL gen + DSL 迁移 + 测试 |

### 每周 Smoke Gate

| Week | Milestone | Smoke 项数 |
|---|---|---|
| W2 | M1 (A 完成) | 5 项 |
| W7 | M2 (B 完成) | 7 项 |
| W12 | M3 (C 完成) | 7 项 |
| W18 | M4 (D 完成) | 6 项 |

---

## 8. 风险与应对总览

跨 5 spec 整理的关键风险:

| 风险 | 来源 | 缓解 |
|---|---|---|
| LLM 实体解析准确率 < 88% | B B1 阈值 | 量化 holdout + B2 升级 + admin queue 兜底 |
| Sheet Merger 时间推断错 | B C-6 | NULL fallback + admin 队列 |
| 1.31M 行回填阻塞 prod | C BF2 | 5K/批 + 200ms sleep + checkpoint resume |
| Multi-tenant RLS 漏配 | 全 spec | CI 自动检查 + sentinel scheme |
| LLM Provider 宕机 | 全 spec | call_chain pattern (Apr 25) + degrade to deterministic |
| LLM 月成本失控 | D | feature_breakdown cap + 自动切档 |
| 灰度 cohort F001+RES_3101_009 客户感知风险 | 全 spec | 7 项 smoke gate + 1 周观察 + 后端 503 灰度 (无 redeploy) |

---

## 9. 与现有系统的关联

数据织网项目复用现有基础设施 (不重做):

| 现有 | 复用方式 |
|---|---|
| `agent_budget_daily` (Apr 23) | LLM 预算 cap + feature_breakdown |
| `narrative_cache` (Apr 23) | Plan cache + Query result cache |
| `call_chain` (Apr 25) | LLM 宕机 fallback |
| `field_registry` (Apr 23) | 字段映射注册表 |
| `dim_resolver` 现有 | Entity Resolution 升级 |
| `entity_resolution_admin_queue` (B v1.2) | C 字段冲突复用 |
| `agent_orchestrator` (Week 5) | LLM 调用统一入口 |
| `RestaurantRuleDetector` 现有 | Shape Detector v2 (LLM-augmented) |
| 44 现有模板 | DSL 迁移高频前 20 |

---

## 10. 4 个 spec 4 周实施核对清单

每周交付物:

### Week 1 (A)
- [ ] Day 0: ALIAS pre-flight 80%+ 命中
- [ ] Day 5: capability/ 模块骨架 + 单测
- [ ] Day 10: Vue 30 卡 wrap + Admin 审计页
- [ ] Day 13: M1 5 项 smoke 全过 → ship A to F001+RES_3101_009

### Week 2-9 (B 主体, 与 A 部分并行)
- [ ] Day 0-3: 标注数据集 1200 对完成
- [ ] Day 4-14: B1 baseline (2 agent + Shape Detector + 4 writer)
- [ ] Day 15-16: B1 dev set 验证 → 是否进 B2
- [ ] Day 17-30: B2 升级 (条件)
- [ ] Day 31-46: 4 MVP 模板 + Sheet Merger + 并发
- [ ] Day 47-53: M2 7 项 smoke → ship B

### Week 10-15 (C)
- [ ] Day 1-5: field_provenance schema + 写入 + 单测
- [ ] Day 6-10: 继承 cascade
- [ ] Day 11-18: BF1-3 backfill + 双写过渡
- [ ] Day 19-26: Trust UI + Factory Config 配置页
- [ ] Day 27-30: M3 7 项 smoke → ship C, BF4 cutover

### Week 16-18 (D)
- [ ] Day 1-5: Query Planner 核心
- [ ] Day 6-9: SQL Generator
- [ ] Day 10-12: DSL + 高频 20 模板迁移
- [ ] Day 13-15: M4 6 项 smoke → ship D

---

## 11. 战略价值 (商业)

完成数据织网后, Cretas SmartBI 实现:

1. **"任何 POS 导出格式都能用"** — 商家不被锁定单一 POS, 接入门槛 0
2. **"数据来源透明可审计"** — 客户看到每个 KPI 的 confidence + 来源, 信任度高
3. **"上传越多越准确"** — 多源数据自动融合, 客户增加上传 = 系统增值
4. **"AI 原生"** — Query Planner + Multi-Agent + 自动实体解析, 是 2026 BI 标配

**vs 竞品** (客如云/二维火/哗啦啦/美味不用等):
- 他们: 锁单一 POS, 数据分析弱, AI 极少
- 我们: 跨格式融合, AI-first, 餐饮深度定制

**vs 大厂** (Snowflake Cortex / Databricks / 阿里 Dataphin):
- 他们: 通用 + 贵 (年费 50万+)
- 我们: 餐饮垂直 + SMB 友好 (¥500-2000/月)

---

## 12. 下一步

✅ **5 个 spec 已 commit, 实施 ready**

立即可做:
1. 决定: 走 MVP-A (5-6 周) 还是完整版 (15-21 周)?
2. 决定: 单工程师 vs 多人并行 (A+B 同时启动)?
3. 启动 Chat A 实施 (基于 02-A v1.4 spec)

实施开始前再确认:
- LLM 月预算 ¥10,000/月 (默认档位 1) 是否在预算内?
- 灰度首批 F001 + RES_3101_009 是否 OK?

---

**文档状态**: 实施 ready summary, 用于 PM/团队对齐