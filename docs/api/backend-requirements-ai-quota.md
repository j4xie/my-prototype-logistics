# AI配额管理后端API需求文档

**需求来源**: React Native前端 - AI配额管理页面
**优先级**: P2 (辅助功能)
**状态**: 待实现 ❌
**前端实现**: ✅ 已完成（使用Mock数据）
**创建时间**: 2025-11-02

---

## 概述

平台管理员需要管理各工厂的DeepSeek AI分析配额，包括：
- 查看所有工厂的AI配额设置
- 修改工厂的每周AI调用配额
- 查看平台级别的AI使用统计
- 监控各工厂的配额使用情况

---

## API端点需求

### 1. 获取所有工厂AI配额

**端点**: `GET /api/platform/ai-quota`
**权限**: 仅平台管理员 (`super_admin`, `platform_admin`)
**描述**: 获取所有工厂的AI配额设置和历史调用统计

#### 请求
```http
GET /api/platform/ai-quota HTTP/1.1
Authorization: Bearer {token}
```

#### 响应
```json
{
  "code": 200,
  "success": true,
  "message": "获取成功",
  "data": [
    {
      "id": "FISH_2025_001",
      "name": "白垩纪鱼肉加工厂",
      "aiWeeklyQuota": 100,
      "_count": {
        "aiUsageLogs": 245
      }
    },
    {
      "id": "MEAT_2025_001",
      "name": "白垩纪肉类加工厂",
      "aiWeeklyQuota": 80,
      "_count": {
        "aiUsageLogs": 156
      }
    }
  ],
  "timestamp": "2025-11-02T12:00:00Z"
}
```

#### 字段说明
- `id`: 工厂ID
- `name`: 工厂名称
- `aiWeeklyQuota`: 每周AI调用配额（次数）
- `_count.aiUsageLogs`: 历史总调用次数

---

### 2. 更新工厂AI配额

**端点**: `PUT /api/platform/ai-quota/:factoryId`
**权限**: 仅平台管理员
**描述**: 更新指定工厂的AI配额设置

#### 请求
```http
PUT /api/platform/ai-quota/FISH_2025_001 HTTP/1.1
Authorization: Bearer {token}
Content-Type: application/json

{
  "weeklyQuota": 120
}
```

#### 请求参数
- `factoryId` (路径参数): 工厂ID
- `weeklyQuota` (body): 新的每周配额（0-1000）

#### 响应
```json
{
  "code": 200,
  "success": true,
  "message": "配额已更新",
  "data": {
    "factoryId": "FISH_2025_001",
    "weeklyQuota": 120
  },
  "timestamp": "2025-11-02T12:00:00Z"
}
```

#### 验证规则
- `weeklyQuota`: 必填，整数，范围 0-1000
- 只有平台管理员可以修改
- 记录配额变更历史（可选）

---

### 3. 获取平台AI使用统计

**端点**: `GET /api/platform/ai-usage-stats`
**权限**: 仅平台管理员
**描述**: 获取平台级别的AI使用统计数据

#### 请求
```http
GET /api/platform/ai-usage-stats HTTP/1.1
Authorization: Bearer {token}
```

#### 响应
```json
{
  "code": 200,
  "success": true,
  "message": "获取成功",
  "data": {
    "currentWeek": "2025-W44",
    "totalUsed": 187,
    "factories": [
      {
        "factoryId": "FISH_2025_001",
        "factoryName": "白垩纪鱼肉加工厂",
        "weeklyQuota": 100,
        "used": 78,
        "remaining": 22,
        "utilization": "78.00"
      },
      {
        "factoryId": "MEAT_2025_001",
        "factoryName": "白垩纪肉类加工厂",
        "weeklyQuota": 80,
        "used": 65,
        "remaining": 15,
        "utilization": "81.25"
      }
    ]
  },
  "timestamp": "2025-11-02T12:00:00Z"
}
```

#### 字段说明
- `currentWeek`: 当前周次（ISO 8601格式：YYYY-Www）
- `totalUsed`: 本周平台总使用量
- `factories`: 各工厂使用情况
  - `factoryId`: 工厂ID
  - `factoryName`: 工厂名称
  - `weeklyQuota`: 配额
  - `used`: 本周已使用次数
  - `remaining`: 剩余次数
  - `utilization`: 使用率（百分比字符串，保留2位小数）

---

## 数据库需求

### Factory表扩展
需要在Factory表中添加AI配额字段（如果不存在）：

```sql
ALTER TABLE Factory ADD COLUMN IF NOT EXISTS aiWeeklyQuota INT DEFAULT 50;
```

### AIUsageLog表（如果不存在则创建）
用于记录AI调用历史：

```sql
CREATE TABLE IF NOT EXISTS AIUsageLog (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  factoryId VARCHAR(50) NOT NULL,
  userId BIGINT,
  requestType VARCHAR(50),  -- 'analysis', 'suggestion', etc.
  tokensUsed INT,
  cost DECIMAL(10,4),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  weekNumber VARCHAR(10),  -- 例如: '2025-W44'

  INDEX idx_factory_week (factoryId, weekNumber),
  INDEX idx_created_at (createdAt),
  FOREIGN KEY (factoryId) REFERENCES Factory(factoryId)
);
```

---

## 业务逻辑需求

### 配额检查逻辑
1. **调用前检查**: 在DeepSeek API调用前，检查工厂本周配额
2. **配额不足处理**: 如果配额不足，返回错误提示
3. **配额计数**: 每次成功调用后，增加使用计数
4. **周期重置**: 每周一自动重置所有工厂的使用计数

### 统计计算逻辑
1. **本周使用量**: 统计当前周（周一到周日）的调用次数
2. **使用率**: `(本周已用 / 配额) * 100`，保留2位小数
3. **剩余次数**: `配额 - 本周已用`

### 权限验证
- 所有3个API端点都需要验证用户是平台管理员
- 使用JWT token验证身份
- 检查用户角色是否为 `super_admin` 或 `platform_admin`

---

## 错误处理

### 常见错误码
- `401`: 未授权（未登录或token无效）
- `403`: 权限不足（非平台管理员）
- `404`: 工厂不存在
- `400`: 请求参数错误（配额超出范围等）
- `500`: 服务器内部错误

### 错误响应示例
```json
{
  "code": 403,
  "success": false,
  "message": "权限不足：此功能仅限平台管理员访问",
  "timestamp": "2025-11-02T12:00:00Z"
}
```

---

## 性能要求

- 响应时间: < 500ms
- 并发支持: 支持10个管理员同时访问
- 缓存策略: 统计数据可缓存5分钟

---

## 安全要求

1. **权限隔离**: 严格限制平台管理员访问
2. **输入验证**: 验证所有输入参数（配额范围、工厂ID格式等）
3. **日志记录**: 记录所有配额修改操作（谁、何时、修改了什么）
4. **SQL注入防护**: 使用参数化查询

---

## 测试用例

### 测试账号
- 用户名: `platform_admin`
- 密码: `123456`
- 角色: `super_admin`

### 测试数据
- 测试工厂: `FISH_2025_001` (白垩纪鱼肉加工厂)
- 初始配额: 100次/周
- 本周已用: 78次

### 测试步骤
1. 使用`platform_admin`登录获取token
2. 调用 `GET /api/platform/ai-quota` 查看所有工厂配额
3. 调用 `PUT /api/platform/ai-quota/FISH_2025_001` 修改配额为120
4. 调用 `GET /api/platform/ai-usage-stats` 查看使用统计
5. 使用普通工厂用户尝试访问（应返回403）

---

## 前端已实现功能

✅ **UI界面**: 完整的AI配额管理页面
✅ **API客户端**: platformApiClient.ts（带Mock数据fallback）
✅ **页面功能**:
- 显示所有工厂配额列表
- 编辑配额功能
- 使用率可视化（进度条）
- 配额建议提示
- 下拉刷新

**Mock数据文件**:
`frontend/CretasFoodTrace/src/services/api/platformApiClient.ts`

---

## 实现优先级

**建议优先级**: P2（辅助功能）

**原因**:
- 非核心业务流程
- 仅平台管理员使用
- 前端已有Mock数据支持，不阻塞开发

**实现顺序**:
1. 先实现核心生产管理API
2. 再实现AI配额管理API

---

## 相关文档

- 前端实现: `frontend/CretasFoodTrace/src/screens/platform/AIQuotaManagementScreen.tsx`
- API客户端: `frontend/CretasFoodTrace/src/services/api/platformApiClient.ts`
- 类型定义: `frontend/CretasFoodTrace/src/types/processing.ts`
- 导航配置: `frontend/CretasFoodTrace/src/navigation/PlatformStackNavigator.tsx`

---

**最后更新**: 2025-11-02
**文档版本**: v1.0
**维护者**: Frontend Development Team
