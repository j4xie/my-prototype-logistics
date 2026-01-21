package com.cretas.aims.service;

import com.cretas.aims.config.IntentCompositionConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * v9.0 多维意图分类测试
 *
 * 验证以下关键场景：
 * 1. 基础 Domain + Action 分类 (v8.0 兼容)
 * 2. Modifier 分类 (STATS, ANOMALY, FUTURE, CRITICAL)
 * 3. TimeScope 分类 (PAST, PRESENT, FUTURE)
 * 4. TargetScope 分类 (PERSONAL, DEPARTMENTAL, ALL)
 * 5. 多维组合映射到正确意图
 */
@DisplayName("v9.0 多维意图分类测试")
class TwoStageIntentClassifierV9Test {

    private TwoStageIntentClassifier classifier;
    private IntentCompositionConfig compositionConfig;

    @BeforeEach
    void setUp() {
        compositionConfig = new IntentCompositionConfig();
        compositionConfig.init();
        classifier = new TwoStageIntentClassifier(compositionConfig);
    }

    // ==================== v8.0 兼容性测试 ====================

    @Test
    @DisplayName("v8.0兼容: 基础原料查询")
    void testBasicMaterialQuery() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("查3天内的入库");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.MATERIAL, result.getDomain());
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.QUERY, result.getAction());
        assertEquals("MATERIAL_BATCH_QUERY", result.getComposedIntent());
        assertTrue(result.isSuccessful());
        assertNotNull(result.getModifiers());
    }

    @Test
    @DisplayName("v8.0兼容: 基础考勤查询")
    void testBasicAttendanceQuery() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("今天出勤情况");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE, result.getDomain());
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.QUERY, result.getAction());
        assertEquals("ATTENDANCE_TODAY", result.getComposedIntent());
    }

    // ==================== v9.0 Modifier 分类测试 ====================

    @Test
    @DisplayName("v9.0 Modifier: 统计类查询 - 考勤统计")
    void testStatsModifier_Attendance() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("考勤统计");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE, result.getDomain());
        assertTrue(result.getModifiers().contains("STATS"));
        assertEquals("ATTENDANCE_STATS", result.getComposedIntent());
    }

    @Test
    @DisplayName("v9.0 Modifier: 异常类查询 - 谁没来")
    void testAnomalyModifier_Attendance() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("谁今天没来");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE, result.getDomain());
        assertTrue(result.getModifiers().contains("ANOMALY"));
        assertEquals("ATTENDANCE_ANOMALY", result.getComposedIntent());
    }

    @Test
    @DisplayName("v9.0 Modifier: 个人查询 - 查张三的考勤")
    void testPersonalModifier_Attendance() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("查张三的考勤");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE, result.getDomain());
        assertEquals("PERSONAL", result.getTargetScope());
        assertEquals("ATTENDANCE_HISTORY", result.getComposedIntent());
    }

    @Test
    @DisplayName("v9.0 Modifier: 未来时态 - 明天要到的原料")
    void testFutureModifier_Material() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("明天要到的原料");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.MATERIAL, result.getDomain());
        assertTrue(result.getModifiers().contains("FUTURE"));
        assertEquals("FUTURE", result.getTimeScope());
        assertEquals("MATERIAL_INCOMING", result.getComposedIntent());
    }

    @Test
    @DisplayName("v9.0 Modifier: 统计类查询 - 质检统计")
    void testStatsModifier_Quality() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("统计80分以上的质检");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.QUALITY, result.getDomain());
        assertTrue(result.getModifiers().contains("STATS"));
        assertEquals("QUALITY_STATS", result.getComposedIntent());
    }

    @Test
    @DisplayName("v9.0 Modifier: 关键项查询 - 关键质检项")
    void testCriticalModifier_Quality() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("关键质检项");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.QUALITY, result.getDomain());
        assertTrue(result.getModifiers().contains("CRITICAL"));
        assertEquals("QUALITY_CRITICAL_ITEMS", result.getComposedIntent());
    }

    // ==================== TimeScope 分类测试 ====================

    @Test
    @DisplayName("v9.0 TimeScope: 过去时态 - 昨天")
    void testTimeScope_Past_Yesterday() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("昨天的考勤");
        assertEquals("PAST", result.getTimeScope());
    }

    @Test
    @DisplayName("v9.0 TimeScope: 过去时态 - N天内")
    void testTimeScope_Past_WithinDays() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("查7天内的入库");
        assertEquals("PAST", result.getTimeScope());
    }

    @Test
    @DisplayName("v9.0 TimeScope: 未来时态 - 明天")
    void testTimeScope_Future_Tomorrow() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("明天的计划");
        assertEquals("FUTURE", result.getTimeScope());
    }

    @Test
    @DisplayName("v9.0 TimeScope: 未来时态 - N天后")
    void testTimeScope_Future_AfterDays() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("3天后要到的原料");
        assertEquals("FUTURE", result.getTimeScope());
        assertTrue(result.getModifiers().contains("FUTURE"));
    }

    @Test
    @DisplayName("v9.0 TimeScope: 当前时态 - 默认")
    void testTimeScope_Present_Default() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("设备状态");
        assertEquals("PRESENT", result.getTimeScope());
    }

    // ==================== TargetScope 分类测试 ====================

    @Test
    @DisplayName("v9.0 TargetScope: 个人 - 我的")
    void testTargetScope_Personal_Mine() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("我的考勤记录");
        assertEquals("PERSONAL", result.getTargetScope());
    }

    @Test
    @DisplayName("v9.0 TargetScope: 部门 - 部门")
    void testTargetScope_Departmental() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("部门考勤情况");
        assertEquals("DEPARTMENTAL", result.getTargetScope());
    }

    @Test
    @DisplayName("v9.0 TargetScope: 全部 - 默认")
    void testTargetScope_All_Default() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("考勤情况");
        assertEquals("ALL", result.getTargetScope());
    }

    // ==================== 月度 Modifier 测试 ====================

    @Test
    @DisplayName("v9.0 Modifier: 月度查询 - 本月考勤")
    void testMonthlyModifier_Attendance() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("本月考勤");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE, result.getDomain());
        assertTrue(result.getModifiers().contains("MONTHLY"));
        assertEquals("ATTENDANCE_MONTHLY", result.getComposedIntent());
    }

    // ==================== 参数化测试 ====================

    @ParameterizedTest
    @DisplayName("v9.0 验证用例批量测试")
    @CsvSource({
            "查3天内的入库, MATERIAL, QUERY, MATERIAL_BATCH_QUERY",
            "明天要到的原料, MATERIAL, QUERY, MATERIAL_INCOMING",
            "谁今天没来, ATTENDANCE, QUERY, ATTENDANCE_ANOMALY",
            "考勤统计, ATTENDANCE, QUERY, ATTENDANCE_STATS",
            "统计80分以上的质检, QUALITY, QUERY, QUALITY_STATS",
            "今天出勤情况, ATTENDANCE, QUERY, ATTENDANCE_TODAY",
            "本月考勤, ATTENDANCE, QUERY, ATTENDANCE_MONTHLY",
            "关键质检项, QUALITY, QUERY, QUALITY_CRITICAL_ITEMS"
    })
    void testV9ValidationCases(String input, String expectedDomain,
                                String expectedAction, String expectedIntent) {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(input);

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.valueOf(expectedDomain),
                result.getDomain(), "Domain mismatch for: " + input);
        assertEquals(TwoStageIntentClassifier.ClassifiedAction.valueOf(expectedAction),
                result.getAction(), "Action mismatch for: " + input);
        assertEquals(expectedIntent, result.getComposedIntent(),
                "Intent mismatch for: " + input);
    }

    // ==================== 边界情况测试 ====================

    @Test
    @DisplayName("v9.0 边界: 空输入")
    void testEmptyInput() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.UNKNOWN, result.getDomain());
        assertFalse(result.isSuccessful());
        assertNotNull(result.getModifiers());
        assertTrue(result.getModifiers().isEmpty());
    }

    @Test
    @DisplayName("v9.0 边界: null输入")
    void testNullInput() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify(null);

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.UNKNOWN, result.getDomain());
        assertFalse(result.isSuccessful());
    }

    @Test
    @DisplayName("v9.0 边界: 多个Modifier同时存在")
    void testMultipleModifiers() {
        // 统计 + 异常 (STATS 优先级低于 ANOMALY)
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("统计缺勤的考勤");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE, result.getDomain());
        assertTrue(result.getModifiers().contains("STATS"));
        assertTrue(result.getModifiers().contains("ANOMALY"));
        // ANOMALY 优先级更高，应该映射到 ATTENDANCE_ANOMALY
        assertEquals("ATTENDANCE_ANOMALY", result.getComposedIntent());
    }

    // ==================== 打卡意图测试 ====================

    @Test
    @DisplayName("v9.0: 打卡意图 - 帮我打个卡")
    void testClockIn() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("帮我打个卡");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.ATTENDANCE, result.getDomain());
        // 打卡是 UPDATE/CREATE 操作
        assertTrue(result.getAction() == TwoStageIntentClassifier.ClassifiedAction.CREATE
                || result.getAction() == TwoStageIntentClassifier.ClassifiedAction.UPDATE);
    }

    // ==================== 设备领域测试 ====================

    @Test
    @DisplayName("v9.0 Modifier: 设备故障查询")
    void testAnomalyModifier_Equipment() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("设备故障");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.EQUIPMENT, result.getDomain());
        assertTrue(result.getModifiers().contains("ANOMALY"));
        assertEquals("EQUIPMENT_FAULT", result.getComposedIntent());
    }

    @Test
    @DisplayName("v9.0 Modifier: 设备统计")
    void testStatsModifier_Equipment() {
        TwoStageIntentClassifier.TwoStageResult result = classifier.classify("设备数量统计");

        assertEquals(TwoStageIntentClassifier.ClassifiedDomain.EQUIPMENT, result.getDomain());
        assertTrue(result.getModifiers().contains("STATS"));
        assertEquals("EQUIPMENT_STATS", result.getComposedIntent());
    }
}
