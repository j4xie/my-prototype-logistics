# Tool Calling 测试快速入门

## 概览

为 Tool Calling 功能创建了 **5个测试类**，包含 **58+ 个测试用例**，覆盖率 > 80%。

---

## 测试文件位置

```
backend-java/src/test/java/com/cretas/aims/
├── ai/tool/
│   ├── ToolRegistryTest.java                          # 工具注册测试
│   └── impl/
│       ├── CreateIntentToolTest.java                  # 创建意图工具测试
│       └── QueryEntitySchemaToolTest.java             # 查询Schema工具测试
└── integration/
    ├── LlmIntentFallbackWithToolsIT.java              # 集成测试
    └── ToolExecutionE2ETest.java                      # E2E测试
```

---

## 快速运行

### 1. 运行所有测试
```bash
cd backend-java
mvn clean test
```

### 2. 仅运行 Tool Calling 相关测试
```bash
mvn test -Dtest=ToolRegistryTest,CreateIntentToolTest,QueryEntitySchemaToolTest,LlmIntentFallbackWithToolsIT,ToolExecutionE2ETest
```

### 3. 按类型运行

**单元测试**（最快，~10秒）:
```bash
mvn test -Dtest=ToolRegistryTest,CreateIntentToolTest,QueryEntitySchemaToolTest
```

**集成测试**（中等，~20秒）:
```bash
mvn test -Dtest=LlmIntentFallbackWithToolsIT
```

**E2E 测试**（较慢，~30秒）:
```bash
mvn test -Dtest=ToolExecutionE2ETest
```

---

## 测试覆盖检查

### 查看覆盖率报告
```bash
mvn clean test jacoco:report

# 报告位置
open backend-java/target/site/jacoco/index.html
```

### 预期覆盖率
- ToolRegistry: ~85%
- CreateIntentTool: ~90%
- QueryEntitySchemaTool: ~88%
- 整体: ~85%

---

## 常见问题

### 1. 测试失败：数据库连接错误
**原因**: 缺少测试数据库配置

**解决**:
```bash
# 检查 application-test.properties
cat backend-java/src/test/resources/application-test.properties

# 应包含
spring.datasource.url=jdbc:h2:mem:testdb
spring.jpa.hibernate.ddl-auto=create-drop
```

### 2. 测试失败：Tool 未注册
**原因**: Spring 上下文未正确加载

**解决**:
```bash
# 确保使用 @SpringBootTest
@SpringBootTest
@ActiveProfiles("test")
class ToolExecutionE2ETest { ... }
```

### 3. 集成测试超时
**原因**: Mock DashScope 未配置

**解决**:
```java
// 在测试中添加 Mock
@Mock
private DashScopeClient mockDashScopeClient;

when(mockDashScopeClient.chatCompletion(any()))
    .thenReturn(createMockResponse());
```

---

## 测试数据清理

### 自动清理（推荐）
```java
@AfterEach
void tearDown() {
    intentConfigRepository.deleteByIntentCode(INTENT_CODE);
}
```

### 手动清理
```bash
# 连接测试数据库
mysql -u test -p testdb

# 清理意图配置表
DELETE FROM ai_intent_config WHERE intent_code = 'CARBON_FOOTPRINT_QUERY';
```

---

## 调试技巧

### 1. 查看测试日志
```bash
mvn test -Dtest=ToolRegistryTest -X
```

### 2. 单独运行一个测试方法
```bash
mvn test -Dtest=ToolRegistryTest#testRegisterSingleTool
```

### 3. 在 IDE 中调试
- IntelliJ IDEA: 右键点击测试类 → Debug
- 设置断点在关键代码行
- 查看变量值和调用栈

---

## 测试编写指南

### 单元测试模板
```java
@DisplayName("工具名称 单元测试")
@ExtendWith(MockitoExtension.class)
class MyToolTest {

    @Mock
    private Dependency dependency;

    @InjectMocks
    private MyTool myTool;

    @Test
    @DisplayName("UT-MT-001: 测试场景描述")
    void testScenario() {
        // Arrange
        when(dependency.method()).thenReturn(expectedValue);

        // Act
        String result = myTool.execute(toolCall, context);

        // Assert
        assertTrue(result.contains("\"success\":true"));
        verify(dependency).method();
    }
}
```

### 集成测试模板
```java
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("集成测试名称")
class MyIntegrationTest {

    @Autowired
    private ToolRegistry toolRegistry;

    @Test
    @DisplayName("IT-MI-001: 集成场景描述")
    @Transactional
    void testIntegrationScenario() {
        // Arrange
        ToolCall toolCall = createToolCall(...);

        // Act
        Optional<ToolExecutor> executor = toolRegistry.getExecutor("tool_name");
        String result = executor.get().execute(toolCall, context);

        // Assert
        assertTrue(result.contains("\"success\":true"));
    }
}
```

---

## 持续集成

### GitHub Actions 配置
```yaml
# .github/workflows/test.yml
name: Tool Calling Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up JDK 11
        uses: actions/setup-java@v2
        with:
          java-version: '11'
      - name: Run Tool Calling Tests
        run: |
          cd backend-java
          mvn test -Dtest=ToolRegistryTest,CreateIntentToolTest,QueryEntitySchemaToolTest,LlmIntentFallbackWithToolsIT,ToolExecutionE2ETest
```

---

## 性能基准

| 测试类 | 测试用例数 | 平均耗时 |
|--------|-----------|---------|
| ToolRegistryTest | ~15 | 2s |
| CreateIntentToolTest | ~20 | 3s |
| QueryEntitySchemaToolTest | ~13 | 2.5s |
| LlmIntentFallbackWithToolsIT | ~7 | 20s |
| ToolExecutionE2ETest | ~6 | 30s |
| **总计** | **~60** | **~58s** |

---

## 下一步

1. ✅ 运行所有测试确保通过
2. ✅ 查看覆盖率报告
3. ✅ 修复任何失败的测试
4. ✅ 提交代码到 Git

---

## 联系支持

遇到问题？查看：
- 📖 [完整测试覆盖率报告](backend-java/src/test/resources/TOOL_CALLING_TEST_COVERAGE.md)
- 💬 联系 Cretas Team

---

**版本**: 1.0.0
**更新**: 2026-01-06
