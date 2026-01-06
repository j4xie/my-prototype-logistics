# 集成测试待完成工作清单

## 总体进度

**已完成**: 2/8 测试文件 (25%)
**待完成**: 6/8 测试文件 + 测试运行调试

---

## ✅ 已完成的测试文件

### 1. AlertSystemFlowTest.java
- **路径**: `backend-java/src/test/java/com/cretas/aims/integration/AlertSystemFlowTest.java`
- **代码行数**: 156行
- **测试用例数**: 10个
- **状态**: ✅ 已完成 (上一个session)

### 2. DeviceIntegrationFlowTest.java
- **路径**: `backend-java/src/test/java/com/cretas/aims/integration/DeviceIntegrationFlowTest.java`
- **代码行数**: 310行
- **测试用例数**: 10个
- **状态**: ✅ 已完成 (当前session)
- **覆盖场景**:
  1. 设备注册和协议配置完整流程
  2. 协议自动匹配 (HEX_FIXED, ASCII_VARIABLE, MODBUS_RTU)
  3. 设备状态监控 (上线/离线/故障/维护)
  4. 实时数据解析
  5. 异常数据触发告警
  6. 设备离线检测
  7. 多设备管理
  8. 协议切换
  9. 设备删除和清理
  10. 设备批量状态更新

---

## ⏳ 待完成的测试文件

### 3. MaterialBatchFlowTest.java (原料批次流程测试)
**测试场景**:
- 原料批次登记 (供应商、批次号、数量、质检报告)
- 入库记录和库位分配
- 原料库存查询和统计
- 批次追溯信息记录
- 原料过期预警
- 批次质检状态管理
- 原料消耗记录
- 库存盘点流程
- 批次合并和拆分
- 原料退货处理

**涉及服务**:
- MaterialBatchService
- InventoryService
- QualityCheckService
- SupplierService

---

### 4. ProductionProcessFlowTest.java (生产加工流程测试)
**测试场景**:
- 生产计划创建和调度
- 原料领料和投料
- 生产过程记录 (温度、时间、设备)
- 半成品质检
- 成品入库
- 批次转换率计算
- 生产异常记录
- 设备使用记录
- 生产进度追踪
- 生产成本核算

**涉及服务**:
- ProductionPlanService
- ProcessingService
- MaterialConsumptionService
- EquipmentManagementService

---

### 5. QualityInspectionFlowTest.java (质检流程测试)
**测试场景**:
- 原料入厂检验
- 过程质量控制
- 成品出厂检验
- 质检报告生成
- 不合格品处理流程
- 质检数据统计分析
- 质检标准配置
- 抽检计划管理
- 质检结果审核
- 质检异常预警

**涉及服务**:
- QualityCheckService
- QualityReportService
- DisposalService
- AlertService

---

### 6. ShipmentTraceabilityFlowTest.java (出货溯源流程测试)
**测试场景**:
- 出货订单创建
- 批次分配和标签打印
- 出货检验记录
- 物流信息录入
- 溯源码生成和查询
- 全链路追溯查询 (从原料到成品)
- 召回批次定位
- 客户质量反馈
- 出货记录查询
- 溯源报告导出

**涉及服务**:
- ShipmentService
- TraceabilityService
- LabelService
- RecallService

---

### 7. AIIntentRecognitionFlowTest.java (AI意图识别流程测试)
**测试场景**:
- 用户意图识别准确性
- 关键词匹配测试
- 语义缓存命中率
- 多轮对话上下文
- 意图配置管理
- LLM降级处理
- 意图执行结果验证
- 错误意图处理
- 意图版本回滚
- 自学习关键词更新

**涉及服务**:
- AIIntentService
- SemanticCacheService
- LlmIntentFallbackClient
- IntentHandlerService

---

### 8. AttendanceWorkTimeFlowTest.java (考勤工时流程测试)
**测试场景**:
- 员工打卡签到/签退
- 考勤异常记录
- 加班申请和审批
- 请假申请流程
- 工时统计报表
- 排班计划管理
- 考勤规则配置
- 迟到早退统计
- 考勤数据导出
- 月度考勤汇总

**涉及服务**:
- AttendanceService
- WorkTimeService
- LeaveService
- ShiftService

---

## 📋 测试编写规范

### 通用模板结构
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("XXX流程集成测试")
class XxxFlowTest {

    @Autowired
    private XxxService xxxService;

    @Autowired
    private XxxRepository xxxRepository;

    @MockBean
    private PushNotificationService pushNotificationService;

    private static final String TEST_FACTORY_ID = "F001";
    private static final Long TEST_USER_ID = 22L;

    @Test
    @Order(1)
    @Transactional
    @DisplayName("测试1: XXX核心流程")
    void testCoreFlow() {
        // Given
        // When
        // Then (使用 AssertJ assertThat)
    }
}
```

### 技术要求
- ✅ 使用 `@Transactional` 自动回滚
- ✅ 使用 `@Order` 控制测试顺序
- ✅ 使用 AssertJ 流式断言
- ✅ 使用 Builder 模式构造测试数据
- ✅ Mock 外部服务 (如 PushNotificationService)
- ✅ 每个测试文件 8-12 个测试用例
- ✅ 覆盖正常流程 + 异常场景

---

## 🔧 后续任务

### Task 9: 运行测试并修复问题
完成所有测试文件后需要:
1. 执行完整测试套件
   ```bash
   cd backend-java
   mvn test -Dtest="*FlowTest"
   ```
2. 修复失败的测试用例
3. 检查测试覆盖率
4. 验证事务回滚正确性
5. 确认Mock服务工作正常

---

## 📊 预计工作量

| 测试文件 | 预计用例数 | 预计代码行数 | 状态 |
|---------|-----------|------------|------|
| AlertSystemFlowTest | 10 | 156 | ✅ 完成 |
| DeviceIntegrationFlowTest | 10 | 310 | ✅ 完成 |
| MaterialBatchFlowTest | 10 | ~300 | ⏳ 待完成 |
| ProductionProcessFlowTest | 12 | ~350 | ⏳ 待完成 |
| QualityInspectionFlowTest | 10 | ~300 | ⏳ 待完成 |
| ShipmentTraceabilityFlowTest | 10 | ~320 | ⏳ 待完成 |
| AIIntentRecognitionFlowTest | 10 | ~280 | ⏳ 待完成 |
| AttendanceWorkTimeFlowTest | 10 | ~250 | ⏳ 待完成 |
| **总计** | **82** | **~2266** | **25%** |

---

## 🚀 建议并行策略

### 方案1: 单Chat多Agent并行
可以在同一个chat中启动3个并行agent:
- Agent 1: MaterialBatchFlowTest + ProductionProcessFlowTest (相关联)
- Agent 2: QualityInspectionFlowTest + ShipmentTraceabilityFlowTest (质检相关)
- Agent 3: AIIntentRecognitionFlowTest + AttendanceWorkTimeFlowTest (独立功能)

### 方案2: 多Chat窗口并行
可以开3个独立的Claude Code窗口:
- 窗口1: 原料+生产流程测试 (MaterialBatch + Production)
- 窗口2: 质检+溯源流程测试 (Quality + Shipment)
- 窗口3: AI+考勤流程测试 (AIIntent + Attendance)

**注意**: 不存在文件冲突风险，所有测试文件相互独立

---

## 📝 测试执行环境

### 数据库配置
- **测试Profile**: `application-test.yml`
- **数据库**: H2内存数据库 或 MySQL测试实例
- **事务策略**: `@Transactional` 自动回滚

### Mock服务
需要Mock的外部依赖:
- `PushNotificationService` (消息推送)
- 其他第三方API调用

### 测试常量
```java
TEST_FACTORY_ID = "F001"
TEST_USER_ID = 22L
```

---

## 📌 下一步行动

1. **立即开始**: 创建 `MaterialBatchFlowTest.java`
2. **然后**: 依次完成剩余5个测试文件
3. **最后**: 执行测试套件并修复问题

---

**生成时间**: 2026-01-06
**当前进度**: 2/8 测试文件 (25%)
**预计完成**: 完成剩余6个测试文件 + 测试调试
