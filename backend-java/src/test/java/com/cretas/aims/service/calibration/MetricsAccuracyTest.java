package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics.PeriodType;
import com.cretas.aims.entity.calibration.ToolReliabilityStats;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 指标计算精度测试
 *
 * 验证行为校准服务中各项指标的计算准确性：
 * - 成功率 (successRate) = successCount / totalCalls * 100
 * - 冗余率 (redundancyRate) = redundantCalls / totalCalls * 100
 * - 恢复率 (recoveryRate) = recoveredCalls / failedCalls * 100
 * - 综合得分 (compositeScore) = 权重加权平均
 *
 * 测试重点：
 * 1. BigDecimal精度控制
 * 2. 除零保护
 * 3. 舍入行为
 * 4. 边界值处理
 * 5. 浮点数精度问题
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@DisplayName("指标计算精度测试 - MetricsAccuracyTest")
class MetricsAccuracyTest {

    // 测试用常量
    private static final String TEST_FACTORY_ID = "F001";
    private static final LocalDate TEST_DATE = LocalDate.of(2026, 1, 19);

    // 精度常量
    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    // 综合得分权重
    private static final BigDecimal WEIGHT_CONCISENESS = new BigDecimal("0.3");
    private static final BigDecimal WEIGHT_SUCCESS_RATE = new BigDecimal("0.5");
    private static final BigDecimal WEIGHT_EFFICIENCY = new BigDecimal("0.2");

    /**
     * 成功率计算精度测试
     * 公式: successRate = successfulCalls / totalCalls * 100
     */
    @Nested
    @DisplayName("成功率计算精度测试")
    class SuccessRateAccuracyTest {

        @ParameterizedTest(name = "成功{0}次/总共{1}次 = {2}%")
        @DisplayName("成功率计算 - 精确到0.01%")
        @CsvSource({
            // 整数结果
            "100, 100, 100.00",
            "50, 100, 50.00",
            "0, 100, 0.00",
            // 需要舍入的结果
            "1, 3, 33.33",
            "2, 3, 66.67",
            "1, 7, 14.29",
            "6, 7, 85.71",
            // 小数点后两位精度
            "333, 1000, 33.30",
            "667, 1000, 66.70",
            // 极端比例
            "1, 10000, 0.01",
            "9999, 10000, 99.99"
        })
        void calculateSuccessRate_PrecisionTest(int successful, int total, String expectedRate) {
            // 准备测试数据
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(total, successful, 0, 0);

            // 执行计算
            metrics.calculateScores();

            // 验证精度
            BigDecimal expected = new BigDecimal(expectedRate);
            assertEquals(0, expected.compareTo(metrics.getSuccessRate()),
                String.format("成功率计算错误: 期望 %s, 实际 %s", expectedRate, metrics.getSuccessRate()));
        }

        @Test
        @DisplayName("成功率计算 - 1/3精度验证 (循环小数)")
        void calculateSuccessRate_RecurringDecimal() {
            // 1/3 = 0.333... -> 33.33%
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(3, 1, 0, 0);
            metrics.calculateScores();

            // 验证使用HALF_UP舍入
            assertEquals(new BigDecimal("33.33"), metrics.getSuccessRate());
        }

        @Test
        @DisplayName("成功率计算 - 2/3精度验证 (循环小数)")
        void calculateSuccessRate_TwoThirds() {
            // 2/3 = 0.666... -> 66.67% (HALF_UP)
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(3, 2, 0, 0);
            metrics.calculateScores();

            assertEquals(new BigDecimal("66.67"), metrics.getSuccessRate());
        }

        @Test
        @DisplayName("成功率计算 - 极小概率 0.01%")
        void calculateSuccessRate_VerySmallRate() {
            // 1/10000 = 0.01%
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(10000, 1, 0, 0);
            metrics.calculateScores();

            assertEquals(new BigDecimal("0.01"), metrics.getSuccessRate());
        }

        @Test
        @DisplayName("成功率计算 - 极高概率 99.99%")
        void calculateSuccessRate_VeryHighRate() {
            // 9999/10000 = 99.99%
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(10000, 9999, 0, 0);
            metrics.calculateScores();

            assertEquals(new BigDecimal("99.99"), metrics.getSuccessRate());
        }
    }

    /**
     * 冗余率计算边界测试
     * 公式: redundancyRate = redundantCalls / totalCalls * 100
     */
    @Nested
    @DisplayName("冗余率计算边界测试")
    class RedundancyRateEdgeCaseTest {

        @Test
        @DisplayName("冗余率计算 - 全部冗余 (100%)")
        void calculateRedundancyRate_AllRedundant() {
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(100, 0, 100, 0);
            metrics.calculateScores();

            // 简洁性 = (100 - 100) / 100 * 100 = 0%
            assertEquals(new BigDecimal("0.00"), metrics.getConcisenessScore());
        }

        @Test
        @DisplayName("冗余率计算 - 无冗余 (0%)")
        void calculateRedundancyRate_NoRedundant() {
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(100, 100, 0, 0);
            metrics.calculateScores();

            // 简洁性 = (100 - 0) / 100 * 100 = 100%
            assertEquals(new BigDecimal("100.00"), metrics.getConcisenessScore());
        }

        @Test
        @DisplayName("冗余率计算 - 部分冗余 (30%)")
        void calculateRedundancyRate_PartialRedundant() {
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(100, 70, 30, 0);
            metrics.calculateScores();

            // 简洁性 = (100 - 30) / 100 * 100 = 70%
            assertEquals(new BigDecimal("70.00"), metrics.getConcisenessScore());
        }

        @ParameterizedTest(name = "冗余{0}次/总共{1}次 -> 简洁性{2}%")
        @DisplayName("简洁性得分计算 - 多种边界情况")
        @CsvSource({
            "0, 100, 100.00",
            "1, 100, 99.00",
            "50, 100, 50.00",
            "99, 100, 1.00",
            "100, 100, 0.00",
            // 精度测试
            "33, 100, 67.00",
            "67, 100, 33.00",
            // 循环小数
            "1, 3, 66.67",
            "2, 3, 33.33"
        })
        void calculateConcisenessScore_EdgeCases(int redundant, int total, String expectedScore) {
            BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
                .factoryId(TEST_FACTORY_ID)
                .metricDate(TEST_DATE)
                .periodType(PeriodType.DAILY)
                .totalCalls(total)
                .successfulCalls(total - redundant)
                .failedCalls(0)
                .redundantCalls(redundant)
                .recoveredCalls(0)
                .totalInputTokens(1000L)
                .totalOutputTokens(500L)
                .build();

            metrics.calculateScores();

            BigDecimal expected = new BigDecimal(expectedScore);
            assertEquals(0, expected.compareTo(metrics.getConcisenessScore()),
                String.format("简洁性得分计算错误: 期望 %s, 实际 %s", expectedScore, metrics.getConcisenessScore()));
        }
    }

    /**
     * 恢复率公式验证测试
     * 公式: recoveryRate = recoveredCalls / failedCalls * 100
     */
    @Nested
    @DisplayName("恢复率公式验证测试")
    class RecoveryRateFormulaTest {

        @Test
        @DisplayName("恢复率计算 - 全部恢复 (100%)")
        void calculateRecoveryRate_AllRecovered() {
            int failedCalls = 10;
            int recoveredCalls = 10;

            BigDecimal recoveryRate = calculateRecoveryRate(failedCalls, recoveredCalls);

            assertEquals(new BigDecimal("100.00"), recoveryRate);
        }

        @Test
        @DisplayName("恢复率计算 - 部分恢复 (50%)")
        void calculateRecoveryRate_PartiallyRecovered() {
            int failedCalls = 10;
            int recoveredCalls = 5;

            BigDecimal recoveryRate = calculateRecoveryRate(failedCalls, recoveredCalls);

            assertEquals(new BigDecimal("50.00"), recoveryRate);
        }

        @Test
        @DisplayName("恢复率计算 - 无恢复 (0%)")
        void calculateRecoveryRate_NoneRecovered() {
            int failedCalls = 10;
            int recoveredCalls = 0;

            BigDecimal recoveryRate = calculateRecoveryRate(failedCalls, recoveredCalls);

            assertEquals(new BigDecimal("0.00"), recoveryRate);
        }

        @ParameterizedTest(name = "恢复{0}次/失败{1}次 = {2}%")
        @DisplayName("恢复率计算 - 精度验证")
        @CsvSource({
            "1, 3, 33.33",
            "2, 3, 66.67",
            "1, 7, 14.29",
            "3, 7, 42.86",
            "1, 9, 11.11",
            "8, 9, 88.89"
        })
        void calculateRecoveryRate_PrecisionTest(int recovered, int failed, String expectedRate) {
            BigDecimal recoveryRate = calculateRecoveryRate(failed, recovered);

            BigDecimal expected = new BigDecimal(expectedRate);
            assertEquals(0, expected.compareTo(recoveryRate),
                String.format("恢复率计算错误: 期望 %s, 实际 %s", expectedRate, recoveryRate));
        }

        /**
         * 恢复率计算辅助方法
         */
        private BigDecimal calculateRecoveryRate(int failedCalls, int recoveredCalls) {
            if (failedCalls == 0) {
                return BigDecimal.ZERO;
            }
            return BigDecimal.valueOf(recoveredCalls)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(failedCalls), SCALE, ROUNDING_MODE);
        }
    }

    /**
     * 综合得分计算（加权平均）测试
     * 公式: compositeScore = conciseness * 0.3 + successRate * 0.5 + efficiency * 0.2
     */
    @Nested
    @DisplayName("综合得分计算（加权平均）测试")
    class CompositeScoreWeightedAverageTest {

        @Test
        @DisplayName("综合得分计算 - 全满分100")
        void calculateCompositeScore_AllPerfect() {
            // 简洁性100% + 成功率100% + 效率100%
            // = 100*0.3 + 100*0.5 + 100*0.2 = 30 + 50 + 20 = 100
            BehaviorCalibrationMetrics metrics = createMetricsWithFullScores(100, 100, 100);

            BigDecimal compositeScore = calculateCompositeScore(
                new BigDecimal("100"), new BigDecimal("100"), new BigDecimal("100"));

            assertEquals(new BigDecimal("100.00"), compositeScore);
        }

        @Test
        @DisplayName("综合得分计算 - 全零分0")
        void calculateCompositeScore_AllZero() {
            // 简洁性0% + 成功率0% + 效率0%
            // = 0*0.3 + 0*0.5 + 0*0.2 = 0
            BigDecimal compositeScore = calculateCompositeScore(
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

            assertEquals(new BigDecimal("0.00"), compositeScore);
        }

        @Test
        @DisplayName("综合得分计算 - 仅成功率满分")
        void calculateCompositeScore_OnlySuccessRatePerfect() {
            // 简洁性0% + 成功率100% + 效率0%
            // = 0*0.3 + 100*0.5 + 0*0.2 = 50
            BigDecimal compositeScore = calculateCompositeScore(
                BigDecimal.ZERO, new BigDecimal("100"), BigDecimal.ZERO);

            assertEquals(new BigDecimal("50.00"), compositeScore);
        }

        @Test
        @DisplayName("综合得分计算 - 仅简洁性满分")
        void calculateCompositeScore_OnlyConcisenessPerfect() {
            // 简洁性100% + 成功率0% + 效率0%
            // = 100*0.3 + 0*0.5 + 0*0.2 = 30
            BigDecimal compositeScore = calculateCompositeScore(
                new BigDecimal("100"), BigDecimal.ZERO, BigDecimal.ZERO);

            assertEquals(new BigDecimal("30.00"), compositeScore);
        }

        @Test
        @DisplayName("综合得分计算 - 仅效率满分")
        void calculateCompositeScore_OnlyEfficiencyPerfect() {
            // 简洁性0% + 成功率0% + 效率100%
            // = 0*0.3 + 0*0.5 + 100*0.2 = 20
            BigDecimal compositeScore = calculateCompositeScore(
                BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("100"));

            assertEquals(new BigDecimal("20.00"), compositeScore);
        }

        @ParameterizedTest(name = "简洁性{0}% + 成功率{1}% + 效率{2}% = {3}")
        @DisplayName("综合得分计算 - 多种组合验证")
        @CsvSource({
            "100, 100, 100, 100.00",
            "0, 0, 0, 0.00",
            "50, 50, 50, 50.00",
            "80, 90, 70, 83.00",  // 80*0.3 + 90*0.5 + 70*0.2 = 24 + 45 + 14 = 83
            "95, 85, 75, 86.00",  // 95*0.3 + 85*0.5 + 75*0.2 = 28.5 + 42.5 + 15 = 86
            "33.33, 66.67, 50.00, 53.33"  // 33.33*0.3 + 66.67*0.5 + 50*0.2 = 10 + 33.335 + 10 = 53.335
        })
        void calculateCompositeScore_VariousCombinations(
                String conciseness, String successRate, String efficiency, String expectedScore) {
            BigDecimal compositeScore = calculateCompositeScore(
                new BigDecimal(conciseness),
                new BigDecimal(successRate),
                new BigDecimal(efficiency));

            BigDecimal expected = new BigDecimal(expectedScore);
            assertEquals(0, expected.compareTo(compositeScore),
                String.format("综合得分计算错误: 期望 %s, 实际 %s", expectedScore, compositeScore));
        }

        @Test
        @DisplayName("综合得分权重验证 - 权重之和等于1.0")
        void validateWeights_SumEqualsOne() {
            BigDecimal weightSum = WEIGHT_CONCISENESS.add(WEIGHT_SUCCESS_RATE).add(WEIGHT_EFFICIENCY);
            assertEquals(0, new BigDecimal("1.0").compareTo(weightSum),
                "权重之和应等于1.0");
        }

        /**
         * 综合得分计算辅助方法
         */
        private BigDecimal calculateCompositeScore(BigDecimal conciseness, BigDecimal successRate, BigDecimal efficiency) {
            return conciseness.multiply(WEIGHT_CONCISENESS)
                .add(successRate.multiply(WEIGHT_SUCCESS_RATE))
                .add(efficiency.multiply(WEIGHT_EFFICIENCY))
                .setScale(SCALE, ROUNDING_MODE);
        }
    }

    /**
     * Token消耗计算测试
     */
    @Nested
    @DisplayName("Token消耗计算测试")
    class TokenConsumptionCalculationTest {

        // 基准Token消耗：每次调用1000 tokens
        private static final int BASELINE_TOKENS_PER_CALL = 1000;

        @Test
        @DisplayName("推理效率计算 - 基准消耗 (100%)")
        void calculateReasoningEfficiency_BaselineConsumption() {
            // 每次调用1000 tokens -> 效率100%
            BehaviorCalibrationMetrics metrics = createMetricsWithTokens(10, 5000L, 5000L);
            metrics.calculateScores();

            // 总tokens = 10000, 平均 = 1000, 效率 = 1000/1000 * 100 = 100%
            assertEquals(new BigDecimal("100.00"), metrics.getReasoningEfficiency());
        }

        @Test
        @DisplayName("推理效率计算 - 低于基准消耗 (>100% 但限制为100%)")
        void calculateReasoningEfficiency_BelowBaseline() {
            // 每次调用500 tokens -> 效率应为100%（上限）
            BehaviorCalibrationMetrics metrics = createMetricsWithTokens(10, 2500L, 2500L);
            metrics.calculateScores();

            // 总tokens = 5000, 平均 = 500, 效率 = 1000/500 * 100 = 200% -> 限制为100%
            assertEquals(new BigDecimal("100.00"), metrics.getReasoningEfficiency());
        }

        @Test
        @DisplayName("推理效率计算 - 高于基准消耗 (50%)")
        void calculateReasoningEfficiency_AboveBaseline() {
            // 每次调用2000 tokens -> 效率50%
            BehaviorCalibrationMetrics metrics = createMetricsWithTokens(10, 10000L, 10000L);
            metrics.calculateScores();

            // 总tokens = 20000, 平均 = 2000, 效率 = 1000/2000 * 100 = 50%
            assertEquals(new BigDecimal("50.00"), metrics.getReasoningEfficiency());
        }

        @ParameterizedTest(name = "总调用{0}次，输入{1}tokens，输出{2}tokens -> 效率{3}%")
        @DisplayName("推理效率计算 - 多种消耗场景")
        @CsvSource({
            "10, 5000, 5000, 100.00",   // 平均1000 -> 100%
            "10, 10000, 10000, 50.00",  // 平均2000 -> 50%
            "10, 2000, 3000, 100.00",   // 平均500 -> 200%(限制100%)
            "100, 50000, 50000, 100.00", // 平均1000 -> 100%
            "1, 1500, 500, 50.00"       // 平均2000 -> 50%
        })
        void calculateReasoningEfficiency_VariousScenarios(
                int calls, long inputTokens, long outputTokens, String expectedEfficiency) {
            BehaviorCalibrationMetrics metrics = createMetricsWithTokens(calls, inputTokens, outputTokens);
            metrics.calculateScores();

            BigDecimal expected = new BigDecimal(expectedEfficiency);
            assertEquals(0, expected.compareTo(metrics.getReasoningEfficiency()),
                String.format("推理效率计算错误: 期望 %s, 实际 %s", expectedEfficiency, metrics.getReasoningEfficiency()));
        }

        @Test
        @DisplayName("Token累加测试 - 多次增量")
        void addTokens_IncrementalAddition() {
            BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
                .factoryId(TEST_FACTORY_ID)
                .metricDate(TEST_DATE)
                .periodType(PeriodType.DAILY)
                .totalInputTokens(0L)
                .totalOutputTokens(0L)
                .build();

            // 累加多次
            metrics.addTokens(100, 50);
            metrics.addTokens(200, 100);
            metrics.addTokens(300, 150);

            assertEquals(600L, metrics.getTotalInputTokens());
            assertEquals(300L, metrics.getTotalOutputTokens());
        }
    }

    /**
     * BigDecimal舍入行为测试
     */
    @Nested
    @DisplayName("BigDecimal舍入行为测试")
    class RoundingBehaviorTest {

        @Test
        @DisplayName("舍入模式 - HALF_UP 正数边界值")
        void roundingMode_HalfUp_PositiveBoundary() {
            // 0.005 -> 0.01 (HALF_UP)
            BigDecimal value = new BigDecimal("0.005");
            BigDecimal rounded = value.setScale(2, RoundingMode.HALF_UP);

            assertEquals(new BigDecimal("0.01"), rounded);
        }

        @Test
        @DisplayName("舍入模式 - HALF_UP 低于边界值")
        void roundingMode_HalfUp_BelowBoundary() {
            // 0.004 -> 0.00 (HALF_UP)
            BigDecimal value = new BigDecimal("0.004");
            BigDecimal rounded = value.setScale(2, RoundingMode.HALF_UP);

            assertEquals(new BigDecimal("0.00"), rounded);
        }

        @Test
        @DisplayName("舍入模式 - HALF_UP 高于边界值")
        void roundingMode_HalfUp_AboveBoundary() {
            // 0.006 -> 0.01 (HALF_UP)
            BigDecimal value = new BigDecimal("0.006");
            BigDecimal rounded = value.setScale(2, RoundingMode.HALF_UP);

            assertEquals(new BigDecimal("0.01"), rounded);
        }

        @ParameterizedTest(name = "{0} 舍入后 = {1}")
        @DisplayName("舍入精度 - 小数点后两位")
        @CsvSource({
            "33.333, 33.33",
            "33.335, 33.34",
            "66.665, 66.67",
            "66.664, 66.66",
            "99.995, 100.00",
            "0.005, 0.01",
            "0.004, 0.00"
        })
        void roundingPrecision_TwoDecimalPlaces(String input, String expected) {
            BigDecimal value = new BigDecimal(input);
            BigDecimal rounded = value.setScale(SCALE, ROUNDING_MODE);

            assertEquals(new BigDecimal(expected), rounded);
        }
    }

    /**
     * 除零保护测试
     */
    @Nested
    @DisplayName("除零保护测试")
    class DivisionByZeroHandlingTest {

        @Test
        @DisplayName("除零保护 - 总调用为0时成功率返回0")
        void divisionByZero_ZeroTotalCalls_SuccessRateIsZero() {
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(0, 0, 0, 0);
            metrics.calculateScores();

            assertEquals(BigDecimal.ZERO, metrics.getSuccessRate());
        }

        @Test
        @DisplayName("除零保护 - 总调用为0时简洁性返回0")
        void divisionByZero_ZeroTotalCalls_ConcisenessIsZero() {
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(0, 0, 0, 0);
            metrics.calculateScores();

            assertEquals(BigDecimal.ZERO, metrics.getConcisenessScore());
        }

        @Test
        @DisplayName("除零保护 - 总调用为0时综合得分返回0")
        void divisionByZero_ZeroTotalCalls_CompositeScoreIsZero() {
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(0, 0, 0, 0);
            metrics.calculateScores();

            assertEquals(BigDecimal.ZERO, metrics.getCompositeScore());
        }

        @Test
        @DisplayName("除零保护 - 失败调用为0时恢复率处理")
        void divisionByZero_ZeroFailedCalls_RecoveryRateHandling() {
            // 没有失败调用时，恢复率无意义，应返回0或不计算
            int failedCalls = 0;
            int recoveredCalls = 0;

            BigDecimal recoveryRate = (failedCalls == 0) ? BigDecimal.ZERO :
                BigDecimal.valueOf(recoveredCalls)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(failedCalls), SCALE, ROUNDING_MODE);

            assertEquals(BigDecimal.ZERO, recoveryRate);
        }

        @Test
        @DisplayName("除零保护 - null值处理")
        void divisionByZero_NullValues() {
            BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
                .factoryId(TEST_FACTORY_ID)
                .metricDate(TEST_DATE)
                .periodType(PeriodType.DAILY)
                .totalCalls(null)
                .successfulCalls(null)
                .failedCalls(null)
                .redundantCalls(null)
                .recoveredCalls(null)
                .build();

            // 不应抛出异常
            assertDoesNotThrow(() -> metrics.calculateScores());

            assertEquals(BigDecimal.ZERO, metrics.getSuccessRate());
            assertEquals(BigDecimal.ZERO, metrics.getConcisenessScore());
        }
    }

    /**
     * 百分比范围测试 (0-100)
     */
    @Nested
    @DisplayName("百分比范围测试 (0-100)")
    class PercentageRangeTest {

        @Test
        @DisplayName("百分比范围 - 成功率最小值0%")
        void percentageRange_SuccessRate_MinValue() {
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(100, 0, 0, 0);
            metrics.calculateScores();

            assertTrue(metrics.getSuccessRate().compareTo(BigDecimal.ZERO) >= 0,
                "成功率不应小于0%");
        }

        @Test
        @DisplayName("百分比范围 - 成功率最大值100%")
        void percentageRange_SuccessRate_MaxValue() {
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(100, 100, 0, 0);
            metrics.calculateScores();

            assertTrue(metrics.getSuccessRate().compareTo(new BigDecimal("100")) <= 0,
                "成功率不应大于100%");
        }

        @Test
        @DisplayName("百分比范围 - 简洁性分数范围验证")
        void percentageRange_ConcisenessScore_Range() {
            // 最小值
            BehaviorCalibrationMetrics metricsMin = createMetricsWithCalls(100, 0, 100, 0);
            metricsMin.calculateScores();
            assertTrue(metricsMin.getConcisenessScore().compareTo(BigDecimal.ZERO) >= 0);

            // 最大值
            BehaviorCalibrationMetrics metricsMax = createMetricsWithCalls(100, 100, 0, 0);
            metricsMax.calculateScores();
            assertTrue(metricsMax.getConcisenessScore().compareTo(new BigDecimal("100")) <= 0);
        }

        @Test
        @DisplayName("百分比范围 - 推理效率上限100%")
        void percentageRange_ReasoningEfficiency_MaxCapped() {
            // 即使计算结果超过100%，也应限制为100%
            BehaviorCalibrationMetrics metrics = createMetricsWithTokens(10, 500L, 500L);
            metrics.setTotalCalls(10);
            metrics.setSuccessfulCalls(10);
            metrics.calculateScores();

            assertTrue(metrics.getReasoningEfficiency().compareTo(new BigDecimal("100")) <= 0,
                "推理效率不应超过100%");
        }

        @Test
        @DisplayName("百分比范围 - 综合得分范围验证")
        void percentageRange_CompositeScore_Range() {
            // 测试极端情况下综合得分仍在0-100范围内
            BehaviorCalibrationMetrics metricsMin = createMetricsWithCalls(100, 0, 100, 0);
            metricsMin.setTotalInputTokens(100000L);
            metricsMin.setTotalOutputTokens(100000L);
            metricsMin.calculateScores();

            assertTrue(metricsMin.getCompositeScore().compareTo(BigDecimal.ZERO) >= 0,
                "综合得分最小值应>=0");

            BehaviorCalibrationMetrics metricsMax = createMetricsWithCalls(100, 100, 0, 0);
            metricsMax.setTotalInputTokens(500L);
            metricsMax.setTotalOutputTokens(500L);
            metricsMax.calculateScores();

            assertTrue(metricsMax.getCompositeScore().compareTo(new BigDecimal("100")) <= 0,
                "综合得分最大值应<=100");
        }
    }

    /**
     * 累计指标聚合测试
     */
    @Nested
    @DisplayName("累计指标聚合测试")
    class CumulativeMetricsAggregationTest {

        @Test
        @DisplayName("累计聚合 - 多日指标求和")
        void aggregateMetrics_SumMultipleDays() {
            List<BehaviorCalibrationMetrics> dailyMetrics = new ArrayList<>();

            // 创建7天的指标数据
            for (int i = 0; i < 7; i++) {
                dailyMetrics.add(createMetricsWithCalls(100, 90, 10, 5));
            }

            // 聚合计算
            int totalCalls = dailyMetrics.stream()
                .mapToInt(m -> m.getTotalCalls() != null ? m.getTotalCalls() : 0)
                .sum();
            int successfulCalls = dailyMetrics.stream()
                .mapToInt(m -> m.getSuccessfulCalls() != null ? m.getSuccessfulCalls() : 0)
                .sum();
            int redundantCalls = dailyMetrics.stream()
                .mapToInt(m -> m.getRedundantCalls() != null ? m.getRedundantCalls() : 0)
                .sum();

            assertEquals(700, totalCalls);
            assertEquals(630, successfulCalls);
            assertEquals(70, redundantCalls);
        }

        @Test
        @DisplayName("累计聚合 - Token消耗累加")
        void aggregateMetrics_SumTokenConsumption() {
            List<BehaviorCalibrationMetrics> dailyMetrics = new ArrayList<>();

            // 创建3天的指标数据
            dailyMetrics.add(createMetricsWithTokens(10, 5000L, 3000L));
            dailyMetrics.add(createMetricsWithTokens(20, 10000L, 6000L));
            dailyMetrics.add(createMetricsWithTokens(15, 7500L, 4500L));

            long totalInputTokens = dailyMetrics.stream()
                .mapToLong(m -> m.getTotalInputTokens() != null ? m.getTotalInputTokens() : 0L)
                .sum();
            long totalOutputTokens = dailyMetrics.stream()
                .mapToLong(m -> m.getTotalOutputTokens() != null ? m.getTotalOutputTokens() : 0L)
                .sum();

            assertEquals(22500L, totalInputTokens);
            assertEquals(13500L, totalOutputTokens);
        }

        @Test
        @DisplayName("累计聚合 - 重新计算聚合后的比率")
        void aggregateMetrics_RecalculateRates() {
            // 模拟3天数据聚合
            int day1Total = 100, day1Success = 80;
            int day2Total = 150, day2Success = 140;
            int day3Total = 200, day3Success = 180;

            int totalCalls = day1Total + day2Total + day3Total; // 450
            int totalSuccess = day1Success + day2Success + day3Success; // 400

            // 聚合后重新计算成功率
            BigDecimal aggregatedSuccessRate = BigDecimal.valueOf(totalSuccess)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(totalCalls), SCALE, ROUNDING_MODE);

            // 400/450 = 88.89%
            assertEquals(new BigDecimal("88.89"), aggregatedSuccessRate);
        }
    }

    /**
     * 日/周/月聚合精度测试
     */
    @Nested
    @DisplayName("日/周/月聚合精度测试")
    class DailyWeeklyMonthlyAggregationTest {

        @Test
        @DisplayName("周聚合精度 - 7天数据聚合")
        void weeklyAggregation_SevenDaysAccuracy() {
            // 模拟一周数据
            int[] dailyTotalCalls = {100, 120, 90, 110, 130, 80, 70};
            int[] dailySuccessful = {95, 110, 85, 100, 120, 75, 65};

            int weeklyTotal = 0;
            int weeklySuccess = 0;
            for (int i = 0; i < 7; i++) {
                weeklyTotal += dailyTotalCalls[i];
                weeklySuccess += dailySuccessful[i];
            }

            // 总计: 700 calls, 650 success
            assertEquals(700, weeklyTotal);
            assertEquals(650, weeklySuccess);

            // 周成功率: 650/700 = 92.86%
            BigDecimal weeklySuccessRate = BigDecimal.valueOf(weeklySuccess)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(weeklyTotal), SCALE, ROUNDING_MODE);

            assertEquals(new BigDecimal("92.86"), weeklySuccessRate);
        }

        @Test
        @DisplayName("月聚合精度 - 30天数据聚合")
        void monthlyAggregation_ThirtyDaysAccuracy() {
            // 模拟30天数据，每天100次调用，成功率从90%到99%线性增长
            int monthlyTotal = 0;
            int monthlySuccess = 0;

            for (int day = 0; day < 30; day++) {
                int dailyCalls = 100;
                double successRate = 0.90 + (0.09 * day / 29.0); // 90% to 99%
                int dailySuccess = (int) Math.round(dailyCalls * successRate);

                monthlyTotal += dailyCalls;
                monthlySuccess += dailySuccess;
            }

            // 总计: 3000 calls
            assertEquals(3000, monthlyTotal);

            // 计算月度成功率
            BigDecimal monthlySuccessRate = BigDecimal.valueOf(monthlySuccess)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(monthlyTotal), SCALE, ROUNDING_MODE);

            // 验证结果在合理范围内 (约94-95%)
            assertTrue(monthlySuccessRate.compareTo(new BigDecimal("94.00")) >= 0);
            assertTrue(monthlySuccessRate.compareTo(new BigDecimal("96.00")) <= 0);
        }

        @Test
        @DisplayName("聚合类型验证 - PeriodType枚举")
        void periodType_EnumValidation() {
            // 验证三种周期类型存在
            assertEquals(3, PeriodType.values().length);
            assertNotNull(PeriodType.DAILY);
            assertNotNull(PeriodType.WEEKLY);
            assertNotNull(PeriodType.MONTHLY);
        }
    }

    /**
     * 不同分母的比率计算测试
     */
    @Nested
    @DisplayName("不同分母的比率计算测试")
    class RateCalculationWithDifferentDenominatorsTest {

        @ParameterizedTest(name = "分母={0}, 分子={1}, 期望比率={2}%")
        @DisplayName("不同分母的成功率计算")
        @MethodSource("provideDifferentDenominators")
        void calculateRate_DifferentDenominators(int denominator, int numerator, String expectedRate) {
            BehaviorCalibrationMetrics metrics = createMetricsWithCalls(denominator, numerator, 0, 0);
            metrics.calculateScores();

            BigDecimal expected = new BigDecimal(expectedRate);
            assertEquals(0, expected.compareTo(metrics.getSuccessRate()),
                String.format("分母=%d时计算错误: 期望 %s, 实际 %s",
                    denominator, expectedRate, metrics.getSuccessRate()));
        }

        static Stream<Arguments> provideDifferentDenominators() {
            return Stream.of(
                // 小分母
                Arguments.of(1, 1, "100.00"),
                Arguments.of(2, 1, "50.00"),
                Arguments.of(3, 1, "33.33"),
                Arguments.of(3, 2, "66.67"),
                // 中等分母
                Arguments.of(7, 1, "14.29"),
                Arguments.of(7, 3, "42.86"),
                Arguments.of(11, 3, "27.27"),
                Arguments.of(13, 5, "38.46"),
                // 大分母
                Arguments.of(97, 47, "48.45"),
                Arguments.of(101, 37, "36.63"),
                Arguments.of(1000, 333, "33.30"),
                Arguments.of(9999, 1234, "12.34")
            );
        }
    }

    /**
     * 浮点数精度问题测试
     */
    @Nested
    @DisplayName("浮点数精度问题测试")
    class FloatingPointPrecisionIssuesTest {

        @Test
        @DisplayName("浮点精度 - 避免double精度丢失")
        void floatingPointPrecision_AvoidDoubleLoss() {
            // 0.1 + 0.2 在double中 != 0.3
            double d1 = 0.1;
            double d2 = 0.2;
            // 使用double可能出现精度问题
            // assertNotEquals(0.3, d1 + d2); // 可能不等于0.3

            // 使用BigDecimal避免精度问题
            BigDecimal bd1 = new BigDecimal("0.1");
            BigDecimal bd2 = new BigDecimal("0.2");
            assertEquals(new BigDecimal("0.3"), bd1.add(bd2));
        }

        @Test
        @DisplayName("浮点精度 - 大数计算不丢失精度")
        void floatingPointPrecision_LargeNumbersNoLoss() {
            // 大数除法
            long largeNumerator = 9999999L;
            long largeDenominator = 10000000L;

            BigDecimal result = BigDecimal.valueOf(largeNumerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(largeDenominator), SCALE, ROUNDING_MODE);

            // 9999999/10000000 * 100 = 99.99999% -> 100.00% (HALF_UP)
            assertEquals(new BigDecimal("100.00"), result);
        }

        @Test
        @DisplayName("浮点精度 - 连续乘除运算精度")
        void floatingPointPrecision_ChainedOperations() {
            // 模拟综合得分计算的连续运算
            BigDecimal conciseness = new BigDecimal("95.55");
            BigDecimal successRate = new BigDecimal("88.88");
            BigDecimal efficiency = new BigDecimal("77.77");

            // 精确计算: 95.55*0.3 + 88.88*0.5 + 77.77*0.2
            // = 28.665 + 44.44 + 15.554 = 88.659 -> 88.66
            BigDecimal composite = conciseness.multiply(WEIGHT_CONCISENESS)
                .add(successRate.multiply(WEIGHT_SUCCESS_RATE))
                .add(efficiency.multiply(WEIGHT_EFFICIENCY))
                .setScale(SCALE, ROUNDING_MODE);

            assertEquals(new BigDecimal("88.66"), composite);
        }

        @Test
        @DisplayName("浮点精度 - 重复计算结果一致性")
        void floatingPointPrecision_ConsistentResults() {
            // 相同输入多次计算应得到相同结果
            BehaviorCalibrationMetrics metrics1 = createMetricsWithCalls(333, 222, 33, 11);
            BehaviorCalibrationMetrics metrics2 = createMetricsWithCalls(333, 222, 33, 11);

            metrics1.calculateScores();
            metrics2.calculateScores();

            assertEquals(metrics1.getSuccessRate(), metrics2.getSuccessRate());
            assertEquals(metrics1.getConcisenessScore(), metrics2.getConcisenessScore());
            assertEquals(metrics1.getCompositeScore(), metrics2.getCompositeScore());
        }
    }

    /**
     * 工具可靠性统计精度测试
     */
    @Nested
    @DisplayName("工具可靠性统计精度测试")
    class ToolReliabilityStatsPrecisionTest {

        @Test
        @DisplayName("工具成功率计算 - 标准场景")
        void toolSuccessRate_StandardScenario() {
            ToolReliabilityStats stats = ToolReliabilityStats.builder()
                .factoryId(TEST_FACTORY_ID)
                .toolName("inventory_query")
                .statDate(TEST_DATE)
                .totalCalls(100)
                .successfulCalls(95)
                .failedCalls(5)
                .build();

            stats.calculateSuccessRate();

            assertEquals(new BigDecimal("95.00"), stats.getSuccessRate());
        }

        @Test
        @DisplayName("工具成功率计算 - 零调用处理")
        void toolSuccessRate_ZeroCalls() {
            ToolReliabilityStats stats = ToolReliabilityStats.builder()
                .factoryId(TEST_FACTORY_ID)
                .toolName("inventory_query")
                .statDate(TEST_DATE)
                .totalCalls(0)
                .successfulCalls(0)
                .failedCalls(0)
                .build();

            stats.calculateSuccessRate();

            assertEquals(BigDecimal.ZERO, stats.getSuccessRate());
        }

        @Test
        @DisplayName("工具成功率计算 - null值处理")
        void toolSuccessRate_NullValues() {
            ToolReliabilityStats stats = ToolReliabilityStats.builder()
                .factoryId(TEST_FACTORY_ID)
                .toolName("inventory_query")
                .statDate(TEST_DATE)
                .totalCalls(null)
                .successfulCalls(null)
                .failedCalls(null)
                .build();

            assertDoesNotThrow(() -> stats.calculateSuccessRate());
            assertEquals(BigDecimal.ZERO, stats.getSuccessRate());
        }

        @Test
        @DisplayName("工具调用计数增量 - 原子性验证")
        void toolCallCounting_AtomicIncrement() {
            ToolReliabilityStats stats = ToolReliabilityStats.builder()
                .factoryId(TEST_FACTORY_ID)
                .toolName("inventory_query")
                .statDate(TEST_DATE)
                .totalCalls(0)
                .successfulCalls(0)
                .failedCalls(0)
                .build();

            // 模拟100次调用，90次成功，10次失败
            for (int i = 0; i < 100; i++) {
                stats.incrementTotalCalls();
                if (i < 90) {
                    stats.incrementSuccessfulCalls();
                } else {
                    stats.incrementFailedCalls();
                }
            }

            assertEquals(100, stats.getTotalCalls());
            assertEquals(90, stats.getSuccessfulCalls());
            assertEquals(10, stats.getFailedCalls());

            stats.calculateSuccessRate();
            assertEquals(new BigDecimal("90.00"), stats.getSuccessRate());
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 创建带有调用统计的指标实体
     */
    private BehaviorCalibrationMetrics createMetricsWithCalls(
            int totalCalls, int successfulCalls, int redundantCalls, int recoveredCalls) {
        return BehaviorCalibrationMetrics.builder()
            .factoryId(TEST_FACTORY_ID)
            .metricDate(TEST_DATE)
            .periodType(PeriodType.DAILY)
            .totalCalls(totalCalls)
            .successfulCalls(successfulCalls)
            .failedCalls(totalCalls - successfulCalls)
            .redundantCalls(redundantCalls)
            .recoveredCalls(recoveredCalls)
            .totalInputTokens((long) totalCalls * 500)
            .totalOutputTokens((long) totalCalls * 500)
            .build();
    }

    /**
     * 创建带有Token统计的指标实体
     */
    private BehaviorCalibrationMetrics createMetricsWithTokens(
            int totalCalls, long inputTokens, long outputTokens) {
        return BehaviorCalibrationMetrics.builder()
            .factoryId(TEST_FACTORY_ID)
            .metricDate(TEST_DATE)
            .periodType(PeriodType.DAILY)
            .totalCalls(totalCalls)
            .successfulCalls(totalCalls)
            .failedCalls(0)
            .redundantCalls(0)
            .recoveredCalls(0)
            .totalInputTokens(inputTokens)
            .totalOutputTokens(outputTokens)
            .build();
    }

    /**
     * 创建带有满分的指标实体
     */
    private BehaviorCalibrationMetrics createMetricsWithFullScores(
            double conciseness, double successRate, double efficiency) {
        BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
            .factoryId(TEST_FACTORY_ID)
            .metricDate(TEST_DATE)
            .periodType(PeriodType.DAILY)
            .concisenessScore(BigDecimal.valueOf(conciseness))
            .successRate(BigDecimal.valueOf(successRate))
            .reasoningEfficiency(BigDecimal.valueOf(efficiency))
            .build();
        return metrics;
    }
}
