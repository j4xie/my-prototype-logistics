# AI Phase 2 扩展功能计划

**制定日期**: 2026-01-06
**Phase 1 完成状态**: ✅ 已完成（核心AI模块 95%）
**Phase 2 预计工期**: 21天（3周）
**Phase 2 覆盖范围**: 代码重构、硬件集成、IoT扩展、ISAPI智能分析、集成测试

---

## 📋 Phase 1 完成摘要

### 已验证通过的功能 ✅

**核心AI模块** (7个模块, 100%完成):
1. ✅ **LLM Function Calling** - 6个工具实现（电子秤、相机、数据操作、原料、质检、工单）
2. ✅ **5层意图识别管道** - Exact → Regex → Keyword → Semantic → LLM Fallback
3. ✅ **userId传递链完整修复** - 13个关键节点修复
4. ✅ **多租户意图隔离** - 工厂级意图配置隔离
5. ✅ **自学习关键词系统** - Wilson Score + 4种关键词来源
6. ✅ **语义缓存系统** - 3层缓存架构 + TTL 1小时
7. ✅ **Handler参数提取改造** - 4个Handler降级解析实现

**架构优化任务** (3个任务, 100%完成):
1. ✅ **对话状态管理器** - ConversationService完整实现
2. ✅ **LLM自动修复机制** - 双模降级（DashScope + Python）
3. ✅ **MAIA架构文档** - 完整架构设计和审计结果

**代码重构** (2个任务, 100%完成):
1. ✅ **VectorUtils工具类** - 统一向量计算逻辑
2. ✅ **KeywordLearningService** - 统一关键词学习机制

### 测试验证结果 ✅

**集成测试通过** (2/8测试文件完成):
- ✅ **AIIntentRecognitionFlowTest** - 15/15 tests passed (01:43 min)
  - 测试覆盖: 5层识别管道、语义缓存、LLM fallback、版本管理、自学习

- ✅ **Multi-turn conversation E2E test** - 手动验证通过
  - 测试流程: 低置信度输入 → 澄清问题 → 会话延续 → 意图识别 → 学习

**API端到端测试** (4个测试文件):
- ✅ test_conversation_e2e.sh - 多轮对话流程验证
- ✅ test_multi_handler_need_more_info.sh - 6个Handler NEED_MORE_INFO场景
- ⚠️  test_semantic_cache_e2e.sh - 待运行
- ⚠️  test_llm_function_calling.sh - 待运行

---

## 🎯 Phase 2 核心目标

### 1. 代码质量提升 (1.5天)
- 消除请求级重复计算（Embedding缓存）
- 统一配置管理（17个@Value注解迁移）

### 2. 硬件系统完善 (5天)
- 修复设备关联类型不匹配bug
- 实现完整的硬件测试框架（65单元 + 45集成）

### 3. IoT完整解决方案 (2天)
- 实现5种设备类型支持（电子秤、温度、湿度、摄像头、网关）
- 完善数据持久化存储和阈值告警

### 4. ISAPI智能分析 (4天)
- 实现行为检测、入侵检测、人脸检测
- 前端配置界面（区域绘制）
- AI意图集成

### 5. 集成测试覆盖 (10天)
- 完成剩余6个FlowTest（原料、生产、质检、出货、考勤）
- 测试覆盖率从25%提升至100%

---

## 📊 Phase 2 任务清单

### 类别A: 代码重构与优化 (1.5天)

#### 重构3: RequestScopedEmbeddingCache 请求级缓存
**优先级**: P1
**预计工期**: 1天
**风险等级**: 中

**实施内容**:
1. 创建 `service/RequestScopedEmbeddingCache.java`
2. 使用ThreadLocal实现请求级缓存
3. 修改所有Embedding调用点使用缓存（7处）
4. 实现自动清理机制（请求结束时）

**涉及调用点**:
- ExpressionLearningServiceImpl.java:75
- SemanticCacheServiceImpl.java:149, 199, 305
- IntentEmbeddingCacheServiceImpl.java:201, 338, 452

**预期收益**:
- 单次请求Embedding计算从2-3次降为1次
- 响应时间预计降低30-40%
- 减少不必要的API调用

**技术实现**:
```java
@Service
public class RequestScopedEmbeddingCache {
    private static final ThreadLocal<Map<String, float[]>> cache =
        ThreadLocal.withInitial(HashMap::new);

    public float[] getOrCompute(String text, Supplier<float[]> computer) {
        Map<String, float[]> requestCache = cache.get();
        return requestCache.computeIfAbsent(text, k -> computer.get());
    }

    public void clear() {
        cache.remove();
    }
}
```

---

#### 重构4: IntentMatchingConfig 配置统一化
**优先级**: P1
**预计工期**: 0.5天
**风险等级**: 低

**实施内容**:
1. 创建 `config/IntentMatchingConfig.java`
2. 创建 `config/IntentKnowledgeBase.java`（外部化硬编码常量）
3. 迁移17个@Value注解到配置类
4. 外部化 STOP_WORDS, QUERY_INDICATORS, UPDATE_INDICATORS

**当前问题**:
- 17个@Value分散在6个分类
- 硬编码常量（停用词、查询指示词）难以维护

**目标结构**:
```java
@Configuration
@ConfigurationProperties(prefix = "intent.matching")
public class IntentMatchingConfig {
    // 阈值配置
    private Double exactMatchThreshold;
    private Double keywordMatchThreshold;
    private Double semanticMatchThreshold;

    // 权重配置
    private Double keywordWeight;
    private Double semanticWeight;

    // ... 其他配置
}

@Component
public class IntentKnowledgeBase {
    private static final Set<String> STOP_WORDS = Set.of("的", "了", "是", ...);
    private static final Set<String> QUERY_INDICATORS = Set.of("查询", "显示", ...);
    // ...
}
```

**预期收益**:
- 统一配置管理，便于维护
- 支持运行时动态调整阈值
- 减少硬编码，提高灵活性

---

### 类别B: 硬件系统完善 (5天)

#### 硬件1: 修复IsapiDevice.equipment_id类型不匹配bug
**优先级**: P1（Bug修复）
**预计工期**: 0.5天
**风险等级**: 中（需要数据迁移）

**问题描述**:
- IsapiDevice.equipment_id 类型为 String
- FactoryEquipment.id 类型为 Long
- 导致外键关联失败，设备无法正确关联到工厂设备

**实施内容**:
1. 修改 `entity/IsapiDevice.java` - equipment_id 字段类型 String → Long
2. 创建数据库迁移脚本
3. 修改相关查询和DTO转换逻辑
4. 验证设备关联功能

**数据库修改**:
```sql
-- 1. 备份现有数据
CREATE TABLE isapi_devices_backup AS SELECT * FROM isapi_devices;

-- 2. 修改字段类型
ALTER TABLE isapi_devices
MODIFY COLUMN equipment_id BIGINT;

-- 3. 如果有外键约束，先删除再重建
ALTER TABLE isapi_devices
DROP FOREIGN KEY fk_isapi_equipment;

ALTER TABLE isapi_devices
ADD CONSTRAINT fk_isapi_equipment
FOREIGN KEY (equipment_id) REFERENCES factory_equipment(id);
```

**验证测试**:
- 创建ISAPI设备并关联到工厂设备
- 查询设备列表验证关联信息正确
- 删除设备验证级联操作

---

#### 硬件2: 硬件系统测试框架实现
**优先级**: P1
**预计工期**: 4.5天
**风险等级**: 低

**测试范围**:

**单元测试** (65个测试用例):
1. **电子秤协议解析测试** (15个)
   - ScaleProtocolParserTest.java
   - 测试场景: 重量解析、稳定性判断、单位转换、负值处理、数据帧验证

2. **ISAPI相机控制测试** (20个)
   - IsapiClientTest.java
   - 测试场景: 相机连接、PTZ控制、抓拍、视频流、参数配置

3. **设备管理服务测试** (30个)
   - DeviceManagementServiceTest.java
   - 测试场景: 设备注册、状态更新、告警创建、心跳检测、离线检测

**集成测试** (45个测试用例):
1. 设备注册和配置流程（10个）
2. 实时数据采集流程（10个）
3. 设备状态监控流程（10个）
4. 设备告警流程（10个）
5. 设备维护流程（5个）

**已完成**: DeviceIntegrationFlowTest.java（部分集成测试）

**技术实现**:
- 使用 Mockito 模拟硬件设备
- 使用 @SpringBootTest 进行集成测试
- 使用 TestContainers 提供测试数据库
- 使用 WireMock 模拟HTTP接口

**预期收益**:
- 硬件系统测试覆盖率达到80%+
- 减少生产环境硬件问题
- 提供完整的测试示例

---

### 类别C: IoT完整解决方案 (2天)

#### IoT-1: Entity + Repository 创建
**优先级**: P2
**预计工期**: 1天
**风险等级**: 低

**设备类型覆盖**:
| 设备类型 | DeviceType | 数据类型 | 用途 |
|----------|------------|----------|------|
| 电子秤 | SCALE | WEIGHT | 原料入库、成品出库称重 |
| 温度传感器 | SENSOR | TEMPERATURE | 冷链监控、仓库环境 |
| 湿度传感器 | SENSOR | HUMIDITY | 仓库环境监控 |
| 摄像头 | CAMERA | IMAGE/EVENT | 生产过程监控、质量抽检 |
| 边缘网关 | GATEWAY | HEARTBEAT | 设备汇聚、协议转换 |

**实施内容**:

**IotDevice 实体**:
```java
@Entity
@Table(name = "iot_devices")
public class IotDevice extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String deviceCode;        // 设备编码
    private String deviceName;        // 设备名称
    private String factoryId;         // 工厂ID

    @Enumerated(EnumType.STRING)
    private DeviceType deviceType;    // 设备类型

    @Enumerated(EnumType.STRING)
    private DeviceStatus status;      // 在线状态

    private Long equipmentId;         // 关联设备ID
    private String protocolConfig;    // 协议配置(JSON)
    private LocalDateTime lastHeartbeat; // 最后心跳时间
}
```

**IotDeviceData 实体**:
```java
@Entity
@Table(name = "iot_device_data")
public class IotDeviceData extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long deviceId;            // 设备ID

    @Enumerated(EnumType.STRING)
    private DataType dataType;        // 数据类型

    private String dataValue;         // 数据值
    private LocalDateTime collectTime; // 采集时间
    private LocalDateTime receiveTime; // 接收时间

    private Boolean processed;        // 是否已处理
    private Long relatedBatchId;      // 关联生产批次
}
```

**枚举定义**:
```java
public enum DeviceType {
    SCALE,      // 电子秤
    SENSOR,     // 传感器
    CAMERA,     // 摄像头
    GATEWAY     // 边缘网关
}

public enum DeviceStatus {
    ONLINE,     // 在线
    OFFLINE,    // 离线
    ERROR,      // 错误
    MAINTENANCE // 维护中
}

public enum DataType {
    WEIGHT,       // 重量
    TEMPERATURE,  // 温度
    HUMIDITY,     // 湿度
    IMAGE,        // 图像
    HEARTBEAT     // 心跳
}
```

**Repository 接口**:
```java
public interface IotDeviceRepository extends JpaRepository<IotDevice, Long> {
    List<IotDevice> findByFactoryId(String factoryId);
    List<IotDevice> findByDeviceType(DeviceType deviceType);
    List<IotDevice> findByStatus(DeviceStatus status);
    Optional<IotDevice> findByDeviceCode(String deviceCode);
}

public interface IotDeviceDataRepository extends JpaRepository<IotDeviceData, Long> {
    List<IotDeviceData> findByDeviceIdAndCollectTimeBetween(
        Long deviceId, LocalDateTime start, LocalDateTime end);
    List<IotDeviceData> findTop10ByDeviceIdOrderByCollectTimeDesc(Long deviceId);
    List<IotDeviceData> findByDataType(DataType dataType);
}
```

**数据库表创建**:
```sql
CREATE TABLE iot_devices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_code VARCHAR(50) UNIQUE NOT NULL,
    device_name VARCHAR(100),
    factory_id VARCHAR(50) NOT NULL,
    device_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'OFFLINE',
    equipment_id BIGINT,
    protocol_config TEXT,
    last_heartbeat DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_factory_device (factory_id, device_type),
    INDEX idx_status (status)
);

CREATE TABLE iot_device_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_id BIGINT NOT NULL,
    data_type VARCHAR(20) NOT NULL,
    data_value TEXT,
    collect_time DATETIME NOT NULL,
    receive_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    related_batch_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_device_time (device_id, collect_time),
    INDEX idx_data_type (data_type),
    INDEX idx_processed (processed)
);
```

---

#### IoT-2: Service 层实现
**优先级**: P2
**预计工期**: 0.5天
**风险等级**: 中

**实施内容**:

**IotDataService 接口**:
```java
public interface IotDataService {
    // 设备数据管理
    void saveDeviceData(Long deviceId, DataType dataType, String dataValue);
    List<IotDeviceData> getRecentData(Long deviceId, int limit);
    List<IotDeviceData> getDataByType(DataType dataType);

    // 设备状态管理
    void updateDeviceStatus(Long deviceId, DeviceStatus status);
    void updateHeartbeat(Long deviceId);
    IotDevice getDeviceInfo(Long deviceId);

    // 设备关联更新
    void updateEquipmentWeight(Long equipmentId, Double weight);

    // 阈值告警检查
    void checkTemperatureThreshold(Long deviceId, Double temperature);
    void checkHumidityThreshold(Long deviceId, Double humidity);

    // 告警管理
    void createDeviceAlert(Long deviceId, String alertType, String message);
    void handleOfflineAlert(Long deviceId);
}
```

**核心实现逻辑**:
```java
@Service
public class IotDataServiceImpl implements IotDataService {

    @Override
    public void saveDeviceData(Long deviceId, DataType dataType, String dataValue) {
        IotDeviceData data = new IotDeviceData();
        data.setDeviceId(deviceId);
        data.setDataType(dataType);
        data.setDataValue(dataValue);
        data.setCollectTime(LocalDateTime.now());
        data.setReceiveTime(LocalDateTime.now());
        iotDeviceDataRepository.save(data);

        // 根据数据类型触发业务逻辑
        switch (dataType) {
            case WEIGHT:
                handleWeightData(deviceId, dataValue);
                break;
            case TEMPERATURE:
                checkTemperatureThreshold(deviceId, Double.parseDouble(dataValue));
                break;
            case HUMIDITY:
                checkHumidityThreshold(deviceId, Double.parseDouble(dataValue));
                break;
        }
    }

    @Override
    public void updateHeartbeat(Long deviceId) {
        Optional<IotDevice> deviceOpt = iotDeviceRepository.findById(deviceId);
        if (deviceOpt.isPresent()) {
            IotDevice device = deviceOpt.get();
            device.setLastHeartbeat(LocalDateTime.now());
            device.setStatus(DeviceStatus.ONLINE);
            iotDeviceRepository.save(device);
        }
    }

    @Override
    public void checkTemperatureThreshold(Long deviceId, Double temperature) {
        // 冷链区: < -15°C (告警阈值: -18°C)
        // 常温区: 0-25°C
        if (temperature < -18.0 || temperature > 30.0) {
            createDeviceAlert(deviceId, "TEMPERATURE_EXCEED",
                String.format("温度异常: %.1f°C", temperature));
        }
    }

    private void handleWeightData(Long deviceId, String weightStr) {
        Double weight = Double.parseDouble(weightStr);
        IotDevice device = iotDeviceRepository.findById(deviceId).orElse(null);
        if (device != null && device.getEquipmentId() != null) {
            updateEquipmentWeight(device.getEquipmentId(), weight);
        }
    }
}
```

**预期收益**:
- 统一IoT数据处理流程
- 自动化阈值告警
- 完整的设备状态管理

---

#### IoT-3: MqttSubscriber 业务逻辑扩展
**优先级**: P2
**预计工期**: 0.5天
**风险等级**: 低

**实施内容**: 在现有MQTT订阅器中添加业务处理逻辑

**扩展方法**:
```java
@Service
public class MqttSubscriber {

    @Autowired
    private IotDataService iotDataService;

    /**
     * 处理称重数据
     */
    public void handleWeightData(String deviceCode, WeightMessage message) {
        IotDevice device = iotDeviceRepository.findByDeviceCode(deviceCode)
            .orElseThrow(() -> new DeviceNotFoundException(deviceCode));

        // 1. 存储数据
        iotDataService.saveDeviceData(
            device.getId(),
            DataType.WEIGHT,
            String.valueOf(message.getWeight())
        );

        // 2. 更新设备心跳
        iotDataService.updateHeartbeat(device.getId());

        // 3. 如果重量稳定，触发自动入库（可选）
        if (message.isStable()) {
            autoInboundService.tryAutoInbound(device.getId(), message.getWeight());
        }
    }

    /**
     * 处理温度数据
     */
    public void handleTemperatureData(String deviceCode, TemperatureMessage message) {
        IotDevice device = iotDeviceRepository.findByDeviceCode(deviceCode)
            .orElseThrow(() -> new DeviceNotFoundException(deviceCode));

        // 1. 存储数据
        iotDataService.saveDeviceData(
            device.getId(),
            DataType.TEMPERATURE,
            String.valueOf(message.getTemperature())
        );

        // 2. 阈值检查（自动触发告警）
        iotDataService.checkTemperatureThreshold(
            device.getId(),
            message.getTemperature()
        );
    }

    /**
     * 处理湿度数据
     */
    public void handleHumidityData(String deviceCode, HumidityMessage message) {
        IotDevice device = iotDeviceRepository.findByDeviceCode(deviceCode)
            .orElseThrow(() -> new DeviceNotFoundException(deviceCode));

        // 存储 + 阈值检查
        iotDataService.saveDeviceData(
            device.getId(),
            DataType.HUMIDITY,
            String.valueOf(message.getHumidity())
        );
        iotDataService.checkHumidityThreshold(
            device.getId(),
            message.getHumidity()
        );
    }

    /**
     * 处理摄像头数据
     */
    public void handleCameraData(String deviceCode, CameraMessage message) {
        IotDevice device = iotDeviceRepository.findByDeviceCode(deviceCode)
            .orElseThrow(() -> new DeviceNotFoundException(deviceCode));

        // 1. 存储数据（图片URL或事件描述）
        iotDataService.saveDeviceData(
            device.getId(),
            DataType.IMAGE,
            message.getImageUrl()
        );

        // 2. 如果是异常事件，创建告警
        if (message.isAbnormalEvent()) {
            iotDataService.createDeviceAlert(
                device.getId(),
                "CAMERA_EVENT",
                message.getEventDescription()
            );
        }
    }

    /**
     * 处理心跳
     */
    public void handleHeartbeat(String deviceCode) {
        IotDevice device = iotDeviceRepository.findByDeviceCode(deviceCode)
            .orElseThrow(() -> new DeviceNotFoundException(deviceCode));

        iotDataService.updateHeartbeat(device.getId());
    }
}
```

**预期收益**:
- MQTT订阅器从"数据转发器"升级为"业务处理器"
- 自动化告警和业务触发
- 完整的设备生命周期管理

---

### 类别D: ISAPI智能分析实现 (4天)

#### ISAPI阶段1: 后端API实现
**优先级**: P2
**预计工期**: 2天
**风险等级**: 中

**实施内容**:
1. 创建SmartAnalysisDTO数据模型
2. 实现XML解析器（ISAPI使用XML格式）
3. 扩展IsapiClient支持智能分析接口
4. 创建IsapiSmartAnalysisService服务
5. 创建IsapiSmartAnalysisController控制器

**新建文件**:
- dto/camera/SmartAnalysisDTO.java
- dto/camera/LineDetectionConfig.java
- dto/camera/FieldDetectionConfig.java
- dto/camera/FaceDetectionConfig.java
- service/IsapiSmartAnalysisService.java
- service/impl/IsapiSmartAnalysisServiceImpl.java
- controller/IsapiSmartAnalysisController.java

**核心DTO设计**:
```java
@Data
public class LineDetectionConfig {
    private String ruleId;
    private String ruleName;
    private List<Point> detectionLine;    // 检测线坐标
    private String crossDirection;        // 穿越方向: A_TO_B, B_TO_A, BOTH
    private Boolean enabled;
}

@Data
public class FieldDetectionConfig {
    private String ruleId;
    private String ruleName;
    private List<Point> detectionRegion;  // 检测区域多边形
    private String eventType;             // 事件类型: INTRUSION, LOITERING
    private Integer durationThreshold;    // 持续时间阈值（秒）
    private Boolean enabled;
}

@Data
public class SmartAnalysisEvent {
    private String eventId;
    private String deviceCode;
    private String eventType;             // LINE_CROSS, FIELD_INTRUSION, FACE_DETECTED
    private LocalDateTime eventTime;
    private String imageUrl;              // 抓拍图片URL
    private Map<String, Object> metadata; // 事件元数据
}
```

**IsapiClient扩展**:
```java
@Component
public class IsapiClient {

    /**
     * 配置行为检测规则
     */
    public void configureLineDetection(String deviceIp, LineDetectionConfig config) {
        String url = String.format("http://%s/ISAPI/Smart/LineDetection/%s",
            deviceIp, config.getRuleId());
        String xmlBody = convertToXml(config);
        httpClient.put(url, xmlBody, basicAuth);
    }

    /**
     * 配置区域入侵规则
     */
    public void configureFieldDetection(String deviceIp, FieldDetectionConfig config) {
        String url = String.format("http://%s/ISAPI/Smart/FieldDetection/%s",
            deviceIp, config.getRuleId());
        String xmlBody = convertToXml(config);
        httpClient.put(url, xmlBody, basicAuth);
    }

    /**
     * 查询智能分析事件
     */
    public List<SmartAnalysisEvent> getSmartEvents(String deviceIp,
                                                     LocalDateTime start,
                                                     LocalDateTime end) {
        String url = String.format("http://%s/ISAPI/ContentMgmt/search", deviceIp);
        String searchXml = buildSearchXml(start, end, "smart");
        String responseXml = httpClient.post(url, searchXml, basicAuth);
        return parseEventsFromXml(responseXml);
    }
}
```

**Controller实现**:
```java
@RestController
@RequestMapping("/api/mobile/{factoryId}/isapi-smart")
public class IsapiSmartAnalysisController {

    @PostMapping("/line-detection")
    public ApiResponse<Void> configLineDetection(
            @PathVariable String factoryId,
            @RequestBody LineDetectionConfig config) {
        isapiSmartService.configureLineDetection(factoryId, config);
        return ApiResponse.success();
    }

    @PostMapping("/field-detection")
    public ApiResponse<Void> configFieldDetection(
            @PathVariable String factoryId,
            @RequestBody FieldDetectionConfig config) {
        isapiSmartService.configureFieldDetection(factoryId, config);
        return ApiResponse.success();
    }

    @GetMapping("/events")
    public ApiResponse<List<SmartAnalysisEvent>> getSmartEvents(
            @PathVariable String factoryId,
            @RequestParam String deviceCode,
            @RequestParam @DateTimeFormat(iso = ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = ISO.DATE_TIME) LocalDateTime end) {
        List<SmartAnalysisEvent> events = isapiSmartService.getSmartEvents(
            factoryId, deviceCode, start, end);
        return ApiResponse.success(events);
    }
}
```

---

#### ISAPI阶段2: 前端配置界面
**优先级**: P2
**预计工期**: 1.5天
**风险等级**: 中

**实施内容**:
1. 创建智能分析配置屏幕
2. 实现区域绘制组件（绘制检测线/区域）
3. 集成API客户端
4. 实现配置保存和验证

**新建文件**:
- screens/IsapiSmartConfigScreen.tsx
- components/camera/RegionDrawer.tsx
- components/camera/LineDrawer.tsx
- services/api/isapiSmartAnalysisApi.ts

**核心组件设计**:
```typescript
// IsapiSmartConfigScreen.tsx
export const IsapiSmartConfigScreen: React.FC = () => {
  const [configType, setConfigType] = useState<'line' | 'field'>('line');
  const [detectionPoints, setDetectionPoints] = useState<Point[]>([]);

  const handleSaveConfig = async () => {
    if (configType === 'line') {
      await isapiSmartApi.configLineDetection({
        ruleId: '1',
        ruleName: '进出口监控',
        detectionLine: detectionPoints,
        crossDirection: 'BOTH',
        enabled: true
      });
    } else {
      await isapiSmartApi.configFieldDetection({
        ruleId: '1',
        ruleName: '禁止区域',
        detectionRegion: detectionPoints,
        eventType: 'INTRUSION',
        durationThreshold: 5,
        enabled: true
      });
    }
    Alert.alert('成功', '智能分析配置已保存');
  };

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={configType}
        onValueChange={setConfigType}
        buttons={[
          { value: 'line', label: '行为检测' },
          { value: 'field', label: '区域入侵' }
        ]}
      />

      {configType === 'line' ? (
        <LineDrawer
          onPointsChange={setDetectionPoints}
          maxPoints={2}
        />
      ) : (
        <RegionDrawer
          onPointsChange={setDetectionPoints}
          maxPoints={10}
        />
      )}

      <Button onPress={handleSaveConfig}>
        保存配置
      </Button>
    </View>
  );
};
```

**依赖库**:
- react-native-svg（绘制区域）
- react-native-gesture-handler（手势交互）
- react-native-image-zoom-viewer（图片缩放）

---

#### ISAPI阶段3: AI意图扩展
**优先级**: P2
**预计工期**: 0.5天
**风险等级**: 低

**实施内容**:
1. 增加智能分析相关意图
2. 实现意图处理器
3. 集成到现有AI意图识别系统

**新增意图**:
```java
// AIIntentConfig 新增记录
{
    "intentCode": "ISAPI_CONFIG_LINE_DETECTION",
    "intentName": "配置行为检测",
    "keywords": ["行为检测", "配置检测线", "穿越检测"],
    "category": "CAMERA_MANAGEMENT"
},
{
    "intentCode": "ISAPI_CONFIG_FIELD_DETECTION",
    "intentName": "配置区域入侵",
    "keywords": ["区域入侵", "入侵检测", "禁止区域"],
    "category": "CAMERA_MANAGEMENT"
},
{
    "intentCode": "ISAPI_QUERY_DETECTION_EVENTS",
    "intentName": "查询检测事件",
    "keywords": ["查询检测事件", "智能分析记录", "检测历史"],
    "category": "CAMERA_MANAGEMENT"
}
```

**Intent Handler实现**:
```java
@Component
public class IsapiSmartIntentHandler implements IntentHandler {

    @Override
    public IntentExecuteResponse handleConfigLineDetection(
            IntentExecuteRequest request,
            Map<String, Object> context) {

        String deviceCode = context.get("deviceCode", String.class);
        List<Point> detectionLine = extractDetectionLine(request.getUserInput());

        if (deviceCode == null || detectionLine == null) {
            return IntentExecuteResponse.needMoreInfo(
                "请提供设备编码和检测线坐标"
            );
        }

        LineDetectionConfig config = LineDetectionConfig.builder()
            .ruleId("auto_" + System.currentTimeMillis())
            .ruleName("AI自动配置")
            .detectionLine(detectionLine)
            .crossDirection("BOTH")
            .enabled(true)
            .build();

        isapiSmartService.configureLineDetection(request.getFactoryId(), config);

        return IntentExecuteResponse.success(
            "行为检测规则已配置成功",
            Map.of("ruleId", config.getRuleId())
        );
    }
}
```

**预期收益**:
- 自然语言配置智能分析规则
- 语音查询检测事件
- 完整的AI + 硬件集成闭环

---

### 类别E: 集成测试覆盖 (10天)

**当前进度**: 2/8测试文件完成（25%）
**已完成**: AIIntentRecognitionFlowTest ✅, DeviceIntegrationFlowTest ✅
**待完成**: 6个测试文件

---

#### 测试1: MaterialBatchFlowTest（原料批次流程测试）
**预计工期**: 2天

**测试场景** (10个):
1. 原料批次登记（供应商、批次号、数量、质检报告）
2. 入库记录和库位分配
3. 原料库存查询和统计
4. 批次追溯信息记录
5. 原料过期预警
6. 批次质检状态管理
7. 原料消耗记录
8. 库存盘点流程
9. 批次合并和拆分
10. 原料退货处理

**测试示例**:
```java
@Test
@DisplayName("Test1: 原料批次登记和入库")
void testMaterialBatchRegistrationAndInbound() {
    // 1. 登记原料批次
    MaterialBatchRequest request = MaterialBatchRequest.builder()
        .materialTypeId("RMT-F001-001")
        .batchNumber("MB-TEST-001")
        .quantity(1000.0)
        .supplierId(1L)
        .build();

    MaterialBatchDTO batch = materialBatchService.createBatch(request);
    assertThat(batch.getId()).isNotNull();

    // 2. 创建入库记录
    InboundRequest inboundReq = InboundRequest.builder()
        .materialBatchId(batch.getId())
        .storageLocation("A01-01")
        .build();

    InboundRecordDTO record = inventoryService.createInboundRecord(inboundReq);
    assertThat(record.getStorageLocation()).isEqualTo("A01-01");

    // 3. 验证库存更新
    InventoryDTO inventory = inventoryService.getInventory(batch.getMaterialTypeId());
    assertThat(inventory.getCurrentStock()).isEqualTo(1000.0);
}
```

---

#### 测试2: ProductionProcessFlowTest（生产加工流程测试）
**预计工期**: 2天

**测试场景** (12个):
1. 生产计划创建和调度
2. 原料领料和投料
3. 生产过程记录（温度、时间、设备）
4. 半成品质检
5. 成品入库
6. 批次转换率计算
7. 生产异常记录
8. 设备使用记录
9. 生产进度追踪
10. 生产成本核算
11. 生产计划调整
12. 紧急插单处理

---

#### 测试3: QualityInspectionFlowTest（质检流程测试）
**预计工期**: 2天

**测试场景** (10个):
1. 原料入厂检验
2. 过程质量控制
3. 成品出厂检验
4. 质检报告生成
5. 不合格品处理流程
6. 质检数据统计分析
7. 质检标准配置
8. 抽检计划管理
9. 质检结果审核
10. 质检异常预警

---

#### 测试4: ShipmentTraceabilityFlowTest（出货溯源流程测试）
**预计工期**: 2天

**测试场景** (10个):
1. 出货订单创建
2. 批次分配和标签打印
3. 出货检验记录
4. 物流信息录入
5. 溯源码生成和查询
6. 全链路追溯查询（从原料到成品）
7. 召回批次定位
8. 客户质量反馈
9. 出货记录查询
10. 溯源报告导出

---

#### 测试5: AttendanceWorkTimeFlowTest（考勤工时流程测试）
**预计工期**: 2天

**测试场景** (10个):
1. 员工打卡签到/签退
2. 考勤异常记录
3. 加班申请和审批
4. 请假申请流程
5. 工时统计报表
6. 排班计划管理
7. 考勤规则配置
8. 迟到早退统计
9. 考勤数据导出
10. 月度考勤汇总

---

#### 测试运行和调试 (预留)
**预计工期**: 建议预留0.5天处理测试失败和环境问题

---

## 📅 Phase 2 实施计划

### 优先级分组

**第1周（高优先级）**:
- Day 1: 重构3 - RequestScopedEmbeddingCache (1天)
- Day 2: 重构4 - IntentMatchingConfig配置统一化 (0.5天)
- Day 2-3: 硬件1 - 修复IsapiDevice类型不匹配bug (0.5天)
- Day 3-5: 测试1 - MaterialBatchFlowTest (2天)

**第2周（中优先级）**:
- Day 6-7: 测试2 - ProductionProcessFlowTest (2天)
- Day 8-9: 测试3 - QualityInspectionFlowTest (2天)
- Day 10: IoT-1 - Entity + Repository创建 (1天)

**第3周（扩展功能）**:
- Day 11: IoT-2 - Service层实现 (0.5天)
- Day 11: IoT-3 - MqttSubscriber扩展 (0.5天)
- Day 12-13: 测试4 - ShipmentTraceabilityFlowTest (2天)
- Day 14-15: 测试5 - AttendanceWorkTimeFlowTest (2天)

**可选（根据时间）**:
- 硬件2: 硬件系统测试框架（4.5天）
- ISAPI阶段1-3: 智能分析实现（4天）

---

## 📊 Phase 2 预期成果

### 代码质量提升
- ✅ 消除请求级重复计算（Embedding缓存）
- ✅ 统一配置管理（17个@Value迁移）
- ✅ 代码可维护性提升30%+

### 硬件系统完善
- ✅ 修复设备关联类型不匹配bug
- ✅ 硬件测试覆盖率达到80%+
- ✅ 减少生产环境硬件问题

### IoT完整解决方案
- ✅ 支持5种设备类型（电子秤、温度、湿度、摄像头、网关）
- ✅ 完整的数据持久化存储
- ✅ 自动化阈值告警

### 集成测试覆盖
- ✅ 测试覆盖率从25%提升至75%（6/8测试完成）
- ✅ 覆盖核心业务流程（原料、生产、质检、出货、考勤）
- ✅ 提供完整的测试示例

---

## ⚠️ 风险评估

### 高风险项
1. **硬件1: IsapiDevice类型修改**
   - 需要数据迁移，可能导致现有设备关联丢失
   - 缓解措施: 数据备份 + 充分测试

2. **IoT-2: Service层实现**
   - 阈值告警逻辑复杂，可能产生误报
   - 缓解措施: 可配置阈值 + 告警抑制

### 中风险项
1. **RequestScopedEmbeddingCache**
   - ThreadLocal可能导致内存泄漏
   - 缓解措施: 请求拦截器自动清理

2. **ISAPI智能分析**
   - XML解析复杂，不同相机型号可能不兼容
   - 缓解措施: 充分测试多种型号

### 低风险项
- 集成测试编写（纯测试代码，不影响生产）
- 配置统一化（重构，不改变逻辑）

---

## 🎯 成功标准

### Phase 2 完成标准:
1. ✅ 所有P1任务完成（代码重构 + 硬件bug修复）
2. ✅ 至少6/8集成测试完成（75%覆盖率）
3. ✅ IoT基础设施完成（Entity + Service + MQTT扩展）
4. ✅ 所有新增代码通过编译和单元测试
5. ✅ 文档更新完整（API文档 + 测试文档）

### 可选完成标准:
- ⭕ 硬件系统测试框架完成（如时间允许）
- ⭕ ISAPI智能分析实现（如时间允许）

---

## 📚 相关文档

- **Phase 1 完成总结**: AI-OPT-3-COMPLETION-SUMMARY.md
- **AI模块分析报告**: AI-MODULE-COMPLETION-ANALYSIS.md
- **任务总览**: REMAINING-TASKS.md
- **MAIA架构计划**: MAIA-ARCHITECTURE-PLAN.md

---

**制定日期**: 2026-01-06
**制定人**: AI Assistant
**审核状态**: 待审核
**预计开始日期**: 2026-01-07
**预计完成日期**: 2026-01-28（3周）
