# Dry-Run API 快速参考

## 一句话说明

在不保存规则和不影响数据的情况下，测试 Drools 规则的执行效果。

## 快速开始

### 1. 最简单的请求

```bash
POST /api/mobile/F001/rules/dry-run
Content-Type: application/json
Authorization: Bearer {token}

{
  "ruleContent": "package com.cretas.aims.rules;\n\nimport java.util.Map;\nimport java.util.HashMap;\nimport java.util.List;\n\nglobal List results;\n\nrule \"Test Rule\"\n  when\n    $data : Map()\n  then\n    Map result = new HashMap();\n    result.put(\"result\", \"ALLOW\");\n    results.add(result);\nend",
  "testData": {}
}
```

### 2. 必须的 DRL 结构

```drl
package com.cretas.aims.rules;

import java.util.Map;
import java.util.HashMap;
import java.util.List;

global List results;              // ← 必须
global Map simulatedChanges;      // ← 可选

rule "Your Rule Name"
  when
    $data : Map()  // 测试数据
  then
    Map result = new HashMap();
    result.put("result", "ALLOW");  // ALLOW/DENY/WARN/BLOCK
    result.put("message", "成功");
    results.add(result);            // ← 必须
end
```

### 3. 常用响应字段

```json
{
  "success": true,
  "rulesMatched": ["规则名"],
  "result": "ALLOW",
  "simulatedChanges": {"field": "value"},
  "firedCount": 1,
  "executionTimeMs": 15
}
```

## 5 个实用示例

### 示例 1: 验证数量

```javascript
{
  "ruleContent": "package com.cretas.aims.rules;\nimport java.util.*;\nglobal List results;\nrule \"Check Quantity\"\n  when\n    $data : Map(this[\"qty\"] != null)\n    eval(((Number)$data.get(\"qty\")).doubleValue() <= 0)\n  then\n    Map r = new HashMap();\n    r.put(\"result\", \"DENY\");\n    r.put(\"message\", \"数量必须>0\");\n    results.add(r);\nend",
  "testData": {"qty": -5}
}
```

### 示例 2: 自动计算

```javascript
{
  "ruleContent": "package com.cretas.aims.rules;\nimport java.util.*;\nglobal List results;\nglobal Map simulatedChanges;\nrule \"Calculate Total\"\n  when\n    $data : Map()\n  then\n    double qty = ((Number)$data.get(\"qty\")).doubleValue();\n    double price = ((Number)$data.get(\"price\")).doubleValue();\n    double total = qty * price;\n    simulatedChanges.put(\"total\", total);\n    Map r = new HashMap();\n    r.put(\"result\", \"ALLOW\");\n    results.add(r);\nend",
  "testData": {"qty": 10, "price": 50}
}
```

### 示例 3: 检查必填字段

```javascript
{
  "ruleContent": "package com.cretas.aims.rules;\nimport java.util.*;\nglobal List results;\nrule \"Required Fields\"\n  when\n    $data : Map()\n    eval($data.get(\"name\") == null || $data.get(\"id\") == null)\n  then\n    Map r = new HashMap();\n    r.put(\"result\", \"BLOCK\");\n    r.put(\"message\", \"缺少必填字段\");\n    results.add(r);\nend",
  "testData": {"id": "123"}
}
```

### 示例 4: 日期计算

```javascript
{
  "ruleContent": "package com.cretas.aims.rules;\nimport java.util.*;\nimport java.time.LocalDate;\nglobal List results;\nglobal Map simulatedChanges;\nrule \"Add Days\"\n  when\n    $data : Map()\n  then\n    LocalDate date = LocalDate.parse((String)$data.get(\"date\"));\n    LocalDate newDate = date.plusDays(30);\n    simulatedChanges.put(\"expiry\", newDate.toString());\n    Map r = new HashMap();\n    r.put(\"result\", \"ALLOW\");\n    results.add(r);\nend",
  "testData": {"date": "2025-01-01"}
}
```

### 示例 5: 多规则

```javascript
{
  "ruleContent": "package com.cretas.aims.rules;\nimport java.util.*;\nglobal List results;\nrule \"Rule1\" salience 100\n  when $data:Map() eval($data.get(\"a\") == null)\n  then Map r=new HashMap(); r.put(\"result\",\"DENY\"); r.put(\"message\",\"缺少a\"); results.add(r);\nend\nrule \"Rule2\" salience 50\n  when $data:Map() eval($data.get(\"b\") == null)\n  then Map r=new HashMap(); r.put(\"result\",\"WARN\"); r.put(\"message\",\"缺少b\"); results.add(r);\nend",
  "testData": {"c": 1}
}
```

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `validationErrors: ["..."]` | DRL 语法错误 | 检查规则语法 |
| `firedCount: 0` | when 条件不匹配 | 检查 testData |
| `simulatedChanges: {}` | 未使用 global Map | 添加 `global Map simulatedChanges` |

## 测试工具

```bash
# 方法 1: Shell 脚本
cd docs && ./test-dry-run.sh

# 方法 2: curl
curl -X POST "http://IP:10010/api/mobile/F001/rules/dry-run" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @request.json

# 方法 3: Postman
# 导入 DRY_RUN_POSTMAN_EXAMPLES.json
```

## 权限要求

- `factory_super_admin`
- `department_admin`

## 性能指标

- 平均响应时间: 10-20ms
- 建议超时: 5 秒
- 最大规则数: 无限制（建议 < 100）

## 下一步

- 📖 完整文档: `DRY_RUN_API_GUIDE.md`
- 📝 实现总结: `DRY_RUN_IMPLEMENTATION_SUMMARY.md`
- 🧪 Postman 集合: `DRY_RUN_POSTMAN_EXAMPLES.json`
- 🔧 测试脚本: `test-dry-run.sh`
