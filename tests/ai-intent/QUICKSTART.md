# AI意图识别测试框架 - 快速入门

## 5分钟快速上手

### 1. 检查环境 (30秒)

```bash
cd /Users/jietaoxie/my-prototype-logistics/tests/ai-intent
./check_environment.sh
```

如果看到 "All checks passed!"，说明环境配置正确。

### 2. 运行示例测试 (1分钟)

```bash
./test_runner.sh --file test-cases-example.json
```

### 3. 查看测试报告 (30秒)

```bash
# 查看最新的测试报告
ls -lt reports/
cat reports/test-report-*.md
```

---

## 使用Bash脚本测试

### 基本用法

```bash
# 执行所有测试
./test_runner.sh --file test-cases-example.json

# 只执行P0优先级测试
./test_runner.sh --file test-cases-example.json --priority P0

# 只执行物料相关测试
./test_runner.sh --file test-cases-example.json --category MATERIAL

# 执行单个测试
./test_runner.sh --file test-cases-example.json --id TC-P0-MATERIAL-001
```

### 测试用例文件格式

创建 `my-tests.json`:

```json
{
  "testSuite": {
    "name": "我的测试",
    "version": "1.0.0"
  },
  "testCases": [
    {
      "id": "TC-P0-CUSTOM-001",
      "name": "自定义测试",
      "priority": "P0",
      "category": "CUSTOM",
      "input": "你的问题",
      "setup": {
        "sql": "INSERT INTO ..."
      },
      "expected": {
        "success": true,
        "intentType": "期望的意图类型"
      },
      "cleanup": {
        "sql": "DELETE FROM ..."
      }
    }
  ]
}
```

---

## 使用Java测试框架

### 创建测试类

```java
@SpringBootTest
public class MyIntentTest extends IntentTestBase {

    @Test
    public void testMyIntent() {
        // 1. 准备数据
        testDataSetup.setupTestData("INSERT INTO ...");

        try {
            // 2. 执行测试
            IntentExecuteResponse response = executeIntent("你的问题");

            // 3. 验证结果
            assertSuccess(response);
            assertIntentType(response, "EXPECTED_INTENT");
            assertResultsNotEmpty(response);

        } finally {
            // 4. 清理数据
            testDataSetup.cleanupTestData("DELETE FROM ...");
        }
    }
}
```

### 运行Java测试

```bash
cd /Users/jietaoxie/my-prototype-logistics/backend-java

# 运行单个测试类
mvn test -Dtest=MaterialIntentTest

# 运行所有测试
mvn test -Dtest=**/*IntentTest
```

---

## 常用验证方法速查

### Level 1: 响应验证

```java
assertSuccess(response);                     // 验证成功
assertIntentType(response, "INTENT_TYPE");   // 验证意图类型
assertConfidence(response, 0.7);             // 验证置信度 >= 0.7
```

### Level 2: 数据验证

```java
assertResultsNotEmpty(response);             // 验证有结果
assertResultCount(response, 5);              // 验证结果数量 = 5
assertMinResultCount(response, 3);           // 验证结果数量 >= 3

validateRequiredFields(response,             // 验证必需字段
    Arrays.asList("field1", "field2"));
```

### Level 3: 语义验证

```java
validateSemantic(
    "用户问题",
    response,
    "评估标准：应该返回..."
);

evaluateQuality(                             // 质量评估
    "用户问题",
    response,
    3.5                                      // 最低分数
);
```

### Level 4: 数据库验证

```java
assertDatabaseCount(                         // 验证数量
    "table_name",
    "where_clause",
    1
);

assertDatabaseExists(                        // 验证存在
    "table_name",
    "where_clause"
);
```

---

## 编写测试用例的最佳实践

### 1. 使用唯一的测试数据ID

```sql
-- ✅ 使用999xxx范围
INSERT INTO material_batches (id, ...) VALUES (999901, ...);

-- ❌ 不要使用业务数据范围
INSERT INTO material_batches (id, ...) VALUES (1, ...);
```

### 2. 始终清理测试数据

```java
try {
    // 测试逻辑
} finally {
    // 必须清理，即使测试失败
    testDataSetup.cleanupTestData("DELETE FROM ...");
}
```

### 3. 测试用例ID命名规范

```
TC-{优先级}-{类别}-{序号}

例如：
- TC-P0-MATERIAL-001  (P0优先级，物料类别，序号001)
- TC-P1-INVENTORY-002 (P1优先级，库存类别，序号002)
```

### 4. 使用日志记录测试步骤

```java
logTestInfo("Starting material batch query test");
logTestStep("Step 1: Preparing test data");
logTestStep("Step 2: Executing intent");
logTestStep("Step 3: Validating response");
```

---

## 故障排查速查

### 问题: 依赖检查失败

**解决:**
```bash
# macOS
brew install jq mysql-client curl

# Linux
sudo apt-get install jq mysql-client curl
```

### 问题: 数据库连接失败

**检查:**
```bash
mysql -h 139.196.165.140 -u creats-test -pR8mwtyFEDMDPBwC8 creats-test -e "SELECT 1"
```

### 问题: API调用401未授权

**原因:** Token过期或用户名密码错误

**解决:** 检查 `TEST_USERNAME` 和 `TEST_PASSWORD` 配置

### 问题: 测试数据冲突

**原因:** 测试数据没有清理或ID重复

**解决:**
1. 检查cleanup SQL是否正确执行
2. 使用唯一的测试数据ID (999xxx)
3. 手动清理: `DELETE FROM table WHERE id = 999xxx`

---

## 进阶使用

### 自定义环境变量

```bash
export API_BASE_URL="http://your-api-url"
export DB_HOST="your-db-host"
export DB_USER="your-db-user"
export DB_PASS="your-db-password"

./test_runner.sh --file test-cases-example.json
```

### 生成HTML报告

```bash
./test_runner.sh --file test-cases-example.json --report-html
```

### 批量验证（使用LLM）

```java
List<LLMValidator.TestCase> testCases = Arrays.asList(
    new LLMValidator.TestCase("问题1", "响应1", "标准1"),
    new LLMValidator.TestCase("问题2", "响应2", "标准2")
);

LLMValidator.BatchValidationResult result =
    llmValidator.validateBatch(testCases);

System.out.printf("Pass rate: %.2f%%\n", result.getPassRate());
```

---

## 下一步

1. 阅读完整文档: [README.md](README.md)
2. 查看示例用例: [test-cases-example.json](test-cases-example.json)
3. 查看示例测试: [MaterialIntentTest.java](../../backend-java/src/test/java/com/cretas/aims/test/MaterialIntentTest.java)
4. 创建你的第一个测试用例！

---

## 需要帮助？

- 查看 [README.md](README.md) 获取详细文档
- 运行 `./check_environment.sh` 检查环境配置
- 运行 `./test_runner.sh --help` 查看命令行选项
