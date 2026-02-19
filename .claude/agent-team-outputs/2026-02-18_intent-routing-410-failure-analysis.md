# 意图路由 410 用例 E2E 测试 — 57 个失败案例分析

**日期**: 2026-02-18
**测试结果**: 353/410 (86%) — 原311用例98%，新增99个压力测试用例49%通过

## Executive Summary

57个失败分四类：A类架构限制(32%)、B类配置缺失(35%)、C类测试期望(12%)、D类分类器不足(21%)。系统Layer 0(matchPhrase)权力过大导致语义理解缺失。首要风险是盲目添加phrases或修改pipeline可能在353个PASS用例上造成回归。

---

## 失败分类矩阵

### A类：架构限制 (18个, 32%)

| # | 用例 | 实际结果 | 期望结果 | 具体原因 |
|---|------|---------|---------|---------|
| 2 | 新建一条猪肉的入库记录 | MATERIAL_BATCH_QUERY | CREATE | phrase"入库记录"先于CREATE，substring不理解动词 |
| 4 | 从上个月初...以及迟到早退 | UNMATCHED | ATTENDANCE_STATS | 多意图bypass("以及"触发skipPhraseShortcut) |
| 8 | 上一个新批次 | PROCESSING_BATCH_LIST | CREATE | "上"被解析为查看而非创建 |
| 14 | 李明的出勤记录 | UNMATCHED | ATTENDANCE_HISTORY | 人名"李明"打断phrase匹配，无NER |
| 16 | 把任务分配给刘伟 | UNMATCHED | TASK_ASSIGN_WORKER | "把...给"句式+人名，无NER |
| 19 | 拜托帮我录入一条入库记录 | MATERIAL_BATCH_QUERY | CREATE | phrase"入库记录"→QUERY先于CREATE |
| 20 | 能帮我下一个订单吗 | UNMATCHED | ORDER_CREATE | "下一个"被解析为"next"而非"place" |
| 21 | 猪肉快不够了 | UNMATCHED | LOW_STOCK | 间接表达无推理层 |
| 22 | 设备好像有点问题 | UNMATCHED | ALERT_LIST | 间接表达无推理层 |
| 23 | 订单好像超时了 | UNMATCHED | ORDER_TIMEOUT | 间接表达无推理层 |
| 25 | 生产批次质量报告 | PROCESSING_BATCH_LIST | QUALITY_REPORT | 同长度"生产批次"优先于"质量报告" |
| 27 | 不良品率 | QUALITY_DISPOSITION_EXECUTE | QUALITY_STATS | "不良品"→处置而非统计 |
| 30 | 消除设备报警 | EQUIPMENT_ALERT_LIST | ALERT_RESOLVE | "设备报警"→查询，忽略"消除"动词 |
| 44 | 生产线可以开了 | PROCESSING_BATCH_LIST | EQUIPMENT_START | "生产线"→查询，忽略"开了"(启动) |
| 46 | 不要这个订单了 | UNMATCHED | ORDER_DELETE | 否定式删除无法处理 |
| 47 | 退回这批原料 | MATERIAL_BATCH_QUERY | RELEASE | "原料"→查询，忽略"退回" |
| 48 | 撤销刚才的操作 | UNMATCHED | CANCEL | "撤销"抽象操作无phrase |
| 51 | 通过质检 | QUALITY_CHECK_QUERY | EXECUTE | "质检"→查询，忽略"通过"(执行) |

### B类：配置缺失 (20个, 35%)

| # | 用例 | 缺失的phrase | 目标intent |
|---|------|-------------|-----------|
| 5 | 开工了几条线 | "开工" | PRODUCTION_STATUS_QUERY |
| 6 | 做完了没有 | "做完" | TASK_PROGRESS_QUERY |
| 7 | 来一个新的牛肉批次 | "来一个" | PROCESSING_BATCH_CREATE |
| 9 | 哪里出了问题 | "出了问题"/"出问题" | ALERT_LIST |
| 12 | 库存少于100公斤的原料 | "少于"条件表达 | MATERIAL_LOW_STOCK_ALERT |
| 13 | 批次PC-2024-001的详情 | 复杂批次号stripping | BATCH_AUTO_LOOKUP |
| 24 | 这批猪肉合格吗 | "合格" | QUALITY_CHECK_QUERY |
| 28 | 几号机器报警了 | "机器" | EQUIPMENT_ALERT_LIST |
| 29 | 产线故障 | "产线"/"故障" | EQUIPMENT_STATUS_QUERY |
| 31 | 原料不够了，需要采购 | "不够"/"采购" | MATERIAL_LOW_STOCK_ALERT |
| 32 | 采购的猪肉到了没 | "到了没" | PROCUREMENT_LIST |
| 33 | 本月采购了多少猪肉 | "采购了多少" | PROCUREMENT_STATS |
| 35 | 今天几个人在干活 | "干活" | ATTENDANCE_TODAY |
| 36 | 加班申请 | "加班" | ATTENDANCE_STATS |
| 38 | 产量最高的车间 | "最高的"排名 | REPORT_PRODUCTION |
| 39 | 出勤率最低的部门 | "最低的"排名 | ATTENDANCE_STATS |
| 40 | 客户下单量排行 | "排行" | CUSTOMER_STATS |
| 41 | 全部在用设备数 | "在用" | EQUIPMENT_STATS |
| 42 | 全年营收汇总 | "营收汇总" | REPORT_FINANCE |
| 52 | 签收货物 | "签收" | SHIPMENT_STATUS_UPDATE |

### C类：测试期望不合理 (7个, 12%)

| # | 用例 | 实际结果 | 期望结果 | 判断 |
|---|------|---------|---------|------|
| 10 | 警告信息 | EQUIPMENT_ALERT_LIST | ALERT_LIST | C2:数据集合不同 |
| 11 | 什么东西出毛病了 | EQUIPMENT_ALERT_LIST | ALERT_LIST | C2:同上 |
| 15 | 王芳今天上班了吗 | ATTENDANCE_HISTORY | TODAY | C2:时间范围差异 |
| 17 | 请问现在设备运行正常吗 | EQUIPMENT_STATS | STATUS_QUERY | C1:近似可接受 |
| 37 | 与去年同期对比 | REPORT_PRODUCTION | REPORT_TRENDS | C1:都是报表类 |
| 43 | 这批牛肉检验合格 | UNMATCHED | QUALITY_MARK | C2:隐藏Bug |
| 45 | 故障排除了 | UNMATCHED | EQUIPMENT_RESUME | C2:隐藏Bug |

### D类：分类器/语义路由器不足 (12个, 21%)

| # | 用例 | 实际结果 | 期望结果 | 具体原因 |
|---|------|---------|---------|---------|
| 1 | 过期未处理的质检报告 | FOOD_KNOWLEDGE_QUERY | QUALITY_CHECK | FOOD domain过度捕获"过期" |
| 3 | 变质原材料处理记录 | FOOD_KNOWLEDGE_QUERY | QUALITY_CHECK | FOOD domain过度捕获"变质" |
| 18 | 劳驾查一下猪肉入库情况 | MATERIAL_BATCH_CREATE | QUERY | 分类器将"入库"→CREATE |
| 26 | 在产批次的检验状态 | QUALITY_CHECK_EXECUTE | QUERY | "检验"→EXECUTE而非QUERY |
| 34 | 车间人手够不够 | MATERIAL_BATCH_QUERY | ATTENDANCE | 分类器跨域误判 |
| 49 | 同意这个申请 | UNMATCHED | ORDER_APPROVAL | 审批语义未训练 |
| 50 | 驳回采购申请 | UNMATCHED | ORDER_MODIFY | 审批语义未训练 |
| 53 | 反式脂肪酸的危害 | UNMATCHED | FOOD_KNOWLEDGE | 食品安全词缺失 |
| 54 | 瘦肉精是什么 | UNMATCHED | FOOD_KNOWLEDGE | 食品安全事件词缺失 |
| 55 | 三聚氰胺事件 | UNMATCHED | FOOD_KNOWLEDGE | 同上 |
| 56 | 苏丹红有什么危害 | UNMATCHED | FOOD_KNOWLEDGE | 同上 |
| 57 | 地沟油怎么鉴别 | UNMATCHED | FOOD_KNOWLEDGE | 同上 |

---

## 统计汇总

| 类别 | 数量 | 占比 | 置信度 |
|------|------|------|--------|
| A类(架构限制) | 18 | 32% | ★★★★★ |
| B类(配置缺失) | 20 | 35% | ★★★★☆ |
| C类(测试期望) | 7 | 12% | ★★☆☆☆ |
| D类(分类器不足) | 12 | 21% | ★★★★☆ |

### 与上轮(311用例)对比

| 维度 | 311用例(v23.2) | 410用例(v24) |
|------|---------------|-------------|
| 通过率 | 304/311 (98%) | 353/410 (86%) |
| A类占比 | 2/7 (29%) | 18/57 (32%) |
| B类占比 | 3/7 (43%) | 20/57 (35%) |
| D类占比 | 1/7 (14%) | 12/57 (21%) |
| **新模式** | 无 | 间接表达、跨域混淆、隐式写入、否定操作 |

---

## 改进建议 (按优先级)

### Immediate (今日)
1. **细分B类20个用例** → 区分B1纯缺失/B2同长冲突/B3 strippedInput破坏
2. **回顾C类7个用例** → 区分C1真可接受/C2隐藏Bug
3. **建立回归测试** → 353个PASS用例作为防回归基线

### Short-term (本周)
1. **P0: FOOD domain关键词精确化** — 移除"过期"/"变质"等通用词，预期+5-6个PASS
2. **B1: 添加纯缺失phrases** — ~8个低风险phrase，预期+8个PASS
3. **P2: 轻量级正则NER** — 人名/数量剥离，预期+3-4个PASS
4. **S2: 食品安全事件词补充** — 瘦肉精/三聚氰胺/苏丹红/地沟油/反式脂肪酸，预期+5个PASS

### Conditional
1. **matchPhrase改"候选集"模式** — 仅在上述改进后F1仍<88%时触发
2. **P4: 间接表达LLM rewrite** — 仅在O3类用例>3个未解决时触发
3. **P1: 动词-名词分离匹配** — 需先完成353用例依赖度分析

### 预期改进路径
- 当前: 353/410 (86%)
- P0+B1+S2: +19个 → 372/410 (91%)
- +P2(NER): +4个 → 376/410 (92%)
- +C类修正: +2-3个 → 378/410 (92%)
- 理论上限(不改架构): ~380-385/410 (93-94%)
- 改架构后上限: ~395-400/410 (96-98%)

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (架构、分类器、NLP最佳实践)
- Key disagreements: 3 resolved (B类细分、C类公平性、P1可行性), 1 unresolved (动词-名词分离)
- Phases completed: Research → Analysis → Critique → Integration
