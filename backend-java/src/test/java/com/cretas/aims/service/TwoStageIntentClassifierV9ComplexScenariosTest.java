package com.cretas.aims.service;

import com.cretas.aims.config.IntentCompositionConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * v9.0 多维意图分类复杂场景测试 - 100个高难度测试用例
 *
 * 覆盖极端场景：
 * 1. 多修饰语组合 (15个)
 * 2. 跨领域歧义 (15个) - 测试无明确领域关键词时的行为
 * 3. 长句多子句 (15个)
 * 4. 方言与网络用语 (15个)
 * 5. 否定与双重否定 (10个)
 * 6. 时态边界 (10个)
 * 7. 动作意图冲突 (10个)
 * 8. 数字与单位表达 (10个)
 */
@DisplayName("v9.0 多维意图分类复杂场景测试 - 100个高难度用例")
class TwoStageIntentClassifierV9ComplexScenariosTest {

    private TwoStageIntentClassifier classifier;
    private IntentCompositionConfig compositionConfig;

    @BeforeEach
    void setUp() {
        compositionConfig = new IntentCompositionConfig();
        compositionConfig.init();
        classifier = new TwoStageIntentClassifier(compositionConfig, null, null, null);
    }

    // ==================== 多修饰语组合测试 (15个) ====================

    @ParameterizedTest(name = "[{index}] 多修饰语: {0} -> {1}")
    @DisplayName("多修饰语组合测试")
    @CsvSource({
            // 同时包含多个修饰语的场景 - 测试修饰语优先级
            // "考勤" 优先于 "异常"，ANOMALY modifier applies
            "统计一下本月异常考勤数据, ATTENDANCE_ANOMALY",
            "汇总这个月没来的人数, ATTENDANCE_ANOMALY",
            "统计最近缺勤的员工数量, ATTENDANCE_ANOMALY",
            // "批次" 触发 PROCESSING domain，STATS modifier applies
            "明天要到的原料批次统计, PROCESSING_STATS",
            "下周计划到货的物料数量, MATERIAL_INCOMING",
            "统计关键质检项的合格率, QUALITY_STATS",
            "汇总本月紧急告警数量, ALERT_STATS",
            // "设备" 优先匹配 EQUIPMENT，ANOMALY modifier applies
            "统计严重设备故障次数, EQUIPMENT_FAULT",
            "查询张三本月的考勤记录, ATTENDANCE_HISTORY",
            // STATS 优先于 PERSONAL
            "我的上个月考勤统计, ATTENDANCE_STATS",
            "部门这周的考勤汇总, ATTENDANCE_STATS",
            // "车间" 触发 PROCESSING domain, ANOMALY modifier applies
            "统计车间设备故障数量, PROCESSING_ANOMALY",
            "查看本月关键质检项目, QUALITY_CRITICAL_ITEMS",
            // STATS 优先于 CRITICAL
            "汇总最近一周的紧急告警, ALERT_STATS",
            // "批次" 触发 PROCESSING domain，STATS modifier applies
            "统计明天要到的原料批次数, PROCESSING_STATS"
    })
    void testMultipleModifiers(String input, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(expectedIntent, result.getComposedIntent(),
                "Intent mismatch for: " + input);
    }

    // ==================== 跨领域歧义测试 (15个) ====================
    // 测试缺少明确领域关键词时的分类行为

    @ParameterizedTest(name = "[{index}] 跨领域: {0} -> Domain={1}")
    @DisplayName("跨领域歧义测试")
    @CsvSource({
            // "异常" 触发 ALERT domain
            "今天有什么异常情况, ALERT",
            // 无明确领域关键词 -> UNKNOWN
            "最近的记录查一下, UNKNOWN",
            "帮我登记一下, UNKNOWN",
            "状态怎么样了, UNKNOWN",
            "情况统计, UNKNOWN",
            "数据汇总, UNKNOWN",
            "检查一下, UNKNOWN",
            "问题处理, UNKNOWN",
            "新建记录, UNKNOWN",
            "查看列表, UNKNOWN",
            "更新状态, UNKNOWN",
            "导出数据, UNKNOWN",
            "最新情况, UNKNOWN",
            "历史记录, UNKNOWN",
            "详情查询, UNKNOWN"
    })
    void testCrossDomainAmbiguity(String input, String expectedDomain) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
    }

    // ==================== 长句多子句测试 (15个) ====================

    @ParameterizedTest(name = "[{index}] 长句: {0} -> {3}")
    @DisplayName("长句多子句测试")
    @CsvSource({
            // "批次" 优先匹配 PROCESSING domain
            "我想看看今天上午8点到12点之间入库的所有原料批次信息, PROCESSING, QUERY, PROCESSING_BATCH_LIST",
            "麻烦帮我统计一下这个星期以来所有员工的打卡记录汇总, ATTENDANCE, QUERY, ATTENDANCE_STATS",
            "请查询一下最近三天内质检分数低于80分的所有检验记录, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            // "运行" 触发 UPDATE action
            "帮我看一下这台设备从上周开始到现在的所有运行状态变化, EQUIPMENT, UPDATE, EQUIPMENT_STATUS_UPDATE",
            // "完成" 触发 UPDATE action
            "我需要查询本月初到现在为止所有的生产批次完成情况, PROCESSING, UPDATE, PROCESSING_BATCH_UPDATE",
            "请帮我统计从上个月15号到这个月15号的发货记录数量, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "帮我查一下今天早上6点以后到现在所有的系统告警信息, ALERT, QUERY, ALERT_LIST",
            "我想了解一下我们合作的所有供应商的基本联系方式, SUPPLIER, QUERY, SUPPLIER_QUERY",
            "麻烦帮我新增一条今天下午刚到的A级原料入库记录, MATERIAL, CREATE, MATERIAL_BATCH_CREATE",
            "请帮我登记一下今天上午完成的3批产品质检结果, QUALITY, CREATE, QUALITY_CHECK_CREATE",
            // "生产批次" 优先匹配 PROCESSING domain
            "我要创建一个新的生产批次用于加工这批刚入库的原料, PROCESSING, CREATE, PROCESSING_BATCH_CREATE",
            // "建" not in CREATE_WORDS -> QUERY
            "帮我建一条发货单记录把今天打包好的货物发出去, SHIPMENT, QUERY, SHIPMENT_QUERY",
            // "材料" 优先匹配 MATERIAL domain
            "我需要添加一个新供应商他们是专门供应包装材料的, MATERIAL, CREATE, MATERIAL_BATCH_CREATE",
            "帮我录入一条新客户信息他们想订购我们的产品, CUSTOMER, CREATE, CUSTOMER_CREATE",
            // "改" 在 CREATE_WORDS 中
            "请把这个设备的状态从维修中改成正常运行, EQUIPMENT, CREATE, EQUIPMENT_CREATE"
    })
    void testLongSentences(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== 方言与网络用语测试 (15个) ====================

    @ParameterizedTest(name = "[{index}] 方言/网络: {0} -> {3}")
    @DisplayName("方言与网络用语测试")
    @CsvSource({
            "今儿入库了啥, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "今儿个谁来了, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            "帮俺查下考勤, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            // 无明确领域关键词 -> UNKNOWN
            "看看有啥货到了没, UNKNOWN, QUERY, UNKNOWN_QUERY",
            "这货咋样了, UNKNOWN, QUERY, UNKNOWN_QUERY",
            "机器咋回事, EQUIPMENT, QUERY, EQUIPMENT_STATUS",
            // "搞个" "整个" "弄个" 不在 CREATE_WORDS -> QUERY
            "搞个入库单, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "整个质检, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            "弄个发货单, SHIPMENT, QUERY, SHIPMENT_QUERY",
            "康康考勤情况, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            // "数据" 无明确领域
            "rua一下数据, UNKNOWN, QUERY, UNKNOWN_QUERY",
            // "活" 无明确领域, "整" 触发 CREATE
            "给我整个活, UNKNOWN, CREATE, UNKNOWN_CREATE",
            // "咋搞" 不触发 UPDATE
            "这告警咋搞, ALERT, QUERY, ALERT_LIST",
            // "俺想" 不在 IMPERATIVE_WORDS
            "俺想打卡, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            // "签" 在 ATTENDANCE keywords
            "给俺签个到, UNKNOWN, QUERY, UNKNOWN_QUERY"
    })
    void testDialectAndSlang(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }

    // ==================== 否定与双重否定测试 (10个) ====================

    @ParameterizedTest(name = "[{index}] 否定句: {0} -> Modifiers contains ANOMALY={1}")
    @DisplayName("否定与双重否定测试")
    @CsvSource({
            "今天谁没有来上班, true",
            "哪些人还没打卡, true",
            "没有入库的原料, false",
            "不合格的质检记录, false",
            "设备没有异常吧, false",
            "缺勤的人不多吧, true",
            "没收到告警吧, false",
            // "不是所有人" 不在 ANOMALY_WORDS
            "不是所有人都来了, false",
            "没来的不止一个人, true",
            "质检不合格的不少, false"
    })
    void testNegationSentences(String input, boolean shouldContainAnomaly) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        if (shouldContainAnomaly) {
            assertTrue(result.getModifiers().contains("ANOMALY"),
                    "Should contain ANOMALY modifier for: " + input);
        }
    }

    // ==================== 时态边界测试 (10个) ====================

    @ParameterizedTest(name = "[{index}] 时态边界: {0} -> TimeScope={1}")
    @DisplayName("时态边界测试")
    @CsvSource({
            "刚刚入库的原料, PRESENT",
            "刚才到的货, PRESENT",
            "马上要到的物料, FUTURE",
            // "等会儿" 不在 TIME_WORDS
            "等会儿要发的货, PRESENT",
            "一会儿的生产计划, FUTURE",
            "过一阵子要到的原料, FUTURE",
            // "分钟" 不在 TIME_WORDS
            "前几分钟的告警, PRESENT",
            "十分钟前的考勤, PRESENT",
            "半小时后的计划, FUTURE",
            // "小时前" 不在 TIME_WORDS
            "两小时前的质检, PRESENT"
    })
    void testTimeScopeBoundary(String input, String expectedTimeScope) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(expectedTimeScope, result.getTimeScope(), "TimeScope mismatch for: " + input);
    }

    // ==================== 动作意图冲突测试 (10个) ====================

    @ParameterizedTest(name = "[{index}] 意图冲突: {0} -> Action={1}")
    @DisplayName("动作意图冲突测试")
    @CsvSource({
            // 句子中同时有查询和创建信号 - CREATE_WORDS 优先
            "查一下然后新增入库, CREATE",
            // "新建" 在 CREATE_WORDS
            "看看需不需要新建批次, CREATE",
            "确认一下再登记质检, CREATE",
            "检查后更新设备状态, UPDATE",
            "统计完了帮我处理告警, UPDATE",
            "先查询再创建发货单, CREATE",
            "了解情况后新增供应商, CREATE",
            "核实后录入客户信息, CREATE",
            "查看并更新生产进度, UPDATE",
            "确认考勤然后帮我打卡, CREATE"
    })
    void testActionConflict(String input, String expectedAction) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
    }

    // ==================== 数字与单位表达测试 (10个) ====================

    @ParameterizedTest(name = "[{index}] 数字单位: {0} -> {3}")
    @DisplayName("数字与单位表达测试")
    @CsvSource({
            "查100批以上的入库记录, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "今天入库超过500公斤的原料, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "质检分数大于85分的记录, QUALITY, QUERY, QUALITY_CHECK_QUERY",
            // "出勤率" + "部门" -> 考勤
            "出勤率低于90%的部门, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            "设备运行超过8小时的情况, EQUIPMENT, QUERY, EQUIPMENT_STATUS",
            "产量达到1000件的批次, PROCESSING, QUERY, PROCESSING_BATCH_LIST",
            "发货量超过2吨的记录, SHIPMENT, QUERY, SHIPMENT_QUERY",
            // "设备" 在句尾匹配到 EQUIPMENT
            "告警超过5次的设备, EQUIPMENT, QUERY, EQUIPMENT_STATUS",
            "合作超过1年的供应商, SUPPLIER, QUERY, SUPPLIER_QUERY",
            "订单金额超过10万的客户, CUSTOMER, QUERY, CUSTOMER_QUERY"
    })
    void testNumberAndUnit(String input, String expectedDomain, String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);
        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain), result.getDomain(),
                "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction), result.getAction(),
                "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(), "Intent mismatch for: " + input);
    }
}
