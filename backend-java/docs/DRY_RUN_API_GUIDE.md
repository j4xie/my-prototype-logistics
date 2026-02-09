# 规则引擎 Dry-Run API 使用指南

## 概述

Dry-Run API 允许在不保存规则和不影响真实数据的情况下，测试 Drools 规则的执行效果。这对于规则发布前的预览和验证非常有用。

## API 端点

```
POST /api/mobile/{factoryId}/rules/dry-run
```

### 权限要求
- `factory_super_admin`
- `department_admin`

## 请求格式

### Request Body

```json
{
  "ruleContent": "完整的 DRL 规则内容",
  "entityType": "MATERIAL_BATCH | PROCESSING_BATCH | QUALITY_INSPECTION",
  "hookPoint": "beforeCreate | beforeSubmit | afterSubmit",
  "testData": {
    "field1": "value1",
    "field2": "value2"
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ruleContent` | String | ✅ | 完整的 DRL 规则定义（包含 package、import、global、rule 等） |
| `entityType` | String | ❌ | 实体类型（用于审计和上下文） |
| `hookPoint` | String | ❌ | 触发点（beforeCreate, beforeSubmit, afterSubmit） |
| `testData` | Object | ❌ | 测试数据，可以是单个对象或包含多个 facts 的对象 |

## 响应格式

### 成功响应

```json
{
  "success": true,
  "message": "Dry-Run 执行成功",
  "data": {
    "success": true,
    "validationErrors": [],
    "rulesMatched": ["temp_rule (fired 1 times)"],
    "result": "ALLOW | DENY | WARN | BLOCK",
    "ruleResults": [
      {
        "result": "ALLOW",
        "message": "规则执行通过"
      }
    ],
    "simulatedChanges": {
      "modifiedField1": "newValue1",
      "modifiedField2": "newValue2"
    },
    "firedCount": 1,
    "warnings": [],
    "executionTimeMs": 15,
    "factoryId": "F001",
    "entityType": "MATERIAL_BATCH",
    "hookPoint": "beforeCreate"
  }
}
```

### 失败响应（语法错误）

```json
{
  "success": true,
  "message": "Dry-Run 执行失败",
  "data": {
    "success": false,
    "validationErrors": [
      "Rule Compilation error : [Rule name='ValidateQuantity']",
      "Syntax error near line 10"
    ],
    "rulesMatched": [],
    "result": null,
    "simulatedChanges": {},
    "warnings": []
  }
}
```

## 使用示例

### 示例 1: 简单验证规则

验证原材料批次的数量是否大于 0：

```java
POST /api/mobile/F001/rules/dry-run
Content-Type: application/json
Authorization: Bearer {token}

{
  "ruleContent": "package com.cretas.aims.rules;\n\nimport java.util.Map;\nimport java.util.HashMap;\nimport java.util.List;\nimport java.util.ArrayList;\n\nglobal List results;\nglobal Map simulatedChanges;\n\nrule \"Validate Material Batch Quantity\"\n  salience 100\n  when\n    $data : Map(this[\"quantity\"] != null, this[\"quantity\"] instanceof Number)\n    eval(((Number) $data.get(\"quantity\")).doubleValue() <= 0)\n  then\n    Map result = new HashMap();\n    result.put(\"result\", \"DENY\");\n    result.put(\"message\", \"数量必须大于 0\");\n    results.add(result);\nend",
  "entityType": "MATERIAL_BATCH",
  "hookPoint": "beforeCreate",
  "testData": {
    "quantity": -5,
    "materialType": "面粉",
    "supplierId": "S001"
  }
}
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "success": true,
    "rulesMatched": ["temp_rule (fired 1 times)"],
    "result": "DENY",
    "ruleResults": [
      {
        "result": "DENY",
        "message": "数量必须大于 0"
      }
    ],
    "firedCount": 1,
    "executionTimeMs": 12
  }
}
```

### 示例 2: 自动计算规则

自动计算原材料的保质期：

```java
POST /api/mobile/F001/rules/dry-run

{
  "ruleContent": "package com.cretas.aims.rules;\n\nimport java.util.Map;\nimport java.util.HashMap;\nimport java.util.List;\nimport java.util.ArrayList;\nimport java.time.LocalDate;\n\nglobal List results;\nglobal Map simulatedChanges;\n\nrule \"Calculate Expiry Date\"\n  salience 100\n  when\n    $data : Map(this[\"productionDate\"] != null, this[\"shelfLifeDays\"] != null)\n  then\n    String productionDateStr = (String) $data.get(\"productionDate\");\n    Integer shelfLifeDays = ((Number) $data.get(\"shelfLifeDays\")).intValue();\n    \n    LocalDate productionDate = LocalDate.parse(productionDateStr);\n    LocalDate expiryDate = productionDate.plusDays(shelfLifeDays);\n    \n    simulatedChanges.put(\"expiryDate\", expiryDate.toString());\n    simulatedChanges.put(\"calculationMethod\", \"productionDate + shelfLifeDays\");\n    \n    Map result = new HashMap();\n    result.put(\"result\", \"ALLOW\");\n    result.put(\"message\", \"保质期已自动计算: \" + expiryDate);\n    results.add(result);\nend",
  "entityType": "MATERIAL_BATCH",
  "hookPoint": "beforeCreate",
  "testData": {
    "productionDate": "2025-01-01",
    "shelfLifeDays": 30,
    "materialType": "鸡蛋"
  }
}
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "success": true,
    "rulesMatched": ["temp_rule (fired 1 times)"],
    "result": "ALLOW",
    "ruleResults": [
      {
        "result": "ALLOW",
        "message": "保质期已自动计算: 2025-01-31"
      }
    ],
    "simulatedChanges": {
      "expiryDate": "2025-01-31",
      "calculationMethod": "productionDate + shelfLifeDays"
    },
    "firedCount": 1,
    "executionTimeMs": 18
  }
}
```

### 示例 3: 多条件验证规则

验证质检记录的完整性：

```java
POST /api/mobile/F001/rules/dry-run

{
  "ruleContent": "package com.cretas.aims.rules;\n\nimport java.util.Map;\nimport java.util.HashMap;\nimport java.util.List;\nimport java.util.ArrayList;\n\nglobal List results;\nglobal Map simulatedChanges;\n\nrule \"Validate Quality Check Completeness\"\n  salience 100\n  when\n    $data : Map()\n    eval(\n      $data.get(\"sampleSize\") == null ||\n      $data.get(\"inspector\") == null ||\n      $data.get(\"inspectionDate\") == null\n    )\n  then\n    Map result = new HashMap();\n    result.put(\"result\", \"BLOCK\");\n    result.put(\"block\", true);\n    \n    List missingFields = new ArrayList();\n    if ($data.get(\"sampleSize\") == null) missingFields.add(\"sampleSize\");\n    if ($data.get(\"inspector\") == null) missingFields.add(\"inspector\");\n    if ($data.get(\"inspectionDate\") == null) missingFields.add(\"inspectionDate\");\n    \n    result.put(\"message\", \"质检记录不完整，缺少字段: \" + missingFields);\n    result.put(\"missingFields\", missingFields);\n    results.add(result);\nend",
  "entityType": "QUALITY_INSPECTION",
  "hookPoint": "beforeSubmit",
  "testData": {
    "sampleSize": 10,
    "inspectionDate": "2025-01-15"
  }
}
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "success": true,
    "rulesMatched": ["temp_rule (fired 1 times)"],
    "result": "BLOCK",
    "ruleResults": [
      {
        "result": "BLOCK",
        "block": true,
        "message": "质检记录不完整，缺少字段: [inspector]",
        "missingFields": ["inspector"]
      }
    ],
    "firedCount": 1,
    "executionTimeMs": 14
  }
}
```

### 示例 4: 多个 Facts 的规则

使用 `facts` 数组传递多个事实对象：

```java
POST /api/mobile/F001/rules/dry-run

{
  "ruleContent": "package com.cretas.aims.rules;\n\nimport java.util.Map;\nimport java.util.HashMap;\nimport java.util.List;\nimport java.util.ArrayList;\n\nglobal List results;\n\nrule \"Cross-Check Material and Supplier\"\n  salience 100\n  when\n    $material : Map(this[\"type\"] == \"material\")\n    $supplier : Map(this[\"type\"] == \"supplier\")\n    eval(\n      !$material.get(\"supplierId\").equals($supplier.get(\"id\"))\n    )\n  then\n    Map result = new HashMap();\n    result.put(\"result\", \"WARN\");\n    result.put(\"message\", \"供应商ID不匹配\");\n    results.add(result);\nend",
  "entityType": "MATERIAL_BATCH",
  "hookPoint": "beforeCreate",
  "testData": {
    "facts": [
      {
        "type": "material",
        "name": "小麦",
        "supplierId": "S001"
      },
      {
        "type": "supplier",
        "id": "S002",
        "name": "优质供应商"
      }
    ]
  }
}
```

## 实现原理

### 1. 语法验证
首先使用 Drools 的 `KieBuilder` 验证 DRL 语法是否正确。

### 2. 临时容器创建
创建一个临时的 `KieContainer`，不会影响已加载的规则。

### 3. 沙箱执行
- 在隔离的 `KieSession` 中执行规则
- 使用 `global` 变量收集执行结果和模拟的修改
- 执行完成后立即清理 `KieSession` 和 `KieContainer`

### 4. 结果收集
- `rulesMatched`: 匹配并触发的规则
- `result`: 规则的决策结果（ALLOW/DENY/WARN/BLOCK）
- `simulatedChanges`: 规则模拟的数据修改
- `ruleResults`: 规则执行的详细结果
- `firedCount`: 触发的规则数量
- `executionTimeMs`: 执行耗时

## 安全特性

1. **隔离执行**: 使用临时 `KieContainer`，不影响已加载的规则
2. **资源清理**: 执行完成后立即释放资源
3. **超时保护**: 后续可添加执行超时限制（建议 5 秒）
4. **权限控制**: 仅管理员可执行 Dry-Run

## DRL 规则编写建议

### 1. 必须定义 global 变量

```drl
global List results;           // 用于收集规则执行结果
global Map simulatedChanges;   // 用于记录模拟的数据修改（可选）
```

### 2. 使用 Map 作为 Fact

推荐使用 `Map` 作为事实对象，便于动态测试：

```drl
when
  $data : Map(this["fieldName"] != null)
then
  // ...
end
```

### 3. 返回结构化结果

```drl
then
  Map result = new HashMap();
  result.put("result", "ALLOW");  // ALLOW, DENY, WARN, BLOCK
  result.put("message", "执行成功");
  result.put("additionalData", someValue);
  results.add(result);
end
```

### 4. 记录模拟修改

```drl
then
  simulatedChanges.put("calculatedField", newValue);
  simulatedChanges.put("modifiedAt", LocalDateTime.now().toString());
end
```

## 常见问题

### Q1: 规则执行但 `firedCount` 为 0？

**原因**: 规则的 `when` 条件不匹配测试数据。

**解决**: 检查 `testData` 是否包含规则需要的字段和值。

### Q2: 如何测试多个规则？

**答案**: 在一个 DRL 文件中定义多个 `rule`，所有匹配的规则都会被触发。

### Q3: `simulatedChanges` 为空？

**原因**: 规则可能没有定义 `global Map simulatedChanges` 或未向其写入数据。

**解决**: 在规则的 `then` 部分添加：
```drl
simulatedChanges.put("key", value);
```

### Q4: 如何测试异常情况？

**答案**: 在 `testData` 中构造边界值或非法值，验证规则是否能正确处理。

## 前端集成示例

### TypeScript 调用

```typescript
import { ruleApiClient } from '@/services/api/ruleApiClient';

interface DryRunRequest {
  ruleContent: string;
  entityType?: string;
  hookPoint?: string;
  testData?: Record<string, any>;
}

async function testRule(factoryId: string, request: DryRunRequest) {
  try {
    const response = await ruleApiClient.dryRun(factoryId, request);

    if (response.data.success) {
      console.log('规则执行成功:', response.data.result);
      console.log('触发规则:', response.data.rulesMatched);
      console.log('模拟修改:', response.data.simulatedChanges);
    } else {
      console.error('规则执行失败:', response.data.validationErrors);
    }
  } catch (error) {
    console.error('API 调用失败:', error);
  }
}
```

### React Hook 使用

```typescript
import { useRuleHooks } from '@/formily/hooks/useRuleHooks';

function RuleTestScreen() {
  const { dryRunRule, loading } = useRuleHooks();

  const handleTest = async () => {
    const result = await dryRunRule({
      ruleContent: '...',
      entityType: 'MATERIAL_BATCH',
      testData: { quantity: 10 }
    });

    if (result.success) {
      Alert.alert('测试成功', result.result);
    } else {
      Alert.alert('测试失败', result.validationErrors.join('\n'));
    }
  };

  return <Button onPress={handleTest} loading={loading}>测试规则</Button>;
}
```

## 总结

Dry-Run API 提供了一个安全、隔离的环境来测试 Drools 规则，适用于：

- ✅ 规则发布前的预览
- ✅ 规则语法验证
- ✅ 规则逻辑验证
- ✅ 配置变更集（ChangeSet）的预览
- ✅ 开发调试

通过合理使用 Dry-Run API，可以大大降低规则错误导致的生产问题风险。
