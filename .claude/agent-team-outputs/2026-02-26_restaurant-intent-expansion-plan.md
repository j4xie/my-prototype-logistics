# 餐饮意图系统扩展方案 — 完整分析与批判性评审

**生成时间**: 2026-02-26
**分析对象**: Cretas 食品溯源系统 — 餐饮意图从18个/92条短语扩展至工厂同等水平
**当前版本**: v32 多业态隔离架构已就位

---

## Analyst Output

### 1. 现状对比矩阵

#### 1.1 总量级对比

| 维度 | 工厂 (FACTORY) | 餐饮 (RESTAURANT) | 差距倍数 | 备注 |
|------|---------------|-------------------|---------|------|
| **意图码数量** | 272 唯一码 | 18 唯一码 | **15.1x** | 工厂含RESTAURANT_前缀的重复不计入 |
| **短语映射总量** | 3749 条 (phraseToIntentMapping) | 92 条 (restaurantPhraseMapping) | **40.7x** | |
| **每意图平均短语数** | 13.8 条/意图 | 5.1 条/意图 | **2.7x** | |
| **业务域覆盖** | 21 个域 | 4 个域 | **5.3x** | |
| **Handler 文件** | 25 个 Handler (17,683行) | 1 个 (1,173行) | **15.1x** | |
| **DB意图配置 (test)** | 377 条 FACTORY | 18 条 RESTAURANT | **20.9x** | 含29条COMMON |
| **DB意图配置 (prod)** | 404 条 FACTORY | 18 条 RESTAURANT | **22.4x** | |
| **分类器训练数据** | 已训练 | 未训练 (被业态过滤跳过) | N/A | |

#### 1.2 工厂意图域分布 (按短语数降序)

| 域 | 代表前缀 | 短语数 | 意图数 | 餐饮是否有对应域 |
|----|---------|--------|--------|----------------|
| 报表/BI | REPORT_* | ~354 | ~15 | 部分 (REVENUE/MARGIN) |
| 发货 | SHIPMENT_* | ~267 | ~8 | 无 (餐饮不发货) |
| 食品知识 | FOOD_KNOWLEDGE_* | 264 | 1 | 共享 (COMMON) |
| 告警 | ALERT_* | ~246 | ~8 | 无 |
| 原料/批次 | MATERIAL_BATCH_* | ~233 | ~8 | 部分 (INGREDIENT_*) |
| 加工批次 | PROCESSING_BATCH_* | ~212 | ~7 | 无 (但可对标"出餐") |
| 设备 | EQUIPMENT_* | ~201 | ~12 | 无 (但餐饮有厨具设备) |
| 考勤/HR | ATTENDANCE_* | ~181 | ~8 | 无 |
| 订单 | ORDER_* | ~140 | ~5 | 部分 (ORDER_STATISTICS) |
| 供应商 | SUPPLIER_* | ~105 | ~5 | 无 |
| 质检 | QUALITY_* | ~99+ | ~8 | 无 (但餐饮有食安合规) |
| 客户/CRM | CUSTOMER_* | ~62 | ~5 | 无 |
| 溯源 | TRACE_* | ~68 | ~3 | 无 |
| 秤/IoT | SCALE_* | ~90+ | ~8 | 无 |
| 摄像头 | CAMERA_* | ~20 | ~10 | 无 |
| 系统导航 | SYSTEM_* | (commonMapping) | ~8 | 共享 (COMMON) |

#### 1.3 餐饮当前18个意图分布

| 域 | 意图数 | 短语数 | 每意图短语 | 覆盖评价 |
|----|--------|--------|-----------|---------|
| 菜品查询 | 5 | 33 | 6.6 | 基本可用但变体少 |
| 食材管理 | 5 | 24 | 4.8 | 缺时间/数量修饰词 |
| 营业分析 | 5 | 24 | 4.8 | 缺对比/趋势细分 |
| 损耗管理 | 3 | 11 | 3.7 | 最薄弱 |
| **合计** | **18** | **92** | **5.1** | |

---

### 2. 餐饮意图扩展方案 — 分批规划

#### 2.1 目标设定

**不盲目对标工厂 337 个意图**。餐饮业态有本质差异:
- 餐饮不涉及: 发货(SHIPMENT)、加工批次(PROCESSING_BATCH)、秤协议(SCALE_PROTOCOL)、摄像头(CAMERA) 等硬件密集型意图
- 餐饮独有: 外卖平台、桌台管理、预订排队、会员积分、后厨动线

**合理目标**: 80-120 个意图码，800-1200 条短语，覆盖餐饮核心 12 个业务域。

---

#### P0: 现有意图短语加厚 (0 新意图, +350 短语)

**目标**: 将现有 18 个意图的短语从 92 条提升至 ~440 条 (每意图 ~24 条)，达到工厂中位水平。

**方法**: 对照工厂高频意图的短语变体模式，系统性扩充。

| 变体类型 | 示例 (RESTAURANT_DISH_LIST) | 估计每意图增量 |
|---------|----------------------------|-------------|
| 时间限定 | "今天的菜品"、"本月菜单"、"上周新菜" | +3~5 |
| 数量限定 | "有多少道菜"、"菜品数量" | +2~3 |
| 反问句 | "不是有个新菜吗"、"没有菜品吧" | +2~3 |
| 口语/方言 | "瞅瞅菜"、"菜品看看"、"啥菜" | +2~3 |
| 场景嵌入 | "给客人推荐什么"、"午市有啥特色菜" | +2~3 |
| 否定式 | "没新菜了吗"、"不卖那道菜了?" | +1~2 |
| 中英混合 | "menu查一下"、"dish list" | +1~2 |
| 省略式 | "菜"、"看菜" (短词) | +1~2 |

**实现复杂度**: **低** — 仅修改 `IntentKnowledgeBase.java` 的 `restaurantPhraseMapping`，无需新 Handler 代码。

**风险**: 短词("菜"、"单")容易产生误匹配，需配合 `minLength` 过滤或优先级策略。

---

#### P1: 核心缺失域补齐 (新增 28 个意图, +336 短语)

**优先级依据**: 餐饮日常经营中最高频的决策场景。

##### P1.1 员工/排班管理 (8 个意图)

对标工厂: ATTENDANCE_TODAY(48短语)、ATTENDANCE_STATS(48)、ATTENDANCE_HISTORY(45)、HR_*(595行Handler)

| 意图码 | 意图名 | 短语数(估) | Handler复杂度 | 依赖 |
|--------|--------|-----------|-------------|------|
| `RESTAURANT_STAFF_LIST` | 员工花名册 | 12 | 低 — 查 Department/User 表 | 已有User表 |
| `RESTAURANT_STAFF_SCHEDULE` | 排班查询 | 15 | 中 — 需新建排班表 | **需建表** |
| `RESTAURANT_STAFF_ATTENDANCE` | 今日出勤 | 12 | 低 — 复用NFC/签到逻辑 | 已有Attendance表 |
| `RESTAURANT_STAFF_LEAVE` | 请假记录 | 10 | 低 | 已有 |
| `RESTAURANT_STAFF_PERFORMANCE` | 员工绩效 | 12 | 中 — 需定义餐饮绩效指标 | **需建表** |
| `RESTAURANT_STAFF_OVERTIME` | 加班统计 | 8 | 低 | 已有 |
| `RESTAURANT_STAFF_SCHEDULE_SUGGEST` | 智能排班建议 | 12 | **高** — 需算法 | P2延后 |
| `RESTAURANT_LABOR_COST` | 人力成本分析 | 10 | 中 | 需薪资数据 |

**小计**: 8 意图, ~91 短语, Handler 约 400 行

##### P1.2 会员/客户管理 (6 个意图)

对标工厂: CRMIntentHandler.java (805行), CUSTOMER_STATS(38短语)

| 意图码 | 意图名 | 短语数(估) | Handler复杂度 |
|--------|--------|-----------|-------------|
| `RESTAURANT_MEMBER_COUNT` | 会员数量 | 12 | 低 |
| `RESTAURANT_MEMBER_GROWTH` | 会员增长趋势 | 10 | 中 |
| `RESTAURANT_MEMBER_TOP_SPENDING` | 高消费会员 | 10 | 低 |
| `RESTAURANT_CUSTOMER_FREQUENCY` | 复购频率分析 | 12 | 中 |
| `RESTAURANT_CUSTOMER_SATISFACTION` | 顾客满意度 | 10 | 中 — 需评价数据 |
| `RESTAURANT_MEMBER_RETENTION` | 会员留存率 | 10 | 中 |

**小计**: 6 意图, ~64 短语, Handler 约 350 行

##### P1.3 食品安全/合规 (6 个意图)

对标工厂: QualityIntentHandler.java (700行), QUALITY_CHECK_QUERY(73短语)

| 意图码 | 意图名 | 短语数(估) | Handler复杂度 |
|--------|--------|-----------|-------------|
| `RESTAURANT_FOOD_SAFETY_CHECK` | 食安巡检记录 | 12 | 中 |
| `RESTAURANT_TEMPERATURE_LOG` | 冷链温控记录 | 10 | 低 |
| `RESTAURANT_HYGIENE_SCORE` | 卫生评分 | 10 | 中 |
| `RESTAURANT_LICENSE_EXPIRY` | 证照到期提醒 | 8 | 低 |
| `RESTAURANT_ALLERGEN_QUERY` | 过敏原查询 | 12 | 中 |
| `RESTAURANT_FOOD_RECALL_CHECK` | 食材召回检查 | 8 | 低 |

**小计**: 6 意图, ~60 短语, Handler 约 350 行

##### P1.4 供应商管理 (4 个意图)

| 意图码 | 意图名 | 短语数(估) | Handler复杂度 |
|--------|--------|-----------|-------------|
| `RESTAURANT_SUPPLIER_LIST` | 供应商列表 | 10 | 低 |
| `RESTAURANT_SUPPLIER_PRICE_COMPARE` | 供应商比价 | 12 | 中 |
| `RESTAURANT_SUPPLIER_RATING` | 供应商评分 | 10 | 中 |
| `RESTAURANT_PURCHASE_ORDER_STATUS` | 采购单状态 | 12 | 低 |

**小计**: 4 意图, ~44 短语, Handler 约 200 行

##### P1.5 告警/通知 (4 个意图)

对标工厂: AlertIntentHandler.java (494行), ALERT_LIST(124短语)

| 意图码 | 意图名 | 短语数(估) | Handler复杂度 |
|--------|--------|-----------|-------------|
| `RESTAURANT_ALERT_LIST` | 告警列表 | 15 | 低 — 复用Alert框架 |
| `RESTAURANT_ALERT_ACTIVE` | 活跃告警 | 12 | 低 |
| `RESTAURANT_ALERT_SETTINGS` | 告警配置 | 10 | 中 |
| `RESTAURANT_ALERT_HISTORY` | 历史告警 | 10 | 低 |

**小计**: 4 意图, ~47 短语, Handler 约 250 行

**P1 总计**: **28 个新意图, ~306 条新短语**, 新增 Handler 代码约 **1,550 行**

---

#### P2: 营收深度分析 + 餐饮独有场景 (新增 24 个意图, +288 短语)

##### P2.1 财务/成本深度分析 (8 个意图)

对标工厂: ReportIntentHandler.java (1,079行), REPORT_FINANCE(49短语)

| 意图码 | 意图名 | 短语数(估) |
|--------|--------|-----------|
| `RESTAURANT_PROFIT_LOSS` | 利润表 | 12 |
| `RESTAURANT_COST_BREAKDOWN` | 成本构成分析 | 12 |
| `RESTAURANT_REVENUE_BY_CHANNEL` | 分渠道收入 (堂食/外卖/团购) | 12 |
| `RESTAURANT_REVENUE_BY_PERIOD` | 分时段收入 (午/晚/夜宵) | 10 |
| `RESTAURANT_RENT_RATIO` | 租售比分析 | 8 |
| `RESTAURANT_BREAK_EVEN` | 盈亏平衡分析 | 10 |
| `RESTAURANT_CASH_FLOW` | 现金流查询 | 12 |
| `RESTAURANT_BUDGET_VS_ACTUAL` | 预算执行对比 | 10 |

**小计**: 8 意图, ~86 短语

##### P2.2 外卖/平台管理 (6 个意图) — 餐饮独有

| 意图码 | 意图名 | 短语数(估) |
|--------|--------|-----------|
| `RESTAURANT_DELIVERY_ORDER_LIST` | 外卖订单列表 | 12 |
| `RESTAURANT_DELIVERY_STATS` | 外卖数据统计 | 12 |
| `RESTAURANT_DELIVERY_RATING` | 外卖评分 | 10 |
| `RESTAURANT_DELIVERY_COMPLAINT` | 外卖差评/投诉 | 12 |
| `RESTAURANT_PLATFORM_COMMISSION` | 平台佣金分析 | 10 |
| `RESTAURANT_DELIVERY_TIME_ANALYSIS` | 出餐/配送时效 | 12 |

**小计**: 6 意图, ~68 短语

##### P2.3 桌台/排队管理 (5 个意图) — 餐饮独有

| 意图码 | 意图名 | 短语数(估) |
|--------|--------|-----------|
| `RESTAURANT_TABLE_STATUS` | 桌台状态 | 12 |
| `RESTAURANT_TABLE_TURNOVER` | 翻台率 | 12 |
| `RESTAURANT_QUEUE_STATUS` | 排队情况 | 10 |
| `RESTAURANT_RESERVATION_LIST` | 预订列表 | 10 |
| `RESTAURANT_SEAT_UTILIZATION` | 座位利用率 | 10 |

**小计**: 5 意图, ~54 短语

##### P2.4 菜品深度分析 (5 个意图)

| 意图码 | 意图名 | 短语数(估) |
|--------|--------|-----------|
| `RESTAURANT_MENU_OPTIMIZATION` | 菜单优化建议 | 12 |
| `RESTAURANT_DISH_PAIRING` | 菜品搭配分析 | 10 |
| `RESTAURANT_SEASONAL_MENU` | 时令菜品推荐 | 10 |
| `RESTAURANT_DISH_FEEDBACK` | 菜品评价汇总 | 12 |
| `RESTAURANT_NEW_DISH_PERFORMANCE` | 新菜上市表现 | 10 |

**小计**: 5 意图, ~54 短语

**P2 总计**: **24 个新意图, ~262 条新短语**

---

#### P3: 高级分析 + IoT + 智能化 (新增 20 个意图, +200 短语)

| 子域 | 意图数 | 典型意图 |
|------|--------|---------|
| 厨房设备管理 | 5 | RESTAURANT_EQUIPMENT_STATUS, _MAINTENANCE, _ENERGY |
| 营销/活动管理 | 5 | RESTAURANT_PROMOTION_EFFECT, _COUPON_STATS, _CAMPAIGN_ROI |
| 对比/趋势分析 | 5 | RESTAURANT_YOY_REVENUE, _MOM_MARGIN, _BENCHMARK |
| 预测/AI建议 | 5 | RESTAURANT_DEMAND_FORECAST, _PRICE_SUGGEST, _STAFF_PREDICT |

**P3 总计**: **20 个新意图, ~200 条新短语**

---

### 3. 汇总统计

| 阶段 | 新增意图数 | 新增短语数 | 累计意图 | 累计短语 | 工厂对比 |
|------|-----------|-----------|---------|---------|---------|
| 现状 | 0 | 0 | 18 | 92 | 6.6% |
| P0 完成 | 0 | +350 | 18 | 442 | 意图6.6%, 短语11.8% |
| P1 完成 | +28 | +306 | 46 | 748 | 意图16.9%, 短语20.0% |
| P2 完成 | +24 | +262 | 70 | 1,010 | 意图25.7%, 短语26.9% |
| P3 完成 | +20 | +200 | 90 | 1,210 | 意图33.1%, 短语32.3% |

**最终目标**: 90 个意图 / 1,210 条短语 — 约为工厂的 **1/3 规模**，但覆盖餐饮所有核心决策场景。

---

### 4. 冲突短语处理策略

#### 4.1 已知冲突列表

| 短语 | 工厂意图 | 餐饮意图 | 当前处理 | 风险级别 |
|------|---------|---------|---------|---------|
| "营业额" | REPORT_KPI | RESTAURANT_DAILY_REVENUE | restaurantPhraseMapping 覆盖 | 低 — 已解决 |
| "毛利率" | PROFIT_TREND_ANALYSIS | RESTAURANT_MARGIN_ANALYSIS | restaurantPhraseMapping 覆盖 | 低 — 已解决 |
| "成本分析" | REPORT_FINANCE | RESTAURANT_DISH_COST_ANALYSIS | restaurantPhraseMapping 覆盖 | 低 — 已解决 |
| "库存盘点" | REPORT_INVENTORY | RESTAURANT_INGREDIENT_STOCK | restaurantPhraseMapping 覆盖 | 低 — 已解决 |
| "采购建议" | (无精确匹配) | RESTAURANT_PROCUREMENT_SUGGESTION | restaurantPhraseMapping 覆盖 | 低 |
| "订单统计" | ORDER_LIST | RESTAURANT_ORDER_STATISTICS | restaurantPhraseMapping 覆盖 | 低 — 已解决 |

#### 4.2 P1/P2 新增可能冲突

| 新增短语 | 工厂可能命中 | 餐饮应命中 | 处理方式 |
|---------|------------|-----------|---------|
| "员工列表" | HR_EMPLOYEE_LIST | RESTAURANT_STAFF_LIST | 业态Map隔离 |
| "排班" | SCHEDULING_* | RESTAURANT_STAFF_SCHEDULE | 业态Map隔离 |
| "告警列表" | ALERT_LIST | RESTAURANT_ALERT_LIST | 业态Map隔离 |
| "设备状态" | EQUIPMENT_STATUS_QUERY | RESTAURANT_EQUIPMENT_STATUS | 业态Map隔离 |
| "供应商" | SUPPLIER_LIST | RESTAURANT_SUPPLIER_LIST | 业态Map隔离 |
| "出餐时间" | (无匹配) | RESTAURANT_DELIVERY_TIME_ANALYSIS | 无冲突 |
| "翻台率" | (无匹配) | RESTAURANT_TABLE_TURNOVER | 无冲突 |

#### 4.3 架构级处理方案

当前 v32 架构已具备完善的业态隔离机制:

```
匹配顺序:
1. businessDomain == "RESTAURANT"
   → restaurantPhraseMapping (精确匹配)
   → commonPhraseMapping (SYSTEM_*, OUT_OF_DOMAIN, GREETING等)
   → 分类器 (被业态过滤跳过，因分类器只有FACTORY训练数据)
   → LLM fallback (已有业态过滤: 只返回 business_type=RESTAURANT 或 COMMON 的意图)

2. businessDomain == "FACTORY"
   → phraseToIntentMapping (精确匹配)
   → commonPhraseMapping
   → 分类器
   → LLM fallback (只返回 FACTORY/COMMON)
```

**结论**: 冲突短语通过业态专用Map + DB business_type列已完全隔离，扩展无需改动路由架构。

---

### 5. 分类器/语义路由器训练规划

#### 5.1 当前瓶颈

分类器 (ONNX) 仅训练了工厂意图数据。餐饮用户的分类器层被 `AIIntentServiceImpl` 中的业态过滤跳过:

```java
// v32: 业态过滤 — 餐饮用户不应该命中工厂专属意图
if (intentBizType != null && !"COMMON".equals(intentBizType)
        && !intentBizType.equals(businessDomain)) {
    // 跳过分类器结果
}
```

这意味着餐饮用户**完全依赖精确短语匹配 + LLM fallback**，没有模糊匹配能力。

#### 5.2 训练数据规划

| 阶段 | 数据量 | 方法 |
|------|--------|------|
| P0 完成后 | 18 意图 x 24 短语 = 432 样本 | 可训练小模型但样本太少 |
| P1 完成后 | 46 意图 x 16 短语 = 736 样本 | **最低可行训练点** — 每类 ~16 样本 |
| P2 完成后 | 70 意图 x 14 短语 = 1,010 样本 | 推荐训练点 |
| 数据增强 | 每短语 x3 变体 (同义替换、语序调换) | ~3,000 样本 |

#### 5.3 推荐方案

**短期 (P0-P1)**: 不训练分类器，依赖:
- restaurantPhraseMapping 精确匹配 (~440→748 短语)
- LLM fallback (已有业态过滤，效果可接受)

**中期 (P2完成后)**:
- 训练独立的 `restaurant_classifier.onnx`
- 或在现有分类器中加入 RESTAURANT 标签 (需注意类别不平衡: FACTORY 3749 vs RESTAURANT 1010)
- 推荐: **独立模型**，避免工厂分类器精度回退

**技术路径**:
1. 从 `restaurantPhraseMapping` 导出训练数据
2. 数据增强 (同义替换、字符扰动、语序变换)
3. 训练 `DistilBERT` 或 `MiniLM` → ONNX 导出
4. `AIIntentServiceImpl` 中根据 `businessDomain` 选择对应分类器

---

### 6. 实施代价估算

#### 6.1 代码变更量

| 阶段 | 文件 | 变更类型 | 行数估算 |
|------|------|---------|---------|
| **P0** | IntentKnowledgeBase.java | 新增短语 | +350 行 |
| **P0** | insert_restaurant_intent_configs.sql | 无新意图 | 0 |
| **P1** | IntentKnowledgeBase.java | 新增短语 | +306 行 |
| **P1** | RestaurantIntentHandler.java | 新增28个case | +1,550 行 (Handler增至~2,700行) |
| **P1** | insert_restaurant_intent_configs.sql | 28条INSERT | +28 行 |
| **P1** | 数据库DDL | 新建排班表、绩效表 | +2 个表 |
| **P1** | Repository接口 | 新增查询方法 | +80 行 |
| **P2** | IntentKnowledgeBase.java | 新增短语 | +262 行 |
| **P2** | RestaurantIntentHandler.java (或拆分) | 24个新case | +1,200 行 |
| **P2** | 数据库DDL | 外卖/桌台/预订表 | +3-5 个表 |
| **P3** | 同上 | 20个新case | +1,000 行 |

#### 6.2 Handler 拆分建议

当前 `RestaurantIntentHandler.java` 已有 1,173 行，18 个 case。P1 完成后将达到 ~2,700 行、46 个 case。

**建议在 P1 实施时拆分**:

```
service/handler/restaurant/
├── RestaurantDishHandler.java       (~10 case, ~500行)
├── RestaurantIngredientHandler.java (~8 case, ~400行)
├── RestaurantRevenueHandler.java    (~10 case, ~500行)
├── RestaurantStaffHandler.java      (~8 case, ~400行)
├── RestaurantMemberHandler.java     (~6 case, ~350行)
├── RestaurantSafetyHandler.java     (~6 case, ~350行)
├── RestaurantSupplierHandler.java   (~4 case, ~200行)
├── RestaurantAlertHandler.java      (~4 case, ~250行)
└── RestaurantIntentRouter.java      (路由入口, ~100行)
```

**路由入口**按意图前缀分发到子 Handler，保持 `IntentHandler` 接口兼容。

---

### 7. 决策框架

| 决策点 | 推荐 | 理由 |
|--------|------|------|
| 目标意图数 | 80-100 (非337) | 餐饮业态更简单，不需要硬件/秤/摄像头意图 |
| 第一步 | P0 短语加厚 | ROI最高: 0代码改动，识别率提升预估 40%+ |
| Handler架构 | P1时拆分为子Handler | 单文件 3000+ 行不可维护 |
| 分类器 | P2后训练独立模型 | P0-P1阶段精确匹配+LLM足够 |
| 数据库策略 | 增量DDL脚本 | 不修改现有表结构，新增表和列 |

---

### 8. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 短语爆炸导致误匹配 | 中 | 高 | 短词(<2字)不进入精确匹配; 分层匹配优先级 |
| Handler单文件过大 | 高 | 中 | P1时拆分为8个子Handler |
| 新表数据为空 | 高 | 低 | Handler返回引导性消息("请先在XX模块录入数据") |
| 分类器类别不平衡 | 中 | 中 | 训练独立餐饮分类器 |
| LLM fallback延迟 | 低 | 中 | 精确匹配覆盖率提升后LLM调用频率下降 |
| 冲突短语遗漏 | 低 | 低 | v32业态隔离架构已解决 |
| P1新表无业务入口 | 高 | 中 | 需同步开发餐饮RN界面中的录入功能 |

---

---

## Critic Output

### 总体评价

Analyst 的方案在技术层面扎实、分批合理，但存在几个根本性盲区需要严肃对待。

---

### 批判点 1: 337 是伪目标 — 但 90 也可能过多

Analyst 正确拒绝了"盲目对标337"，将目标调至 90 个意图。但这个数字仍可能偏高。

**证据审查**:

工厂的 272 个意图中，按短语数排序:
- **尾部 50 个意图**平均仅 1-2 条短语 (如 `WAREHOUSE_OUTBOUND`=1, `BATCH_DELETE`=1, `ORDER_CANCEL`=1)
- 这些尾部意图**很可能从未被真实用户触发过** — 它们是"防御性"意图，为了覆盖长尾场景而添加

**现实检验**: 餐饮经营者的典型使用场景远比工厂车间主管简单:
- 餐厅老板每天关心: 今天赚了多少、哪个菜卖得好、食材还够不够
- 这 3 个问题覆盖了现有 18 个意图中的 **RESTAURANT_DAILY_REVENUE, RESTAURANT_DISH_SALES_RANKING, RESTAURANT_INGREDIENT_STOCK**
- 80/20 法则: 80% 的用户查询可能集中在 **8-10 个核心意图**

**建议**: 在 P0 完成后，**先部署到测试环境，收集 2-4 周真实使用数据**，再决定 P1 中哪些域值得投入。不要基于"工厂有什么"来推导"餐饮需要什么"。

---

### 批判点 2: P0 短语加厚的 ROI 被高估

Analyst 声称 P0 可使"识别率提升 40%+"。这个数字缺乏数据支撑。

**反面论据**:
1. 当前 92 条短语已覆盖最常见表述 ("营业额"、"菜品列表"、"食材库存")
2. 新增的变体 ("不是有个新菜吗"、"menu查一下") 是**长尾低频表述**
3. 真正的识别瓶颈可能是**用户说了短语表以外的话** — 这应该靠 LLM fallback 解决，而非无限加厚短语表
4. 从 92→442 条短语，意味着 `restaurantPhraseMapping` 内存增加 4.8x。虽然绝对值不大(~50KB)，但 IntentKnowledgeBase.java **已经 6600+ 行**，继续膨胀有可维护性问题

**替代方案**: 与其加 350 条硬编码短语，不如投资提升 LLM fallback 对餐饮意图的识别精度:
- 在 LLM fallback prompt 中增加餐饮意图的描述和示例
- 这样可以用 **0 行代码变更**覆盖无限多的自然语言变体

---

### 批判点 3: 新表/新数据源 — 最被低估的风险

Analyst 的 P1 方案中:
- `RESTAURANT_STAFF_SCHEDULE` 需要排班表 → 但当前系统**没有排班录入界面**
- `RESTAURANT_STAFF_PERFORMANCE` 需要绩效表 → 绩效指标定义都没有
- `RESTAURANT_CUSTOMER_SATISFACTION` 需要评价数据 → 从哪来? 手动录? 对接大众点评?
- `RESTAURANT_FOOD_SAFETY_CHECK` 需要巡检记录 → 需要移动端录入功能

**这不是意图系统的问题，是业务系统完整度的问题**。

如果只建了意图 + Handler + 空表，用户说"排班情况"，系统返回"暂无排班数据，请先在排班管理中录入" — 这种体验**比不识别更糟糕**。

**建议**: P1 的每个新域都应该附带**数据来源可行性评估**:
- "已有数据源" → 可立即实施 (如 RESTAURANT_ALERT_*, 复用现有 Alert 表)
- "需新建表 + 录入界面" → 应与前端排期绑定，不单独发布意图
- "需外部对接" → 降至 P3 或砍掉

---

### 批判点 4: Handler 拆分方案过于前瞻

Analyst 建议 P1 时将 RestaurantIntentHandler 拆为 8 个子 Handler。这在理论上正确，但:

1. 当前工厂的 Handler 体系是 **按意图类别(FORM/DATA_OP/ANALYSIS/SYSTEM等)分发**，不是按业务域
2. RestaurantIntentHandler 之所以是一个文件，是因为 `getSupportedCategory()` 返回 `"RESTAURANT"` — 这是架构设计
3. 拆分为 8 个子 Handler 意味着需要修改 `IntentExecutorServiceImpl` 的路由逻辑，或引入 Restaurant 内部的二级路由

**更务实的方案**:
- **P1 阶段保持单文件**，用 `//region` 折叠分组
- 如果确实超过 3000 行，可以将 handler 方法抽取到 **Service 层** (如 `RestaurantStaffService`, `RestaurantMemberService`)，Handler 仅做路由

---

### 批判点 5: 分类器训练的必要性存疑

Analyst 规划 P2 后训练独立餐饮分类器。需要质疑:

**工厂分类器的实际贡献率是多少?**

从 `AIIntentServiceImpl` 的匹配流程看:
1. 精确短语匹配 → 命中率极高 (3749 条短语)
2. 分类器 → 处理精确匹配未命中的情况
3. LLM fallback → 最后兜底

如果精确短语匹配的覆盖率 >90%（工厂 3749 条短语情况下很可能），分类器只处理 <10% 的边缘情况。

**对于餐饮**: 如果 P0+P1 后有 748 条短语 + LLM fallback，分类器可能只在 2-5% 的查询中有用。为这 2-5% 训练和维护一个模型的 ROI 很低。

**建议**: 除非有数据证明 LLM fallback 延迟(~2-3s)对餐饮用户体验造成显著影响，否则**推迟分类器训练至有实际使用数据后再决定**。

---

### 批判点 6: 缺失的用户研究

整个方案的最大弱点: **没有一行来自真实餐饮用户的数据**。

- 所有的意图规划都是"对标工厂推导出来的"
- 餐饮经营者真正会问什么? 用什么表述? 在什么场景下使用?
- 一个火锅店老板和一个西餐厅主厨的需求完全不同

**建议**: 在 P0 之前，至少做一项:
1. **种子用户访谈**: 找 3-5 个餐饮客户，让他们自由对话，收集真实表述
2. **竞品分析**: 查看美团商家版、客如云、二维火等餐饮SaaS的AI助手都支持什么功能
3. **搜索日志分析**: 如果已有餐饮用户在用系统，查看 OUT_OF_DOMAIN 命中日志——这些就是用户想要但系统不支持的意图

---

### 批判点 7: 工作量估算偏乐观

| Analyst估算 | 现实调整 | 理由 |
|------------|---------|------|
| P0: 仅修改一个文件 | +测试用例、+部署验证、+冲突回归 | 350条短语需逐条验证不冲突 |
| P1: Handler ~1550行 | x1.5 = ~2300行 | 每个新意图需: 空数据处理、时间参数解析、分页、错误处理 |
| P1: 2个新表 | +迁移脚本、+Repository、+Entity、+DTO | 每个新表至少5个Java文件 |
| P2: 外卖/桌台 | **未知** — 可能需要外部API对接 | 美团/饿了么API接入本身就是一个项目 |

---

### 修正后的推荐路线图

| 阶段 | 时间 | 内容 | 前置条件 |
|------|------|------|---------|
| **P0a** | 1-2 天 | 现有18个意图短语加厚至每意图15条 (总~270条) | 无 |
| **P0b** | 持续 | 收集OUT_OF_DOMAIN日志，分析餐饮用户真实需求 | 需有餐饮用户在使用 |
| **P1a** | 3-5 天 | 仅实施**有现成数据源**的新意图 (Alert复用4个, 供应商复用4个) | P0a完成 |
| **P1b** | 视数据 | 根据P0b日志决定: 员工/会员/食安哪个域优先 | P0b有足够数据 |
| **P2** | 视业务 | 外卖/桌台等独有场景，与前端同步开发 | 餐饮端产品规划明确 |
| **P3** | 不规划 | 等 P1 上线后的用户反馈再决定 | 真实使用数据 |

---

### 最终结论

Analyst 的技术方案本身是**合格的** — 架构分析准确、分批逻辑清晰、冲突处理机制正确。

但方案的根本问题是**需求来源不可靠**:
1. "对标工厂"不等于"餐饮需要"
2. 90个意图可能是 40 个就够的事情做了 2.25 倍
3. 没有数据支撑的意图扩展等于在黑暗中射箭

**一句话总结**: 先做 P0 短语加厚 + 日志收集，用数据驱动后续迭代，避免投入 2-3 周工期开发一堆"没人用"的意图。
