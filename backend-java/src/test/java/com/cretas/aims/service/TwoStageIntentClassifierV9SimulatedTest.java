package com.cretas.aims.service;

import com.cretas.aims.config.IntentCompositionConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * v9.0 多维意图分类模拟测试 - 另外100个测试用例
 *
 * 覆盖更多边界场景：
 * 1. 复杂语句 (20个)
 * 2. 时间组合 (15个)
 * 3. 多领域混合 (15个)
 * 4. 口语化表达 (20个)
 * 5. 否定句和疑问句 (15个)
 * 6. 数量和范围查询 (15个)
 */
@DisplayName("v9.0 多维意图分类模拟测试 - 另外100个用例")
class TwoStageIntentClassifierV9SimulatedTest {

    private TwoStageIntentClassifier classifier;
    private IntentCompositionConfig compositionConfig;

    @BeforeEach
    void setUp() {
        compositionConfig = new IntentCompositionConfig();
        compositionConfig.init();
        classifier = new TwoStageIntentClassifier(compositionConfig, null, null, null);
    }

    // ==================== 复杂语句测试 (20个) ====================

    @ParameterizedTest(name = "[{index}] 复杂语句: {0} -> {3}")
    @DisplayName("复杂语句测试")
    @CsvSource({
            "帮我查一下今天的原料入库情况, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "我想看看最近一周的考勤统计数据, ATTENDANCE, QUERY, ATTENDANCE_STATS",
            "查询一下设备运行状态, EQUIPMENT, QUERY, EQUIPMENT_STATUS",
            "麻烦帮我统计一下本月的质检合格率, QUALITY, QUERY, QUALITY_STATS",
            "需要查看昨天的生产批次情况, PROCESSING, QUERY, PROCESSING_BATCH_LIST",
            "给我看看今天发货记录, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "帮忙查一下系统告警信息, ALERT, QUERY, ALERT_LIST",
            "我想知道供应商的联系信息, SUPPLIER, QUERY, SUPPLIER_QUERY",
            "请帮我新增一条原料入库记录, MATERIAL, CREATE, MATERIAL_BATCH_CREATE",
            "麻烦帮我登记一下今天的质检结果, QUALITY, CREATE, QUALITY_CHECK_CREATE",
            "我要创建一个新的生产批次, PROCESSING, CREATE, PROCESSING_BATCH_CREATE",
            "帮我新建一条发货单, SHIPMENT, CREATE, SHIPMENT_CREATE",
            "请给我添加一个新供应商, SUPPLIER, CREATE, SUPPLIER_CREATE",
            "需要录入一条新的客户信息, CUSTOMER, CREATE, CUSTOMER_CREATE",
            "帮我修改一下设备状态, EQUIPMENT, UPDATE, EQUIPMENT_STATUS_UPDATE",
            "请处理一下这个告警, ALERT, UPDATE, ALERT_RESOLVE",
            "我要查询7天内所有的入库记录, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "帮我看看过去三天的考勤数据, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            "请查一下上个月的质检汇总, QUALITY, QUERY, QUALITY_STATS",
            "给我调出最近一个月的生产数据, PROCESSING, QUERY, PROCESSING_BATCH_LIST"
    })
    void testComplexSentences(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== 时间组合测试 (15个) ====================

    @ParameterizedTest(name = "[{index}] 时间组合: {0} -> TimeScope={1}")
    @DisplayName("时间组合测试")
    @CsvSource({
            "查询今天上午的入库, PRESENT",
            "看看昨天下午的考勤, PAST",
            "明天早上要到的原料, FUTURE",
            "上周一的质检报告, PAST",
            "下周三的生产计划, FUTURE",
            "上个月的发货记录, PAST",
            "过去三天的告警情况, PAST",
            "过去一周的设备状态, PAST",
            "接下来两天的到货预计, FUTURE",
            "5天内的库存变化, PAST",
            "10天前的考勤记录, PAST",
            "3天后要到的物料, FUTURE",
            "上个月的产量统计, PAST",
            "即将到期的原料批次, FUTURE",
            "将要发货的物流, FUTURE"
    })
    void testTimeCombinations(String input, String expectedTimeScope) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(expectedTimeScope, result.getTimeScope(), "TimeScope mismatch for: " + input);
    }

    // ==================== 多领域关键词测试 (15个) ====================

    @ParameterizedTest(name = "[{index}] 领域识别: {0} -> {1}")
    @DisplayName("多领域关键词测试")
    @CsvSource({
            "今天入库了多少批原材料, MATERIAL",
            "这周打卡情况怎么样, ATTENDANCE",
            "质量检验的标准是什么, QUALITY",
            "机器设备运行正常吗, EQUIPMENT",
            "生产线的产能如何, PROCESSING",
            "物流配送要多久, SHIPMENT",
            "有什么预警信息, ALERT",
            "供货商的评级是多少, SUPPLIER",
            "客户信息查询, CUSTOMER",
            "仓库里还有多少库存, MATERIAL",
            "员工签到记录, ATTENDANCE",
            "品控部的检测结果, QUALITY",
            "设备机台状态, EQUIPMENT",
            "加工单的完成情况, PROCESSING",
            "出库物流跟踪, SHIPMENT"
    })
    void testDomainRecognition(String input, String expectedDomain) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
    }

    // ==================== 口语化表达测试 (20个) ====================

    @ParameterizedTest(name = "[{index}] 口语化: {0} -> {3}")
    @DisplayName("口语化表达测试")
    @CsvSource({
            "今天谁来了, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            "有啥原料到货没, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "质检咋样了, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            "机器坏没坏, EQUIPMENT, QUERY, EQUIPMENT_STATUS",
            "发货记录查一下, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "有警报没, ALERT, QUERY, ALERT_LIST",
            "供应商电话多少, SUPPLIER, QUERY, SUPPLIER_QUERY",
            "客户信息查一下, CUSTOMER, QUERY, CUSTOMER_QUERY",
            "帮我打卡, ATTENDANCE, CREATE, CLOCK_IN",
            "我要打个卡, ATTENDANCE, CREATE, CLOCK_IN",
            "帮我签到, ATTENDANCE, CREATE, CLOCK_IN",
            "新增入库单, MATERIAL, CREATE, MATERIAL_BATCH_CREATE",
            "新增质检记录, QUALITY, CREATE, QUALITY_CHECK_CREATE",
            "新增发货单, SHIPMENT, CREATE, SHIPMENT_CREATE",
            "新增供应商, SUPPLIER, CREATE, SUPPLIER_CREATE",
            "处理这个告警, ALERT, UPDATE, ALERT_RESOLVE",
            "启动一下设备, EQUIPMENT, UPDATE, EQUIPMENT_STATUS_UPDATE",
            "最近原料入库情况, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "考勤有没有问题, ATTENDANCE, QUERY, ATTENDANCE_ANOMALY",
            "生产进度怎样了, PROCESSING, QUERY, PROCESSING_BATCH_LIST"
    })
    void testColloquialExpressions(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== 否定和疑问句测试 (15个) ====================

    @ParameterizedTest(name = "[{index}] 否定/疑问: {0} -> {3}")
    @DisplayName("否定句和疑问句测试")
    @CsvSource({
            "谁还没打卡, ATTENDANCE, QUERY, ATTENDANCE_ANOMALY",
            "哪些原料还没入库, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "设备运行有问题, EQUIPMENT, QUERY, EQUIPMENT_FAULT",
            "哪些质检不合格, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            "有多少发货记录, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "有没有告警, ALERT, QUERY, ALERT_LIST",
            "缺勤的人有几个, ATTENDANCE, QUERY, ATTENDANCE_ANOMALY",
            "没来上班的是谁, ATTENDANCE, QUERY, ATTENDANCE_ANOMALY",
            "原料够不够用, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "设备是否正常运行, EQUIPMENT, QUERY, EQUIPMENT_STATUS",
            "质检通过了吗, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            "发货记录有多少, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "有没有紧急告警, ALERT, QUERY, ALERT_CRITICAL",
            "供应商靠谱吗, SUPPLIER, QUERY, SUPPLIER_QUERY",
            "客户信息, CUSTOMER, QUERY, CUSTOMER_QUERY"
    })
    void testNegativeAndQuestions(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== 数量和范围查询测试 (15个) ====================

    @ParameterizedTest(name = "[{index}] 数量/范围: {0} -> Modifier contains STATS={1}")
    @DisplayName("数量和范围查询测试")
    @CsvSource({
            "今天入库了多少批, true",
            "考勤人数有几个, true",
            "质检通过率是多少, true",
            "设备总数有多少, true",
            "生产了多少件, true",
            "发货总量统计, true",
            "告警数量汇总, true",
            "供应商有几家, true",
            "客户订单数量, true",
            "原料库存统计, true",
            "出勤率统计, true",
            "合格率平均值, true",
            "设备运行时长, false",
            "日产量统计, true",
            "月度发货汇总, true"
    })
    void testQuantityQueries(String input, boolean shouldContainStats) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        if (shouldContainStats) {
            assertTrue(result.getModifiers().contains("STATS"),
                    "Should contain STATS modifier for: " + input);
        }
    }
}
