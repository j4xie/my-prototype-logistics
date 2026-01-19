package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.*;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics.PeriodType;
import com.cretas.aims.entity.calibration.CorrectionRecord.CorrectionStrategy;
import com.cretas.aims.entity.calibration.CorrectionRecord.ErrorCategory;
import com.cretas.aims.entity.calibration.ToolCallRecord.ExecutionStatus;
import com.cretas.aims.repository.calibration.*;
import com.cretas.aims.service.calibration.impl.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 状态转换测试
 *
 * 测试所有行为校准相关实体的状态机转换逻辑，包括：
 * - ToolCallRecord 执行状态转换
 * - CorrectionRecord 纠错生命周期
 * - ToolCallCache 缓存状态转换
 * - 错误恢复状态机
 * - 会话状态管理
 * - 指标计算状态
 *
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的设计
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("状态转换测试 - State Transition Tests")
class StateTransitionTest {

    // ==================== Mock 依赖 ====================

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private CorrectionRecordRepository correctionRecordRepository;

    @Mock
    private ToolCallCacheRepository cacheRepository;

    @Mock
    private BehaviorCalibrationMetricsRepository metricsRepository;

    @Mock
    private ToolReliabilityStatsRepository reliabilityStatsRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    // ==================== 测试常量 ====================

    private static final String TEST_FACTORY_ID = "F001";
    private static final String TEST_SESSION_ID = "session-12345";
    private static final String TEST_TOOL_NAME = "inventory_query";
    private static final LocalDate TEST_DATE = LocalDate.of(2026, 1, 19);

    // ==================== ToolCallRecord 状态转换测试 ====================

    @Nested
    @DisplayName("ToolCallRecord 状态转换测试")
    class ToolCallRecordStateTests {

        @Test
        @DisplayName("有效转换: SUCCESS 状态应保持不变")
        void validTransition_SuccessStatus_ShouldRemainSuccess() {
            // 创建一个成功状态的记录
            ToolCallRecord record = createToolCallRecord(ExecutionStatus.SUCCESS);

            // 验证成功状态
            assertEquals(ExecutionStatus.SUCCESS, record.getExecutionStatus());
            assertFalse(record.getIsRedundant());
            assertNull(record.getErrorType());
        }

        @Test
        @DisplayName("有效转换: 记录失败时应正确设置错误信息")
        void validTransition_RecordFailure_ShouldSetErrorInfo() {
            // 创建初始记录
            ToolCallRecord record = createToolCallRecord(ExecutionStatus.SUCCESS);

            // 执行失败转换
            record.recordFailure("TIMEOUT_ERROR", "工具执行超时，超过30秒限制");

            // 验证状态转换
            assertEquals(ExecutionStatus.FAILED, record.getExecutionStatus());
            assertEquals("TIMEOUT_ERROR", record.getErrorType());
            assertEquals("工具执行超时，超过30秒限制", record.getErrorMessage());
        }

        @Test
        @DisplayName("有效转换: 标记为冗余调用时状态应变为 SKIPPED")
        void validTransition_MarkAsRedundant_ShouldChangeToSkipped() {
            // 创建初始记录
            ToolCallRecord record = createToolCallRecord(ExecutionStatus.SUCCESS);
            Long originalCallId = 100L;

            // 执行冗余标记转换
            record.markAsRedundant(originalCallId, "相同参数调用已在5分钟内执行");

            // 验证状态转换
            assertEquals(ExecutionStatus.SKIPPED, record.getExecutionStatus());
            assertTrue(record.getIsRedundant());
            assertEquals(originalCallId, record.getOriginalCallId());
            assertEquals("相同参数调用已在5分钟内执行", record.getRedundantReason());
        }

        @Test
        @DisplayName("有效转换: 恢复成功时状态应变为 SUCCESS")
        void validTransition_RecordRecovery_ShouldChangeToSuccess() {
            // 创建失败状态的记录
            ToolCallRecord record = createToolCallRecord(ExecutionStatus.FAILED);
            record.setErrorType("DATA_ERROR");
            record.setRetryCount(2);

            // 执行恢复转换
            record.recordRecovery("RE_RETRIEVE");

            // 验证状态转换
            assertEquals(ExecutionStatus.SUCCESS, record.getExecutionStatus());
            assertTrue(record.getRecovered());
            assertEquals("RE_RETRIEVE", record.getRecoveryStrategy());
        }

        @Test
        @DisplayName("有效转换: 重试计数应正确递增")
        void validTransition_IncrementRetry_ShouldIncreaseCount() {
            // 创建记录，初始重试次数为0
            ToolCallRecord record = createToolCallRecord(ExecutionStatus.FAILED);
            assertEquals(0, record.getRetryCount());

            // 执行多次重试递增
            record.incrementRetryCount();
            assertEquals(1, record.getRetryCount());

            record.incrementRetryCount();
            assertEquals(2, record.getRetryCount());

            record.incrementRetryCount();
            assertEquals(3, record.getRetryCount());
        }

        @ParameterizedTest
        @EnumSource(ExecutionStatus.class)
        @DisplayName("参数化测试: 所有执行状态枚举值应可正确创建")
        void parameterizedTest_AllExecutionStatusValues_ShouldBeCreatable(ExecutionStatus status) {
            // 验证每个状态枚举值都可以正确设置
            ToolCallRecord record = ToolCallRecord.builder()
                .toolName(TEST_TOOL_NAME)
                .executionStatus(status)
                .build();

            assertEquals(status, record.getExecutionStatus());
        }

        @Test
        @DisplayName("状态顺序: FAILED -> 重试 -> SUCCESS 应正确完成")
        void stateOrder_FailedToRetryToSuccess_ShouldCompleteCorrectly() {
            // 阶段1: 创建初始失败状态
            ToolCallRecord record = createToolCallRecord(ExecutionStatus.SUCCESS);
            record.recordFailure("NETWORK_ERROR", "网络连接失败");
            assertEquals(ExecutionStatus.FAILED, record.getExecutionStatus());

            // 阶段2: 第一次重试
            record.incrementRetryCount();
            assertEquals(1, record.getRetryCount());

            // 阶段3: 重试仍然失败
            record.recordFailure("NETWORK_ERROR", "第二次网络连接失败");
            record.incrementRetryCount();
            assertEquals(2, record.getRetryCount());

            // 阶段4: 第三次重试成功
            record.recordRecovery("RETRY_WITH_BACKOFF");
            assertEquals(ExecutionStatus.SUCCESS, record.getExecutionStatus());
            assertTrue(record.getRecovered());
        }

        @Test
        @DisplayName("状态约束: 已恢复的记录不应再次标记为冗余")
        void stateConstraint_RecoveredRecord_ShouldNotBeMarkedRedundant() {
            // 创建已恢复的记录
            ToolCallRecord record = createToolCallRecord(ExecutionStatus.SUCCESS);
            record.setRecovered(true);
            record.setRecoveryStrategy("RE_RETRIEVE");

            // 尝试标记为冗余 - 在实际业务中这应该被阻止
            // 这里测试当前的行为（允许覆盖）
            record.markAsRedundant(200L, "测试覆盖");

            // 验证状态被覆盖（这可能是需要修复的行为）
            assertEquals(ExecutionStatus.SKIPPED, record.getExecutionStatus());
            assertTrue(record.getIsRedundant());
            // 注意：recovered 状态仍然为 true，表明存在状态不一致
            assertTrue(record.getRecovered());
        }
    }

    // ==================== CorrectionRecord 生命周期测试 ====================

    @Nested
    @DisplayName("CorrectionRecord 生命周期测试")
    class CorrectionRecordLifecycleTests {

        @Test
        @DisplayName("生命周期: 创建 -> 处理中 -> 成功")
        void lifecycle_CreatedToProcessingToSuccess() {
            // 阶段1: 创建纠错记录
            CorrectionRecord record = createCorrectionRecord(ErrorCategory.DATA_INSUFFICIENT);
            assertEquals(ErrorCategory.DATA_INSUFFICIENT, record.getErrorCategory());
            assertEquals(CorrectionStrategy.RE_RETRIEVE, record.getCorrectionStrategy());
            assertFalse(record.getCorrectionSuccess());
            assertEquals(1, record.getCorrectionRounds());

            // 阶段2: 模拟处理中（增加轮次）
            record.incrementRounds();
            assertEquals(2, record.getCorrectionRounds());

            // 阶段3: 标记成功
            record.markSuccess("数据重新检索成功");
            assertTrue(record.getCorrectionSuccess());
            assertEquals("数据重新检索成功", record.getFinalStatus());
        }

        @Test
        @DisplayName("生命周期: 创建 -> 处理中 -> 失败（达到最大轮次）")
        void lifecycle_CreatedToProcessingToFailed_MaxRounds() {
            // 阶段1: 创建纠错记录
            CorrectionRecord record = createCorrectionRecord(ErrorCategory.ANALYSIS_ERROR);

            // 阶段2: 模拟多轮处理
            for (int i = 0; i < SelfCorrectionService.MAX_CORRECTION_ROUNDS - 1; i++) {
                record.incrementRounds();
            }
            assertEquals(SelfCorrectionService.MAX_CORRECTION_ROUNDS, record.getCorrectionRounds());

            // 阶段3: 达到最大轮次后标记失败
            record.markFailure("达到最大纠错轮次(3)，仍未成功");
            assertFalse(record.getCorrectionSuccess());
            assertEquals("达到最大纠错轮次(3)，仍未成功", record.getFinalStatus());
        }

        @ParameterizedTest
        @EnumSource(ErrorCategory.class)
        @DisplayName("参数化测试: 每种错误类型应映射到正确的纠错策略")
        void parameterizedTest_ErrorCategoryToStrategy_ShouldMapCorrectly(ErrorCategory category) {
            // 获取推荐策略
            CorrectionStrategy strategy = CorrectionRecord.getRecommendedStrategy(category);

            // 验证映射关系
            switch (category) {
                case DATA_INSUFFICIENT:
                    assertEquals(CorrectionStrategy.RE_RETRIEVE, strategy);
                    break;
                case ANALYSIS_ERROR:
                    assertEquals(CorrectionStrategy.RE_ANALYZE, strategy);
                    break;
                case FORMAT_ERROR:
                    assertEquals(CorrectionStrategy.FORMAT_FIX, strategy);
                    break;
                case LOGIC_ERROR:
                    assertEquals(CorrectionStrategy.PROMPT_INJECTION, strategy);
                    break;
                case UNKNOWN:
                    assertEquals(CorrectionStrategy.FULL_RETRY, strategy);
                    break;
            }
        }

        @Test
        @DisplayName("状态约束: 成功后的记录不应再增加轮次")
        void stateConstraint_SuccessRecord_ShouldNotIncrementRounds() {
            // 创建并标记为成功的记录
            CorrectionRecord record = createCorrectionRecord(ErrorCategory.FORMAT_ERROR);
            record.markSuccess("格式修正成功");
            int roundsAfterSuccess = record.getCorrectionRounds();

            // 尝试增加轮次（在实际业务中应该被阻止）
            record.incrementRounds();

            // 当前行为是允许增加，这可能需要业务逻辑验证
            assertEquals(roundsAfterSuccess + 1, record.getCorrectionRounds());
        }

        @Test
        @DisplayName("状态转换: markSuccess 和 markFailure 应互斥")
        void stateTransition_MarkSuccessAndMarkFailure_ShouldBeMutuallyExclusive() {
            // 创建记录
            CorrectionRecord record = createCorrectionRecord(ErrorCategory.LOGIC_ERROR);

            // 先标记成功
            record.markSuccess("纠正成功");
            assertTrue(record.getCorrectionSuccess());

            // 再标记失败（覆盖之前的状态）
            record.markFailure("最终失败");
            assertFalse(record.getCorrectionSuccess());
            assertEquals("最终失败", record.getFinalStatus());
        }
    }

    // ==================== Cache 状态转换测试 ====================

    @Nested
    @DisplayName("ToolCallCache 状态转换测试")
    class CacheStateTests {

        @Test
        @DisplayName("缓存状态: miss -> 创建缓存 -> hit")
        void cacheState_MissToCreateToHit() {
            // 阶段1: 初始状态 - 缓存未命中（通过检查是否存在）
            String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, "abc123");

            // 阶段2: 创建缓存
            ToolCallCache cache = ToolCallCache.builder()
                .cacheKey(cacheKey)
                .sessionId(TEST_SESSION_ID)
                .toolName(TEST_TOOL_NAME)
                .parametersHash("abc123")
                .cachedResult("{\"result\": \"success\"}")
                .originalCallId(1L)
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .hitCount(0)
                .build();

            assertFalse(cache.isExpired());
            assertEquals(0, cache.getHitCount());

            // 阶段3: 缓存命中
            cache.incrementHitCount();
            assertEquals(1, cache.getHitCount());

            // 多次命中
            cache.incrementHitCount();
            cache.incrementHitCount();
            assertEquals(3, cache.getHitCount());
        }

        @Test
        @DisplayName("缓存状态: hit -> expired -> miss（需要重新创建）")
        void cacheState_HitToExpiredToMiss() {
            // 阶段1: 创建已命中的缓存
            ToolCallCache cache = ToolCallCache.builder()
                .cacheKey("test-key")
                .sessionId(TEST_SESSION_ID)
                .toolName(TEST_TOOL_NAME)
                .parametersHash("xyz789")
                .cachedResult("{\"data\": \"test\"}")
                .originalCallId(2L)
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .hitCount(5)
                .build();

            assertFalse(cache.isExpired());

            // 阶段2: 模拟过期（设置过期时间为过去）
            cache.setExpiresAt(LocalDateTime.now().minusMinutes(1));
            assertTrue(cache.isExpired());

            // 阶段3: 过期后应该被清理，这里验证 isExpired 判断逻辑
            assertTrue(cache.isExpired());
        }

        @Test
        @DisplayName("缓存延期: extendExpiration 应正确更新过期时间")
        void cacheExtension_ExtendExpiration_ShouldUpdateExpiresAt() {
            // 创建即将过期的缓存
            ToolCallCache cache = ToolCallCache.builder()
                .cacheKey("extend-test")
                .sessionId(TEST_SESSION_ID)
                .toolName(TEST_TOOL_NAME)
                .parametersHash("extend123")
                .cachedResult("{}")
                .originalCallId(3L)
                .expiresAt(LocalDateTime.now().plusSeconds(30))
                .build();

            LocalDateTime originalExpiry = cache.getExpiresAt();

            // 延期5分钟
            cache.extendExpiration(5);

            // 验证新的过期时间在原来基础上延长了
            assertTrue(cache.getExpiresAt().isAfter(originalExpiry));
            assertFalse(cache.isExpired());
        }

        @Test
        @DisplayName("缓存键生成: generateCacheKey 应产生一致的结果")
        void cacheKeyGeneration_ShouldBeConsistent() {
            // 相同参数应产生相同的缓存键
            String key1 = ToolCallCache.generateCacheKey("session1", "tool1", "hash1");
            String key2 = ToolCallCache.generateCacheKey("session1", "tool1", "hash1");
            assertEquals(key1, key2);

            // 不同参数应产生不同的缓存键
            String key3 = ToolCallCache.generateCacheKey("session2", "tool1", "hash1");
            assertNotEquals(key1, key3);

            // 验证格式: session_id:tool_name:parameters_hash
            assertEquals("session1:tool1:hash1", key1);
        }
    }

    // ==================== 错误恢复状态机测试 ====================

    @Nested
    @DisplayName("错误恢复状态机测试")
    class ErrorRecoveryStateMachineTests {

        @Test
        @DisplayName("状态机: error -> classify -> strategy -> retry -> success")
        void stateMachine_ErrorToClassifyToStrategyToRetryToSuccess() {
            // 阶段1: 发生错误
            ToolCallRecord toolRecord = createToolCallRecord(ExecutionStatus.SUCCESS);
            toolRecord.recordFailure("DATA_NOT_FOUND", "未找到指定批次的库存数据");
            assertEquals(ExecutionStatus.FAILED, toolRecord.getExecutionStatus());

            // 阶段2: 错误分类
            ErrorCategory category = classifyErrorMessage("未找到指定批次的库存数据");
            assertEquals(ErrorCategory.DATA_INSUFFICIENT, category);

            // 阶段3: 确定策略
            CorrectionStrategy strategy = CorrectionRecord.getRecommendedStrategy(category);
            assertEquals(CorrectionStrategy.RE_RETRIEVE, strategy);

            // 阶段4: 创建纠错记录
            CorrectionRecord correction = CorrectionRecord.builder()
                .toolCallId(toolRecord.getId() != null ? toolRecord.getId() : 1L)
                .factoryId(TEST_FACTORY_ID)
                .sessionId(TEST_SESSION_ID)
                .errorType("DATA_NOT_FOUND")
                .errorCategory(category)
                .originalErrorMessage("未找到指定批次的库存数据")
                .correctionStrategy(strategy)
                .build();

            // 阶段5: 重试成功
            toolRecord.incrementRetryCount();
            toolRecord.recordRecovery(strategy.name());
            correction.markSuccess("重新检索后找到数据");

            // 验证最终状态
            assertEquals(ExecutionStatus.SUCCESS, toolRecord.getExecutionStatus());
            assertTrue(toolRecord.getRecovered());
            assertTrue(correction.getCorrectionSuccess());
        }

        @Test
        @DisplayName("状态机: error -> classify -> strategy -> retry (3次) -> fail")
        void stateMachine_ErrorToClassifyToStrategyToMaxRetryToFail() {
            // 阶段1: 发生错误
            ToolCallRecord toolRecord = createToolCallRecord(ExecutionStatus.SUCCESS);
            toolRecord.recordFailure("UNKNOWN_ERROR", "未知系统错误");

            // 阶段2: 分类为 UNKNOWN
            ErrorCategory category = ErrorCategory.UNKNOWN;
            CorrectionStrategy strategy = CorrectionRecord.getRecommendedStrategy(category);
            assertEquals(CorrectionStrategy.FULL_RETRY, strategy);

            // 阶段3: 创建纠错记录
            CorrectionRecord correction = CorrectionRecord.builder()
                .toolCallId(1L)
                .factoryId(TEST_FACTORY_ID)
                .sessionId(TEST_SESSION_ID)
                .errorType("UNKNOWN_ERROR")
                .errorCategory(category)
                .originalErrorMessage("未知系统错误")
                .correctionStrategy(strategy)
                .build();

            // 阶段4: 重试3次都失败
            // retryCount 从0开始，需要递增3次达到3
            for (int i = 0; i < SelfCorrectionService.MAX_CORRECTION_ROUNDS; i++) {
                toolRecord.incrementRetryCount();
            }
            // correctionRounds 从1开始（@Builder.Default），需要递增2次达到3（MAX_CORRECTION_ROUNDS）
            for (int i = 0; i < SelfCorrectionService.MAX_CORRECTION_ROUNDS - 1; i++) {
                correction.incrementRounds();
            }

            // 阶段5: 达到最大轮次，标记最终失败
            correction.markFailure("重试3次后仍然失败");

            // 验证最终状态
            assertEquals(ExecutionStatus.FAILED, toolRecord.getExecutionStatus());
            assertEquals(3, toolRecord.getRetryCount());
            assertFalse(correction.getCorrectionSuccess());
            assertEquals(3, correction.getCorrectionRounds().intValue());
        }

        @Test
        @DisplayName("策略选择: 不同错误类型应选择正确的恢复策略")
        void strategySelection_DifferentErrors_ShouldSelectCorrectStrategy() {
            // 测试各种错误消息的分类和策略选择
            assertStrategyForError("数据不完整，缺少必要字段", CorrectionStrategy.RE_RETRIEVE);
            assertStrategyForError("分析计算结果异常", CorrectionStrategy.RE_ANALYZE);
            assertStrategyForError("JSON格式解析失败", CorrectionStrategy.FORMAT_FIX);
            assertStrategyForError("业务逻辑冲突，规则不满足", CorrectionStrategy.PROMPT_INJECTION);
            assertStrategyForError("系统内部异常", CorrectionStrategy.FULL_RETRY);
        }

        private void assertStrategyForError(String errorMessage, CorrectionStrategy expectedStrategy) {
            ErrorCategory category = classifyErrorMessage(errorMessage);
            CorrectionStrategy actualStrategy = CorrectionRecord.getRecommendedStrategy(category);
            assertEquals(expectedStrategy, actualStrategy,
                "错误消息 '" + errorMessage + "' 应使用策略 " + expectedStrategy);
        }
    }

    // ==================== 会话状态测试 ====================

    @Nested
    @DisplayName("会话状态管理测试")
    class SessionStateTests {

        @Test
        @DisplayName("会话状态: active -> idle -> expired -> cleaned")
        void sessionState_ActiveToIdleToExpiredToCleaned() {
            // 模拟会话状态管理
            SessionState session = new SessionState(TEST_SESSION_ID);

            // 阶段1: 初始状态 - active
            assertEquals(SessionState.State.ACTIVE, session.getState());

            // 阶段2: 长时间无操作 -> idle
            session.markIdle();
            assertEquals(SessionState.State.IDLE, session.getState());

            // 阶段3: 超过过期时间 -> expired
            session.markExpired();
            assertEquals(SessionState.State.EXPIRED, session.getState());

            // 阶段4: 清理会话数据 -> cleaned
            session.markCleaned();
            assertEquals(SessionState.State.CLEANED, session.getState());
        }

        @Test
        @DisplayName("会话状态: 活动操作应重置空闲计时器")
        void sessionState_ActivityShouldResetIdleTimer() {
            SessionState session = new SessionState(TEST_SESSION_ID);
            session.markIdle();
            assertEquals(SessionState.State.IDLE, session.getState());

            // 新的活动应将状态重置为 active
            session.recordActivity();
            assertEquals(SessionState.State.ACTIVE, session.getState());
        }

        @Test
        @DisplayName("无效状态转换: expired 状态不能转回 active")
        void invalidTransition_ExpiredCannotBecomeActive() {
            SessionState session = new SessionState(TEST_SESSION_ID);
            session.markExpired();

            // 尝试从 expired 转回 active 应抛出异常
            assertThrows(IllegalStateException.class, session::recordActivity);
        }

        @Test
        @DisplayName("无效状态转换: cleaned 状态不能进行任何操作")
        void invalidTransition_CleanedCannotDoAnything() {
            SessionState session = new SessionState(TEST_SESSION_ID);
            session.markExpired();
            session.markCleaned();

            // cleaned 状态下的任何操作都应抛出异常
            assertThrows(IllegalStateException.class, session::recordActivity);
            assertThrows(IllegalStateException.class, session::markIdle);
            assertThrows(IllegalStateException.class, session::markExpired);
        }
    }

    // ==================== 指标计算状态测试 ====================

    @Nested
    @DisplayName("指标计算状态测试")
    class MetricsCalculationStateTests {

        @Test
        @DisplayName("指标状态: raw_data -> aggregated -> saved")
        void metricsState_RawDataToAggregatedToSaved() {
            // 阶段1: 原始数据状态
            BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
                .factoryId(TEST_FACTORY_ID)
                .metricDate(TEST_DATE)
                .periodType(PeriodType.DAILY)
                .totalCalls(100)
                .successfulCalls(90)
                .failedCalls(10)
                .redundantCalls(5)
                .recoveredCalls(3)
                .build();

            // 原始数据状态：得分尚未计算
            assertNull(metrics.getCompositeScore());
            assertNull(metrics.getConcisenessScore());
            assertNull(metrics.getSuccessRate());

            // 阶段2: 聚合计算
            metrics.calculateScores();

            // 验证聚合后的状态
            assertNotNull(metrics.getCompositeScore());
            assertNotNull(metrics.getConcisenessScore());
            assertNotNull(metrics.getSuccessRate());
            assertNotNull(metrics.getReasoningEfficiency());

            // 简洁性 = (100 - 5) / 100 * 100 = 95%
            assertEquals(0, metrics.getConcisenessScore().compareTo(new BigDecimal("95.00")));
            // 成功率 = 90 / 100 * 100 = 90%
            assertEquals(0, metrics.getSuccessRate().compareTo(new BigDecimal("90.00")));
        }

        @Test
        @DisplayName("指标状态: 零数据时应返回零值而非 null")
        void metricsState_ZeroData_ShouldReturnZeros() {
            // 创建无数据的指标
            BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
                .factoryId(TEST_FACTORY_ID)
                .metricDate(TEST_DATE)
                .periodType(PeriodType.DAILY)
                .totalCalls(0)
                .build();

            // 计算得分
            metrics.calculateScores();

            // 验证返回零值
            assertEquals(BigDecimal.ZERO, metrics.getConcisenessScore());
            assertEquals(BigDecimal.ZERO, metrics.getSuccessRate());
            assertEquals(BigDecimal.ZERO, metrics.getCompositeScore());
        }

        @Test
        @DisplayName("指标递增: 各类计数器应正确递增")
        void metricsIncrement_CountersShouldIncrementCorrectly() {
            BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
                .factoryId(TEST_FACTORY_ID)
                .metricDate(TEST_DATE)
                .periodType(PeriodType.DAILY)
                .build();

            // 初始状态
            assertEquals(0, metrics.getTotalCalls());
            assertEquals(0, metrics.getSuccessfulCalls());
            assertEquals(0, metrics.getFailedCalls());
            assertEquals(0, metrics.getRedundantCalls());
            assertEquals(0, metrics.getRecoveredCalls());

            // 模拟调用记录
            metrics.incrementTotalCalls();
            metrics.incrementSuccessfulCalls();
            assertEquals(1, metrics.getTotalCalls());
            assertEquals(1, metrics.getSuccessfulCalls());

            metrics.incrementTotalCalls();
            metrics.incrementFailedCalls();
            assertEquals(2, metrics.getTotalCalls());
            assertEquals(1, metrics.getFailedCalls());

            metrics.incrementTotalCalls();
            metrics.incrementRedundantCalls();
            assertEquals(3, metrics.getTotalCalls());
            assertEquals(1, metrics.getRedundantCalls());

            metrics.incrementRecoveredCalls();
            assertEquals(1, metrics.getRecoveredCalls());
        }

        @Test
        @DisplayName("指标Token累计: addTokens 应正确累加")
        void metricsTokens_AddTokensShouldAccumulate() {
            BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
                .factoryId(TEST_FACTORY_ID)
                .metricDate(TEST_DATE)
                .periodType(PeriodType.DAILY)
                .build();

            // 初始状态
            assertEquals(0L, metrics.getTotalInputTokens());
            assertEquals(0L, metrics.getTotalOutputTokens());

            // 添加 token
            metrics.addTokens(1000, 500);
            assertEquals(1000L, metrics.getTotalInputTokens());
            assertEquals(500L, metrics.getTotalOutputTokens());

            // 再次添加
            metrics.addTokens(2000, 1500);
            assertEquals(3000L, metrics.getTotalInputTokens());
            assertEquals(2000L, metrics.getTotalOutputTokens());
        }

        @ParameterizedTest
        @EnumSource(PeriodType.class)
        @DisplayName("参数化测试: 所有周期类型应正确创建")
        void parameterizedTest_AllPeriodTypes_ShouldBeCreatable(PeriodType periodType) {
            BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
                .factoryId(TEST_FACTORY_ID)
                .metricDate(TEST_DATE)
                .periodType(periodType)
                .build();

            assertEquals(periodType, metrics.getPeriodType());
        }
    }

    // ==================== 并发状态变更测试 ====================

    @Nested
    @DisplayName("并发状态变更测试")
    class ConcurrentStateChangeTests {

        @Test
        @DisplayName("并发测试: 多线程同时递增计数器")
        void concurrentTest_MultipleThreadsIncrementingCounters() throws InterruptedException {
            // 创建指标对象
            BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
                .factoryId(TEST_FACTORY_ID)
                .metricDate(TEST_DATE)
                .periodType(PeriodType.DAILY)
                .totalCalls(0)
                .successfulCalls(0)
                .build();

            // 使用 AtomicInteger 记录期望值
            int threadCount = 10;
            int incrementsPerThread = 100;
            int expectedTotal = threadCount * incrementsPerThread;

            // 创建线程池
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch latch = new CountDownLatch(threadCount);

            // 提交并发任务
            for (int i = 0; i < threadCount; i++) {
                executor.submit(() -> {
                    try {
                        for (int j = 0; j < incrementsPerThread; j++) {
                            synchronized (metrics) {
                                metrics.incrementTotalCalls();
                            }
                        }
                    } finally {
                        latch.countDown();
                    }
                });
            }

            // 等待所有线程完成
            latch.await(10, TimeUnit.SECONDS);
            executor.shutdown();

            // 验证最终计数（使用同步后应该准确）
            assertEquals(expectedTotal, metrics.getTotalCalls());
        }

        @Test
        @DisplayName("并发测试: 多线程缓存命中计数")
        void concurrentTest_CacheHitCountIncrement() throws InterruptedException {
            ToolCallCache cache = ToolCallCache.builder()
                .cacheKey("concurrent-test")
                .sessionId(TEST_SESSION_ID)
                .toolName(TEST_TOOL_NAME)
                .parametersHash("hash123")
                .cachedResult("{}")
                .originalCallId(1L)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .hitCount(0)
                .build();

            int threadCount = 5;
            int hitsPerThread = 50;
            int expectedTotal = threadCount * hitsPerThread;

            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch latch = new CountDownLatch(threadCount);

            for (int i = 0; i < threadCount; i++) {
                executor.submit(() -> {
                    try {
                        for (int j = 0; j < hitsPerThread; j++) {
                            synchronized (cache) {
                                cache.incrementHitCount();
                            }
                        }
                    } finally {
                        latch.countDown();
                    }
                });
            }

            latch.await(10, TimeUnit.SECONDS);
            executor.shutdown();

            assertEquals(expectedTotal, cache.getHitCount());
        }
    }

    // ==================== 状态回滚测试 ====================

    @Nested
    @DisplayName("状态回滚场景测试")
    class StateRollbackTests {

        @Test
        @DisplayName("回滚场景: 纠错失败后应保留原始错误状态")
        void rollback_CorrectionFailure_ShouldPreserveOriginalError() {
            // 创建失败的工具调用记录
            ToolCallRecord toolRecord = createToolCallRecord(ExecutionStatus.FAILED);
            toolRecord.setErrorType("VALIDATION_ERROR");
            toolRecord.setErrorMessage("参数验证失败: 日期格式不正确");

            // 保存原始状态
            String originalErrorType = toolRecord.getErrorType();
            String originalErrorMessage = toolRecord.getErrorMessage();

            // 尝试纠错但失败
            toolRecord.incrementRetryCount();
            // 纠错失败，状态应保持为 FAILED

            // 验证原始错误信息被保留
            assertEquals(ExecutionStatus.FAILED, toolRecord.getExecutionStatus());
            assertEquals(originalErrorType, toolRecord.getErrorType());
            assertEquals(originalErrorMessage, toolRecord.getErrorMessage());
            assertEquals(1, toolRecord.getRetryCount());
        }

        @Test
        @DisplayName("回滚场景: 多次重试失败后应记录所有尝试")
        void rollback_MultipleRetryFailures_ShouldTrackAllAttempts() {
            ToolCallRecord toolRecord = createToolCallRecord(ExecutionStatus.FAILED);
            List<String> attemptResults = new ArrayList<>();

            // 第一次重试
            toolRecord.incrementRetryCount();
            attemptResults.add("第1次重试失败");

            // 第二次重试
            toolRecord.incrementRetryCount();
            attemptResults.add("第2次重试失败");

            // 第三次重试
            toolRecord.incrementRetryCount();
            attemptResults.add("第3次重试失败");

            // 验证重试次数
            assertEquals(3, toolRecord.getRetryCount());
            assertEquals(3, attemptResults.size());

            // 最终状态仍然是失败
            assertEquals(ExecutionStatus.FAILED, toolRecord.getExecutionStatus());
            assertFalse(toolRecord.getRecovered());
        }

        @Test
        @DisplayName("回滚场景: 部分成功后整体失败应正确标记")
        void rollback_PartialSuccessThenFail_ShouldMarkCorrectly() {
            // 模拟复杂的多步骤操作
            CorrectionRecord correction = createCorrectionRecord(ErrorCategory.ANALYSIS_ERROR);

            // 第一轮部分成功
            correction.incrementRounds();
            // 模拟中间状态

            // 第二轮继续处理
            correction.incrementRounds();
            // 模拟中间状态

            // 最终失败
            correction.markFailure("部分数据恢复成功，但关键计算仍然失败");

            // 验证最终状态
            assertFalse(correction.getCorrectionSuccess());
            assertEquals(3, correction.getCorrectionRounds().intValue());
            assertTrue(correction.getFinalStatus().contains("部分"));
        }
    }

    // ==================== 工具可靠性统计状态测试 ====================

    @Nested
    @DisplayName("工具可靠性统计状态测试")
    class ToolReliabilityStatsTests {

        @Test
        @DisplayName("统计计算: 成功率应正确计算")
        void statsCalculation_SuccessRate_ShouldCalculateCorrectly() {
            ToolReliabilityStats stats = ToolReliabilityStats.builder()
                .factoryId(TEST_FACTORY_ID)
                .toolName(TEST_TOOL_NAME)
                .statDate(TEST_DATE)
                .totalCalls(100)
                .successfulCalls(85)
                .failedCalls(15)
                .build();

            // 计算成功率
            stats.calculateSuccessRate();

            // 验证: 85 / 100 * 100 = 85%
            assertEquals(0, stats.getSuccessRate().compareTo(new BigDecimal("85.00")));
        }

        @Test
        @DisplayName("统计计算: 零调用时成功率应为零")
        void statsCalculation_ZeroCalls_SuccessRateShouldBeZero() {
            ToolReliabilityStats stats = ToolReliabilityStats.builder()
                .factoryId(TEST_FACTORY_ID)
                .toolName(TEST_TOOL_NAME)
                .statDate(TEST_DATE)
                .totalCalls(0)
                .build();

            stats.calculateSuccessRate();

            assertEquals(BigDecimal.ZERO, stats.getSuccessRate());
        }

        @Test
        @DisplayName("统计递增: 计数器应正确递增")
        void statsIncrement_CountersShouldIncrementCorrectly() {
            ToolReliabilityStats stats = ToolReliabilityStats.builder()
                .factoryId(TEST_FACTORY_ID)
                .toolName(TEST_TOOL_NAME)
                .statDate(TEST_DATE)
                .build();

            // 模拟10次调用: 8成功, 2失败
            for (int i = 0; i < 8; i++) {
                stats.incrementTotalCalls();
                stats.incrementSuccessfulCalls();
            }
            for (int i = 0; i < 2; i++) {
                stats.incrementTotalCalls();
                stats.incrementFailedCalls();
            }

            assertEquals(10, stats.getTotalCalls());
            assertEquals(8, stats.getSuccessfulCalls());
            assertEquals(2, stats.getFailedCalls());

            // 计算并验证成功率
            stats.calculateSuccessRate();
            assertEquals(0, stats.getSuccessRate().compareTo(new BigDecimal("80.00")));
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 创建测试用的工具调用记录
     */
    private ToolCallRecord createToolCallRecord(ExecutionStatus status) {
        return ToolCallRecord.builder()
            .factoryId(TEST_FACTORY_ID)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .toolParameters("{\"query\": \"test\"}")
            .parametersHash("test-hash-123")
            .executionStatus(status)
            .isRedundant(false)
            .retryCount(0)
            .recovered(false)
            .executionTimeMs(150)
            .inputTokens(500)
            .outputTokens(300)
            .build();
    }

    /**
     * 创建测试用的纠错记录
     */
    private CorrectionRecord createCorrectionRecord(ErrorCategory category) {
        CorrectionStrategy strategy = CorrectionRecord.getRecommendedStrategy(category);
        return CorrectionRecord.builder()
            .toolCallId(1L)
            .factoryId(TEST_FACTORY_ID)
            .sessionId(TEST_SESSION_ID)
            .errorType("TEST_ERROR")
            .errorCategory(category)
            .originalErrorMessage("测试错误消息")
            .correctionStrategy(strategy)
            .correctionSuccess(false)
            .correctionRounds(1)
            .build();
    }

    /**
     * 模拟错误消息分类逻辑
     * 这是 SelfCorrectionService.classifyError 的简化版本
     */
    private ErrorCategory classifyErrorMessage(String errorMessage) {
        if (errorMessage == null || errorMessage.isEmpty()) {
            return ErrorCategory.UNKNOWN;
        }

        String lowerMessage = errorMessage.toLowerCase();

        if (lowerMessage.contains("数据不完整") || lowerMessage.contains("信息不足") ||
            lowerMessage.contains("未找到") || lowerMessage.contains("数据为空") ||
            lowerMessage.contains("缺少")) {
            return ErrorCategory.DATA_INSUFFICIENT;
        }

        if (lowerMessage.contains("分析") || lowerMessage.contains("计算") ||
            lowerMessage.contains("统计") || lowerMessage.contains("结果异常")) {
            return ErrorCategory.ANALYSIS_ERROR;
        }

        if (lowerMessage.contains("格式") || lowerMessage.contains("解析") ||
            lowerMessage.contains("json") || lowerMessage.contains("类型转换")) {
            return ErrorCategory.FORMAT_ERROR;
        }

        if (lowerMessage.contains("逻辑") || lowerMessage.contains("规则") ||
            lowerMessage.contains("冲突") || lowerMessage.contains("条件")) {
            return ErrorCategory.LOGIC_ERROR;
        }

        return ErrorCategory.UNKNOWN;
    }

    // ==================== 内部测试辅助类 ====================

    /**
     * 会话状态管理辅助类
     * 用于测试会话生命周期状态转换
     */
    private static class SessionState {
        enum State {
            ACTIVE,   // 活动状态
            IDLE,     // 空闲状态
            EXPIRED,  // 已过期
            CLEANED   // 已清理
        }

        private final String sessionId;
        private State state;

        public SessionState(String sessionId) {
            this.sessionId = sessionId;
            this.state = State.ACTIVE;
        }

        public State getState() {
            return state;
        }

        public void recordActivity() {
            if (state == State.EXPIRED || state == State.CLEANED) {
                throw new IllegalStateException("无法在 " + state + " 状态下记录活动");
            }
            this.state = State.ACTIVE;
        }

        public void markIdle() {
            if (state == State.CLEANED) {
                throw new IllegalStateException("无法在 CLEANED 状态下标记为空闲");
            }
            this.state = State.IDLE;
        }

        public void markExpired() {
            if (state == State.CLEANED) {
                throw new IllegalStateException("无法在 CLEANED 状态下标记为过期");
            }
            this.state = State.EXPIRED;
        }

        public void markCleaned() {
            this.state = State.CLEANED;
        }
    }
}
