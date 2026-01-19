# P1优先级测试用例说明文档

## 概述

本文档说明了P1优先级AI意图识别测试用例的结构、使用方法和覆盖范围。

**文件**: `test-cases-p1-complete-165.json`
**总用例数**: 164个
**生成日期**: 2026-01-16
**版本**: 1.0.0

## 测试用例分布

### 按类别统计

| 类别 | 数量 | 占比 | 起始ID | 结束ID |
|------|------|------|--------|--------|
| REPORT | 56 | 34.1% | TC-P1-REPORT-005 | TC-P1-REPORT-060 |
| ALERT | 38 | 23.2% | TC-P1-ALERT-003 | TC-P1-ALERT-040 |
| EQUIPMENT | 33 | 20.1% | TC-P1-EQUIPMENT-003 | TC-P1-EQUIPMENT-035 |
| SCALE | 24 | 14.6% | TC-P1-SCALE-002 | TC-P1-SCALE-025 |
| INVENTORY | 13 | 7.9% | TC-P1-INVENTORY-003 | TC-P1-INVENTORY-015 |
| **总计** | **164** | **100%** | - | - |

### 按意图代码统计

#### REPORT类 (56个)

| 意图代码 | 数量 | 说明 |
|----------|------|------|
| REPORT_DASHBOARD_OVERVIEW | 12 | 仪表盘概览查询 |
| REPORT_PRODUCTION | 15 | 生产报表查询 |
| REPORT_QUALITY | 10 | 质量报表查询 |
| REPORT_INVENTORY | 10 | 库存报表查询 |
| REPORT_EFFICIENCY | 9 | 效率报表查询 |

#### ALERT类 (38个)

| 意图代码 | 数量 | 说明 |
|----------|------|------|
| ALERT_LIST | 10 | 告警列表查询 |
| ALERT_ACTIVE | 10 | 活跃告警查询 |
| ALERT_DIAGNOSE | 9 | 告警诊断分析 |
| ALERT_STATS | 9 | 告警统计查询 |

#### EQUIPMENT类 (33个)

| 意图代码 | 数量 | 说明 |
|----------|------|------|
| EQUIPMENT_LIST | 9 | 设备列表查询 |
| EQUIPMENT_STATS | 8 | 设备统计查询 |
| EQUIPMENT_DETAIL | 8 | 设备详情查询 |
| EQUIPMENT_ALERT_LIST | 8 | 设备告警列表 |

#### SCALE类 (24个)

| 意图代码 | 数量 | 说明 |
|----------|------|------|
| SCALE_LIST_DEVICES | 8 | 电子秤列表查询 |
| SCALE_DEVICE_DETAIL | 8 | 电子秤详情查询 |
| SCALE_READING_HISTORY | 8 | 电子秤读数历史 |

#### INVENTORY类 (13个)

| 意图代码 | 数量 | 说明 |
|----------|------|------|
| MATERIAL_BATCH_QUERY | 13 | 原料批次查询 |

## 测试用例结构

### JSON Schema

```json
{
  "id": "TC-P1-{CATEGORY}-{NUMBER}",
  "priority": "P1",
  "category": "REPORT|ALERT|EQUIPMENT|SCALE|INVENTORY",
  "intentCode": "意图代码",
  "testType": "QUERY",
  "description": "测试用例描述",
  "userInput": "用户输入文本",
  "expectedIntent": {
    "intentCode": "期望识别的意图代码",
    "confidence": 1.0,
    "matchMethod": "FUSION|SEMANTIC|COLLOQUIAL",
    "questionType": "INFORMATION_QUERY"
  },
  "testDataSetup": {
    "sql": "INSERT INTO ...",
    "factoryId": "F001",
    "cleanup": "DELETE FROM ..."
  },
  "validation": {
    "responseAssertion": {
      "status": "COMPLETED",
      "intentRecognized": true,
      "dataNotNull": true,
      "intentCode": "意图代码"
    },
    "dataVerification": {
      "method": "验证方法",
      "expectedFields": ["字段列表"],
      "aggregationValidation": {
        "聚合字段": "期望值"
      }
    },
    "semanticCheck": {
      "enabled": true,
      "llmPrompt": "语义验证提示词"
    }
  },
  "expectedResponse": {
    "status": "COMPLETED",
    "messagePattern": "响应消息模式"
  }
}
```

## 数据验证方法

### 验证方法类型

| 方法名称 | 说明 | 适用场景 |
|----------|------|----------|
| AGGREGATED_DATA | 聚合数据验证 | 统计报表、总计数据 |
| DATABASE_COMPARE | 数据库比对 | 直接查询结果验证 |
| CALCULATED_FIELD | 计算字段验证 | 需要公式计算的字段 |
| GROUP_BY_AGGREGATION | 分组聚合验证 | 按维度分组的统计 |
| TIME_RANGE_AGGREGATION | 时间范围聚合 | 时间维度统计 |
| LIST_COUNT | 列表计数验证 | 简单的记录数量验证 |
| STATUS_FILTER | 状态筛选验证 | 按状态筛选的查询 |
| TYPE_FILTER | 类型筛选验证 | 按类型筛选的查询 |
| CONDITIONAL_FILTER | 条件筛选验证 | 复杂条件筛选 |

### aggregationValidation覆盖率

- **总测试用例**: 164个
- **包含aggregationValidation**: 164个 (100%)
- **各类别覆盖率**: 全部100%

## 重点验证内容

### 1. 数据聚合准确性 ✓

所有测试用例都包含`aggregationValidation`,验证内容包括:

- **REPORT类**: 计划产量、实际产量、完成率、批次数等
- **ALERT类**: 告警总数、活跃数、严重数量等
- **EQUIPMENT类**: 设备总数、运行数量、利用率等
- **SCALE类**: 电子秤总数、在线数量、精度等
- **INVENTORY类**: 批次总数、可用数量、利用率等

### 2. 分页排序

测试用例支持验证:
- 分页参数正确性
- 排序规则准确性
- 记录数量匹配

### 3. 时间范围筛选

支持的时间范围类型:
- 今日 (TODAY)
- 本周 (WEEK)
- 本月 (MONTH)
- 自定义范围 (CUSTOM)
- 最近N小时/天 (24_HOURS等)

### 4. 多维度统计

支持的分组维度:
- 按产品类型 (product_type_id)
- 按车间 (workshop_id)
- 按产线 (production_line_id)
- 按操作员 (operator_id)
- 按告警类型 (alert_type)
- 按严重级别 (severity)
- 按设备状态 (status)

## 使用方法

### 1. 测试执行流程

```bash
# 1. 执行测试数据准备 (testDataSetup.sql)
# 2. 调用AI意图识别API,传入userInput
# 3. 验证响应 (validation)
# 4. 清理测试数据 (testDataSetup.cleanup)
```

### 2. 验证步骤

#### Step 1: 响应断言验证
```java
// 验证响应状态和意图识别
assert response.getStatus() == "COMPLETED";
assert response.getIntentRecognized() == true;
assert response.getIntentCode() == expectedIntentCode;
```

#### Step 2: 数据准确性验证
```java
// 验证返回数据的准确性
assert response.getData() != null;
// 对比数据库查询结果
assert actualValue == expectedValue;
```

#### Step 3: 聚合验证
```java
// 验证聚合计算结果
assert aggregatedData.getTotalPlanned() == 1000.00;
assert aggregatedData.getTotalActual() == 950.00;
assert aggregatedData.getCompletionRate() == 95.00;
```

#### Step 4: 语义验证
```java
// 使用LLM进行语义正确性验证
SemanticCheckResult result = llmVerify(userInput, response);
assert result.isCorrect() == true;
```

### 3. 示例代码

```java
@Test
public void testReportDashboardOverview() {
    // 1. 准备测试数据
    String setupSql = testCase.getTestDataSetup().getSql();
    jdbcTemplate.execute(setupSql);

    try {
        // 2. 调用API
        IntentExecuteRequest request = new IntentExecuteRequest();
        request.setFactoryId("F001");
        request.setUserInput(testCase.getUserInput());

        IntentExecuteResponse response = aiIntentService.executeIntent(request);

        // 3. 验证响应
        ValidationResult validationResult = validateResponse(
            response,
            testCase.getValidation()
        );

        // 4. 断言
        assertTrue(validationResult.isSuccess());
        assertEquals(
            testCase.getExpectedIntent().getIntentCode(),
            response.getIntentCode()
        );

        // 5. 验证聚合数据
        Map<String, Object> aggregation = testCase.getValidation()
            .getDataVerification()
            .getAggregationValidation();

        for (Map.Entry<String, Object> entry : aggregation.entrySet()) {
            Object actualValue = extractFieldFromResponse(response, entry.getKey());
            assertEquals(entry.getValue(), actualValue);
        }

    } finally {
        // 6. 清理数据
        String cleanupSql = testCase.getTestDataSetup().getCleanup();
        jdbcTemplate.execute(cleanupSql);
    }
}
```

## 注意事项

### 1. 测试数据隔离

- 每个测试用例使用独立的测试数据
- 测试数据ID范围: 9000-9999 (production_batches), 8000-8999 (equipment), 7000-7999 (alerts)
- 测试批次ID前缀: `MB_TEST_`, `QI_TEST_` 等
- 必须在测试结束后清理数据

### 2. 并发测试

- 测试用例设计为可并行执行
- 使用不同的ID范围避免冲突
- 建议使用事务隔离

### 3. 性能考虑

- 每个测试用例的执行时间应控制在5秒内
- 聚合验证查询应优化索引
- 大数据量测试应单独标记

### 4. 维护建议

- 定期更新测试数据以反映业务变化
- 新增功能时同步更新测试用例
- 失败的测试用例应记录原因并修复

## 扩展测试

### 计划扩展 (P2, P3)

- **P2优先级**: 操作类测试用例 (CREATE, UPDATE, DELETE)
- **P3优先级**: 边界测试、异常处理、多轮对话
- **性能测试**: 大数据量、高并发场景

### 测试覆盖率目标

| 维度 | 当前覆盖率 | 目标覆盖率 |
|------|-----------|-----------|
| 意图识别准确率 | - | ≥95% |
| 数据准确性 | 100% | 100% |
| 响应时间 | - | <2s |
| 聚合计算准确率 | 100% | 100% |

## 联系方式

如有问题或建议,请联系:
- 测试负责人: [团队成员]
- 文档更新: 2026-01-16
- 版本: 1.0.0
