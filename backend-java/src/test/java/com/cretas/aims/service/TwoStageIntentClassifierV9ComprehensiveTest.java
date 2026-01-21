package com.cretas.aims.service;

import com.cretas.aims.config.IntentCompositionConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * v9.0 多维意图分类综合测试 - 100个测试用例
 *
 * 覆盖场景：
 * 1. MATERIAL 领域 (15个)
 * 2. ATTENDANCE 领域 (20个)
 * 3. QUALITY 领域 (15个)
 * 4. EQUIPMENT 领域 (10个)
 * 5. PROCESSING 领域 (10个)
 * 6. SHIPMENT 领域 (10个)
 * 7. ALERT 领域 (8个)
 * 8. SUPPLIER/CUSTOMER 领域 (6个)
 * 9. 边界/混合场景 (6个)
 */
@DisplayName("v9.0 多维意图分类综合测试 - 100个用例")
class TwoStageIntentClassifierV9ComprehensiveTest {

    private TwoStageIntentClassifier classifier;
    private IntentCompositionConfig compositionConfig;

    @BeforeEach
    void setUp() {
        compositionConfig = new IntentCompositionConfig();
        compositionConfig.init();
        classifier = new TwoStageIntentClassifier(compositionConfig);
    }

    // ==================== MATERIAL 领域 (15个) ====================

    @ParameterizedTest(name = "[{index}] MATERIAL: {0} -> {3}")
    @DisplayName("MATERIAL领域测试")
    @CsvSource({
            // 基础查询
            "查询原料批次, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "查3天内的入库, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "最近的原料入库记录, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "本周入库情况, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "查看库存, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            // 未来时态
            "明天要到的原料, MATERIAL, QUERY, MATERIAL_INCOMING",
            "下周要到的物料, MATERIAL, QUERY, MATERIAL_INCOMING",
            "即将到货的原材料, MATERIAL, QUERY, MATERIAL_INCOMING",
            "预计到货的材料, MATERIAL, QUERY, MATERIAL_INCOMING",
            "3天后要到的原料, MATERIAL, QUERY, MATERIAL_INCOMING",
            // 创建操作
            "新增原料入库, MATERIAL, CREATE, MATERIAL_BATCH_CREATE",
            "登记物料入库, MATERIAL, CREATE, MATERIAL_BATCH_CREATE",
            "录入原材料批次, MATERIAL, CREATE, MATERIAL_BATCH_CREATE",
            "添加库存记录, MATERIAL, CREATE, MATERIAL_BATCH_CREATE",
            "创建入库单, MATERIAL, CREATE, MATERIAL_BATCH_CREATE"
    })
    void testMaterialDomain(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== ATTENDANCE 领域 (20个) ====================

    @ParameterizedTest(name = "[{index}] ATTENDANCE: {0} -> {3}")
    @DisplayName("ATTENDANCE领域测试")
    @CsvSource({
            // 基础查询 - 今日考勤
            "今天出勤情况, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            "查看考勤, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            "今天谁来了, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            "出勤记录, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            // 统计查询
            "考勤统计, ATTENDANCE, QUERY, ATTENDANCE_STATS",
            "统计出勤率, ATTENDANCE, QUERY, ATTENDANCE_STATS",
            "考勤数据汇总, ATTENDANCE, QUERY, ATTENDANCE_STATS",
            "出勤人数统计, ATTENDANCE, QUERY, ATTENDANCE_STATS",
            // 异常查询
            "谁今天没来, ATTENDANCE, QUERY, ATTENDANCE_ANOMALY",
            "今天缺勤的人, ATTENDANCE, QUERY, ATTENDANCE_ANOMALY",
            "没打卡的人, ATTENDANCE, QUERY, ATTENDANCE_ANOMALY",
            "迟到的人有哪些, ATTENDANCE, QUERY, ATTENDANCE_ANOMALY",
            // 个人查询
            "查张三的考勤, ATTENDANCE, QUERY, ATTENDANCE_HISTORY",
            "我的考勤记录, ATTENDANCE, QUERY, ATTENDANCE_HISTORY",
            "李四的出勤情况, ATTENDANCE, QUERY, ATTENDANCE_HISTORY",
            // 月度查询
            "本月考勤, ATTENDANCE, QUERY, ATTENDANCE_MONTHLY",
            "这个月的出勤, ATTENDANCE, QUERY, ATTENDANCE_MONTHLY",
            "月度考勤报表, ATTENDANCE, QUERY, ATTENDANCE_MONTHLY",
            // 打卡操作
            "帮我打个卡, ATTENDANCE, CREATE, CLOCK_IN",
            "我要签到, ATTENDANCE, CREATE, CLOCK_IN"
    })
    void testAttendanceDomain(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== QUALITY 领域 (15个) ====================

    @ParameterizedTest(name = "[{index}] QUALITY: {0} -> {3}")
    @DisplayName("QUALITY领域测试")
    @CsvSource({
            // 基础查询
            "查看质检记录, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            "最近的质检结果, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            "今天的检测情况, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            "质量检验报告, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            "不合格的检验有哪些, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            // 统计查询
            "统计80分以上的质检, QUALITY, QUERY, QUALITY_STATS",
            "质检合格率统计, QUALITY, QUERY, QUALITY_STATS",
            "检验数据汇总, QUALITY, QUERY, QUALITY_STATS",
            "本月质检数量, QUALITY, QUERY, QUALITY_STATS",
            // 关键项查询
            "关键质检项, QUALITY, QUERY, QUALITY_CRITICAL_ITEMS",
            "重要的检验项目, QUALITY, QUERY, QUALITY_CRITICAL_ITEMS",
            "紧急质检任务, QUALITY, QUERY, QUALITY_CRITICAL_ITEMS",
            // 创建操作
            "新增质检记录, QUALITY, CREATE, QUALITY_CHECK_CREATE",
            "登记检测结果, QUALITY, CREATE, QUALITY_CHECK_CREATE",
            "录入质量检验, QUALITY, CREATE, QUALITY_CHECK_CREATE"
    })
    void testQualityDomain(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== EQUIPMENT 领域 (10个) ====================

    @ParameterizedTest(name = "[{index}] EQUIPMENT: {0} -> {3}")
    @DisplayName("EQUIPMENT领域测试")
    @CsvSource({
            // 基础查询
            "设备状态, EQUIPMENT, QUERY, EQUIPMENT_STATUS",
            "查看机器运行情况, EQUIPMENT, QUERY, EQUIPMENT_STATUS",
            "机台状态查询, EQUIPMENT, QUERY, EQUIPMENT_STATUS",
            "仪器使用情况, EQUIPMENT, QUERY, EQUIPMENT_STATUS",
            // 故障查询
            "设备故障, EQUIPMENT, QUERY, EQUIPMENT_FAULT",
            "机器异常, EQUIPMENT, QUERY, EQUIPMENT_FAULT",
            "哪些设备有问题, EQUIPMENT, QUERY, EQUIPMENT_FAULT",
            // 统计查询
            "设备数量统计, EQUIPMENT, QUERY, EQUIPMENT_STATS",
            "机器运行统计, EQUIPMENT, QUERY, EQUIPMENT_STATS",
            // 更新操作
            "启动设备, EQUIPMENT, UPDATE, EQUIPMENT_STATUS_UPDATE"
    })
    void testEquipmentDomain(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== PROCESSING 领域 (10个) ====================

    @ParameterizedTest(name = "[{index}] PROCESSING: {0} -> {3}")
    @DisplayName("PROCESSING领域测试")
    @CsvSource({
            // 基础查询
            "生产批次列表, PROCESSING, QUERY, PROCESSING_BATCH_LIST",
            "查看加工单, PROCESSING, QUERY, PROCESSING_BATCH_LIST",
            "今天的生产情况, PROCESSING, QUERY, PROCESSING_BATCH_LIST",
            "车间生产记录, PROCESSING, QUERY, PROCESSING_BATCH_LIST",
            "产线运行情况, PROCESSING, QUERY, PROCESSING_BATCH_LIST",
            // 统计查询
            "生产统计, PROCESSING, QUERY, PROCESSING_STATS",
            "产量汇总, PROCESSING, QUERY, PROCESSING_STATS",
            // 创建操作
            "新建生产批次, PROCESSING, CREATE, PROCESSING_BATCH_CREATE",
            "创建加工单, PROCESSING, CREATE, PROCESSING_BATCH_CREATE",
            // 更新操作
            "完成生产批次, PROCESSING, UPDATE, PROCESSING_BATCH_UPDATE"
    })
    void testProcessingDomain(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== SHIPMENT 领域 (10个) ====================

    @ParameterizedTest(name = "[{index}] SHIPMENT: {0} -> {3}")
    @DisplayName("SHIPMENT领域测试")
    @CsvSource({
            // 基础查询
            "发货记录, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "今天的出货情况, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "物流配送查询, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "出库记录, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "送货单列表, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "运输情况, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "发运状态, SHIPMENT, QUERY, SHIPMENT_QUERY",
            // 创建操作
            "新建发货单, SHIPMENT, CREATE, SHIPMENT_CREATE",
            "登记出货, SHIPMENT, CREATE, SHIPMENT_CREATE",
            "创建配送任务, SHIPMENT, CREATE, SHIPMENT_CREATE"
    })
    void testShipmentDomain(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== ALERT 领域 (8个) ====================

    @ParameterizedTest(name = "[{index}] ALERT: {0} -> {3}")
    @DisplayName("ALERT领域测试")
    @CsvSource({
            // 基础查询
            "告警列表, ALERT, QUERY, ALERT_LIST",
            "查看预警, ALERT, QUERY, ALERT_LIST",
            "报警记录, ALERT, QUERY, ALERT_LIST",
            "警告信息, ALERT, QUERY, ALERT_LIST",
            // 紧急查询
            "紧急告警, ALERT, QUERY, ALERT_CRITICAL",
            "严重预警, ALERT, QUERY, ALERT_CRITICAL",
            // 统计查询
            "告警统计, ALERT, QUERY, ALERT_STATS",
            // 更新操作
            "处理告警, ALERT, UPDATE, ALERT_RESOLVE"
    })
    void testAlertDomain(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== SUPPLIER/CUSTOMER 领域 (6个) ====================

    @ParameterizedTest(name = "[{index}] SUPPLIER/CUSTOMER: {0} -> {3}")
    @DisplayName("SUPPLIER和CUSTOMER领域测试")
    @CsvSource({
            // SUPPLIER
            "供应商列表, SUPPLIER, QUERY, SUPPLIER_QUERY",
            "查看供货商, SUPPLIER, QUERY, SUPPLIER_QUERY",
            "新增供应商, SUPPLIER, CREATE, SUPPLIER_CREATE",
            // CUSTOMER
            "客户列表, CUSTOMER, QUERY, CUSTOMER_QUERY",
            "查看订单, CUSTOMER, QUERY, CUSTOMER_QUERY",
            "新增客户, CUSTOMER, CREATE, CUSTOMER_CREATE"
    })
    void testSupplierCustomerDomain(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== TimeScope 验证 (6个) ====================

    @ParameterizedTest(name = "[{index}] TimeScope: {0} -> {1}")
    @DisplayName("TimeScope分类测试")
    @CsvSource({
            "昨天的入库, PAST",
            "7天内的原料, PAST",
            "上周的考勤, PAST",
            "明天要到的原料, FUTURE",
            "下周的计划, FUTURE",
            "今天出勤情况, PRESENT"
    })
    void testTimeScope(String input, String expectedTimeScope) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(expectedTimeScope, result.getTimeScope(), "TimeScope mismatch for: " + input);
    }
}
