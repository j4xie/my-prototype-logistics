# AI 意图识别系统综合测试报告

**测试时间**: 2026-01-17 18:45
**测试服务器**: http://139.196.165.140:10010
**测试账号**: factory_admin1
**工厂ID**: F001

---

## 总体测试摘要

| 测试类别 | 测试数 | 通过 | 失败 | 通过率 |
|---------|-------|------|------|-------|
| 意图识别 (查询类) | 8 | 8 | 0 | 100% |
| 意图识别 (操作类) | 6 | 3 | 3 | 50% |
| 参数提取规则学习 | 4 | 4 | 0 | 100% |
| 规则管理 API | 4 | 4 | 0 | 100% |
| 错误处理 | 3 | 3 | 0 | 100% |
| **总计** | **25** | **22** | **3** | **88%** |

---

## 一、意图识别测试

### 1.1 查询类意图 (全部通过)

| 用户输入 | 识别意图 | 状态 | 结果 |
|---------|---------|------|------|
| 查询所有带鱼原材料批次 | MATERIAL_BATCH_QUERY | SUCCESS | ✅ |
| 看看还剩多少虾仁 | MATERIAL_BATCH_QUERY | SUCCESS | ✅ |
| 查询所有原料的库存状态 | MATERIAL_BATCH_QUERY | SUCCESS | ✅ |
| 查看今天的质检记录 | QUALITY_CHECK_QUERY | SUCCESS | ✅ |
| 查询最近一周的出货情况 | SHIPMENT_QUERY | SUCCESS | ✅ |
| 追溯批次BATCH-2026-001的来源 | TRACE_BATCH | SUCCESS | ✅ |
| 查看今天的生产批次 | PROCESSING_BATCH_LIST | SUCCESS | ✅ |
| 查看库存 | REPORT_INVENTORY | SUCCESS | ✅ |

### 1.2 操作类意图 (部分需优化)

| 用户输入 | 期望意图 | 实际意图 | 状态 | 说明 |
|---------|---------|---------|------|------|
| 创建新用户,用户名testuser | USER_CREATE | USER_CREATE | ✅ | 正常 |
| 禁用用户zhangsan123的账号 | USER_DISABLE | USER_DISABLE | ✅ | 正常 |
| 新建用户wangwu,真名王五 | USER_CREATE | USER_CREATE | ✅ | 规则学习后正常 |
| 入库一批带鱼,数量500公斤 | MATERIAL_BATCH_CREATE | MATERIAL_BATCH_QUERY | ⚠️ | 意图误识别 |
| 发货给客户华润万家 | SHIPMENT_CREATE | MATERIAL_BATCH_QUERY | ⚠️ | 意图误识别 |
| 使用批次xxx的带鱼50公斤 | MATERIAL_BATCH_USE | PROCESSING_BATCH_TIMELINE | ⚠️ | 意图误识别 |

**说明**: 操作类意图识别需要优化，部分操作被误识别为查询类意图。

---

## 二、参数提取规则学习测试

### 2.1 规则学习功能 (全部通过)

| 测试场景 | 输入模式 | 学习结果 | 状态 |
|---------|---------|---------|------|
| 首次调用 LLM 提取 | `用户名zhangsan` | 学习 KEYWORD_AFTER 规则 | ✅ |
| 二次调用规则提取 | `用户名lisi` | 使用学习规则，hitCount +1 | ✅ |
| 参数确认学习 | `新建用户xxx,真名yyy` | 学习新规则，规则数 2→4 | ✅ |
| 规则验证 | `新建用户wangwu,真名王五` | 成功提取并执行 | ✅ |

### 2.2 学习到的规则详情

**USER_CREATE 意图规则 (4条)**:

| 参数名 | 规则类型 | 提取关键词 | 命中次数 | 来源 |
|-------|---------|-----------|---------|------|
| username | KEYWORD_AFTER | 用户名 | 9 | LLM_LEARNED |
| realName | KEYWORD_AFTER | 姓名 | 9 | LLM_LEARNED |
| username | KEYWORD_AFTER | 新建用户 | 1 | USER_CONFIRMED |
| realName | KEYWORD_AFTER | 真名 | 1 | USER_CONFIRMED |

### 2.3 规则学习执行流程验证

```
首次调用 (无规则):
  用户输入 "创建新用户,用户名zhangsan,姓名张三"
    ↓
  LLM Tool Calling 提取参数
    ↓
  学习规则: KEYWORD_AFTER("用户名"), KEYWORD_AFTER("姓名")
    ↓
  执行操作

二次调用 (有规则):
  用户输入 "创建新用户,用户名lisi,姓名李四"
    ↓
  规则匹配: "用户名" 后提取 "lisi"
    ↓
  规则匹配: "姓名" 后提取 "李四"
    ↓
  hitCount: 8 → 9
    ↓
  直接执行 (不调用 LLM)
```

---

## 三、规则管理 API 测试

### 3.1 API 端点测试结果

| 端点 | 方法 | 功能 | 状态 |
|-----|------|------|------|
| `/ai-intents/params/rules/{intentCode}` | GET | 查询规则 | ✅ |
| `/ai-intents/params/confirm` | POST | 参数确认并学习 | ✅ |
| `/ai-intents/params/rules/{ruleId}` | DELETE | 删除规则 | ✅ |
| `/ai-intents/params/rules/cleanup` | POST | 清理低效规则 | ✅ |

### 3.2 参数确认 API 测试

**请求**:
```json
{
  "intentCode": "USER_CREATE",
  "userInput": "新建用户lisi,真名李四,设置为管理员",
  "confirmedParams": {"username": "lisi", "realName": "李四", "role": "factory_admin"},
  "executeAfterConfirm": false
}
```

**响应**: `参数已确认，规则已学习`

**验证**: 规则数量从 2 增加到 4

---

## 四、错误处理测试

| 测试场景 | 用户输入 | 预期行为 | 实际行为 | 状态 |
|---------|---------|---------|---------|------|
| 缺少必需参数 | "帮我创建一个用户" | 提示缺少参数 | "缺少必需参数: username, role" | ✅ |
| 查询不存在数据 | "查询批次XXXX-NOT-EXIST" | 返回空结果 | SUCCESS (空结果) | ✅ |
| 模糊查询 | "查看库存" | 返回库存报表 | REPORT_INVENTORY | ✅ |

---

## 五、已知问题与优化建议

### 5.1 操作类意图识别问题

部分操作类输入被误识别为查询类意图：

| 问题输入 | 误识别为 | 应识别为 |
|---------|---------|---------|
| 入库一批带鱼 | MATERIAL_BATCH_QUERY | MATERIAL_BATCH_CREATE |
| 发货给客户xxx | MATERIAL_BATCH_QUERY | SHIPMENT_CREATE |

**建议**:
1. 增加操作类意图的学习表达
2. 在意图配置中添加更多操作动词触发词

### 5.2 多轮对话上下文

- 追问 "第一批的具体信息呢" 未能正确利用上下文
- 建议: 完善 ConversationMemoryService 的上下文传递

---

## 六、参数提取规则学习功能验证总结

### 核心功能验证清单

- [x] ParameterExtractionRule 实体类创建成功
- [x] ParameterExtractionRuleRepository 数据访问正常
- [x] ParameterExtractionLearningService 服务功能正常
- [x] IntentExecutorServiceImpl 集成规则提取
- [x] AIIntentConfigController 新增 4 个 API
- [x] 数据库迁移脚本执行成功
- [x] 首次调用 LLM 提取 + 自动学习规则
- [x] 二次调用使用学习规则 (不调用 LLM)
- [x] hitCount 正确递增
- [x] 用户确认 API 正常工作
- [x] 规则清理 API 正常工作

### 学习效果验证

```
测试前: LLM 参数提取调用次数 = N
测试后: 对于已学习规则的输入，LLM 调用次数 = 0

服务端日志确认:
"使用学习规则提取参数: [username, realName] (无需调用 LLM)"
```

---

## 七、结论

**参数提取规则学习功能已完整实现并通过验证**。

主要成果：
1. ✅ 实现了类似 LearnedExpression 的参数提取规则学习机制
2. ✅ 支持 KEYWORD_AFTER、KEYWORD_IS、REGEX 等规则类型
3. ✅ 规则学习后，相似输入不再调用 LLM
4. ✅ API 端点完整，支持规则查询/确认/删除/清理

待优化：
1. ⚠️ 操作类意图识别准确率需提升
2. ⚠️ 多轮对话上下文传递需完善

---

*测试报告生成时间: 2026-01-17 18:50*
*测试执行者: AI Assistant*
