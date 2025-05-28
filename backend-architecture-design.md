# 食品溯源系统后端架构设计

## 数据存储分层设计

### PostgreSQL (主数据库)
**存储内容**: 核心业务数据、关系型数据
```sql
-- 核心实体表设计示例
-- 养殖场信息
CREATE TABLE farms (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    contact_person VARCHAR(50),
    gis_location POINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 养殖批次
CREATE TABLE farming_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_no VARCHAR(50) UNIQUE NOT NULL,
    farm_id BIGINT REFERENCES farms(id),
    species_id BIGINT,
    quantity INTEGER,
    start_date DATE,
    expected_end_date DATE,
    status VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 加工批次
CREATE TABLE processing_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_no VARCHAR(50) UNIQUE NOT NULL,
    source_batch_ids BIGINT[],  -- 原料批次ID数组
    product_id BIGINT,
    quantity DECIMAL(10,2),
    processing_date TIMESTAMPTZ,
    status VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 溯源关系表
CREATE TABLE trace_relations (
    id BIGSERIAL PRIMARY KEY,
    trace_code VARCHAR(100) UNIQUE NOT NULL,
    source_type VARCHAR(20), -- farming, processing, logistics
    source_id BIGINT,
    parent_trace_codes VARCHAR(100)[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### MongoDB (文档数据库)
**存储内容**: 灵活结构数据、日志记录、配置信息
```javascript
// 操作日志文档
{
  "_id": ObjectId("..."),
  "traceCode": "TR202412250001",
  "operation": "feeding",
  "operatorId": 12345,
  "timestamp": ISODate("2024-12-25T08:00:00Z"),
  "data": {
    "feedType": "corn",
    "quantity": 50.5,
    "location": "pen-A01",
    "temperature": 25.3,
    "humidity": 65,
    "notes": "正常饲喂",
    "images": ["img1.jpg", "img2.jpg"]
  },
  "metadata": {
    "deviceId": "feeder-001",
    "gpsLocation": [116.123, 39.456]
  }
}

// 质检报告文档
{
  "_id": ObjectId("..."),
  "batchId": "B202412250001",
  "testType": "quality_check",
  "testDate": ISODate("2024-12-25T10:00:00Z"),
  "testResults": {
    "weight": 1250.5,
    "grade": "A",
    "moistureContent": 18.5,
    "proteinContent": 22.1,
    "indicators": {
      "salmonella": "negative",
      "ecoli": "negative",
      "antibiotics": "negative"
    }
  },
  "inspector": {
    "id": 67890,
    "name": "李质检",
    "certification": "QC001"
  }
}
```

### TimescaleDB (时序数据)
**存储内容**: 环境监控数据、设备运行数据、实时传感器数据
```sql
-- 环境监控数据超表
CREATE TABLE environmental_data (
    time TIMESTAMPTZ NOT NULL,
    farm_id BIGINT,
    pen_id VARCHAR(20),
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    co2_level DECIMAL(8,2),
    light_intensity DECIMAL(8,2),
    device_id VARCHAR(50)
);

SELECT create_hypertable('environmental_data', 'time');

-- 设备运行数据
CREATE TABLE equipment_metrics (
    time TIMESTAMPTZ NOT NULL,
    equipment_id VARCHAR(50),
    metric_type VARCHAR(30),
    value DECIMAL(15,4),
    unit VARCHAR(10),
    status VARCHAR(20)
);

SELECT create_hypertable('equipment_metrics', 'time');
```

### Redis (缓存层)
**用途**: 会话管理、热点数据缓存、实时计算结果
```redis
# 用户会话
SET session:user:12345 "{"userId":12345,"roles":["farmer"],"permissions":["read:farm","write:batch"]}"
EXPIRE session:user:12345 3600

# 热点查询缓存
SET trace:TR202412250001 "{"batchInfo":{},"qualityInfo":{},"logisticsInfo":{}}"
EXPIRE trace:TR202412250001 300

# 实时统计
ZADD farm:12345:daily_stats 1735142400 "{"date":"2024-12-25","feeding_count":8,"cost":1250.50}"
```

## API设计规范

### 统一响应格式
```json
{
  "status": "success|error",
  "data": {}, // 业务数据
  "meta": {
    "timestamp": "2024-12-25T10:00:00Z",
    "version": "v1",
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 100
    }
  },
  "errors": [] // 错误信息数组
}
```

### RESTful API设计示例

#### 农业模块API
```
# 养殖场管理
GET    /api/v1/farming/farms                    # 获取养殖场列表
POST   /api/v1/farming/farms                    # 创建养殖场
GET    /api/v1/farming/farms/{farmId}           # 获取单个养殖场
PUT    /api/v1/farming/farms/{farmId}           # 更新养殖场
DELETE /api/v1/farming/farms/{farmId}           # 删除养殖场

# 批次管理
GET    /api/v1/farming/farms/{farmId}/batches   # 获取养殖场批次列表
POST   /api/v1/farming/farms/{farmId}/batches   # 创建新批次
GET    /api/v1/farming/batches/{batchId}        # 获取批次详情
PUT    /api/v1/farming/batches/{batchId}        # 更新批次信息
DELETE /api/v1/farming/batches/{batchId}        # 删除批次

# 饲养记录
POST   /api/v1/farming/batches/{batchId}/feeding     # 添加饲养记录
GET    /api/v1/farming/batches/{batchId}/feeding     # 获取饲养记录
PUT    /api/v1/farming/feeding/{recordId}            # 更新饲养记录

# 成本核算
GET    /api/v1/farming/batches/{batchId}/costs       # 获取批次成本
POST   /api/v1/farming/batches/{batchId}/costs       # 添加成本记录
GET    /api/v1/farming/costs/analysis                # 成本分析报告
```

#### 加工模块API
```
# 原料管理
GET    /api/v1/processing/materials               # 获取原料列表
POST   /api/v1/processing/materials/receive       # 原料接收
PUT    /api/v1/processing/materials/{materialId}  # 更新原料信息

# 加工流程
POST   /api/v1/processing/workflows               # 创建加工流程
GET    /api/v1/processing/workflows/{workflowId}  # 获取流程详情
POST   /api/v1/processing/workflows/{workflowId}/steps  # 添加工序记录

# 质量控制
POST   /api/v1/processing/quality/inspections     # 创建质检记录
GET    /api/v1/processing/quality/reports         # 获取质检报告
GET    /api/v1/processing/quality/statistics      # 质量统计
```

## 微服务通信设计

### 同步通信 (HTTP/REST)
```java
// Feign客户端示例
@FeignClient(name = "farming-service")
public interface FarmingServiceClient {
    
    @GetMapping("/api/v1/farming/batches/{batchId}")
    BatchInfo getBatchInfo(@PathVariable Long batchId);
    
    @PostMapping("/api/v1/farming/batches/{batchId}/status")
    void updateBatchStatus(@PathVariable Long batchId, @RequestBody StatusUpdate status);
}
```

### 异步通信 (消息队列)
```java
// 事件发布示例
@Component
public class ProcessingEventPublisher {
    
    @Autowired
    private RabbitTemplate rabbitTemplate;
    
    public void publishBatchCompleted(BatchCompletedEvent event) {
        rabbitTemplate.convertAndSend("processing.exchange", 
                                    "batch.completed", 
                                    event);
    }
}

// 事件监听示例
@RabbitListener(queues = "trace.queue")
public void handleBatchCompleted(BatchCompletedEvent event) {
    // 更新溯源链
    traceService.updateTraceChain(event.getBatchId(), event.getProcessingResult());
}
```

## 安全架构设计

### JWT Token设计
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user12345",
    "iat": 1735142400,
    "exp": 1735228800,
    "roles": ["farmer", "quality_inspector"],
    "permissions": ["read:farm", "write:batch", "read:quality"],
    "farm_ids": [1, 2, 3],
    "organization_id": 100
  }
}
```

### 权限控制
```java
@PreAuthorize("hasPermission(#farmId, 'farm', 'read')")
@GetMapping("/farms/{farmId}")
public ResponseEntity<Farm> getFarm(@PathVariable Long farmId) {
    // 业务逻辑
}

@PreAuthorize("hasRole('QUALITY_INSPECTOR')")
@PostMapping("/quality/inspections")
public ResponseEntity<Inspection> createInspection(@RequestBody Inspection inspection) {
    // 业务逻辑
}
```

## AI服务架构

### 模型服务设计
```python
# FastAPI AI服务示例
@app.post("/api/v1/ai/predict/cost")
async def predict_cost(request: CostPredictionRequest):
    """成本预测API"""
    # 数据预处理
    features = preprocess_cost_data(request.data)
    
    # 模型推理
    prediction = cost_model.predict(features)
    
    # 结果后处理
    result = {
        "predicted_cost": prediction[0],
        "confidence": prediction[1],
        "factors": analyze_cost_factors(features),
        "recommendations": generate_cost_recommendations(prediction)
    }
    
    return result

@app.post("/api/v1/ai/predict/quality")
async def predict_quality(request: QualityPredictionRequest):
    """质量预测API"""
    # 实现质量预测逻辑
    pass
```

### 模型管理
```yaml
# MLflow模型配置
models:
  - name: cost_prediction_v1
    stage: production
    version: 1.2.3
    endpoint: /models/cost-prediction
    
  - name: quality_prediction_v1
    stage: staging
    version: 1.1.0
    endpoint: /models/quality-prediction
```

## 部署架构

### Docker容器化
```dockerfile
# farming-service Dockerfile
FROM openjdk:17-jre-slim

COPY target/farming-service-1.0.0.jar app.jar

ENV SPRING_PROFILES_ACTIVE=production
ENV DATABASE_URL=jdbc:postgresql://postgres:5432/farming_db

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app.jar"]
```

### Kubernetes部署
```yaml
# farming-service deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: farming-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: farming-service
  template:
    metadata:
      labels:
        app: farming-service
    spec:
      containers:
      - name: farming-service
        image: your-registry/farming-service:1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: farming-service
spec:
  selector:
    app: farming-service
  ports:
  - port: 80
    targetPort: 8080
```

## 监控与运维

### 链路追踪
```java
// Sleuth + Zipkin
@RestController
public class FarmingController {
    
    @NewSpan("get-farm-info")
    @GetMapping("/farms/{farmId}")
    public Farm getFarmInfo(@PathVariable Long farmId) {
        // 自动生成链路追踪信息
        return farmingService.getFarmById(farmId);
    }
}
```

### 健康检查
```java
@Component
public class FarmingServiceHealthIndicator implements HealthIndicator {
    
    @Override
    public Health health() {
        // 检查数据库连接
        if (isDatabaseHealthy()) {
            return Health.up()
                    .withDetail("database", "connected")
                    .build();
        }
        return Health.down()
                .withDetail("database", "disconnected")
                .build();
    }
}
```

## 数据备份与恢复

### 自动备份策略
```bash
#!/bin/bash
# 数据库备份脚本
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_${DATE}.sql
aws s3 cp backup_${DATE}.sql s3://your-backup-bucket/database/
```

### 灾难恢复
```yaml
# 备份恢复流程
disaster_recovery:
  rpo: 4hours  # 恢复点目标
  rto: 2hours  # 恢复时间目标
  strategy:
    - 数据库主从切换
    - 应用多区域部署
    - 文件存储跨区域复制
``` 