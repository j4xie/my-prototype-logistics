# AI意图识别测试框架

自动化测试框架，支持4层验证体系，用于全面测试AI意图识别功能。

## 目录结构

```
tests/ai-intent/
├── README.md                      # 本文档
├── test_runner.sh                 # 主测试执行脚本
├── lib/
│   └── test_utils.sh             # 工具函数库
├── reports/                       # 测试报告输出目录
│   └── test-report-*.md          # 自动生成的测试报告
└── test-cases-example.json       # 示例测试用例
```

## 快速开始

### 1. 安装依赖

**macOS:**
```bash
brew install jq mysql-client curl
```

**Ubuntu/Debian:**
```bash
sudo apt-get install jq mysql-client curl
```

### 2. 配置环境变量（可选）

```bash
export API_BASE_URL="http://139.196.165.140:10010/api/mobile"
export DB_HOST="139.196.165.140"
export DB_USER="creats-test"
export DB_PASS="R8mwtyFEDMDPBwC8"
export DB_NAME="creats-test"
export FACTORY_ID="F001"
```

### 3. 运行测试

**执行所有测试:**
```bash
./test_runner.sh --file test-cases-example.json
```

**按优先级过滤:**
```bash
./test_runner.sh --file test-cases-example.json --priority P0
```

**按类别过滤:**
```bash
./test_runner.sh --file test-cases-example.json --category MATERIAL
```

**执行单个测试:**
```bash
./test_runner.sh --file test-cases-example.json --id TC-P0-MATERIAL-001
```

**生成HTML报告:**
```bash
./test_runner.sh --file test-cases-example.json --report-html
```

## 测试用例格式

### JSON结构说明

```json
{
  "testSuite": {
    "name": "测试套件名称",
    "version": "1.0.0",
    "description": "测试套件描述"
  },
  "testCases": [
    {
      "id": "TC-P0-MATERIAL-001",
      "name": "测试用例名称",
      "priority": "P0|P1|P2",
      "category": "MATERIAL|INVENTORY|等",
      "input": "用户输入的问题",
      "setup": {
        "description": "准备步骤描述",
        "sql": "INSERT INTO ... (多条SQL用分号分隔)"
      },
      "expected": {
        "success": true,
        "intentType": "期望的意图类型",
        "minConfidence": 0.7
      },
      "validation": {
        "dataValidation": {
          "minCount": 1,
          "requiredFields": ["field1", "field2"]
        },
        "semanticCriteria": "语义验证标准描述",
        "operationValidation": {
          "sql": "SELECT COUNT(*) FROM ..."
        }
      },
      "cleanup": {
        "description": "清理步骤描述",
        "sql": "DELETE FROM ..."
      }
    }
  ]
}
```

### 字段说明

| 字段 | 必需 | 说明 |
|------|------|------|
| `id` | ✅ | 测试用例唯一标识，格式：TC-{优先级}-{类别}-{序号} |
| `name` | ✅ | 测试用例名称 |
| `priority` | ✅ | 优先级：P0(核心)/P1(重要)/P2(一般) |
| `category` | ✅ | 类别：MATERIAL/INVENTORY/CHITCHAT等 |
| `input` | ✅ | 用户输入 |
| `setup.sql` | ⭕ | 测试数据准备SQL |
| `expected` | ✅ | 期望的响应结构 |
| `validation` | ⭕ | 验证规则 |
| `cleanup.sql` | ⭕ | 清理SQL |

## 4层验证体系

### Level 1: 响应结构验证

验证API响应的基本结构和字段：
- `success`: 是否成功
- `intentType`: 意图类型
- `confidence`: 置信度

**示例:**
```json
"expected": {
  "success": true,
  "intentType": "MATERIAL_BATCH_QUERY",
  "minConfidence": 0.7
}
```

### Level 2: 数据内容验证

验证返回数据的内容和完整性：
- `minCount`: 最小结果数量
- `requiredFields`: 必需字段列表

**示例:**
```json
"validation": {
  "dataValidation": {
    "minCount": 1,
    "requiredFields": ["batchNumber", "quantity", "unit"]
  }
}
```

### Level 3: 语义正确性验证 (LLM)

使用LLM判断系统回复是否语义正确：

**示例:**
```json
"validation": {
  "semanticCriteria": "返回的数据应该包含批次号B001的完整信息，包括物料类型、数量、单位等字段"
}
```

**注意:** 此层验证在Bash脚本中会跳过，需要在Java测试中使用LLMValidator执行。

### Level 4: 操作效果验证

验证操作对数据库的影响：

**示例:**
```json
"validation": {
  "operationValidation": {
    "sql": "SELECT COUNT(*) FROM material_batches WHERE batch_number = 'B001'"
  }
}
```

## Java测试框架

### 使用IntentTestBase编写测试

```java
@SpringBootTest
public class MaterialIntentTest extends IntentTestBase {

    @Test
    public void testQueryBatch() {
        // 1. 准备测试数据
        String setupSql = "INSERT INTO material_batches ...";
        testDataSetup.setupTestData(setupSql);

        try {
            // 2. 执行意图识别
            IntentExecuteResponse response = executeIntent("查询批次B001");

            // 3. Level 1 验证
            assertSuccess(response);
            assertIntentType(response, "MATERIAL_BATCH_QUERY");

            // 4. Level 2 验证
            assertResultsNotEmpty(response);
            validateRequiredFields(response,
                Arrays.asList("batchNumber", "quantity"));

            // 5. Level 3 验证
            validateSemantic("查询批次B001", response,
                "应该返回批次B001的完整信息");

            // 6. Level 4 验证
            assertDatabaseExists("material_batches",
                "batch_number = 'B001'");

        } finally {
            // 7. 清理数据
            testDataSetup.cleanupTestData(
                "DELETE FROM material_batches WHERE batch_number = 'B001'"
            );
        }
    }
}
```

### 可用的断言方法

**响应验证 (Level 1):**
- `assertSuccess(response)` - 验证成功
- `assertFailure(response)` - 验证失败
- `assertIntentType(response, type)` - 验证意图类型
- `assertConfidence(response, minValue)` - 验证置信度

**数据验证 (Level 2):**
- `assertResultsNotEmpty(response)` - 验证结果不为空
- `assertResultCount(response, count)` - 验证结果数量
- `assertMinResultCount(response, minCount)` - 验证最小数量
- `validateRequiredFields(response, fields)` - 验证必需字段

**语义验证 (Level 3):**
- `validateSemantic(input, response, criteria)` - 语义验证
- `evaluateQuality(input, response, minScore)` - 质量评估

**数据库验证 (Level 4):**
- `assertDatabaseCount(table, where, count)` - 验证数量
- `assertDatabaseExists(table, where)` - 验证存在
- `assertDatabaseNotExists(table, where)` - 验证不存在

## 测试报告

### Markdown报告格式

执行完成后会在 `reports/` 目录生成测试报告：

```markdown
# AI意图识别测试报告

**测试套件**: test-cases-example.json
**执行时间**: 2026-01-16 10:30:00

## 测试摘要

| 指标 | 数值 |
|------|------|
| 总测试数 | 5 |
| 通过数 | 4 |
| 失败数 | 1 |
| 通过率 | 80% |

## 测试结果详情

### ✅ TC-P0-MATERIAL-001 - 查询单个批次详细信息
- **状态**: PASS
- **耗时**: 2.3s

### ❌ TC-P0-MATERIAL-002 - 查询物料类型的所有批次
- **状态**: FAIL
- **耗时**: 1.8s
**错误信息**:
Level 2 validation failed: Result count 1 is less than minimum 2
```

## 最佳实践

### 1. 测试数据隔离

使用唯一ID避免冲突：
```sql
-- 使用999xxx范围作为测试数据ID
INSERT INTO material_batches (id, ...) VALUES (999901, ...)
```

### 2. 测试用例命名规范

```
TC-{优先级}-{类别}-{序号}
例如：TC-P0-MATERIAL-001
```

### 3. 清理策略

- 在 `finally` 块中执行清理，确保无论测试成功失败都会清理
- 使用 `cleanupTestData()` 而不是 `setupTestData()`，前者不会在失败时抛异常

### 4. 日志记录

使用提供的日志方法：
```java
logTestInfo("Starting test");
logTestStep("Step 1: Prepare data");
printResponse(response);  // 调试时打印完整响应
```

## 故障排查

### 依赖检查失败

```bash
# 检查依赖是否安装
./test_runner.sh --file test-cases-example.json
```

如果提示缺少依赖，按照提示安装。

### 数据库连接失败

检查配置：
```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT 1"
```

### API调用失败

检查服务是否运行：
```bash
curl -I http://139.196.165.140:10010/api/mobile/health
```

### 测试数据冲突

如果出现主键冲突，确保：
1. 使用唯一的测试数据ID (999xxx范围)
2. 测试后正确清理数据
3. 检查是否有其他测试使用了相同ID

## 扩展测试框架

### 添加新的验证方法

在 `IntentTestBase` 中添加新方法：

```java
protected void assertCustomValidation(IntentExecuteResponse response) {
    // 自定义验证逻辑
}
```

### 添加新的工具函数

在 `lib/test_utils.sh` 中添加：

```bash
custom_validation() {
    local param="$1"
    # 自定义逻辑
}

export -f custom_validation
```

## 常见问题

**Q: 如何跳过某些测试？**

A: 从JSON文件中移除该测试用例，或使用过滤参数：
```bash
./test_runner.sh --file tests.json --priority P0  # 只执行P0
```

**Q: 如何并行执行测试？**

A: 当前版本按顺序执行。如需并行，可以：
1. 将测试用例分成多个JSON文件
2. 同时运行多个test_runner实例（确保测试数据不冲突）

**Q: LLM验证在Bash中为什么跳过？**

A: LLM验证需要调用AI服务，实现复杂。建议：
- 使用Java测试框架进行LLM验证
- 或在Bash中添加调用Java LLMValidator的逻辑

## 许可证

Copyright © 2026 Cretas Food Traceability System
