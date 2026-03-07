# 意图识别系统 91%→95% 优化推进：三线并行

**日期**: 2026-03-02
**模式**: Full | 语言: Chinese | 代码溯源: ENABLED
**基线**: E2E 91% (1116/1232), 116 条失败, Quality 100% (1230/1232)

---

## Executive Summary

采用三线并行策略推进91%→95%，但需调整预期节奏。Line B（语义描述重写）为核心突破点，Line C（阈值/短语）为快速补充，Line A（V8模型训练）为中期保障。核心风险：V8训练管线存在两处阻断性缺陷（pipeline.sh参数缺失 + 标签集三方不一致170/242/259）。时间线：Day 1-2可达92-93%（非此前预估的94-95%），Day 3-7通过Line A补充可逼近95%。

---

## Comparison Matrix

| 维度 | Line A: V8 训练管线 | Line B: 语义黑洞修复 | Line C: 阈值 + BERT-primary |
|------|-------------------|-------------------|-----------------------------|
| **预期收益** | +15~25 cases | +20~30 cases | +3~6 cases |
| **实施耗时** | 3~5 天 | 1~2 天 | 0.5~1 天 |
| **技术风险** | 高 (3阻断bug+标签集不一致) | 中 (embedding空间连锁反应) | 低 (配置级) |
| **长期价值** | 极高 — 137个弱意图根本方案 | 中 — 结构性缺陷但新意图可能复现 | 低 — 边际递减 |
| **数据就绪度** | 部分就绪 (未整合的657+3436+116条) | 需获取DB description文本 | 就绪 (shadow+推荐脚本已存在) |
| **可回滚性** | V7备份已存在 | DB description可恢复 | Properties即改即生效 |

---

## 116 失败分布

| 失败层 | 数量 | 占比 | 修复路径 |
|--------|------|------|---------|
| SEMANTIC | 88 | 76% | Line B (描述重写) + 架构改动 |
| CLASSIFIER | 15 | 13% | Line A (V8训练) |
| PHRASE_MATCH | 10 | 9% | Line C (短语补充) |
| 其他/LLM | 3 | 2% | LLM优化 |

### 三大语义黑洞意图

| 意图 | 误判数 | 典型误判模式 |
|------|--------|-------------|
| QUALITY_CHECK_CREATE | 30 | "操作对象+数量/条件"句式（如"库存50-100kg的原料"） |
| SYSTEM_HELP | 24 | 领域陌生词/语义模糊当默认兜底（如"WIP在制品"、"PO-001"） |
| MATERIAL_BATCH_RELEASE | 15 | 任务/记录/分配类动词吸引（如"分配任务给张三"） |
| **合计** | **69** | **占116条失败的59%** |

---

## Consensus & Key Disagreements

### 全员共识
- SEMANTIC层88条(76%)是绝对瓶颈
- 三大黑洞意图是最高优先修复目标
- V8训练管线有价值但存在阻断性bug需先修复
- Line A和Line B作用于不同层级（分类器 vs 语义路由器），可真正并行

### 关键分歧 → 解决

| 分歧点 | Analyst观点 | Critic观点 | 最终裁定 |
|--------|------------|-----------|---------|
| Line B预期收益 | +30-40例, 1-2天 | 过于乐观，低垂果实已被短语补丁摘过 | **下调至+20-30例** — 剩余案例含复杂语义歧义 |
| 阈值微调方向 | 0.90→0.91收紧 | 0.01调整幅度太小 | **改为策略性调整** — 对黑洞意图设二次验证门槛 |
| Line A/B依赖关系 | B先于A | 两者独立可并行 | **可并行** — 作用于不同层级，训练数据来源独立 |

---

## V8 训练管线现状

### 阻断性问题 (必须先修复)

| # | 问题 | 严重度 | 修复工作量 |
|---|------|--------|-----------|
| 1 | pipeline.sh Step 5 缺 `--new-data` 必需参数 | 阻断 | 5分钟 |
| 2 | export_training_data.py 输出 `incremental_training_data.jsonl` ≠ pipeline.sh 期望 `merged_training_data.jsonl` | 阻断 | 5分钟 |
| 3 | 标签集三方不一致: merged 170 vs metrics 242 vs V7部署 259 | 高风险 | 30分钟(重新生成label_mapping) |

### 数据资产 (待整合)

| 数据源 | 样本数 | 状态 |
|--------|--------|------|
| merged_training_data.jsonl (基线) | 19,690 | 已有 |
| shadow_adjudicated.jsonl | 657 | 已有，未整合 |
| synthetic_weak_class.jsonl | 3,436 | 已有，未整合 |
| v3-v6 augmentation 合计 | 774 | 已有，未整合 |
| e2e_failures.jsonl (转换后) | ~116 | 需转换脚本 |
| 新合成 (72个F1=0意图×30) | ~2,160 | 待生成 |
| **V8 预估合计** | **~26,833** | — |

### 分类器弱意图分布

| F1 区间 | 意图数量 |
|---------|---------|
| 0.00 (零识别) | 62 |
| 0.01–0.50 | 11 |
| 0.50–0.70 | 64 |
| 0.70–0.85 | 32 |
| 0.85–1.00 | 73 |

---

## 语义黑洞根因分析

### 机制

1. **无负例排斥**: embedding仅由 `description + keywords` 正向拼接，无任何排斥词或负向机制
2. **SYSTEM_HELP全业态曝光**: 作为COMMON_INTENT永远参与全业态相似度计算，不会被域过滤排除
3. **直接执行无纠错**: cosine similarity ≥ 0.90 直接执行，跳过LLM二次确认
4. **语义塌陷**: 学术研究(ANCE, ICLR 2021)证实——无负例训练时，语义覆盖最广的描述会向空间中心漂移成为默认命中

### 关键证据缺口
- **DB中三大黑洞意图的description文本尚未获取** — 这是根因核心证据，修复前必须获取

### 历史修复记录
IntentKnowledgeBase.java中已有6批+针对性短语补丁（注释标记"修复SEMANTIC→QUALITY_CHECK_CREATE/SYSTEM_HELP/SCHEDULING_LIST"等），说明问题反复出现但从未从description根源解决。

---

## Actionable Recommendations

### Immediate (Day 0)

1. **获取DB description文本** (10分钟)
   ```sql
   SELECT intent_code, description, keywords
   FROM ai_intent_config
   WHERE intent_code IN ('QUALITY_CHECK_CREATE','SYSTEM_HELP','MATERIAL_BATCH_RELEASE');
   ```

2. **修复V8管线3个阻断** (40分钟)
   - pipeline.sh: 添加 `--new-data`, `--old-data`, `--model-path`, `--label-mapping` 参数
   - 统一输出路径: export → merged_training_data.jsonl
   - 重新生成259标签的label_mapping.json

### Short-term (Day 1-3)

3. **Line B: 重写三大黑洞description** (1-2天, 预期+20-30)
   - QUALITY_CHECK_CREATE: 收窄至"创建新质检记录/登记质量检验"，排斥"查询/统计/报表/库存/出库/生产"
   - SYSTEM_HELP: 从兜底改为正向匹配——仅"帮助/怎么用/功能介绍/使用说明"
   - MATERIAL_BATCH_RELEASE: 限定"原材料批次放行/解锁"，排斥"任务分配/质检/人事"
   - 每改一个意图跑E2E回归，防连锁反应

4. **Line C: 补充短语 + 黑洞二次验证** (0.5天, 预期+3-6, 与Line B并行)
   - 补充typo/方言短语映射
   - 对QCC/SH/MBR三个意图：当semantic score < 0.92时强制走Reranking

5. **Line A: 启动V8训练** (Day 2-5, 管线修复后)
   - 合并全部数据源 → ~26,833样本
   - 训练配置: replay_ratio=5.0, freeze 8 layers, curriculum sampling
   - smart_weight_transfer保留V7权重

### Conditional

6. **如Line B效果<15例 → 引入负例embedding机制** (2-3天)
7. **如Day 3后<93% → 重构COMMON_INTENT路由逻辑** (架构级)
8. **如V8成功且达95% → 部署+设V7为回滚备份**

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|-----|-------|------|
| SEMANTIC层是主要瓶颈 | ★★★★★ | 3方共识, 数据直接验证 |
| 三大黑洞占59%失败 | ★★★★★ | e2e_failures.jsonl可逐条核验 |
| V8管线有阻断性缺陷 | ★★★★★ | 代码验证, pipeline.sh/export路径明确不匹配 |
| Line B可修复20-30例 | ★★★☆☆ | description文本未获取, 部分案例超出description修复范围 |
| Day 1-2可达92-93% | ★★★☆☆ | 保守估计, 取决于description重写效果 |
| Day 3-7可达94-95% | ★★★☆☆ | 依赖V8训练成功 |
| Line A长期价值最高 | ★★★★★ | 62个F1=0标签需根本解决 |

---

## Open Questions

1. **三大黑洞的DB description文本是什么？** — Line B的决策基础
2. **88条SEMANTIC失败中多少是description可修复的？** — 需逐条分类
3. **SYSTEM_HELP正确路由场景有哪些？** — 避免过度收紧
4. **V8训练能否传导到SEMANTIC路径？** — 分类器改善对语义路由的间接效果
5. **0.90阈值的false-positive分布？** — 决定阈值调整幅度

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (V8管线 + 语义黑洞 + 阈值/BERT)
- Total sources: 9 code files + 1 external paper
- Key disagreements: 3 resolved, 0 unresolved
- Phases: Research (parallel) → Analysis → Critique → Integration → Heal
- Healer: 5 checks, 1 auto-fixed (Integrator threshold value error 0.88→0.90 corrected)
