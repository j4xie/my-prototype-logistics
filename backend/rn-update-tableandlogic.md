# React Native 后端需求文档

本文档记录React Native应用开发过程中需要的后端API、数据库变更和业务逻辑需求。

---

## 原材料规格动态配置功能

**需求日期**: 2025-11-04
**优先级**: P1 - 核心功能
**开发阶段**: Phase 1-3（前端优先） → Phase 4（后端实现）

### 功能概述

实现基于类别的原材料规格自动筛选，支持每个工厂自定义规格配置，管理员可动态管理，用户可下拉选择或手动输入。

### 数据库变更

#### 新增表: material_spec_config

```sql
CREATE TABLE material_spec_config (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
  category VARCHAR(50) NOT NULL COMMENT '原材料类别（海鲜、肉类等）',
  specifications JSON NOT NULL COMMENT '规格选项列表 ["切片", "整条", "去骨"]',
  is_system_default BOOLEAN DEFAULT FALSE COMMENT '是否系统默认配置',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_factory_category (factory_id, category) COMMENT '工厂+类别唯一索引',
  INDEX idx_factory (factory_id) COMMENT '工厂ID索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='原材料规格配置表';
```

#### 默认数据（工厂创建时自动插入）

每个新工厂创建时，自动插入以下默认规格配置：

```sql
-- 假设 FACTORY_ID 为新创建的工厂ID
INSERT INTO material_spec_config (factory_id, category, specifications, is_system_default) VALUES
('FACTORY_ID', '海鲜', '["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"]', TRUE),
('FACTORY_ID', '肉类', '["整块", "切片", "切丁", "绞肉", "排骨", "带骨", "去骨"]', TRUE),
('FACTORY_ID', '蔬菜', '["整颗", "切段", "切丝", "切块", "切片"]', TRUE),
('FACTORY_ID', '水果', '["整个", "切片", "切块", "去皮", "带皮"]', TRUE),
('FACTORY_ID', '粉类', '["袋装", "散装", "桶装"]', TRUE),
('FACTORY_ID', '米面', '["袋装", "散装", "包装"]', TRUE),
('FACTORY_ID', '油类', '["瓶装", "桶装", "散装", "大桶", "小瓶"]', TRUE),
('FACTORY_ID', '调料', '["瓶装", "袋装", "罐装", "散装", "盒装"]', TRUE),
('FACTORY_ID', '其他', '["原装", "分装", "定制"]', TRUE);
```

### API接口设计

#### 1. GET /api/mobile/{factoryId}/material-spec-config

**功能**: 获取工厂的所有规格配置
**权限**: 所有登录用户
**请求参数**: 无

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "海鲜": ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"],
    "肉类": ["整块", "切片", "切丁", "绞肉", "排骨", "带骨", "去骨"],
    "蔬菜": ["整颗", "切段", "切丝", "切块", "切片"],
    "水果": ["整个", "切片", "切块", "去皮", "带皮"],
    "粉类": ["袋装", "散装", "桶装"],
    "米面": ["袋装", "散装", "包装"],
    "油类": ["瓶装", "桶装", "散装", "大桶", "小瓶"],
    "调料": ["瓶装", "袋装", "罐装", "散装", "盒装"],
    "其他": ["原装", "分装", "定制"]
  }
}
```

**业务逻辑**:
1. 查询 `material_spec_config` 表，获取该工厂的所有规格配置
2. 将结果转换为 `{ category: specifications[] }` 格式
3. 如果某个类别不存在配置，使用系统默认值

**性能要求**:
- 响应时间 < 100ms
- 支持缓存（建议24小时过期）

---

#### 2. PUT /api/mobile/{factoryId}/material-spec-config/{category}

**功能**: 更新单个类别的规格配置
**权限**: `factory_super_admin`, `platform_admin`

**请求路径参数**:
- `factoryId`: 工厂ID
- `category`: 类别名称（如"海鲜"）

**请求体**:
```json
{
  "specifications": ["整条", "切片", "去骨切片（新增）"]
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "规格配置更新成功",
  "data": {
    "category": "海鲜",
    "specifications": ["整条", "切片", "去骨切片（新增）"]
  }
}
```

**业务逻辑**:
1. 验证用户权限（factory_super_admin或platform_admin）
2. 验证specifications数组不为空，每项长度不超过50字符
3. 使用 `UPSERT` 逻辑：
   - 如果该工厂+类别记录存在，更新specifications字段，设置 `is_system_default=FALSE`
   - 如果不存在，插入新记录，设置 `is_system_default=FALSE`
4. 更新成功后清除相关缓存

**错误处理**:
- 400: 请求参数格式错误
- 403: 权限不足
- 500: 数据库更新失败

---

#### 3. DELETE /api/mobile/{factoryId}/material-spec-config/{category}

**功能**: 重置为系统默认配置
**权限**: `factory_super_admin`, `platform_admin`

**请求路径参数**:
- `factoryId`: 工厂ID
- `category`: 类别名称（如"海鲜"）

**响应示例**:
```json
{
  "code": 200,
  "message": "已重置为默认配置",
  "data": {
    "category": "海鲜",
    "specifications": ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"]
  }
}
```

**业务逻辑**:
1. 验证用户权限（factory_super_admin或platform_admin）
2. 删除该工厂+类别的自定义配置记录（如果存在）
3. 重新插入系统默认配置（`is_system_default=TRUE`）
4. 返回默认配置内容
5. 清除相关缓存

**错误处理**:
- 403: 权限不足
- 404: 类别不存在
- 500: 数据库操作失败

---

### 业务流程

#### 用户添加原材料流程

```
1. 用户打开"添加原材料类型"表单
   ↓
2. 前端调用 GET /material-spec-config（仅1次，缓存结果）
   ↓
3. 用户选择类别"海鲜"
   ↓
4. 前端从缓存中提取"海鲜"对应的规格列表
   ↓
5. 显示下拉菜单：["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳", "➕ 自定义输入"]
   ↓
6. 用户选择"切片" 或 点击"自定义"手动输入"去骨去头切片"
   ↓
7. 提交表单（specification字段为用户选择或输入的值）
```

#### 管理员配置规格流程（Phase 4）

```
1. 管理员进入"规格配置管理"页面
   ↓
2. 前端调用 GET /material-spec-config 获取当前配置
   ↓
3. 显示所有类别和对应规格列表（可编辑）
   ↓
4. 管理员修改"海鲜"类别，添加"鱼柳"选项
   ↓
5. 点击保存，前端调用 PUT /material-spec-config/海鲜
   ↓
6. 后端更新数据库，清除缓存
   ↓
7. 其他用户下次添加原材料时，会看到更新后的规格选项
```

---

### 数据一致性保证

1. **唯一性约束**: `uk_factory_category` 保证每个工厂的每个类别只有一条配置
2. **默认值处理**: 如果某类别无自定义配置，使用系统默认值
3. **缓存同步**: 更新/删除配置后，立即清除缓存
4. **JSON验证**: 后端验证specifications字段为有效JSON数组

---

### 性能优化建议

1. **缓存策略**:
   - Redis缓存key: `material_spec_config:{factoryId}`
   - 过期时间: 24小时
   - 更新/删除操作后主动清除

2. **数据库索引**:
   - `idx_factory` 用于快速查询工厂的所有配置
   - `uk_factory_category` 用于快速查询特定类别配置

3. **批量查询**:
   - 单次请求获取所有类别配置，避免N+1查询

---

### 测试用例

#### 单元测试
- [ ] 查询不存在的工厂ID，返回空配置或默认配置
- [ ] 更新规格配置，验证JSON格式正确
- [ ] 删除配置后，验证恢复为默认值
- [ ] 权限验证：非管理员无法更新/删除配置

#### 集成测试
- [ ] 工厂创建时自动初始化默认配置
- [ ] 前端调用API，验证响应格式正确
- [ ] 更新配置后，缓存被正确清除
- [ ] 并发更新同一类别配置，验证数据一致性

#### 性能测试
- [ ] 查询接口响应时间 < 100ms
- [ ] 支持100+并发请求

---

### 后续扩展

**Phase 4 可能的增强**:
1. 支持规格选项排序（拖拽调整顺序）
2. 规格选项使用频率统计（推荐常用选项）
3. 跨工厂规格配置复制功能
4. 规格配置历史记录和回滚

---

## AI成本分析功能

**需求日期**: 2025-11-04
**优先级**: P0 - 核心功能（用户已请求）
**开发阶段**: Phase 3 - AI集成
**预计工作量**: 1.5天（12小时）

### 功能概述

实现基于DeepSeek AI的智能成本分析功能，支持：
1. 一键生成成本分析报告（每周自动缓存，7天过期自动重新生成）
2. AI多轮对话（Follow-up问题）
3. 配额管理（基于平台管理员设置）
4. Session持久化（24小时有效期）

### 1. API端点规格

#### 1.1 获取批次成本分析数据

**已有端点** (需验证):
```
GET /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "batch": {
      "batchNumber": "BATCH001",
      "productType": "鱼丸",
      "status": "已完成",
      "rawMaterialCategory": "海鲜"
    },
    "laborStats": {
      "totalSessions": 5,
      "totalMinutes": 480,
      "totalCost": 2400.00,
      "laborDetails": [
        {
          "workType": "加工工",
          "workerCount": 3,
          "cost": 1500.00
        }
      ]
    },
    "equipmentStats": {
      "totalEquipment": 2,
      "totalRuntime": 360,
      "totalCost": 180.00,
      "equipmentDetails": [
        {
          "equipmentName": "搅拌机",
          "runtime": 180,
          "cost": 90.00
        }
      ]
    },
    "costBreakdown": {
      "rawMaterialCost": 5000.00,
      "rawMaterialPercentage": "66.67%",
      "laborCost": 2400.00,
      "laborPercentage": "32.00%",
      "equipmentCost": 180.00,
      "equipmentPercentage": "2.40%",
      "totalCost": 7500.00
    },
    "profitAnalysis": {
      "expectedRevenue": 10000.00,
      "totalCost": 7500.00,
      "profitMargin": 2500.00,
      "profitRate": 25.00,
      "breakEvenPrice": "¥15.00/斤"
    }
  }
}
```

---

#### 1.2 AI成本分析接口（新增）

**端点**:
```
POST /api/mobile/{factoryId}/processing/ai-cost-analysis
```

**请求体**:
```json
{
  "batchId": "12345",          // 必填：批次ID
  "question": "如何降低人工成本？", // 可选：用户自定义问题（不传则生成完整分析）
  "session_id": "sess_abc123"  // 可选：对话Session ID（用于多轮对话）
}
```

**成功响应** (200):
```json
{
  "success": true,
  "data": {
    "analysis": "根据分析，您的批次成本结构如下：\n\n1. **原材料成本占比66.67%**，属于正常范围...\n\n建议：\n- 与供应商谈判批量采购折扣\n- 优化下料流程，减少损耗",
    "session_id": "sess_abc123_new",  // 新的或延续的Session ID
    "message_count": 2,                // 本Session的消息计数
    "quota": {
      "used": 15,                      // 本周已用次数
      "limit": 100,                    // 本周总配额
      "remaining": 85,                 // 本周剩余次数
      "period": "weekly",              // 配额周期
      "resetDate": "2025-11-11T00:00:00Z"  // 下次重置时间（周一凌晨）
    }
  }
}
```

**错误响应**:

**403 - 配额已用完**:
```json
{
  "success": false,
  "message": "本周AI分析次数已用完，请等待下周重置",
  "code": "QUOTA_EXCEEDED",
  "data": {
    "quota": {
      "used": 100,
      "limit": 100,
      "remaining": 0,
      "period": "weekly",
      "resetDate": "2025-11-11T00:00:00Z"
    }
  }
}
```

**404 - 批次不存在**:
```json
{
  "success": false,
  "message": "批次不存在或已被删除",
  "code": "BATCH_NOT_FOUND"
}
```

**500 - AI服务不可用**:
```json
{
  "success": false,
  "message": "AI服务暂时不可用，请稍后再试",
  "code": "AI_SERVICE_UNAVAILABLE"
}
```

---

### 2. 数据库Schema

#### 2.1 AI分析结果表（每周报告缓存）

```sql
CREATE TABLE ai_analysis_results (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  batch_id VARCHAR(50) NOT NULL COMMENT '批次ID',
  factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
  report_type VARCHAR(20) DEFAULT 'cost_analysis' COMMENT '报告类型',
  analysis_text TEXT COMMENT 'AI分析结果文本',
  session_id VARCHAR(100) COMMENT '生成时的Session ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  expires_at TIMESTAMP NOT NULL COMMENT '过期时间（7天后）',
  INDEX idx_batch_expires (batch_id, expires_at) COMMENT '批次+过期时间索引',
  INDEX idx_factory (factory_id) COMMENT '工厂ID索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI分析结果表';
```

**说明**:
- `expires_at` 设置为 `created_at + 7天`
- 查询时检查 `expires_at > NOW()`，过期则重新生成

---

#### 2.2 AI配额使用表

```sql
CREATE TABLE ai_quota_usage (
  id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
  user_id BIGINT COMMENT '用户ID（可选，记录具体使用者）',
  week_start DATE NOT NULL COMMENT '周一日期（配额周期起始）',
  used_count INT DEFAULT 0 COMMENT '已使用次数',
  quota_limit INT DEFAULT 100 COMMENT 'AI配额上限（从平台管理员设置获取）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_factory_week (factory_id, week_start) COMMENT '工厂+周期唯一索引',
  INDEX idx_week_start (week_start) COMMENT '周期索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI配额使用表';
```

**配额重置逻辑**:
```sql
-- Cron Job: 每周一凌晨执行
-- 1. 清理过期记录（保留最近4周数据用于统计）
DELETE FROM ai_quota_usage WHERE week_start < DATE_SUB(CURDATE(), INTERVAL 4 WEEK);

-- 2. 不需要手动重置，新的一周会自动创建新记录
```

---

#### 2.3 AI对话Session表

```sql
CREATE TABLE ai_chat_sessions (
  session_id VARCHAR(100) PRIMARY KEY COMMENT 'Session ID',
  batch_id VARCHAR(50) NOT NULL COMMENT '批次ID',
  factory_id VARCHAR(50) NOT NULL COMMENT '工厂ID',
  user_id BIGINT COMMENT '用户ID',
  message_count INT DEFAULT 0 COMMENT '本Session消息计数',
  context_history JSON COMMENT '对话历史（JSON格式）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后活动时间',
  expires_at TIMESTAMP NOT NULL COMMENT '过期时间（24小时后）',
  INDEX idx_batch_user (batch_id, user_id) COMMENT '批次+用户索引',
  INDEX idx_expires (expires_at) COMMENT '过期时间索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI对话Session表';
```

**Session清理**:
```sql
-- Cron Job: 每小时执行一次
DELETE FROM ai_chat_sessions WHERE expires_at < NOW();
```

---

### 3. 后端业务逻辑

#### 3.1 AI分析主流程

```
用户请求 AI 分析
    ↓
检查批次是否存在
    ↓
检查 AI 配额（ai_quota_usage 表）
    ↓ 配额充足
检查是否有缓存的报告（ai_analysis_results 表）
    ↓ 无缓存或已过期
获取批次成本数据（costBreakdown, laborStats, equipmentStats）
    ↓
格式化成本数据为文本（供AI分析）
    ↓
调用 Python AI 服务 (http://localhost:8085/api/ai/chat)
    ↓
接收 AI 分析结果
    ↓
保存到 ai_analysis_results 表（expires_at = NOW() + 7天）
    ↓
更新配额使用计数（ai_quota_usage.used_count++）
    ↓
返回结果给前端
```

---

#### 3.2 每周报告自动生成逻辑

**实现方式**：懒加载 + 7天过期

1. **用户首次请求**：
   - 查询 `ai_analysis_results` 表
   - 条件: `batch_id = ? AND expires_at > NOW()`
   - 如果**没有记录**或**已过期** → 生成新报告

2. **7天内再次请求**：
   - 直接返回缓存的报告
   - 不消耗AI配额
   - 不调用AI服务

3. **7天后请求**：
   - 检测到 `expires_at < NOW()`
   - 自动删除旧报告
   - 生成新报告

**优点**：
- ✅ 无需Cron Job定时生成
- ✅ 按需生成，节省资源
- ✅ 自动过期清理

---

#### 3.3 AI配额管理逻辑

**获取配额限制**：
```java
// 从平台管理员的AI设置表获取
SELECT ai_quota_weekly_limit
FROM platform_ai_settings
WHERE factory_id = ?;

// 如果未设置，使用默认值 100
```

**检查配额**：
```java
// 获取本周起始日期（周一）
LocalDate weekStart = LocalDate.now().with(DayOfWeek.MONDAY);

// 查询或创建配额记录
SELECT * FROM ai_quota_usage
WHERE factory_id = ? AND week_start = ?;

// 如果不存在，创建新记录
INSERT INTO ai_quota_usage (factory_id, week_start, quota_limit)
VALUES (?, ?, ?);

// 检查是否超过配额
IF (used_count >= quota_limit) {
    THROW QuotaExceededException;
}
```

**更新配额**：
```java
UPDATE ai_quota_usage
SET used_count = used_count + 1,
    updated_at = NOW()
WHERE factory_id = ? AND week_start = ?;
```

---

#### 3.4 Session管理逻辑

**Session生成**：
```java
String sessionId = "sess_" + UUID.randomUUID().toString();
```

**Session保存**：
```java
// 如果请求带 session_id，查询现有session
IF (request.session_id != null) {
    SELECT * FROM ai_chat_sessions WHERE session_id = ? AND expires_at > NOW();

    IF (session exists) {
        // 更新消息计数和最后活动时间
        UPDATE ai_chat_sessions
        SET message_count = message_count + 1,
            last_activity = NOW()
        WHERE session_id = ?;

        // 使用现有session_id
        sessionId = request.session_id;
    }
}

// 如果不存在session，创建新的
IF (session NOT exists) {
    INSERT INTO ai_chat_sessions
    (session_id, batch_id, factory_id, user_id, expires_at)
    VALUES (?, ?, ?, ?, NOW() + INTERVAL 24 HOUR);
}
```

**传递上下文到AI**：
```java
// 获取对话历史
List<Message> history = getContextHistory(sessionId);

// 调用AI服务时传递
aiService.chat(sessionId, newMessage, history);
```

---

### 4. Python AI服务集成

#### 4.1 配置文件 (application.yml)

```yaml
cretas:
  ai:
    service:
      url: http://localhost:8085      # Python AI服务地址（重要：端口是8085！）
      timeout: 30000                  # 超时30秒
      enabled: true                   # 是否启用AI功能
```

---

#### 4.2 Java调用示例

**创建 AIAnalysisService.java**:

```java
@Service
public class AIAnalysisService {

    @Value("${cretas.ai.service.url}")
    private String aiServiceUrl;

    private final RestTemplate restTemplate;

    public AIAnalysisService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * 调用AI服务分析成本数据
     *
     * @param costData 成本数据文本
     * @param sessionId 对话Session ID（可选）
     * @return AI分析结果
     */
    public String analyzeCost(String costData, String sessionId) {
        String endpoint = aiServiceUrl + "/api/ai/chat";

        Map<String, Object> request = new HashMap<>();
        request.put("message", costData);
        if (sessionId != null) {
            request.put("session_id", sessionId);
        }

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                endpoint,
                request,
                Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> body = response.getBody();
                return (String) body.get("response");
            } else {
                throw new AIServiceException("AI服务返回错误: " + response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("调用AI服务失败", e);
            throw new AIServiceException("AI服务暂时不可用", e);
        }
    }

    /**
     * 格式化成本数据为AI可读文本
     */
    public String formatCostDataForAI(BatchCostAnalysis costData) {
        StringBuilder sb = new StringBuilder();
        sb.append("【批次成本分析数据】\n\n");
        sb.append("批次号: ").append(costData.getBatch().getBatchNumber()).append("\n");
        sb.append("产品类型: ").append(costData.getBatch().getProductType()).append("\n\n");

        sb.append("【成本构成】\n");
        sb.append("- 原材料成本: ¥").append(costData.getCostBreakdown().getRawMaterialCost())
          .append(" (").append(costData.getCostBreakdown().getRawMaterialPercentage()).append(")\n");
        sb.append("- 人工成本: ¥").append(costData.getCostBreakdown().getLaborCost())
          .append(" (").append(costData.getCostBreakdown().getLaborPercentage()).append(")\n");
        sb.append("- 设备成本: ¥").append(costData.getCostBreakdown().getEquipmentCost())
          .append(" (").append(costData.getCostBreakdown().getEquipmentPercentage()).append(")\n");
        sb.append("- 总成本: ¥").append(costData.getCostBreakdown().getTotalCost()).append("\n\n");

        sb.append("【人工详情】\n");
        sb.append("- 总人数: ").append(costData.getLaborStats().getTotalSessions()).append("人\n");
        sb.append("- 总工时: ").append(costData.getLaborStats().getTotalMinutes() / 60).append("小时\n\n");

        sb.append("【设备详情】\n");
        sb.append("- 设备数量: ").append(costData.getEquipmentStats().getTotalEquipment()).append("台\n");
        sb.append("- 运行时长: ").append(costData.getEquipmentStats().getTotalRuntime() / 60).append("小时\n");

        return sb.toString();
    }
}
```

---

**在 ProcessingController.java 中添加**:

```java
@RestController
@RequestMapping("/api/mobile/{factoryId}/processing")
public class ProcessingController {

    @Autowired
    private AIAnalysisService aiAnalysisService;

    @Autowired
    private ProcessingService processingService;

    /**
     * AI成本分析接口
     */
    @PostMapping("/ai-cost-analysis")
    public ResponseEntity<?> aiCostAnalysis(
            @PathVariable String factoryId,
            @RequestBody AICostAnalysisRequest request,
            @RequestHeader("Authorization") String token
    ) {
        try {
            // 1. 获取批次成本数据
            BatchCostAnalysis costData = processingService.getBatchCostAnalysis(
                Long.parseLong(request.getBatchId())
            );

            // 2. 检查AI配额
            AIQuota quota = aiQuotaService.checkQuota(factoryId);
            if (quota.getRemaining() <= 0) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "message", "本周AI分析次数已用完，请等待下周重置",
                        "code", "QUOTA_EXCEEDED",
                        "data", Map.of("quota", quota)
                    ));
            }

            // 3. 检查是否有缓存报告（7天内）
            Optional<AIAnalysisResult> cached = aiResultRepository.findValidReport(
                request.getBatchId()
            );

            if (cached.isPresent() && request.getQuestion() == null) {
                // 返回缓存报告（不消耗配额）
                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", Map.of(
                        "analysis", cached.get().getAnalysisText(),
                        "session_id", cached.get().getSessionId(),
                        "message_count", 1,
                        "quota", quota
                    )
                ));
            }

            // 4. 格式化成本数据
            String formattedData = aiAnalysisService.formatCostDataForAI(costData);

            // 5. 如果有自定义问题，追加到数据后
            if (request.getQuestion() != null) {
                formattedData += "\n\n用户问题: " + request.getQuestion();
            }

            // 6. 调用AI服务
            String analysis = aiAnalysisService.analyzeCost(
                formattedData,
                request.getSessionId()
            );

            // 7. 生成新的Session ID
            String newSessionId = "sess_" + UUID.randomUUID().toString();

            // 8. 保存分析结果（仅默认分析，不缓存自定义问题）
            if (request.getQuestion() == null) {
                aiResultRepository.save(AIAnalysisResult.builder()
                    .batchId(request.getBatchId())
                    .factoryId(factoryId)
                    .analysisText(analysis)
                    .sessionId(newSessionId)
                    .expiresAt(LocalDateTime.now().plusDays(7))
                    .build());
            }

            // 9. 更新配额
            aiQuotaService.incrementUsage(factoryId);

            // 10. 更新quota对象
            quota.setUsed(quota.getUsed() + 1);
            quota.setRemaining(quota.getRemaining() - 1);

            // 11. 返回结果
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of(
                    "analysis", analysis,
                    "session_id", newSessionId,
                    "message_count", 1,
                    "quota", quota
                )
            ));

        } catch (QuotaExceededException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of(
                    "success", false,
                    "message", e.getMessage(),
                    "code", "QUOTA_EXCEEDED"
                ));
        } catch (AIServiceException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "success", false,
                    "message", "AI服务暂时不可用，请稍后再试",
                    "code", "AI_SERVICE_UNAVAILABLE"
                ));
        } catch (Exception e) {
            log.error("AI成本分析失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "success", false,
                    "message", "分析失败，请稍后再试"
                ));
        }
    }
}
```

---

### 5. 测试计划

#### 5.1 单元测试
- [ ] AIAnalysisService 单元测试
- [ ] 配额检查逻辑测试
- [ ] Session管理逻辑测试
- [ ] 成本数据格式化测试

#### 5.2 集成测试
- [ ] 端到端AI分析流程测试
- [ ] 配额耗尽场景测试
- [ ] 7天报告过期重新生成测试
- [ ] Session 24小时过期测试
- [ ] AI服务不可用降级测试

#### 5.3 性能测试
- [ ] 并发请求测试（10个用户同时分析）
- [ ] 缓存命中率测试（预期>60%）
- [ ] AI服务响应时间测试（预期<5s）

---

### 6. 成本预估

**AI服务成本**（使用Llama-3.1-8B-Instruct）:
- 每次分析约 ~¥0.025
- 每周100次配额 ≈ ¥2.5/周
- 每月约 ~¥10/工厂

**带缓存优化后**:
- 缓存命中率 60%
- 实际成本降低 50%
- 预计 ~¥5/月/工厂

---

### 7. 部署检查清单

#### 7.1 数据库
- [ ] 创建 `ai_analysis_results` 表
- [ ] 创建 `ai_quota_usage` 表
- [ ] 创建 `ai_chat_sessions` 表
- [ ] 设置Cron Job清理过期Session

#### 7.2 后端代码
- [ ] 创建 `AIAnalysisService.java`
- [ ] 在 `ProcessingController.java` 添加 `/ai-cost-analysis` 端点
- [ ] 创建 `AIQuotaService.java` 配额管理服务
- [ ] 配置 `application.yml` AI服务URL（**重要：端口8085**）

#### 7.3 Python AI服务
- [ ] 确认服务运行在 `localhost:8085`
- [ ] 验证 `/api/ai/chat` 端点可用
- [ ] 测试Session管理功能

#### 7.4 前端
- [x] 已完成优化（724行→150行）
- [x] 已实现智能缓存（5分钟+30分钟）
- [x] 已实现Session持久化（24小时）
- [x] 已创建子组件化架构

---

### 8. 上线后监控

**关键指标**:
1. AI分析成功率（目标>95%）
2. 平均响应时间（目标<5s）
3. 缓存命中率（目标>60%）
4. 每日AI调用次数
5. 配额消耗情况

**告警阈值**:
- AI服务不可用超过5分钟
- 成功率低于90%
- 响应时间超过10s
- 单工厂日调用超过200次（异常使用）

---

## 其他后端需求

_后续需求将追加到此文档_
