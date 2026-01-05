# AI 意图工厂隔离使用指南

## 概述

本文档描述 AI 意图执行的工厂级数据隔离机制，确保多工厂环境下的数据安全。

---

## 1. 核心概念

### 1.1 隔离级别

| 级别 | factoryId | 可见范围 | 创建者 |
|------|-----------|----------|--------|
| 平台级 | `null` | 所有工厂 | 平台管理员 |
| 工厂级 | `"F001"` | 仅该工厂 | 工厂管理员 |

### 1.2 角色权限

| 角色 | 可见意图 | 可创建意图 | 可修改意图 |
|------|----------|------------|------------|
| `super_admin` | 全部 | 平台级 + 工厂级 | 全部 |
| `platform_admin` | 全部 | 平台级 + 工厂级 | 全部 |
| `factory_super_admin` | 本工厂 + 平台级 | 仅工厂级 | 仅本工厂 |
| 其他工厂角色 | 本工厂 + 平台级 | ❌ | ❌ |

---

## 2. API 使用

### 2.1 获取意图列表

```bash
GET /api/mobile/{factoryId}/ai-intents
Authorization: Bearer {token}
```

**返回**: 工厂级意图 + 平台级意图（已去重）

### 2.2 执行意图

```bash
POST /api/mobile/{factoryId}/ai-intents/execute
Authorization: Bearer {token}
Content-Type: application/json

{
  "userInput": "查询原料库存",
  "context": {}
}
```

**行为**: 自动注入 `factoryId` 到所有数据查询

### 2.3 创建意图

#### 工厂管理员创建工厂级意图

```bash
POST /api/mobile/F001/ai-intents/execute
Authorization: Bearer {factory_admin_token}
Content-Type: application/json

{
  "userInput": "创建意图",
  "forceExecute": true,
  "context": {
    "intentCode": "INTENT_CREATE",
    "params": {
      "intentCode": "MY_FACTORY_INTENT",
      "intentName": "我的工厂意图",
      "intentCategory": "QUERY",
      "keywords": ["自定义", "查询"],
      "description": "工厂自定义意图"
    }
  }
}
```

**结果**: 创建 `factoryId = "F001"` 的工厂级意图

#### 平台管理员创建平台级意图

```bash
POST /api/mobile/F001/ai-intents/execute
Authorization: Bearer {platform_admin_token}
Content-Type: application/json

{
  "userInput": "创建意图",
  "forceExecute": true,
  "context": {
    "intentCode": "INTENT_CREATE",
    "scope": "PLATFORM",
    "params": {
      "intentCode": "GLOBAL_INTENT",
      "intentName": "全局通用意图",
      "intentCategory": "QUERY",
      "keywords": ["通用", "全局"],
      "description": "所有工厂可用的意图"
    }
  }
}
```

**结果**: 创建 `factoryId = null` 的平台级意图

#### 平台管理员创建指定工厂的意图

```bash
POST /api/mobile/F001/ai-intents/execute
Authorization: Bearer {platform_admin_token}
Content-Type: application/json

{
  "userInput": "创建意图",
  "forceExecute": true,
  "context": {
    "intentCode": "INTENT_CREATE",
    "scope": "FACTORY",
    "targetFactoryId": "F002",
    "params": {
      "intentCode": "F002_SPECIAL_INTENT",
      "intentName": "F002专属意图",
      "intentCategory": "QUERY",
      "keywords": ["F002", "专属"],
      "description": "仅F002工厂可见的意图"
    }
  }
}
```

**结果**: 创建 `factoryId = "F002"` 的工厂级意图

### 2.4 更新意图

```bash
POST /api/mobile/F001/ai-intents/execute
Authorization: Bearer {token}
Content-Type: application/json

{
  "userInput": "更新意图",
  "forceExecute": true,
  "context": {
    "intentCode": "INTENT_UPDATE",
    "params": {
      "intentCode": "MY_FACTORY_INTENT",
      "intentName": "更新后的名称",
      "keywords": ["更新", "关键词"]
    }
  }
}
```

**权限规则**:
- 工厂管理员：只能更新本工厂的意图
- 平台管理员：可更新任意意图

---

## 3. 数据隔离机制

### 3.1 Handler 隔离实现

所有 IntentHandler 实现类均接收 `factoryId` 参数：

```java
public interface IntentHandler {
    IntentExecuteResponse execute(
        String intentCode,
        String userInput,
        Map<String, Object> context,
        String factoryId,    // 当前工厂ID
        String userRole      // 当前用户角色
    );
}
```

### 3.2 已修复的 Handler

| Handler | 隔离方式 | 说明 |
|---------|----------|------|
| `DataOperationIntentHandler` | Repository 方法 | `findByIdAndFactoryId()` |
| `QualityIntentHandler` | Repository 方法 | 按工厂过滤质检记录 |
| `ShipmentIntentHandler` | 查询后校验 | 校验 `record.getFactoryId()` |
| `MetaIntentHandler` | Repository 方法 | 工厂级 + 平台级查询 |
| `MaterialIntentHandler` | 自带隔离 | 原有实现已支持 |
| `AlertIntentHandler` | 自带隔离 | 原有实现已支持 |
| `ReportIntentHandler` | 自带隔离 | 原有实现已支持 |

### 3.3 无需隔离的 Handler

| Handler | 原因 |
|---------|------|
| `ScaleIntentHandler` | 秤品牌型号为共享配置 |
| `ConfigIntentHandler` | 配置项为共享配置 |
| `SystemIntentHandler` | 系统信息为公共数据 |

---

## 4. Repository 方法

### 4.1 AIIntentConfigRepository

```java
// 查询工厂可见的意图（工厂级 + 平台级）
List<AIIntentConfig> findByFactoryIdOrPlatformLevel(String factoryId);

// 按意图代码查询（优先工厂级）
List<AIIntentConfig> findByIntentCodeAndFactoryIdOrPlatform(String intentCode, String factoryId);

// 检查意图代码在工厂范围内是否存在
boolean existsByIntentCodeInFactoryScope(String intentCode, String factoryId);

// 按ID和工厂查询
Optional<AIIntentConfig> findByIdAndFactoryIdOrPlatform(String id, String factoryId);
```

### 4.2 ProductTypeRepository

```java
// 按ID和工厂查询
Optional<ProductType> findByIdAndFactoryId(UUID id, String factoryId);
```

### 4.3 QualityInspectionRepository

```java
// 按工厂和批次查询最新质检
Optional<QualityInspection> findFirstByFactoryIdAndProductionBatchIdOrderByInspectionDateDesc(
    String factoryId, Long batchId);
```

---

## 5. 数据库设计

### 5.1 ai_intent_configs 表

```sql
ALTER TABLE ai_intent_configs
ADD COLUMN factory_id VARCHAR(50) NULL
COMMENT '工厂ID，NULL表示平台级意图';

CREATE INDEX idx_ai_intent_factory ON ai_intent_configs(factory_id);
```

### 5.2 查询逻辑

```sql
-- 工厂用户查询意图
SELECT * FROM ai_intent_configs
WHERE (factory_id = 'F001' OR factory_id IS NULL)
  AND is_active = true
  AND deleted_at IS NULL
ORDER BY priority DESC;

-- 优先返回工厂级配置
ORDER BY CASE WHEN factory_id = 'F001' THEN 0 ELSE 1 END;
```

---

## 6. 错误处理

### 6.1 常见错误

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `无权访问其他工厂的数据` | 跨工厂访问 | 使用正确的 factoryId |
| `无权修改平台级意图` | 工厂用户修改平台意图 | 联系平台管理员 |
| `意图代码已存在` | 重复的意图代码 | 使用唯一的意图代码 |
| `权限不足` | 角色无创建权限 | 检查 requiredRoles 配置 |

### 6.2 调试方法

```bash
# 1. 检查用户 Token 中的角色和工厂
echo {token} | cut -d. -f2 | base64 -d | jq .

# 2. 检查意图配置的 factoryId
curl -s "/api/mobile/F001/ai-intents" -H "Authorization: Bearer {token}" | jq '.data[] | {intentCode, factoryId}'

# 3. 检查权限配置
curl -s "/api/mobile/F001/ai-intents" -H "Authorization: Bearer {token}" | jq '.data[] | select(.intentCode=="INTENT_CREATE") | .requiredRoles'
```

---

## 7. 测试验证

### 7.1 验证脚本

```bash
#!/bin/bash
BASE_URL="http://139.196.165.140:10010/api/mobile"

# 1. 工厂管理员登录
F001_TOKEN=$(curl -s -X POST "$BASE_URL/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}' | jq -r '.data.token')

# 2. 查询意图列表（应只看到工厂级+平台级）
curl -s "$BASE_URL/F001/ai-intents" \
  -H "Authorization: Bearer $F001_TOKEN" | jq '.data | length'

# 3. 创建工厂级意图
curl -s -X POST "$BASE_URL/F001/ai-intents/execute" \
  -H "Authorization: Bearer $F001_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "创建意图",
    "forceExecute": true,
    "context": {
      "intentCode": "INTENT_CREATE",
      "params": {
        "intentCode": "TEST_ISOLATION_'$(date +%s)'",
        "intentName": "隔离测试意图",
        "intentCategory": "QUERY",
        "keywords": ["测试"],
        "description": "测试工厂隔离"
      }
    }
  }' | jq '.data.factoryId'
# 期望输出: "F001"
```

### 7.2 验证结果

| 测试场景 | 预期结果 | 实际结果 |
|----------|----------|----------|
| 平台管理员创建平台级意图 | factoryId=null | ✅ PASS |
| 工厂用户修改平台级意图 | 403 无权修改 | ✅ PASS |
| 平台管理员修改平台级意图 | 成功 | ✅ PASS |
| 工厂用户查询意图 | 仅本工厂+平台级 | ✅ PASS |

---

## 8. 迁移指南

### 8.1 从无隔离迁移

1. 执行迁移脚本添加 `factory_id` 列
2. 现有意图默认为平台级（factoryId=null）
3. 按需将特定意图分配到工厂

### 8.2 迁移脚本

```sql
-- V2026_01_04_40__ai_intent_config_factory_id.sql
ALTER TABLE ai_intent_configs
ADD COLUMN factory_id VARCHAR(50) NULL;

CREATE INDEX idx_ai_intent_factory ON ai_intent_configs(factory_id);

-- 将特定意图分配到工厂（示例）
UPDATE ai_intent_configs
SET factory_id = 'F001'
WHERE intent_code LIKE 'F001_%';
```

---

## 9. 最佳实践

### 9.1 意图命名规范

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| 平台级 | `{CATEGORY}_{ACTION}` | `MATERIAL_QUERY` |
| 工厂级 | `{FACTORY}_{CATEGORY}_{ACTION}` | `F001_CUSTOM_REPORT` |

### 9.2 关键词设计

- 平台级意图使用通用关键词
- 工厂级意图可使用行业/产品特定关键词
- 避免工厂级意图关键词与平台级冲突

### 9.3 权限最小化

- 默认使用工厂级意图
- 仅在确实需要跨工厂共享时创建平台级
- 定期审计平台级意图使用情况

---

## 10. 相关文件

| 文件 | 说明 |
|------|------|
| `MetaIntentHandler.java` | 意图元操作处理 |
| `DataOperationIntentHandler.java` | 数据操作处理 |
| `QualityIntentHandler.java` | 质检操作处理 |
| `ShipmentIntentHandler.java` | 出货操作处理 |
| `AIIntentConfigRepository.java` | 意图配置仓库 |
| `V2026_01_04_40__*.sql` | 数据库迁移脚本 |

---

## 更新记录

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-01-04 | 1.0.0 | 初始版本，完成工厂隔离实现 |
