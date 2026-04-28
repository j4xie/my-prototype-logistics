# 餐饮版产品使用手册 (含培训 onboarding) — 设计文档

**日期**: 2026-04-28
**作者**: Steve + Claude (brainstorming session)
**状态**: 待用户审批

---

## 1. 背景与目标

### 1.1 触发事件

客户 "edc" 向产品经理请求 "财务 PBI 看板 + 智能数据分析" 模块的屏幕共享培训, 原话 "我有些指数看不明白". 暴露三个事实:

1. 真实餐饮客户已经在使用产品但不会解读核心模块的输出
2. 现有 KB (`restaurant-metrics-glossary.html`, 161 chunks) 解释指数的"含义/计算口径/解读" 已经覆盖, 但缺**怎么操作产品**的内容
3. 管理端 AI 集成做完后 (Phase A 已 ship — `web-admin/src/api/foodKb.ts` + `useKbChat.ts` commit `2e8eb2972`), KB 的回答质量是触达客户的最后一公里

### 1.2 问题陈述

现有 KB 文档分布:

| 文档 | 体量 | 内容 | 缺什么 |
|---|---|---|---|
| `factory-operation-manual.html` (renamed Apr 28, commit `59fb41b7d`) | 7236 行 | 工厂语境为主 | 不适合餐饮 |
| `restaurant-metrics-glossary.html` | 2331 行 / 161 chunks | 餐饮指数定义/计算/解读 | 不讲产品操作 |
| (无) | — | **餐饮产品使用手册** | **本文档要填补** |

### 1.3 目标

构建 **餐饮版产品使用手册** (`restaurant-product-manual.html`), 同时满足:

- **培训 onboarding**: 新员工第一次开机到熟练操作
- **管理决策**: 老板/店长看到数据后怎么解读、怎么动作
- **AI KB**: 通过 `food_kb` ingest 进 RAG, 让 web-admin 管理端 AI 在客户问"这个怎么用"时能直接答

### 1.4 非目标 (Non-goals)

- **不替换** `restaurant-metrics-glossary.html` — 那个是指数字典, 与本手册职责互补
- **不嵌入截图** — RAG 不能 retrieve 二进制. 截图未来作为 UI inline help 单走
- **不用真实客户数据** — 用脱敏化示例, 隐私 + 数字会过期
- **不覆盖工厂功能** — 工厂手册由后续单独项目处理, `factory-operation-manual.html` 现状保留

---

## 2. 受众与视角策略 (Q1 答: C 双层并存)

每章上半"入门"下半"管理"两层视角. 同一功能从两个角度写.

| 视角 | 受众 | 内容侧重 | 语气 |
|---|---|---|---|
| **入门** | 新员工 (前台/收银/中台) | 路径/界面/操作步骤/常见错误 | 步骤化, 命令式 |
| **管理** | 店长/老板/区域经理 | KPI/判断框架/联动/决策场景 | 决策导向, 业务化 |

**RAG 含义**: 同一关键词 (e.g. "翻台率") 上半部分会出 chunk "怎么在 dashboard 看到翻台率", 下半部分会出 chunk "翻台率多少算健康". 客户问"翻台率怎么用"会同时命中两条, AI 综合作答.

---

## 3. 章节清单 (Q2-Q3 答: C + 全加 = 24 章; reviewer 砍掉 ⑪ 加盟体系)

### 3.1 Tier 1 — Deep first (edc 痛点 + Excel 入口)

| # | 章节 | 备注 |
|---|---|---|
| 1 | 智能数据分析 (AI Query) | edc 痛点 #1 |
| 2 | 财务 PBI 看板 | edc 痛点 #2 |
| 3 | Excel 上传与字段识别 | AI Query 的 gateway, 跟 1 紧耦合 |

### 3.2 Tier 2 — 基础流程 + 入口 (骨架先)

| # | 章节 |
|---|---|
| 4 | 登录 + 工厂/门店切换 |
| 5 | Dashboard 首页 |
| 6 | 报表中心 + 数据导出 |
| 7 | 设置 (用户/角色/通知) |
| 8 | 移动端 RN app 使用 |

### 3.3 Tier 3 — 餐饮经营核心 (骨架先)

| # | 章节 |
|---|---|
| 9 | 供应链 / 采购下单 |
| 10 | 库存管理 + 盘点 + 预警 |
| 11 | 菜品 / 配方管理 (含成本核算) |
| 12 | 食安 / 合规检查 (HACCP、留样、突发处理) |
| 13 | 多门店对比分析 |
| 14 | 收银 / POS 对接 |
| 15 | 外卖平台对接 (美团/饿了么) |
| ~~16~~ | ~~加盟体系管理~~ — **deferred to v2** (reviewer I4: 无真实加盟客户验证, 易写成 marketing copy 不可证伪) |

### 3.4 Tier 4 — 客户/营销/治理 (骨架先)

| # | 章节 |
|---|---|
| 16 | 会员分析 |
| 17 | 评价管理 (差评响应流程) |
| 18 | 营销 / 优惠券 / 活动 |
| 19 | 客户投诉与售后 |
| 20 | 数据治理 (完整度 + 质量队列) |

### 3.5 Tier 5 — 员工/运维/集成 (骨架先)

| # | 章节 |
|---|---|
| 21 | 排班 / 人效 / 员工绩效 |
| 22 | 实时人效识别 (VL 摄像头分析) |
| 23 | 数据备份与恢复 |
| 24 | 第三方 API 对接 |

### 3.6 附录 — 培训路径 (跨章节)

| 路径 | 受众 | 章节顺序 | 备注 |
|---|---|---|---|
| **A1** | 前台 / 收银 (新员工首周) | 4 → 5 → 14 → 8 → 12 | reviewer M1: cashier 不上传 Excel 不用 AI Query, 走 POS / 移动端 / 合规线 |
| **A2** | 中台 / 排班 / 财务文员 (新员工首周) | 4 → 5 → 3 → 1 → 21 → 6 | 这条才需要 Excel + AI Query, 由中台经理带 |
| B | 店长首月 | 5 → 1 → 2 → 13 → 16 → 21 | (chapter renumber 跟随 §3.4-3.5 调整, 16=会员 21=排班) |
| C | 老板月度回顾 | 2 → 5 → 13 → 16 → 11 → 6 | (16=会员) |

附录形式: 在文档末尾单列章节, 内嵌锚点链接到对应正文. 不重复内容, 只列引导路径 + 1 段总结.

---

## 4. 每章模板 (Q4 答: C 适配性)

### 4.1 Tier 1 重模板 (8 sections)

```
§N. <章节标题>
  <概述: 1 段, 这个模块解决什么餐饮经营问题>

  入门 / 怎么用 (新员工视角)
    §N.1 进入路径 (3-5 步, 文字描述菜单层级)
    §N.2 主界面 layout (描述布局区块, 不嵌图)
    §N.3 常用操作步骤 (5-8 个 step-by-step)
    §N.4 常见错误处理 (3-5 个 FAQ, "看到 X 怎么办")

  管理 / 怎么解读 (店长/老板视角)
    §N.5 关键指标速查 (列出本模块呈现的核心 KPI, 每个 1 句解读 + 链回指数字典)
    §N.6 业务判断框架 (看到 X 数据 → 想 Y → 做 Z)
    §N.7 跨章节联动 (本模块和哪些其他模块互动, 用 §X 锚点)
    §N.8 常见决策场景 (3 个真实场景, 脱敏化数字, 含建议动作)

  FAQ (3-5 条 Q&A)
  相关章节 (锚点列表)
```

预估每章 1500-2000 行 HTML.

### 4.2 Tier 2-5 轻模板 (4 sections)

```
§N. <章节标题>
  <概述: 1 段>

  入门 / 怎么用 (3-5 个 step-by-step + 1-2 个常见错误)
  管理 / 怎么解读 (1-3 个 KPI + 1-2 个判断场景, 简洁)
  FAQ (1-3 条)
  相关章节 (锚点)
```

预估每章 200-400 行 HTML 骨架, 后续按使用反馈扩到 800-1500 行.

### 4.3 体量预估

| Tier | 章节数 | 每章行数 (HTML) | 小计 |
|---|---|---|---|
| 1 (重模板, deep) | 3 | ~1800 | ~5400 |
| 2-5 (轻模板, 骨架) | 21 | ~300 | ~6300 |
| 附录 (含 A1/A2 拆分) | 4 路径 | ~150 | ~600 |
| **合计 (初版)** | — | — | **~12300 行** |

后续 Tier 2-5 按使用反馈扩到重模板 production-grade, 终版预估 ~24000-29000 行.

### 4.4 Per-chapter chunk 预算 (reviewer I1 — 防 Tier 1 霸占 top-K)

为防止 Tier 1 重模板 (30-50 chunks/章) 在 cosine top-8 retrieval 数学上霸占 Tier 2-5 轻模板 (4-8 chunks/章), 设 chunk 预算上限 + 下限:

| Tier | chunk 上限 | chunk 下限 | 控制手段 |
|---|---|---|---|
| 1 (重模板) | **12** | 8 | 章节内若超 12 chunks, 合并 §N.1-N.4 入门四块为 §N.入门 (单 chunk), §N.5-N.8 管理四块同理 |
| 2-5 (轻模板骨架) | 8 | **6** | 章节若不足 6 chunks, 加 FAQ / 决策场景 padding 到 6 |

技术实现: ingester 按 h2 切 chunk, max_chars 1200 (`document_ingester.py:46`). Tier 1 章节实测 chunk 数若超 12, **作者层面**合并 h2 → 多个 h3 共用 1 个 h2. 不改 ingester.

副作用: 强制每章 chunk 数处于 [6, 12] 区间, 让 retrieval cosine 排序更公平.

---

## 5. 文件组织 (Q5 答: A 单文件)

### 5.1 文件路径

| 路径 | 用途 |
|---|---|
| `docs/plans/restaurant-product-manual.html` | 规范源 (git 主文件) |
| `web-admin/public/restaurant-product-manual.html` | 静态站访问副本, 与规范源同步 |

### 5.2 与现有文件对仗

| 文件 | 受众语境 |
|---|---|
| `factory-operation-manual.html` | 工厂 |
| `restaurant-metrics-glossary.html` | 餐饮指数字典 |
| **`restaurant-product-manual.html`** | **餐饮产品使用 (本文档)** |

### 5.3 HTML 结构惯例 (mirror restaurant-metrics-glossary)

- `<h1>` 章节 (Tier 1-5 各章一个)
- `<h2>` 子章节 (§N.1 / §N.5 等)
- `<h3>` 三级标题 (FAQ 条目、决策场景等)
- `.metric-card` / `.subsection-card` CSS 类沿用现有指数字典样式
- 文档头 TOC 列 24 章 + 4 培训路径 (A1/A2/B/C) + §B 决策场景合成锚点

### 5.4 不嵌入资源

- 不嵌图片 / 视频 (RAG 不能 retrieve 二进制)
- 不嵌 JS (避免折叠章节被 chunker 误识别)
- 纯 HTML + CSS, mirror 现有指数字典模式

---

## 6. KB 集成方案

### 6.1 ingester 修改

`backend/python/food_kb/services/manual_ingester.py` 的 `MANUAL_SOURCES` 加新条目:

```python
{
    "path": "docs/plans/restaurant-product-manual.html",
    "title_prefix": "餐饮产品使用手册",
    "source": "restaurant-product-manual.html",
    "type": "html",
},
```

### 6.2 检索路由策略 (reviewer C1 — 修正"`source` 字段路由"的认知错误)

⚠️ **设计 bug 修正**: 之前误以为 `source` 字段能区分餐饮 vs 工厂 manual 的 retrieval. 实际上 `manual_chat.py:435` 的过滤只看 `categories=["operation_manual"]`, `source` 仅在 `SourceRef` 结果展示, **不参与 retrieval routing**. 一旦本手册 ingest, 3 个 manual (factory 7236 行 + glossary 161 chunks + 本手册) 全在同 pool 竞争 top_k=8.

**真实失败模式** (不修必踩):
- 餐饮客户问 "库存怎么管" → factory-manual.html 的"加工车间库存盘点"和本手册 §10 餐饮库存全 hit, top_k=8 可能 6:2 偏向 factory (因为 factory 7236 行 chunk 总数远多于本手册)
- 餐饮客户问 "成本怎么看" → factory "加工成本" 假阳挤掉本手册 §11 菜品成本

**采取方案**: 加 `subcategory` 字段做域路由.

**实施步骤** (写入 implementation plan):

1. **schema 改动** — `food_kb` 表加 `subcategory VARCHAR` 列 (default null), 索引 `(category, subcategory)` 替代 `(category)`
2. **ingester 改动** — `MANUAL_SOURCES` 每条加 `subcategory` 字段:
   - `factory-operation-manual.html` → `subcategory="factory"`
   - `restaurant-metrics-glossary.html` → `subcategory="restaurant"`
   - `restaurant-product-manual.html` → `subcategory="restaurant"`
3. **retriever 改动** — `KnowledgeRetriever.retrieve()` 加 `subcategories` 参数, 默认 None (不过滤 = 老行为). `manual_chat.py` 加 query domain detection: 若 query 含餐饮关键词 (门店/翻台/菜品/外卖等 ~30 个) → 传 `subcategories=["restaurant"]`, 否则 None (兼容工厂场景).
4. **counter-test** — Phase 1 ingest 后跑 10 条 representative queries (5 餐饮 + 5 中性), assert ≥4/5 餐饮 query 的 top-8 全部来自 restaurant subcategory.

**为什么不用 source field BM25 boost**: 实施成本高 (改 reranker), 也不解决 Tier 1 vs Tier 2-5 内部 imbalance (I1 走 chunk 预算). subcategory 是 schema-level fix, 一次改长期受益.

**Fallback 兼容**: 旧客户调 manual_chat 不传 `subcategories` 还是老行为不变 (3 manuals 全 retrieve). 新行为是 web-admin 集成端的 opt-in.

### 6.3 chunk title format

沿用现有 ingester `_build_title` 逻辑, 自动生成:

```
餐饮产品使用手册 | §1 智能数据分析 | §1.3 常用操作步骤
餐饮产品使用手册 | §2 财务 PBI 看板 | §2.6 业务判断框架
```

完整路径让 LLM 看到层级, 跨章节 retrieval 不会丢上下文.

### 6.4 ingest 时机

- 本设计 spec 批准后写骨架: ingest 1 次 (产生 ~30-50 chunks)
- Tier 1 production-grade 写完: ingest 1 次 (chunks 增至 ~80-120)
- 后续 Tier 2-5 按需扩: 每次扩完 ingest 1 次 (atomic swap, 无 downtime)

每次 ingest 用 `manual_ingester.py` 自带 atomic swap (temp_source + 事务), 与 factory + restaurant-metrics-glossary 一起 refresh.

### 6.5 跨章节查询合成 chunks (reviewer I2)

跨章节 query (e.g. "怎么提高客单价") 自然涉及 §1 / §2 / §11 / §16 / §18 — 单 cosine retrieval 在 top_k=8 内会被稀释. §N.7 跨章节联动锚点对 retriever 不可见.

**采取方案**: 在文档末尾加 §A.决策场景合成章节 (Synthesis chapter), 列 4-6 个高频跨章主题, 每个主题 = 1 个独立 chunk:

| 合成主题 | 整合章节 |
|---|---|
| 提高客单价 | §1 + §2 + §11 + §16 + §18 |
| 降低食材成本率 | §2 + §9 + §11 |
| 优化翻台率 | §1 + §2 + §13 + §21 |
| 复购与流失分析 | §1 + §16 + §18 |
| 多门店扩张决策 | §2 + §13 + §16 |
| 员工绩效跟客单价联动 | §21 + §22 + §16 |

每个合成 chunk 格式: 1 段问题陈述 + 4-6 步分析路径 (各步骤链 §X.Y 锚点) + 1 段决策建议. 体量约 300-500 字 / chunk.

**RAG 行为**: 用户问 "怎么提高客单价" → 合成 chunk 直接命中 (词面 + 语义), top_k=8 可能拿 1 个合成 chunk + 5 个跨章相关 chunks, AI 综合作答时优先用合成 chunk 作骨架. 比单纯靠 cosine 跨章命中可靠.

**写在哪**: 紧跟 §A 培训路径之后, 作 §B 决策场景合成. 标题 h2 "决策场景合成", 每个主题 h3.

---

## 7. 视觉与数据 (Q6+Q7 答: 不嵌图 + 脱敏化)

### 7.1 UI 描述策略

不嵌截图, 用文字描述 UI 路径. 例:

> §1.1 进入路径
>
> 1. 登录 web-admin (默认 URL: `https://admin.cretas.cn`)
> 2. 顶部导航栏点击 "智能 BI"
> 3. 左侧菜单选择 "智能数据分析"
> 4. 页面打开后, 右上角"上传 Excel"按钮在工具栏右侧

理由: RAG 不能 retrieve 图片, 文字路径在 chunks 里直接 hit 用户搜索关键词 ("智能数据分析在哪").

### 7.2 数据示例策略

用脱敏化 + 拟真示例:

> §2.6 业务判断框架: 看到食材成本率突破 38% 怎么办
>
> 假设场景: 上海某门店本月食材成本率 38.5%, 高于行业均值 32% (正餐档).
>
> 第一步: 打开"菜品成本"模块 (§11), 按毛利率升序看哪几个菜单价格倒挂.
> 第二步: 联系采购对账 (§9), 检查上月供应商均价是否上涨.
> 第三步: 如果是配方问题 (§11.5 配方调整), 联系厨师长.

不用真客户号 RES_3101_009 / qhj_prod 实际营业额. 隐私 + 数据漂移.

### 7.3 真实数据例外

仅在 Tier 1 §1 智能数据分析章节, 引用一个 demo Excel (脱敏化的 fake `demo_restaurant_sales.csv`), 描述"上传后 AI 怎么识别字段、怎么聚合". 这个 demo file 同步加到 `docs/plans/demo-data/` 让用户可下载体验.

---

## 8. 培训路径 (Q1 / Tier 4 内容)

3 条路径:

### 路径 A: 新员工首周

> 适合岗位: 前台/收银/中台 — 第一次接触系统
>
> Day 1: §4 登录 + 切换门店 (10 分钟)
> Day 2: §5 Dashboard 首页 (15 分钟)
> Day 3: §3 Excel 上传 (20 分钟, 老员工带做一次)
> Day 4: §1 智能数据分析 (30 分钟, 老员工演示一个 query)
> Day 5: §8 移动端 RN app (10 分钟)
> Day 6-7: §12 食安合规 (合规岗必学)

附录在 `restaurant-product-manual.html` 末尾, 列锚点 + 1 段引导, 不重复正文内容.

### 路径 B: 店长首月

> 适合岗位: 单店店长 — 月度数据复盘
>
> Week 1: §5 Dashboard + §1 AI Query (基础)
> Week 2: §2 财务 PBI 看板 (深入解读)
> Week 3: §13 多门店对比 (跨店视角)
> Week 4: §16 会员分析 + §21 排班/人效 (经营优化)

### 路径 C: 老板月度回顾

> 适合岗位: 老板/区域经理 — 决策视角
>
> §2 财务 PBI 看板 (营收/成本/毛利)
> §5 Dashboard (整体健康度)
> §13 多门店对比 (扩张/收缩判断)
> §16 会员分析 (复购/流失)
> §11 菜品成本 (产品组合优化)
> §6 报表中心 (导出董事会汇报)

---

## 9. 实施分期 (Phased delivery, reviewer C2 — Phase 1 拆 1a/1b 防 scope creep)

### Phase 0: schema + retriever 路由 (前置 1 个 session)

实施 §6.2 的 subcategory 路由 (C1 fix), 这是后续 ingest 能正常路由餐饮 query 的前提.

- DDL: `food_kb` 加 `subcategory` 列 + 复合索引
- ingester: `MANUAL_SOURCES` 每条加 `subcategory`
- retriever: `KnowledgeRetriever.retrieve()` 加 `subcategories` 参数
- `manual_chat.py`: 加 query domain detection (~30 餐饮关键词列表)
- 重新 ingest factory + glossary (现有 2 manual 也要打上 subcategory)
- counter-test: 10 query 验证 (5 餐饮 + 5 中性)

工时估计: **1 session (4-6 hr)**. Schema 改动 + DDL + 4 处代码改动 + 现有 2 manual 重 ingest + 验证.

### Phase 1a: Tier 1 重模板深章 (3 章 production-grade)

- §1 (AI Query) / §2 (财务 PBI) / §3 (Excel) 三章按 8-section 重模板写完整
- 每章 1500-2000 行 HTML, 合计 ~5400 行
- chunk 预算 12 chunks/章, 合计 ~36 chunks
- ingest 1 次
- 工时估计: **1 session (5-7 hr)** 单 session 可完成 (3 章而非 25)

理由: Tier 1 是 edc 客户痛点直接对应章节, 优先 production-grade 出 ROI 最快. 单 session 3 章工时实测可控.

### Phase 1b: Tier 2-5 + 附录骨架 (21 章 + 4 路径 + 6 合成 chunks)

按 milestone commit (规则 1) 拆 4-5 个 batch, 每 batch 5 章左右:

- Batch 1: §4-§8 (Tier 2 基础流程, 5 章) — 1 session 3-4 hr
- Batch 2: §9-§12 (Tier 3 前半, 4 章) — 1 session 3-4 hr
- Batch 3: §13-§15 (Tier 3 后半, 3 章) — 1 session 2-3 hr
- Batch 4: §16-§20 (Tier 4 + Tier 5 开头, 5 章) — 1 session 3-4 hr
- Batch 5: §21-§24 + 附录 A1/A2/B/C + §B 合成场景 (4 章 + 4 路径 + 6 合成 chunks) — 1 session 3-5 hr

每 batch 完成立即 commit (并发-安全 `git commit -- file1` --only mode). 单 batch 失败重做 1 batch 不全部重做.

体量 ~6300 行 HTML + ~600 行附录. ingest 总 1 次 (Batch 5 完合并 ingest).

工时估计: **5 sessions (15-22 hr)**. 跟之前误估的"1 session 3-5 hr"对齐到现实.

### Phase 2: Tier 2-5 按使用反馈扩 (长期, Phase 1b ship 后)

- 监控 KB query 日志 (`manual_chat` 入参), 找出哪几章高频问但 chunks 浅
- 每月扩 1-2 章到重模板, 长期 24 章全 production-grade
- 每次扩完 ingest 1 次

工时估计: 长期, **每月 1-2 章节奏 (~5-10 hr/章)**.

### 总工时 reality check (reviewer C2)

| Phase | 工时 | sessions |
|---|---|---|
| 0 (schema + retriever) | 4-6 hr | 1 |
| 1a (Tier 1 深) | 5-7 hr | 1 |
| 1b (Tier 2-5 骨架, 5 batch) | 15-22 hr | 5 |
| **初版总计 (Phase 0+1a+1b)** | **24-35 hr** | **7 sessions** |

- 旧 spec 估 "1 session 3-5 hr" 错得离谱, 是 7 倍量级. 修正后跟 `restaurant-metrics-glossary.html` (4358 行 / 多 session) 历史经验对齐.

---

## 10. 成功指标

### 10.1 短期 (Phase 1 ship 后 1 周)

- [ ] 客户 edc 问 "智能数据分析怎么用" → AI 命中 ≥3 chunks 来自本手册 §1
- [ ] 客户 edc 问 "财务 PBI 看板的指标怎么看" → AI 答案融合本手册 §2 + 指数字典 §1.x
- [ ] 培训路径 A/B/C 锚点跳转可用 (web-admin/public 访问 OK)

### 10.2 中期 (Phase 2 ship 后 1 月) — reviewer I1 修正 metric

- [ ] **模块定向命中率**: 对于明确指向某模块的 query (例: "怎么管会员/库存/排班"), 该模块的 chunks ≥1 个出现在 top-3. 抽样 20 query, ≥15 通过. — 替换之前的 "Tier 1 三章 ≥40%" (40% 只证明 Tier 1 chunk 多, 不证明有用)
- [ ] **跨章合成命中**: 跨章 query (例: "提高客单价") 命中 §B 决策场景合成 chunk ≥1 个出现在 top-5
- [ ] **餐饮路由命中**: 餐饮关键词 query 的 top-8 中 ≥6 个来自 `subcategory="restaurant"` (验证 §6.2 域路由生效)
- [ ] 至少 1 个新客户上线时 PM 不需要再做屏幕共享培训

### 10.3 长期 (Phase 3+ 持续)

- [ ] Tier 2-5 章节按 query 频率扩到重模板, 长期 24 章全部 production-grade
- [ ] 客户支持工时减少 (定性观察, 无硬指标)

---

## 11. 风险与应对

| # | 风险 | 概率 | 应对 |
|---|---|---|---|
| 1 | 写完发现 Tier 1 章节模板不合适, 需要调 | 中 | Phase 1a 完成后先小范围内审, 看模板是否能承接产品复杂度. 不行就调模板再扩深度 |
| 2 | RES_3101_009 真客户在使用中, KB 答的内容跟实际产品有偏差 | 中 | Phase 1a 完后, 找客户实际 AI Query log 抽 5-10 条对比. 偏差大就改章节内容 |
| 3 | 24 章骨架一次写太长, 容易并发 session 串入 (Apr 28 事故 5b) | **高** | 严格用 `git commit -- file1 file2` --only 模式. Phase 1b 拆 5 batch 每 batch 5 章, 每 batch 立即 commit (里程碑式 commit, 规则 1) |
| 4 | Tier 1 production-grade 章节最终 8000+ 行, 单文件总 30000 行后浏览器加载慢 | 低 | restaurant-metrics-glossary 330KB 已 prove out 30000 行不是问题. 真慢再拆 |
| 5 | 培训路径跟实际新员工 onboarding 流不匹配 | 中 | Phase 1b ship 后跟客户运营负责人对一次, 调路径顺序. A1/A2 拆分已经按 reviewer M1 修过 |
| **6** | **KB 内容随产品迭代腐化** (reviewer I3 — 高风险, 高频迭代模块 4-6 周必偏差) | **高** | **三层防护**: (a) PR-checklist gate — `web-admin/src/views/smart-bi/**`, `backend/python/smartbi/**`, finance 任一改动 → CODEOWNERS 提醒 reviewer 看 §1/§2 是否需要更新; (b) 季度 KB drift audit — 抽 20 真实客户 query, score AI 答案 vs 当前产品行为, 偏差 >20% 触发改章节; (c) §1 / §2 / §11 章节文件头加 `<!-- last-verified-against-product: 2026-04-28 -->` meta, 6 周不刷新 → 红色 banner 提示 |
| 7 | subcategory 域检测词表覆盖不全, 餐饮 query 漏走 restaurant 路由 | 中 | Phase 0 counter-test 跑 10 query 验证. 词表初版 30 词不够 → Phase 1a 后扩到 50-80 词 (从真实客户 query log 提取) |
| 8 | §B 合成 chunk 写得不准, 误导用户 | 中 | 6 个合成主题 Phase 1b Batch 5 写完先内审, 跟 §1/§2/§11 章节对照看建议步骤是否符合产品现状 |

---

## 12. Open Questions (设计完成前需澄清)

- **(reviewer M3 后续)** docs 目录长期归宿. 当前 `docs/plans/` 混了规划/手册/临时记录. 长期建议把所有 manual 类移到 `docs/manuals/` (factory + glossary + product 一起). 不阻塞 v1, 但 v2 该做 — 涉及 `manual_ingester.py:24-46` 4 处路径 + 1 次重 ingest. **决策推迟到 Phase 2 期间**, 列入 backlog.

---

## 13. Spec Self-Review (per brainstorming skill, reviewer M2 — 加实证 check)

- [x] **Placeholder scan**: 无 TBD / TODO / 占位符. 所有章节有具体名字和模板.
- [x] **Internal consistency**: §3 章节清单与 §3.6 培训路径锚点匹配 (§4/5/14/8/12 等都在清单内). §6 ingester 改动与 §4.3 chunk title 自动生成一致. 砍掉 ⑪ 后 §16-§24 章节编号 cascade 已传播到 §3.6 / §10 / §11.
- [x] **Scope check**: 24 章 + 4 路径 + 6 合成 chunks 是大但有边界 (不含工厂 / 不含截图 / 不含真客户号 / 加盟体系 deferred 到 v2). Phase 1a/1b 拆分防过度投资.
- [x] **Ambiguity check**:
  - "production-grade" 定义: §4.1 重模板的 8 sections 全部填齐, 不留 TODO
  - "skeleton/骨架": §4.2 轻模板 4 sections 都有内容, 但每节 1-2 段, 不深入
  - "模块定向命中率": §10.2 — 抽样 20 query, ≥15 通过 (量化判定)
  - "餐饮路由": §10.2 — 餐饮 query top-8 中 ≥6 个来自 restaurant subcategory
- [x] **(reviewer M2)** **断言 vs 实证**: 关键技术断言已配实证步骤 — §6.2 subcategory 路由配 Phase 0 counter-test (10 query 验证); §6.5 合成 chunk 配 §10.2 跨章命中 metric; §11 风险 6 drift 配三层防护 (PR-checklist gate + 季度 audit + 章节头 last-verified meta).
- [x] **Reviewer round 1 fixes 已应用**: C1 (§6.2) / C2 (§9) / I1 (§4.4 + §10.2) / I2 (§6.5) / I3 (§11 row 6) / I4 (§3.3 砍 ⑪) / M1 (§3.6 拆 A1/A2) / M2 (本节实证 check) / M3 (§12 docs/manuals 归宿).

---

## 14. 批准检查表 (用户审批前过一遍, reviewer round 2 修订)

**结构性 (Q1-Q7 锁定)**
- [ ] 24 章清单接受 (砍掉 ⑪ 加盟体系 → 留 v2)
- [ ] Tier 1 重模板 / Tier 2-5 轻模板差异接受
- [ ] 单文件 HTML 接受
- [ ] 不嵌截图接受
- [ ] 脱敏化数据接受
- [ ] 文件名 `restaurant-product-manual.html` 接受

**RAG 路由 (reviewer C1)**
- [ ] 加 `subcategory` 列做域路由 (factory / restaurant) 接受
- [ ] manual_chat.py 加 query domain detection (餐饮关键词列表) 接受
- [ ] Phase 0 counter-test (10 query 验证路由) 接受为前置步骤

**实施分期 (reviewer C2)**
- [ ] Phase 0 (schema/retriever, 1 session) → Phase 1a (Tier 1 深, 1 session) → Phase 1b (Tier 2-5 骨架, 5 batch / 5 session) → Phase 2 (反馈驱动扩)
- [ ] 总工时估计 24-35 hr / 7 sessions 接受
- [ ] Phase 1b milestone commit 节奏 (每 batch 5 章) 接受

**Chunk 设计 (reviewer I1+I2)**
- [ ] 每章 chunk 预算 [6, 12] 区间接受
- [ ] §B 决策场景合成 6 主题 (客单价/食材成本/翻台率/复购流失/扩张/绩效联动) 接受

**长期防腐 (reviewer I3)**
- [ ] PR-checklist gate (smartbi/finance 改动 → 提醒看 §1/§2)
- [ ] 季度 KB drift audit (20 query 抽样)
- [ ] 章节头 `last-verified-against-product` meta 标记

**培训路径 (reviewer M1)**
- [ ] Path A 拆 A1 (前台/收银) + A2 (中台/财务文员) 接受
- [ ] B/C 路径锚点跟随章节重编号 (16=会员 21=排班) 接受

---

## 15. 下一步

1. 用户审批本 spec → 任一项不同意 → 改完再批
2. 批准后调用 `superpowers:writing-plans` skill 写实施 plan, 把 Phase 0 + Phase 1a + Phase 1b (24 章骨架 + 4 培训路径 + 6 合成 chunk) 拆成 task 列表
3. 实施 Phase 1: 写骨架 + ingest 1 次 + 验证 KB 命中
4. Phase 1 ship 后再讨论 Phase 2 时间窗
