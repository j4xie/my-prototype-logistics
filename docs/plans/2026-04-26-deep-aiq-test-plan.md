# 深度 AI 问答测评计划 v2 — 青花椒 vs 桂满陇 vs 唏嘛香

**起草日期**: 2026-04-26 (v1 → v2 用户反馈合入)
**评测对象**: SmartBI AI 问答 (web-admin 智能问答 + Python `/api/chat/general-analysis-stream` + 模板 fast-path)
**评测目标**: 用真实餐饮数据 (青花椒 + 桂满陇 + 唏嘛香) 跑老板视角的多轮问答，评测速度 + 答复质量
**前置 audit**: Apr 25 Phase C `tests/e2e-comprehensive/results/ai-audit/C-quality.md` (avg 3.1/5)；本计划是后续深度版

## v2 vs v1 变更

1. **3 tenant** (+ 唏嘛香作小型对照, 复用 R_XMX_FRESH)
2. **agent-team skill 多角色评分** (取代「我自评」)
3. **每 session 收尾审计 step** (用 agent-team — bug / 体验 / 质量 三维)
4. **题量保持 360 题** (90 主 + 270 跟进)
5. **具体问题清单 per tenant 差异化** (xmx 不问储值/撤单, 改问会员/付款)
6. **报告全中文**

---

## 0. 背景与基线

### 已有 audit 数据
- **Apr 25 Phase A 清单** (`A-inventory.md`): 13 AI surfaces 分类 + 8 LLM 模型 + 8 缓存层
- **Apr 25 Phase B 延迟** (`B-latency.md`): 3 大瓶颈 — smartRecommendChart 24s cold / nl-to-sql 12s / Dashboard insights 30-44s cold
- **Apr 25 Phase C 质量** (`C-quality.md`): 14 questions × 3 surfaces, avg 3.1/5；29% 幻觉率；最差 dish_category_breakdown
- **Apr 24 AIQuery audit** (`page-audit/aiquery-OBSERVATIONS.md`): 5 questions × Q1-Q5 visibility 截图

### Apr 26 优化已落地 (本测试要验证保留)
- Phase 10 D1.C1: AIQuery 模板 fast-path (60s → 200-300ms)
- Phase 11 H1: Dashboard preWarm cron (30-46s → 5-7ms warm)
- Phase 11 G1: 数字 labeling [按金额]/[按笔数]/[毛]/[净]
- Phase 11 I2: ACTION_REC_GUARD_CLAUSE for spec §4.3
- Phase 12 K2 + Apr 26 Item 4: 35 个模板加 §4.3 action recs
- P2 LLM 数字幻觉 guardrail (Apr 24)

### 当前 PROD 数据库状态
| factory | 名称 | uploads | rows |
|---|---|---|---|
| RES_3101_009 | QHJ_PROD | 4 (4170/4171/4169/4172) | 212,912 |
| F001 | 测试工厂 | 874 | 853,973 |
| F002 | 张记餐饮 | 29 | 10,930 |
| FOOD_3101_048 | E2E测试食品厂 | 54 | 3,564,056 |
| 其他 9 个 | 各种 demo / V2 / XMX | | |

### 数据源已盘点
**青花椒** (`smartbi维度分析/大众点评/真实餐饮连锁数据/青花椒/` + `青花椒25年/`):
| 文件 | 大小 | 类型 |
|---|---|---|
| 订单销售明细表.csv | 251M | POS 明细 (太大,本测试只取压缩后的 25年 zip) |
| 收入管理报表.xlsx | 12K | 财务 |
| 评价 Q3 2025.07-09.xlsx | 4M | 大众点评 |
| 评价 Q4 2025.10-12.xlsx | 2.4M | 大众点评 |
| 青花椒2约销量报表.csv | 668K | 商品销量 |
| 25年/商品销售明细表.zip | 5.1M | POS 明细 (压缩) |
| 25年/营业概况报表.zip | 1.2M | 月度 |
| 25年/订单付款方式汇总.zip | 32K | 付款 |
| 25年/堂食外卖占比表.zip | 4K | 渠道 |
| 25年/卡详情一览.zip | 1.2M | 储值卡 |
| 25年/区域销售报表.zip | 1.4M | 区域 |
| 25年/详细日报表.zip | 6.8M | 日报 |
| 25年/撤单报表.zip | 108K | 异常 |
| 25年/赠品统计报表.zip | 24K | 赠品 |
| 25年/卡充值统计.zip | (未确认) | 储值充值 |

**桂满陇** (`smartbi维度分析/大众点评/真实餐饮连锁数据/桂满陇*月_*`):
| 文件 | 大小 | 月份 |
|---|---|---|
| 商品销量报表 × 3 | ~4-5M each | 1月/2月/3月 |
| 桂满陇传菜统计报表 × 3 | ~2M each | 1月/2月/3月 |
| 营业概况报表 × 3 | ~1.3-3M each | 1月/2月/3月 |

---

## 1. 设计原则

1. **不动 sacred items**: Phase 6/10/11 race guards / cache-key remap / Promise.all 不能 regress
2. **不动其他 factory 数据**: 仅 truncate 测试 factory (RES_3101_009 + 新建桂满陇)
3. **真实数据 + 真实 size**: 不用 fixture (避免之前 Phase 5 false-positive)
4. **老板视角**: 问问题要像 CEO/区域经理会问的 (不是 BI 工程师 SELECT 视角)
5. **可重复**: 所有 question + scoring rubric 写成 JSON，未来可重跑对比
6. **诚实评测**: 有 hallucination 必标，幻觉 guardrail 触发也算证据

---

## 2. 数据准备 (Phase A)

### A.1 选定测试 factory (3 个 tenant)
- **青花椒** (大型连锁, 完整数据): 复用 `RES_3101_009` (qhj_prod, 已有)
- **桂满陇** (中型, 季度三月数据): 新建 `RES_GML_001` factory + 用户账号
  - 用户名 `gml_prod` / 密码 `123456` / factoryId `RES_GML_001`
  - 显式 `type='RESTAURANT'` (避免 sidebar 渲染异常)
- **唏嘛香** (小型, 单店牛肉面): 复用 `R_XMX_FRESH` (已存在)
  - 已有 4 个 demo upload (xmx_real.csv 各 203 rows) — 全部清空
  - 用户名待查; 如不存在则新建 `xmx_prod` / `123456`

### A.2 清空策略
**仅清这 3 个 factory 的 SmartBI 数据**，不动其他:
```sql
-- 备份先 (3 个 factory)
\copy (SELECT * FROM smart_bi_pg_excel_uploads WHERE factory_id IN ('RES_3101_009','RES_GML_001','R_XMX_FRESH')) TO '/tmp/3tenants_backup.csv';
\copy (SELECT * FROM smart_bi_pg_field_definitions WHERE upload_id IN (SELECT id FROM smart_bi_pg_excel_uploads WHERE factory_id IN ('RES_3101_009','RES_GML_001','R_XMX_FRESH'))) TO '/tmp/3tenants_fields.csv';
\copy (SELECT * FROM smart_bi_pg_analysis_results WHERE factory_id IN ('RES_3101_009','RES_GML_001','R_XMX_FRESH')) TO '/tmp/3tenants_results.csv';

-- DELETE cascade order
DELETE FROM smart_bi_pg_analysis_results WHERE factory_id IN ('RES_3101_009','RES_GML_001','R_XMX_FRESH');
DELETE FROM smart_bi_pg_dynamic_data WHERE factory_id IN ('RES_3101_009','RES_GML_001','R_XMX_FRESH');
DELETE FROM smart_bi_pg_field_definitions WHERE upload_id IN (SELECT id FROM smart_bi_pg_excel_uploads WHERE factory_id IN ('RES_3101_009','RES_GML_001','R_XMX_FRESH'));
DELETE FROM smart_bi_pg_excel_uploads WHERE factory_id IN ('RES_3101_009','RES_GML_001','R_XMX_FRESH');
```

### A.3 测试数据子集选定 (避免 251M csv 的传输瓶颈，专注代表性)

**青花椒** (8 文件，~22M total):
1. `青花椒2约销量报表.csv` (668K) — 商品销量
2. `收入管理报表.xlsx` (12K) — 财务月度
3. `评价Q3.xlsx` (4M) — 大众点评 12,903 行
4. `评价Q4.xlsx` (2.4M) — 大众点评
5. `25年/详细日报表.zip` 解压后 (~7M) — 日报营业
6. `25年/区域销售报表.zip` 解压后 — 区域
7. `25年/卡详情一览.zip` 解压后 — 储值卡
8. `25年/订单付款方式汇总.zip` 解压后 — 付款方式

**桂满陇** (9 文件，~25M total):
1-3. `1月/2月/3月_商品销量报表.csv` 各 ~4M
4-6. `1月/2月/3月_传菜统计报表.csv` 各 ~2M
7-9. `1月/2月/3月_营业概况报表.csv` 各 ~1.5M

**唏嘛香** (3 文件，~10M total):
1. `20260421100716739_c29cee7a081唏嘛香会员数据.xlsx` (9M) — 会员
2. `20260421100421唏嘛香4月付款报表.xls` (768K) — 付款方式
3. `唏嘛香（牛肉面）2月销量报表.xls` (88K) — 销量

---

## 3. 上传速度测试 (Phase B)

### B.1 测试矩阵 (per factory)

| 维度 | 子维度 | 度量 |
|---|---|---|
| 文件大小 | <1M / 1-5M / 5-10M / >10M | wall ms |
| 文件类型 | xlsx vs csv | wall ms diff |
| Sheet 数 | 单 / 多 | per-sheet ms |
| 行数 | <1K / 1-10K / 10-50K / >50K | rows/sec |
| Phase 分布 | upload / parse / KPI / chart / AI / γ-2c | 各 phase ms |

### B.2 度量方式
- **客户端 Playwright**: 监听 SSE event timestamps (status / chunk / sheet-progress)
- **服务端 log scrape**: `journalctl -u cretas-python --since` filter by upload_id
- **DB timing**: `smart_bi_pg_excel_uploads.upload_started_at` vs `processed_at`

### B.3 输出
`tests/e2e-comprehensive/results/depth-aiq-2026-04-26/upload-speed.json`:
合并 3 个 tenant (qhj 8 + GML 9 + XMX 3 = 20 文件)。
```json
{
  "qhj": [
    { "file": "青花椒2约销量报表.csv", "size_kb": 668, "rows": 12345, "wall_ms": 8500,
      "phases": { "upload_ms": 3200, "parse_ms": 1500, "kpi_ms": 800, "charts_ms": 2400, "ai_ms": 600, "gamma2c_ms": 200 } }
  ],
  "gml": [...]
}
```

---

## 4. 问答测试 (Phase C)

### C.1 问题分类 + 数量 (3 tenant 版)

每个 tenant 30 主问题 × 3 follow-up = 90 questions × 3 tenants = **360 questions 总量**

每 tenant 按主题分布 (差异化处理无对应数据的主题):

| 主题 | qhj 主问题 | GML 主问题 | XMX 主问题 | 老板关心点 |
|---|---|---|---|---|
| 销售排名 | 5 | 5 | 5 | 哪些菜/店赚钱最多 |
| 客单价 | 3 | 3 | 3 | 平均消费, 时段 |
| 时段/趋势 | 4 | 4 | 3 | 月/周/日/时段 |
| 评价/口碑 | 4 | 0 | 0 | 评分, 投诉, 关键词 (仅 qhj 有评价数据) |
| 退款/异常 | 3 | 0 | 0 | 撤单率 (仅 qhj 有撤单报表) |
| 储值/会员 | 3 | 0 | 4 | 储值 (qhj) / 会员消费 (xmx) |
| 渠道/堂食外卖 | 3 | 3 | 3 | 三端占比 (qhj 有堂食外卖) / 付款方式 (xmx 有付款报表) |
| 跨店比较 | 3 | 6 | 3 | qhj 8 店 / GML 1月-3月 / XMX 单店纵向 |
| 经营建议 | 2 | 4 | 4 | 套餐/促销/主推位 |
| 数据质量自审 | 0 | 5 | 5 | 「这份数据完整吗 / 怎么补」(GML/XMX 数据少, 引出 fallback 行为) |
| **合计** | 30 | 30 | 30 | |

### C.1b 90 主问题清单 (按 tenant 列出, 每题给唯一 ID)

#### 青花椒 (qhj-01..qhj-30)
**销售排名 (5)**:
1. `qhj-01` 卖得最好的菜 Top 10 是什么
2. `qhj-02` 哪家店营业额最高 / 末位是哪家
3. `qhj-03` 哪类菜品贡献最大 (主菜/凉菜/饮品/小吃)
4. `qhj-04` 单价最高 / 最低的菜分别是什么
5. `qhj-05` 销量榜首的菜在哪几家店卖得最好

**客单价 (3)**:
6. `qhj-06` 整体客单价多少, 比行业基准 (¥80-150) 怎么样
7. `qhj-07` 哪家店客单价最高 / 最低
8. `qhj-08` 不同时段客单价差异多大

**时段/趋势 (4)**:
9. `qhj-09` 一年里哪个月营业额最高 / 最低
10. `qhj-10` 周末和工作日哪个营业额更高
11. `qhj-11` 一天里哪个时段最忙 (早中晚)
12. `qhj-12` 近 3 个月营业额走势如何

**评价/口碑 (4)**:
13. `qhj-13` 整体评分是多少, 行业怎么样
14. `qhj-14` 哪家店评分最低, 主要差在哪
15. `qhj-15` 评价中最常提及的菜品是什么
16. `qhj-16` 投诉率多高, 主要投诉什么

**退款/异常 (3)**:
17. `qhj-17` 撤单率多少, 哪家店最高
18. `qhj-18` 撤单的主要原因
19. `qhj-19` 赠品损失多大, 有没有滥发现象

**储值/会员 (3)**:
20. `qhj-20` 储值卡余额总额多少
21. `qhj-21` 会员消费占比多少
22. `qhj-22` 大客户 (Top 10 储值持有者) 都是谁

**渠道/堂食外卖 (3)**:
23. `qhj-23` 堂食外卖占比是多少
24. `qhj-24` 哪个渠道客单价高
25. `qhj-25` 三端 (堂食/美团/饿了么) 哪个增长最快

**跨店比较 (3)**:
26. `qhj-26` 哪家店表现最好
27. `qhj-27` 末位店和头部差距多大
28. `qhj-28` 哪家店增长最快

**经营建议 (2)**:
29. `qhj-29` 该重点推哪个菜
30. `qhj-30` 哪类客户值得召回

#### 桂满陇 (gml-01..gml-30)
**销售排名 (5)** + **客单价 (3)** + **时段/趋势 (4)**: 同 qhj 风格但范围只有 1-3 月
**渠道 (3)**: 桂满陇没堂食外卖报表 → 改问 "传菜效率 / 出餐时间 / 堂食客流"
**跨店比较 (6)**: 月度对比 (1月 vs 2月 vs 3月) 取代多店对比
**经营建议 (4)**: 季度总结 / 春节季影响 / 套餐策略 / 主推菜调整
**数据质量自审 (5)**: "这份数据缺什么", "我没储值卡数据怎么办", "怎么补会员/付款数据" — 测系统对 missing data 的诚实度

具体清单 (gml-01..gml-30) 在执行前 1 周内列完, 写入 `qa-runner.mjs` 的 `questions.gml[]` 数组.

#### 唏嘛香 (xmx-01..xmx-30)
**销售排名 (5)** + **客单价 (3)** + **时段/趋势 (3)**: 单店纵向
**会员 (4)**: 会员频次 / 复购率 / 会员客单 / 会员流失
**付款方式 (3)**: 主流付款 / 现金占比 / 各方式金额对比
**跨店比较 (3)**: 这块改问 "时段对比 / 工作日 vs 周末 / 月度对比" (单店没多店)
**经营建议 (4)**: 牛肉面单品策略, 早餐 vs 晚餐, 价格弹性
**数据质量自审 (5)**: 同 GML

具体清单 (xmx-01..xmx-30) 在执行前 1 周内列完.

### C.2 老板视角 follow-up 模板

每个主问题 3 个跟进，从 5 个角度采样：
- **A. 为什么** (root cause): "为什么 X 这么高/低？"
- **B. 怎么办** (next action): "对 Y 该怎么调整？"
- **C. 对比** (benchmarking): "和 Z 比怎么样？"
- **D. 趋势** (time-series): "近 3 个月趋势如何？"
- **E. 假设** (what-if): "如果 W 提升 10% 会怎样？"

### C.3 质量评分 rubric (5+1 项, 满分 30) — 由 agent-team 多角色给分

**评分流程** (用 `agent-team` skill, 见 §6 Phase D 详细):
1. **研究员 × 2-3 并行**: 跑 SQL ground-truth 抽样 + 答复抓取 + 关键词匹配
2. **分析师**: 比对 ground-truth vs 答复, 算 accuracy / specificity / hallucination
3. **批评者**: 挑战分析师的打分 (是否过宽? 是否漏抓幻觉?)
4. **整合者**: 输出最终 0-5 分 + 理由

**6 维度**:
- **Accuracy** (0-5): 数字真实/正确，与 DB 抽样核对一致 (差异 <2% = 5; 2-5% = 4; 5-10% = 3; >10% = 1)
- **Specificity** (0-5): 给出具体 (店名/菜名/数字/百分比) 而非泛词
- **Hallucination** (0/5): 抓到幻觉 = 0; P2 guardrail 触发标红 = 3; 干净 = 5
- **Citation** (0-5): 是否注明 source (例如 "本月 POS 数据 1730 行" / "评价 12,903 条")
- **Action** (0-5): 是否完整 §4.3 a/b/c/d (对象/收益/前置/时间)
- **Speed** (0-5): <300ms=5 / <3s=4 / <10s=3 / <30s=2 / >30s=1

### C.4 速度分类 buckets

| Bucket | 范围 | 对应路径 |
|---|---|---|
| **Template fast-path** | <300ms TTFB | 命中 Phase 10 D1.C1 模板缓存 (Phase 12 K2 / Apr 26 Item 4 模板) |
| **Cache-aggregate** | 300ms-3s | quick_summary cached (Phase 4-7 γ-2c) |
| **LLM warm** | 3-10s | call_chain w/ provider 已预热 |
| **LLM cold** | 10-30s | DashScope/glm-5 cold start |
| **Timeout** | >30s | 异常,需调查 |

### C.5 测试方法

- **Playwright**: 走真实 web-admin /smart-bi/query 页 (验证 FE 渲染 + el-alert 幻觉警告)
- **curl SSE**: 直打 `/api/chat/general-analysis-stream` (精确测量 TTFB / total ms / chunk timing)
- **混合**: 先 curl 获 timing，再 Playwright 抽 5-10 个 visual confirm

### C.6 输出格式

`tests/e2e-comprehensive/results/depth-aiq-2026-04-26/qa-results.json`:
```json
{
  "qhj": {
    "questions": [
      {
        "id": "qhj-q1",
        "topic": "销售排名",
        "question": "哪个菜卖得最好",
        "ttfb_ms": 211,
        "total_ms": 2400,
        "source": "materialized_cache",  // or "llm_chain"
        "bucket": "template_fast_path",
        "answer": "...",
        "scores": { "accuracy": 5, "specificity": 5, "hallucination": 5, "citation": 4, "action": 4, "speed": 5, "total": 28 },
        "follow_ups": [
          { "type": "为什么", "question": "为什么这个菜卖得最好", "ttfb_ms": ..., "scores": ... },
          ...
        ],
        "hallucinations": [],  // 抓到的幻觉 list
        "guardrail_triggered": false
      }
    ]
  },
  "gml": {...}
}
```

---

## 5. 评测产出 (Phase D)

### D.1 agent-team 多角色评分流程

调用方式:
```
/agent-team 360-question SmartBI AI 问答深度测评 — 输入 qa-results.json (含问题、答复、timing)
+ ground-truth-probe.sh 输出 (SQL 真实数字), 给出每题 6 维度 0-5 评分 + 理由 + 整合报告
```

agent-team 内部分工:
- **研究员 R1**: SQL ground-truth 提取 (per-question 真实数字, 比如 "qhj 全年营业额 ¥X / Top 1 菜品 ¥Y")
- **研究员 R2**: 答复内容提取 + 数字解析 (regex 抓答复里的数字 + 实体)
- **研究员 R3** (可选): 幻觉抓手 (跨答复 cross-check / DB 反查)
- **分析师**: 比对 R1 ↔ R2 算 accuracy / specificity, 标记差异 >5% 的题目
- **批评者**: 检查分析师的打分:
  - 是否过宽? (拿 1-2 题挑战 — 比如分析师给了 5 分但其实答复用了 "约/可能/大致" 模糊语)
  - 是否漏抓幻觉? (跨题 reference 抽查)
  - speed bucket 划分是否合理?
- **整合者**: 输出 360 题 × 6 维度的 final scores CSV + per-tenant 总分 + 报告 markdown

输出:
- `tests/e2e-comprehensive/results/depth-aiq-2026-04-26/agent-team-eval/`
  - `R1-ground-truth.json`
  - `R2-answer-parse.json`
  - `R3-hallucination-list.json` (可选)
  - `analyst-scoring.csv`
  - `critic-challenges.md`
  - `integrator-final-report.md`

### D.2 文件结构
```
tests/e2e-comprehensive/results/depth-aiq-2026-04-26/
├── README.md           # 测试方法 + 复现命令
├── upload-speed.json   # Phase B
├── qa-results.json     # Phase C 原始 (问题/答复/timing)
├── quality-scores.csv  # Phase D 整合者输出
├── scripts/
│   ├── upload-test.mjs       # Phase B
│   ├── qa-runner.mjs         # Phase C
│   ├── ground-truth-probe.sh # SQL ground truth
│   └── agent-team-driver.mjs # 调度 agent-team 评分
├── agent-team-eval/    # Phase D agent-team 工作产物
│   ├── R1-ground-truth.json
│   ├── R2-answer-parse.json
│   ├── analyst-scoring.csv
│   ├── critic-challenges.md
│   └── integrator-final-report.md
└── report.md           # 总报告 (中文, 整合者输出复制 + 加封面)
```

### D.3 报告章节 (中文)
1. **执行摘要** (1 页): 上传速度 + 质量评分总分 + 5 个关键发现
2. **上传速度对比**: 3 tenants × 文件 phase 分布柱状图描述 + 异常点
3. **问答质量分项**: per-topic / per-bucket / per-tenant scores 表格 + 幻觉抓手清单
4. **模板覆盖率**: 命中 fast-path 比例 (期望 ≥70%) / LLM cold-start 占比
5. **agent-team 批评者点评**: 抓到的有争议的 / 边界 case
6. **新发现的 bug / 优化点**: 测试中浮出的具体 issue
7. **建议下一步** + 优先级

---

## 6. 执行节奏 — 分 4 session (每 session 收尾 agent-team 审计)

### 总体节奏

| Phase | 内容 | 预估时间 |
|---|---|---|
| A. 准备 | 备份 + 新建 GML/XMX factory + 清空 + 解压 zip | 30 min |
| B. 上传 | 20 文件上传 + timing 采集 | 60 min |
| C1. 主问题 | 90 主问题 × 3 tenant | 120 min |
| C2. Follow-up | 270 follow-up 跟进 | 180 min |
| D. 评测 | agent-team 多角色 + 写 report.md | 90 min |
| **总计** | | **~8h focused** |

### Session 划分 (4 session, 每 session 完用 agent-team 审计)

| Session | 内容 | 时间 | 收尾审计 |
|---|---|---|---|
| **S1: 准备 + 上传** | A + B | ~90 min | agent-team 审「上传体验 / 速度 / 失败处理」 |
| **S2: 主问题** | C1 (90 主) | ~120 min | agent-team 审「答复质量 / 幻觉 / 速度 buckets 分布」 |
| **S3: Follow-up** | C2 (270 跟进) | ~180 min | agent-team 审「跟进相关性 / 上下文连续性 / §4.3 完整度」 |
| **S4: 评测 + 报告** | D | ~90 min | agent-team 审「报告诚实度 / 是否漏掉关键负面发现」 |

### 每 session 收尾审计的 prompt 模板

调用 agent-team:
```
/agent-team 审计 SmartBI 测试 Session N 工作产物 — 维度: (1) 是否有 bug 发生 / 是否被掩盖
(2) 用户体验 (流程顺畅, 错误提示清晰, 进度可见) (3) 答复质量 (准确, 有具体数字,
有行动建议). 输入: tests/e2e-comprehensive/results/depth-aiq-2026-04-26/<session-N-output>.
输出: <session-N>-audit.md (3 维度评分 + 必须 fix 的清单 + nice-to-have 建议).
```

agent-team 内部 (与 §5.D.1 一致): 研究员 → 分析师 → 批评者 → 整合者.

### Session 间 sacred-item regression check (每 session 开头)

每 session 启动前先跑一次:
```bash
# 1. 既有功能不 regress
ssh root@47.100.235.168 "TOKEN=...; time curl -sN --max-time 10 -X POST 'http://localhost:8083/api/chat/general-analysis-stream' -H 'Authorization: Bearer $TOKEN' -d '{\"question\":\"哪家店业绩最好\"}' > /tmp/sanity.out"
# 期望: <300ms TTFB (Phase 10 D1.C1 fast-path)

# 2. Dashboard preWarm 仍然命中
... time curl /dashboard/insights/custom?period=year ...
# 期望: <10ms warm

# 3. quick-summary 4 平均X 仍正常
... curl /api/insight/quick-summary -d '{"upload_id":<qhj-review-upload>}'
# 期望: mean_cols=4
```

如有 regression, 暂停测试 + 调查根因 + commit fix 再继续.

### Session 间 commit 策略

- 每 session 结束生成的 mjs/json/csv/md 立即 commit 进 `tests/e2e-comprehensive/results/depth-aiq-2026-04-26/`
- commit message 模板: `test(depth-aiq): session N <topic> — <bullet summary>`
- agent-team 审计输出也 commit (`session-N-audit.md`)

---

## 7. 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| 251M csv 上传超时 | 高 | 不用大文件，改用 25年 zip 解压版 |
| LLM cold-start 拖慢 60+ 个 question 测试 | 中 | 测前先打 5 次 warm-up; 模板 fast-path 应覆盖 70%+ |
| 桂满陇 factory 没有 type=RESTAURANT 配置导致 sidebar 异常 | 中 | 新建时显式设 type='RESTAURANT' (跟 RES_3101_009 一样) |
| 评价数据评分维度评分大众点评格式与 prod 老的代码不兼容 | 中 | 先用 RES_3101_009 现有 4172 (评价Q3) 验证一遍 |
| 上传过程并行 session 干扰 | 中 | 测试期间在 commit 前 git status; 任何 deploy lock 等开 |
| 幻觉抓不全 | 低 | 用 SQL ground-truth probe 自动比对，标记差异 >5% |

---

## 8. 关键 ground-truth probes (写在 `ground-truth-probe.sh`)

针对每类问题，预先用 SQL 算出真实数字，作为 accuracy 评分基准:

```bash
# 青花椒 - top dish by revenue
PGPASSWORD=smartbi_secure_password_2025 psql -U smartbi_user -d smartbi_prod_db -h localhost -c "
SELECT data->>'菜品名' AS dish, SUM((data->>'实收金额')::numeric) AS rev
FROM smart_bi_pg_dynamic_data
WHERE factory_id='RES_3101_009' AND upload_id=<sales_upload_id>
GROUP BY data->>'菜品名' ORDER BY rev DESC LIMIT 5;"

# 桂满陇 - 月度营业额
... (类似 query for each topic)
```

---

## 9. 不在本次范围 (后续考虑)

- 唏嘛香 / 巴特里 / 御九井 等其他餐厅数据 — 留到下一轮
- 工厂端 (F001 - F004) AI 测试 — 不同 domain，单独评测
- 移动端 H5 AI 问答 — 用户主要从 web 问，本次只测 web
- BAT 国 / 多语言 LLM — 当前 LLM 只测中文

---

## 10. 用户决定 (v2 锁定)

| # | 议题 | v2 决定 |
|---|---|---|
| 1 | 数据子集 | qhj 8 + GML 9 + **XMX 3** = 20 文件 |
| 2 | 桂满陇 factory | `RES_GML_001` (新建) + 唏嘛香 `R_XMX_FRESH` (复用清空) |
| 3 | 执行节奏 | **分 4 session, 每 session 完 agent-team 审计** (bug + 体验 + 质量) |
| 4 | 题量 | **不砍**: 90 主 + 270 跟进 = 360 |
| 5 | 评分方式 | **agent-team 多角色** (研究员 + 分析师 + 批评者 + 整合者) + ground-truth SQL |
| 6 | 报告语言 | 中文 |

## 11. 流程图 (清晰版)

```
Session 1 (~90 min)
├─ A 准备 (备份 → 新建 GML/XMX factory → 清空 → 解压 zip)
├─ B 上传 (20 文件 + timing)
└─ 收尾 → agent-team 审计 S1 (上传体验 / 速度 / 失败处理) → commit

Session 2 (~120 min)
├─ Sacred-item regression check (Phase 10/11 fast-path 仍 < 300ms?)
├─ C1 主问题 (90 题 × 3 tenant)
└─ 收尾 → agent-team 审计 S2 (答复质量 / 幻觉 / speed bucket) → commit

Session 3 (~180 min)
├─ Sacred-item regression check
├─ C2 follow-up (270 跟进, 5 维: 为什么/怎么办/对比/趋势/假设)
└─ 收尾 → agent-team 审计 S3 (上下文连续性 / §4.3 完整度) → commit

Session 4 (~90 min)
├─ Sacred-item regression check
├─ D 评测 (agent-team 多角色 final scoring) + 写 report.md
└─ 收尾 → agent-team 审计 S4 (报告诚实度 / 漏抓的负面发现) → commit
```

---

## 附录 A: 已有 AI 问答测试脚本盘点

| 脚本 | 用途 | 复用度 |
|---|---|---|
| `aiquery-audit-prod.mjs` | Apr 24 audit, 5 questions visibility | 模板高 |
| `e2e-qhj-python-chat-30q.mjs` | 30 questions × Python chat 端到端 | 直接复用 |
| `ai-latency-profile-prod.mjs` | Apr 25 latency profiling | 改造度量逻辑 |
| `gml-quality-check.mjs` | GML 数据质量检查 | 部分复用 |
| `p2-guardrail-full.mjs` | 数字幻觉 guardrail 测试 | 直接复用 |
| `v1.1-agent-insights-e2e.mjs` | Week 5 agent layer e2e | 不直接相关 |

主测脚本会 fork `e2e-qhj-python-chat-30q.mjs` + `aiquery-audit-prod.mjs` 的混合形态。
