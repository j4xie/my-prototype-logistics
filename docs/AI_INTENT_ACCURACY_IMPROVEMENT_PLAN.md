# AI 意图识别系统准确率改进方案

> 基于 38 条抽样测试，当前准确率 55.3%，目标提升至 85%+

---

## 一、问题诊断总结

### 1.1 测试结果

| 类别 | 准确率 | 状态 | 主要问题 |
|------|--------|------|----------|
| simple | 88% (7/8) | ✓ | "订单" 误映射为 SHIPMENT |
| complex | 67% (4/6) | △ | 复合查询降级到 REPORT |
| multi | 75% (3/4) | ✓ | 正常 |
| domain | 75% (3/4) | ✓ | "冷链" 未识别 |
| typo | 50% (2/4) | △ | 部分拼写纠错失败 |
| **high_risk** | **17%** (1/6) | ✗ | DELETE 动作完全未识别 |
| **ambiguous** | **17%** (1/6) | ✗ | 歧义输入过度自信 |

### 1.2 根本原因

| 问题 | 位置 | 原因 |
|------|------|------|
| "订单"→SHIPMENT | TwoStageIntentClassifier | 无 ORDER 域，"订单" 在 CUSTOMER 域但被 SHIPMENT 短语覆盖 |
| DELETE 未识别 | TwoStageIntentClassifier.classifyActionWithContext() | 无 DELETE 分类规则，默认降级为 QUERY |
| 歧义过度自信 | AIIntentServiceImpl + 配置 | 短输入直接匹配高置信度短语 |

---

## 二、架构级改进方案

### 2.1 TwoStageIntentClassifier 增强 (核心修复)

#### 修改一：新增 ORDER 域

**文件**: `backend-java/src/main/java/com/cretas/aims/service/TwoStageIntentClassifier.java`

```java
// 第 61-72 行: ClassifiedDomain 枚举
public enum ClassifiedDomain {
    MATERIAL,
    SHIPMENT,
    ORDER,       // ← 新增
    ATTENDANCE,
    EQUIPMENT,
    QUALITY,
    PROCESSING,
    ALERT,
    SUPPLIER,
    CUSTOMER,
    UNKNOWN
}

// 第 116-154 行: DOMAIN_KEYWORDS 映射
static {
    // 新增 ORDER 域（优先级高于 CUSTOMER）
    DOMAIN_KEYWORDS.put(ClassifiedDomain.ORDER, Arrays.asList(
        "订单", "下单", "接单", "订货", "订购"
    ));

    // 修改 CUSTOMER 域（移除 "订单"）
    DOMAIN_KEYWORDS.put(ClassifiedDomain.CUSTOMER, Arrays.asList(
        "客户", "买家", "顾客", "客户单", "销售"  // 移除 "订单"
    ));

    // ... 其他域保持不变
}
```

#### 修改二：新增 DELETE 动作分类

```java
// 第 190-208 行后添加:
/**
 * DELETE words that indicate DELETE action (v12.2)
 */
private static final List<String> DELETE_WORDS = Arrays.asList(
    "删除", "移除", "清除", "清空", "作废", "去掉", "销毁", "注销", "撤销"
);

// 修改 classifyActionWithContext() 方法（第 402-449 行）
private ActionResult classifyActionWithContext(String input) {
    // ★ 新增 Rule 0: DELETE words (最高优先级)
    if (hasDeleteWords(input)) {
        log.debug("Delete words detected, classifying as DELETE");
        return new ActionResult(ClassifiedAction.DELETE, "delete_words");
    }

    // Rule 1: Create words indicate CREATE (原有)
    if (hasCreateWords(input)) {
        log.debug("Create words detected, classifying as CREATE");
        return new ActionResult(ClassifiedAction.CREATE, "create_words");
    }

    // ... 其余规则保持不变
}

// 新增辅助方法（在第 516 行后）
/**
 * v12.2: Check if input contains delete-related words
 */
private boolean hasDeleteWords(String input) {
    for (String word : DELETE_WORDS) {
        if (input.contains(word)) {
            return true;
        }
    }
    return false;
}
```

#### 修改三：更新 IntentCompositionConfig

**文件**: `backend-java/src/main/java/com/cretas/aims/config/IntentCompositionConfig.java`

```java
// 在 getIntent() 方法的映射中添加:

// ORDER 域组合
"ORDER_QUERY" -> "ORDER_LIST"
"ORDER_CREATE" -> "ORDER_CREATE"
"ORDER_UPDATE" -> "ORDER_UPDATE"
"ORDER_DELETE" -> "ORDER_DELETE"

// DELETE 动作组合 (各域)
"MATERIAL_DELETE" -> "MATERIAL_BATCH_DELETE"
"CUSTOMER_DELETE" -> "CUSTOMER_DELETE"
"PROCESSING_DELETE" -> "PROCESSING_BATCH_CANCEL"
"EQUIPMENT_DELETE" -> "EQUIPMENT_DELETE"
"SUPPLIER_DELETE" -> "SUPPLIER_DELETE"
```

---

### 2.2 IntentKnowledgeBase 短语映射补充

**文件**: `backend-java/src/main/java/com/cretas/aims/config/IntentKnowledgeBase.java`

#### 新增订单相关短语（约第 1100 行附近）

```java
// === v12.2: ORDER 域短语映射 ===
phraseToIntentMapping.put("查看订单", "ORDER_LIST");
phraseToIntentMapping.put("订单列表", "ORDER_LIST");
phraseToIntentMapping.put("订单查询", "ORDER_LIST");
phraseToIntentMapping.put("所有订单", "ORDER_LIST");
phraseToIntentMapping.put("今天的订单", "ORDER_TODAY");
phraseToIntentMapping.put("今天订单", "ORDER_TODAY");
phraseToIntentMapping.put("最近订单", "ORDER_RECENT");
phraseToIntentMapping.put("订单状态", "ORDER_STATUS");
phraseToIntentMapping.put("订单详情", "ORDER_DETAIL");
phraseToIntentMapping.put("查订单", "ORDER_LIST");
```

#### 新增删除操作短语（约第 2880 行附近）

```java
// === v12.2: DELETE 操作短语映射 ===
// 订单删除
phraseToIntentMapping.put("删除订单", "ORDER_DELETE");
phraseToIntentMapping.put("取消订单", "ORDER_CANCEL");
phraseToIntentMapping.put("作废订单", "ORDER_DELETE");

// 用户删除
phraseToIntentMapping.put("删除用户", "USER_DELETE");
phraseToIntentMapping.put("移除用户", "USER_DELETE");
phraseToIntentMapping.put("注销用户", "USER_DELETE");
phraseToIntentMapping.put("删除账号", "USER_DELETE");

// 客户删除
phraseToIntentMapping.put("删除客户", "CUSTOMER_DELETE");
phraseToIntentMapping.put("移除客户", "CUSTOMER_DELETE");

// 设备删除
phraseToIntentMapping.put("删除设备", "EQUIPMENT_DELETE");
phraseToIntentMapping.put("移除设备", "EQUIPMENT_DELETE");

// 供应商删除
phraseToIntentMapping.put("删除供应商", "SUPPLIER_DELETE");
phraseToIntentMapping.put("移除供应商", "SUPPLIER_DELETE");

// 原料删除
phraseToIntentMapping.put("删除原料", "MATERIAL_BATCH_DELETE");
phraseToIntentMapping.put("删除物料", "MATERIAL_BATCH_DELETE");
phraseToIntentMapping.put("删除材料", "MATERIAL_BATCH_DELETE");
```

---

### 2.3 数据库意图配置补充 (推荐)

**优点**: 无需修改 Java 代码，通过 SQL 迁移即可生效

**新建文件**: `backend-java/src/main/resources/db/migration/V2026_01_25_01__add_order_and_delete_intents.sql`

```sql
-- =====================================================
-- V2026_01_25_01: 新增 ORDER 和 DELETE 相关意图
-- =====================================================

-- 1. ORDER 域意图
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, priority, enabled,
    keywords, negative_keywords,
    semantic_domain, semantic_action, semantic_object,
    tool_name, requires_approval
) VALUES
-- ORDER_LIST
(UUID(), 'ORDER_LIST', '订单列表', 'DATA', 'LOW', 90, TRUE,
 '["订单", "订单列表", "查订单", "订单查询", "所有订单"]',
 '["发货", "出货", "配送", "物流"]',
 'ORDER', 'QUERY', 'ORDER',
 'order_list', FALSE),

-- ORDER_TODAY
(UUID(), 'ORDER_TODAY', '今日订单', 'DATA', 'LOW', 92, TRUE,
 '["今天订单", "今日订单", "今天的订单"]',
 '[]',
 'ORDER', 'QUERY', 'ORDER',
 'order_today', FALSE),

-- ORDER_STATUS
(UUID(), 'ORDER_STATUS', '订单状态', 'DATA', 'LOW', 88, TRUE,
 '["订单状态", "订单进度", "订单跟踪"]',
 '[]',
 'ORDER', 'QUERY', 'ORDER',
 'order_status', FALSE),

-- ORDER_DELETE (高风险)
(UUID(), 'ORDER_DELETE', '删除订单', 'DATA_OP', 'CRITICAL', 95, TRUE,
 '["删除订单", "移除订单", "作废订单"]',
 '[]',
 'ORDER', 'DELETE', 'ORDER',
 'order_delete', TRUE);

-- 2. DELETE 类意图
INSERT INTO ai_intent_configs (
    id, intent_code, intent_name, intent_category,
    sensitivity_level, priority, enabled, requires_approval,
    keywords, tool_name, semantic_action
) VALUES
-- USER_DELETE
(UUID(), 'USER_DELETE', '删除用户', 'SYSTEM', 'CRITICAL', 95, TRUE, TRUE,
 '["删除用户", "移除用户", "注销用户", "删除账号"]',
 'user_delete', 'DELETE'),

-- CUSTOMER_DELETE
(UUID(), 'CUSTOMER_DELETE', '删除客户', 'DATA_OP', 'HIGH', 90, TRUE, TRUE,
 '["删除客户", "移除客户", "清除客户"]',
 'customer_delete', 'DELETE'),

-- SUPPLIER_DELETE
(UUID(), 'SUPPLIER_DELETE', '删除供应商', 'DATA_OP', 'HIGH', 90, TRUE, TRUE,
 '["删除供应商", "移除供应商"]',
 'supplier_delete', 'DELETE'),

-- EQUIPMENT_DELETE
(UUID(), 'EQUIPMENT_DELETE', '删除设备', 'DATA_OP', 'HIGH', 90, TRUE, TRUE,
 '["删除设备", "移除设备", "注销设备"]',
 'equipment_delete', 'DELETE');

-- 3. 更新域默认意图表
INSERT INTO ai_domain_default_intents (
    id, domain_name, primary_intent_code, secondary_intent_code, factory_id, enabled
) VALUES
(UUID(), 'ORDER', 'ORDER_LIST', 'ORDER_STATUS', NULL, TRUE);
```

---

### 2.4 歧义处理优化

#### 方案 A: 配置调优 (简单)

**文件**: `application.yml` 或 `application.properties`

```yaml
cretas:
  ai:
    intent:
      # 短输入强制澄清
      min-input-length-for-direct-match: 4

    clarification:
      enabled: true
      # 提高阈值，更容易触发澄清
      confidence-threshold: 0.75
      # 强制澄清的输入模式
      force-clarify-patterns:
        - "^.{1,3}$"           # 3字符以内
        - "^(查|看|这|那|帮).{0,2}$"  # 模糊动词开头
```

#### 方案 B: 代码增强 (精确)

**文件**: `AIIntentServiceImpl.java`

```java
// 在 recognizeIntentWithConfidence() 方法开头添加:

// v12.2: 歧义输入检测
private static final Set<String> VAGUE_INPUTS = Set.of(
    "查一下", "看看", "这个", "那个", "帮我处理", "有问题", "处理下"
);

// 在方法内:
if (VAGUE_INPUTS.contains(userInput.trim())) {
    log.info("Vague input detected, forcing clarification: {}", userInput);
    return createClarificationResult(userInput, "请提供更具体的信息，例如：查什么？处理什么问题？");
}

// 或者使用长度检测
if (userInput.trim().length() <= 3) {
    log.info("Input too short, forcing clarification: {}", userInput);
    return createClarificationResult(userInput, "输入过于简短，请详细描述您的需求。");
}
```

---

## 三、实施计划

### 阶段一：核心修复 (立即执行)

| 任务 | 文件 | 工作量 | 优先级 |
|------|------|--------|--------|
| 添加 ORDER 域 | TwoStageIntentClassifier.java | 30行 | P0 |
| 添加 DELETE 规则 | TwoStageIntentClassifier.java | 20行 | P0 |
| 数据库添加意图 | V2026_01_25_01__*.sql | 60行 | P0 |

**预期效果**: 修复 "订单" 误映射和 DELETE 识别问题

### 阶段二：覆盖完善 (本周)

| 任务 | 文件 | 工作量 | 优先级 |
|------|------|--------|--------|
| 补充短语映射 | IntentKnowledgeBase.java | 50行 | P1 |
| 更新组合配置 | IntentCompositionConfig.java | 15行 | P1 |

**预期效果**: 提高精确短语匹配率

### 阶段三：用户体验 (下周)

| 任务 | 文件 | 工作量 | 优先级 |
|------|------|--------|--------|
| 歧义输入检测 | AIIntentServiceImpl.java | 20行 | P2 |
| 置信度阈值调优 | application.yml | 5行 | P2 |

**预期效果**: 减少歧义输入的误执行

---

## 四、预期结果对比

| 输入 | 当前结果 | 改进后 |
|------|----------|--------|
| "查看订单" | SHIPMENT_QUERY | ORDER_LIST ✓ |
| "今天的订单" | SHIPMENT_QUERY | ORDER_TODAY ✓ |
| "删除订单O001" | SHIPMENT_UPDATE | ORDER_DELETE ✓ |
| "删除用户" | USER_DISABLE | USER_DELETE ✓ |
| "删除设备" | SCALE_DELETE_DEVICE | EQUIPMENT_DELETE ✓ |
| "查一下" | REPORT_DASHBOARD (0.93) | 触发澄清 ✓ |
| "看看" | REPORT_DASHBOARD (0.98) | 触发澄清 ✓ |

### 准确率预测

| 类别 | 当前 | 阶段一后 | 全部完成后 |
|------|------|----------|------------|
| simple | 88% | 100% | 100% |
| high_risk | 17% | 83% | 100% |
| ambiguous | 17% | 17% | 83% |
| complex | 67% | 83% | 100% |
| **总体** | **55%** | **75%** | **90%+** |

---

## 五、测试验证

完成修改后，运行以下命令验证:

```bash
cd backend-java
mvn test -Dtest=TwoStageIntentClassifierTest

# 部署后端点测试
curl -X POST "http://localhost:10010/api/public/ai-demo/recognize" \
  -H "Content-Type: application/json" \
  -d '{"userInput":"查看订单","sessionId":"test"}'

# 预期返回 intentCode: "ORDER_LIST"
```

---

## 六、回滚方案

如果改进导致回归问题:

1. **数据库回滚**: `DELETE FROM ai_intent_configs WHERE intent_code LIKE 'ORDER%'`
2. **代码回滚**: `git revert HEAD`
3. **配置回滚**: 恢复 application.yml 原值

---

*文档版本: v1.0*
*创建时间: 2026-01-25*
*作者: Claude Code*
