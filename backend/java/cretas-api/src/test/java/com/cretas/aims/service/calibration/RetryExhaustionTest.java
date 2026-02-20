package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.CorrectionRecord;
import com.cretas.aims.entity.calibration.CorrectionRecord.CorrectionStrategy;
import com.cretas.aims.entity.calibration.CorrectionRecord.ErrorCategory;
import com.cretas.aims.repository.calibration.CorrectionRecordRepository;
import com.cretas.aims.service.calibration.impl.SelfCorrectionServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 重试耗尽测试
 * 验证系统在达到最大重试次数后的正确行为
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("RetryExhaustion 重试耗尽测试")
class RetryExhaustionTest {

    @Mock
    private CorrectionRecordRepository correctionRecordRepository;

    @InjectMocks
    private SelfCorrectionServiceImpl selfCorrectionService;

    private static final String TEST_SESSION_ID = "retry-test-session";
    private static final String TEST_FACTORY_ID = "F001";
    private static final Long TEST_TOOL_CALL_ID = 1L;
    private static final int MAX_RETRY_COUNT = 3;

    @BeforeEach
    void setUp() {
        // 初始化设置
    }

    @Test
    @DisplayName("第3次重试失败后应返回最终错误")
    void third_retry_failure_should_return_final_error() {
        // 模拟已有3轮失败的纠错记录
        CorrectionRecord record = CorrectionRecord.builder()
            .id(1L)
            .toolCallId(TEST_TOOL_CALL_ID)
            .factoryId(TEST_FACTORY_ID)
            .sessionId(TEST_SESSION_ID)
            .correctionRounds(3)
            .correctionSuccess(false)
            .errorCategory(ErrorCategory.DATA_INSUFFICIENT)
            .correctionStrategy(CorrectionStrategy.RE_RETRIEVE)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        boolean shouldRetry = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);

        assertFalse(shouldRetry, "达到最大重试次数后不应继续重试");
    }

    @Test
    @DisplayName("重试次数应被正确记录")
    void retry_count_should_be_recorded() {
        String errorType = "DATA_NOT_FOUND";
        String errorMessage = "数据不存在";

        // 模拟第一次纠错
        CorrectionRecord savedRecord = CorrectionRecord.builder()
            .id(1L)
            .toolCallId(TEST_TOOL_CALL_ID)
            .factoryId(TEST_FACTORY_ID)
            .sessionId(TEST_SESSION_ID)
            .errorType(errorType)
            .errorCategory(ErrorCategory.DATA_INSUFFICIENT)
            .correctionStrategy(CorrectionStrategy.RE_RETRIEVE)
            .correctionRounds(1)
            .build();

        when(correctionRecordRepository.save(any(CorrectionRecord.class))).thenReturn(savedRecord);

        CorrectionRecord result = selfCorrectionService.createCorrectionRecord(
            TEST_TOOL_CALL_ID, TEST_FACTORY_ID, TEST_SESSION_ID, errorType, errorMessage);

        assertNotNull(result);
        verify(correctionRecordRepository).save(argThat(r ->
            r.getCorrectionRounds() != null && r.getCorrectionRounds() >= 1
        ));
    }

    @Test
    @DisplayName("部分恢复应重置计数")
    void partial_recovery_should_reset_count() {
        // 模拟之前有失败记录，但当前记录表明成功
        CorrectionRecord successRecord = CorrectionRecord.builder()
            .id(2L)
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionSuccess(true)
            .correctionRounds(2)
            .finalStatus("SUCCESS")
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(successRecord));

        // 获取当前轮次
        int currentRound = selfCorrectionService.getCurrentRound(TEST_TOOL_CALL_ID);

        // 即使有成功记录，当前轮次也应该基于最新记录
        assertEquals(2, currentRound);
    }

    @Test
    @DisplayName("剩余重试次数计算 - 0轮纠错")
    void remaining_retries_with_0_rounds() {
        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(Collections.emptyList());

        int remaining = selfCorrectionService.getRemainingRetries(TEST_TOOL_CALL_ID);

        assertEquals(MAX_RETRY_COUNT, remaining, "无纠错记录时应有3次重试机会");
    }

    @Test
    @DisplayName("剩余重试次数计算 - 1轮纠错")
    void remaining_retries_with_1_round() {
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(1)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        int remaining = selfCorrectionService.getRemainingRetries(TEST_TOOL_CALL_ID);

        assertEquals(2, remaining, "1轮纠错后应剩余2次重试");
    }

    @Test
    @DisplayName("剩余重试次数计算 - 2轮纠错")
    void remaining_retries_with_2_rounds() {
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(2)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        int remaining = selfCorrectionService.getRemainingRetries(TEST_TOOL_CALL_ID);

        assertEquals(1, remaining, "2轮纠错后应剩余1次重试");
    }

    @Test
    @DisplayName("剩余重试次数计算 - 3轮纠错（耗尽）")
    void remaining_retries_with_3_rounds_exhausted() {
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(3)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        int remaining = selfCorrectionService.getRemainingRetries(TEST_TOOL_CALL_ID);

        assertEquals(0, remaining, "3轮纠错后应无剩余重试");
    }

    @Test
    @DisplayName("连续失败场景测试")
    void consecutive_failure_scenario() {
        // 模拟3次连续失败
        List<CorrectionRecord> failureRecords = Arrays.asList(
            CorrectionRecord.builder()
                .id(3L)
                .toolCallId(TEST_TOOL_CALL_ID)
                .correctionRounds(3)
                .correctionSuccess(false)
                .createdAt(LocalDateTime.now())
                .build(),
            CorrectionRecord.builder()
                .id(2L)
                .toolCallId(TEST_TOOL_CALL_ID)
                .correctionRounds(2)
                .correctionSuccess(false)
                .createdAt(LocalDateTime.now().minusMinutes(1))
                .build(),
            CorrectionRecord.builder()
                .id(1L)
                .toolCallId(TEST_TOOL_CALL_ID)
                .correctionRounds(1)
                .correctionSuccess(false)
                .createdAt(LocalDateTime.now().minusMinutes(2))
                .build()
        );

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(failureRecords);

        boolean shouldRetry = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);
        int currentRound = selfCorrectionService.getCurrentRound(TEST_TOOL_CALL_ID);
        int remaining = selfCorrectionService.getRemainingRetries(TEST_TOOL_CALL_ID);

        assertFalse(shouldRetry, "连续3次失败后不应重试");
        assertEquals(3, currentRound, "当前轮次应为3");
        assertEquals(0, remaining, "剩余重试次数应为0");
    }

    @Test
    @DisplayName("记录纠错结果 - 失败情况")
    void record_correction_outcome_failure() {
        Long recordId = 1L;
        CorrectionRecord record = CorrectionRecord.builder()
            .id(recordId)
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionSuccess(false)
            .correctionRounds(1)
            .build();

        when(correctionRecordRepository.findById(recordId)).thenReturn(Optional.of(record));
        when(correctionRecordRepository.save(any(CorrectionRecord.class))).thenReturn(record);

        selfCorrectionService.recordCorrectionOutcome(recordId, false, "FAILED");

        verify(correctionRecordRepository).save(argThat(r ->
            !r.getCorrectionSuccess() && "FAILED".equals(r.getFinalStatus())
        ));
    }

    @Test
    @DisplayName("记录纠错结果 - 成功情况")
    void record_correction_outcome_success() {
        Long recordId = 1L;
        CorrectionRecord record = CorrectionRecord.builder()
            .id(recordId)
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionSuccess(false)
            .correctionRounds(2)
            .build();

        when(correctionRecordRepository.findById(recordId)).thenReturn(Optional.of(record));
        when(correctionRecordRepository.save(any(CorrectionRecord.class))).thenReturn(record);

        selfCorrectionService.recordCorrectionOutcome(recordId, true, "SUCCESS");

        verify(correctionRecordRepository).save(argThat(r ->
            r.getCorrectionSuccess() && "SUCCESS".equals(r.getFinalStatus())
        ));
    }

    @Test
    @DisplayName("超过最大重试次数的异常情况")
    void exceeds_max_retry_count_edge_case() {
        // 边缘情况：如果因为某种原因记录了超过3轮
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(5) // 超过最大次数
            .correctionSuccess(false)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        boolean shouldRetry = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);
        int remaining = selfCorrectionService.getRemainingRetries(TEST_TOOL_CALL_ID);

        assertFalse(shouldRetry, "超过最大重试次数后不应重试");
        assertEquals(0, remaining, "剩余重试次数不应为负");
    }

    @Test
    @DisplayName("不同工具调用的重试计数独立")
    void retry_count_independent_for_different_tool_calls() {
        Long toolCallId1 = 1L;
        Long toolCallId2 = 2L;

        // toolCallId1 有2轮
        CorrectionRecord record1 = CorrectionRecord.builder()
            .toolCallId(toolCallId1)
            .correctionRounds(2)
            .build();

        // toolCallId2 有0轮
        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(toolCallId1))
            .thenReturn(List.of(record1));
        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(toolCallId2))
            .thenReturn(Collections.emptyList());

        int remaining1 = selfCorrectionService.getRemainingRetries(toolCallId1);
        int remaining2 = selfCorrectionService.getRemainingRetries(toolCallId2);

        assertEquals(1, remaining1, "toolCallId1 应剩余1次");
        assertEquals(3, remaining2, "toolCallId2 应剩余3次");
    }

    @Test
    @DisplayName("纠错轮次递增逻辑")
    void correction_rounds_increment_logic() {
        // 模拟已有1轮记录
        CorrectionRecord existingRecord = CorrectionRecord.builder()
            .id(1L)
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(1)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(existingRecord));

        ArgumentCaptor<CorrectionRecord> captor = ArgumentCaptor.forClass(CorrectionRecord.class);
        when(correctionRecordRepository.save(captor.capture()))
            .thenAnswer(invocation -> {
                CorrectionRecord saved = invocation.getArgument(0);
                saved.setId(2L);
                return saved;
            });

        // 创建新的纠错记录
        selfCorrectionService.createCorrectionRecord(
            TEST_TOOL_CALL_ID, TEST_FACTORY_ID, TEST_SESSION_ID, "ERROR", "测试错误");

        CorrectionRecord savedRecord = captor.getValue();
        assertEquals(2, savedRecord.getCorrectionRounds(), "新记录的纠错轮次应该递增");
    }

    @Test
    @DisplayName("第1次重试应允许")
    void first_retry_should_be_allowed() {
        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(Collections.emptyList());

        boolean shouldRetry = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);

        assertTrue(shouldRetry, "第1次重试应该被允许");
    }

    @Test
    @DisplayName("第2次重试应允许")
    void second_retry_should_be_allowed() {
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(1)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        boolean shouldRetry = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);

        assertTrue(shouldRetry, "第2次重试应该被允许");
    }

    @Test
    @DisplayName("第3次重试应允许")
    void third_retry_should_be_allowed() {
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(2)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        boolean shouldRetry = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);

        assertTrue(shouldRetry, "第3次重试应该被允许");
    }

    @Test
    @DisplayName("第4次重试应拒绝")
    void fourth_retry_should_be_rejected() {
        CorrectionRecord record = CorrectionRecord.builder()
            .toolCallId(TEST_TOOL_CALL_ID)
            .correctionRounds(3)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(TEST_TOOL_CALL_ID))
            .thenReturn(List.of(record));

        boolean shouldRetry = selfCorrectionService.shouldRetry(TEST_TOOL_CALL_ID);

        assertFalse(shouldRetry, "第4次重试应该被拒绝");
    }
}
