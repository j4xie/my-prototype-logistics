# AI配额规则配置 - 快速上手指南

## 快速开始

### 1. 启动应用（自动执行数据库迁移）

```bash
cd /Users/jietaoxie/my-prototype-logistics/backend-java
mvn spring-boot:run
```

Flyway将自动执行 `V2025_12_31_1__ai_quota_configs.sql` 创建表和插入默认数据。

---

### 2. 验证默认配置

```bash
# 查看默认配置
curl -X GET "http://139.196.165.140:10010/api/mobile/F001/ai-quota-configs" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "factoryConfigs": [
      {
        "questionType": "historical",
        "quotaCost": 3,
        "weeklyLimit": 150
      },
      {
        "questionType": "comparison",
        "quotaCost": 2,
        "weeklyLimit": 150
      }
    ],
    "globalConfigs": [
      {
        "questionType": "historical",
        "quotaCost": 5
      },
      {
        "questionType": "comparison",
        "quotaCost": 3
      },
      {
        "questionType": "time_range",
        "quotaCost": 2
      },
      {
        "questionType": "followup",
        "quotaCost": 1
      },
      {
        "questionType": "default",
        "quotaCost": 1
      }
    ]
  }
}
```

---

### 3. 常用操作

#### 为工厂创建自定义配额规则

```bash
curl -X POST "http://139.196.165.140:10010/api/mobile/F002/ai-quota-configs" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionType": "historical",
    "quotaCost": 4,
    "weeklyLimit": 120,
    "description": "F002工厂自定义配额",
    "enabled": true,
    "priority": 100
  }'
```

#### 更新配额规则

```bash
curl -X PUT "http://139.196.165.140:10010/api/mobile/F001/ai-quota-configs/{configId}" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quotaCost": 2,
    "description": "调整历史分析配额为2次"
  }'
```

#### 删除工厂配额规则（恢复使用全局配置）

```bash
curl -X DELETE "http://139.196.165.140:10010/api/mobile/F001/ai-quota-configs/{configId}" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 配额消耗规则

### 问题类型与配额消耗

| 问题类型 | 全局默认 | F001工厂配置 | 说明 |
|----------|----------|--------------|------|
| `historical` | 5次 | 3次 | 历史数据综合分析 |
| `comparison` | 3次 | 2次 | 批次对比分析 |
| `time_range` | 2次 | - | 时间范围成本分析 |
| `followup` | 1次 | - | Follow-up追问 |
| `default` | 1次 | - | 简单查询 |

### 配置优先级

1. **工厂级别配置** > **全局配置** > **默认值1**
2. 同优先级按 `priority` 字段降序排序
3. F001工厂的历史分析只消耗3次配额（覆盖了全局5次）

---

## 使用场景

### 场景1: 提升某工厂的配额限制

**需求**: F002工厂业务量大，需要将每周配额从100次提升到200次

**操作**:
```sql
INSERT INTO ai_quota_configs (id, factory_id, question_type, quota_cost, weekly_limit, description)
SELECT UUID(), 'F002', question_type, quota_cost, 200, CONCAT('F002工厂 - ', description)
FROM ai_quota_configs
WHERE factory_id = '*' AND enabled = TRUE;
```

或者通过API批量创建。

---

### 场景2: 降低某类分析的配额消耗

**需求**: 时间范围分析消耗太高，从2次降低到1次

**操作**:
```sql
UPDATE ai_quota_configs
SET quota_cost = 1
WHERE question_type = 'time_range' AND factory_id = '*';
```

或者通过API更新。

---

### 场景3: 临时禁用某种分析类型

**需求**: 暂时禁用批次对比分析

**操作**:
```sql
UPDATE ai_quota_configs
SET enabled = FALSE
WHERE question_type = 'comparison';
```

或者通过API更新 `enabled` 字段。

---

## 监控与日志

### 查看配额消耗日志

```bash
# 查看AI服务日志
tail -f /www/wwwroot/cretas/logs/cretas-backend.log | grep "配额消耗"
```

**示例日志输出**:
```
2025-12-31 01:45:23 INFO  AIEnterpriseService - 配额消耗: factoryId=F001, questionType=historical, quotaCost=3
2025-12-31 01:50:15 INFO  AIEnterpriseService - 配额消耗: factoryId=F002, questionType=comparison, quotaCost=3
```

### 查看配额使用情况

```sql
-- 查看本周配额使用情况
SELECT factory_id, used_count, quota_limit,
       (quota_limit - used_count) AS remaining
FROM ai_quota_usage
WHERE week_start = CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY;
```

---

## 故障排查

### 问题1: 配额消耗不正确

**症状**: 历史分析应该消耗3次，实际消耗5次

**排查步骤**:
1. 检查配置是否存在且启用
```sql
SELECT * FROM ai_quota_configs
WHERE factory_id IN ('F001', '*')
  AND question_type = 'historical'
  AND enabled = TRUE
ORDER BY priority DESC;
```

2. 检查应用日志
```bash
grep "未找到配额配置" /www/wwwroot/cretas/logs/cretas-backend.log
```

3. 确认配置优先级
   - 工厂配置优先级 > 全局配置
   - 同级按 `priority` 降序

---

### 问题2: 配额配置不生效

**症状**: 更新配置后仍使用旧配额规则

**解决方案**:
- 当前实现无缓存，每次实时查询数据库
- 检查数据库连接和事务提交
- 重启应用（如果有缓存）

---

### 问题3: 无法删除配置

**症状**: 删除请求返回失败

**可能原因**:
1. 尝试删除全局配置 (factory_id = '*') - **禁止操作**
2. 权限验证失败 - 检查 `factoryId` 是否匹配
3. 配置不存在 - 检查 `configId` 是否正确

---

## 数据库直接操作

### 查询所有配额配置

```sql
SELECT
    factory_id,
    question_type,
    quota_cost,
    weekly_limit,
    enabled,
    priority,
    description
FROM ai_quota_configs
WHERE enabled = TRUE
ORDER BY factory_id, priority DESC;
```

### 重置为默认配置

```sql
-- 删除所有工厂级别配置
DELETE FROM ai_quota_configs WHERE factory_id != '*';

-- 重置全局配置
UPDATE ai_quota_configs SET quota_cost = 5 WHERE question_type = 'historical' AND factory_id = '*';
UPDATE ai_quota_configs SET quota_cost = 3 WHERE question_type = 'comparison' AND factory_id = '*';
UPDATE ai_quota_configs SET quota_cost = 2 WHERE question_type = 'time_range' AND factory_id = '*';
UPDATE ai_quota_configs SET quota_cost = 1 WHERE question_type = 'followup' AND factory_id = '*';
UPDATE ai_quota_configs SET quota_cost = 1 WHERE question_type = 'default' AND factory_id = '*';
```

---

## API参考

### 请求示例

```javascript
// 创建配置
const response = await fetch('http://139.196.165.140:10010/api/mobile/F001/ai-quota-configs', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    questionType: 'historical',
    quotaCost: 4,
    weeklyLimit: 150,
    description: '自定义配额规则',
    enabled: true,
    priority: 100
  })
});

const result = await response.json();
console.log(result);
```

### 响应格式

**成功**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "factoryId": "F001",
    "questionType": "historical",
    "quotaCost": 4,
    "weeklyLimit": 150,
    "enabled": true,
    "priority": 100
  },
  "message": "配置创建成功"
}
```

**失败**:
```json
{
  "success": false,
  "message": "该问题类型的配置已存在"
}
```

---

## 最佳实践

1. **优先使用工厂级别配置**: 针对不同工厂的业务特点调整配额规则
2. **保留全局配置**: 作为默认兜底，确保新工厂可用
3. **谨慎修改全局配置**: 影响所有未配置的工厂
4. **定期审查配额使用**: 根据实际使用情况调整规则
5. **使用描述字段**: 记录配置修改原因和时间

---

## 相关文档

- [完整实现文档](./AI_QUOTA_CONFIG_IMPLEMENTATION.md)
- [API文档](http://139.196.165.140:10010/swagger-ui.html)
- [数据库Schema](../src/main/resources/db/migration/V2025_12_31_1__ai_quota_configs.sql)
