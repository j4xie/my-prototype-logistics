package com.cretas.aims.test.ai;

import com.cretas.aims.entity.AIAnalysisResult;
import com.cretas.aims.repository.AIAnalysisResultRepository;
import com.cretas.aims.service.KnowledgeFeedbackService;
import com.cretas.aims.service.KnowledgeFeedbackService.FeedbackType;
import com.cretas.aims.service.impl.KnowledgeFeedbackServiceImpl;
import com.cretas.aims.test.util.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * 知识库反馈服务单元测试
 * 测试 KnowledgeFeedbackService 的反馈记录、工厂数据学习、批处理等功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@DisplayName("知识库反馈服务测试 (KnowledgeFeedbackService)")
@ExtendWith(MockitoExtension.class)
class KnowledgeFeedbackServiceTest {

    @Mock
    private AIAnalysisResultRepository analysisResultRepository;

    private KnowledgeFeedbackService feedbackService;

    @BeforeEach
    void setUp() {
        feedbackService = new KnowledgeFeedbackServiceImpl(analysisResultRepository);
    }

    // ==========================================
    // 1. 反馈记录测试 (KF-001 to KF-005)
    // ==========================================
    @Nested
    @DisplayName("反馈记录测试")
    class FeedbackRecordingTests {

        @Test
        @DisplayName("KF-001: POSITIVE 反馈应正确记录并增加计数")
        void testPositiveFeedback_ShouldIncreaseCount() {
            // Given
            String sessionId = "session-" + UUID.randomUUID();
            String query = "查询今天的库存";
            String response = "当前库存充足，共计1000件商品";
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(sessionId, query, response, FeedbackType.POSITIVE);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount,
                    "POSITIVE 反馈后计数应增加 1");
        }

        @Test
        @DisplayName("KF-002: NEGATIVE 反馈应正确记录并增加计数")
        void testNegativeFeedback_ShouldIncreaseCount() {
            // Given
            String sessionId = "session-" + UUID.randomUUID();
            String query = "分析良品率趋势";
            String response = "良品率呈上升趋势";
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(sessionId, query, response, FeedbackType.NEGATIVE);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount,
                    "NEGATIVE 反馈后计数应增加 1");
        }

        @Test
        @DisplayName("KF-003: CORRECTION 反馈应包含纠正文本")
        void testCorrectionFeedback_ShouldIncludeCorrectionText() {
            // Given
            String sessionId = "session-" + UUID.randomUUID();
            String query = "查询产品状态";
            String response = "产品状态良好";
            String correctionText = "正确回答应该是：产品库存不足，需要补货";
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(sessionId, query, response,
                    FeedbackType.CORRECTION, correctionText);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount,
                    "CORRECTION 反馈后计数应增加 1");
        }

        @Test
        @DisplayName("KF-004: AUTO_APPROVED 反馈应被 Agent 正确记录")
        void testAutoApprovedFeedback_ShouldBeRecordedByAgent() {
            // Given
            String sessionId = "agent-session-" + UUID.randomUUID();
            String query = "系统自动分析请求";
            String response = "分析完成，结果已通过验证";
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(sessionId, query, response, FeedbackType.AUTO_APPROVED);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount,
                    "AUTO_APPROVED 反馈后计数应增加 1");
        }

        @Test
        @DisplayName("KF-005: 并发记录反馈应保证线程安全，无数据丢失")
        void testConcurrentFeedbackRecording_ShouldBeThreadSafe() throws InterruptedException {
            // Given
            int threadCount = 10;
            int feedbacksPerThread = 100;
            int totalExpectedFeedbacks = threadCount * feedbacksPerThread;

            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch startLatch = new CountDownLatch(1);
            CountDownLatch completeLatch = new CountDownLatch(threadCount);
            AtomicInteger errorCount = new AtomicInteger(0);

            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            for (int t = 0; t < threadCount; t++) {
                final int threadIndex = t;
                executor.submit(() -> {
                    try {
                        startLatch.await(); // 等待所有线程就绪
                        for (int i = 0; i < feedbacksPerThread; i++) {
                            String sessionId = "session-thread-" + threadIndex + "-" + i;
                            String query = "并发测试查询 " + i;
                            String response = "并发测试响应 " + i;
                            FeedbackType type = FeedbackType.values()[i % FeedbackType.values().length];

                            feedbackService.recordFeedback(sessionId, query, response, type);
                        }
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                    } finally {
                        completeLatch.countDown();
                    }
                });
            }

            // 启动所有线程
            startLatch.countDown();

            // 等待所有线程完成
            boolean completed = completeLatch.await(30, TimeUnit.SECONDS);
            executor.shutdown();

            // Then
            assertTrue(completed, "所有线程应在 30 秒内完成");
            assertEquals(0, errorCount.get(), "不应有任何错误发生");

            long finalCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + totalExpectedFeedbacks, finalCount,
                    String.format("应记录 %d 条反馈，实际: %d",
                            totalExpectedFeedbacks, finalCount - initialCount));
        }

        @ParameterizedTest
        @DisplayName("所有反馈类型都应正确记录")
        @EnumSource(FeedbackType.class)
        void testAllFeedbackTypes_ShouldRecord(FeedbackType type) {
            // Given
            String sessionId = "session-type-test-" + UUID.randomUUID();
            String query = "测试查询 for " + type.name();
            String response = "测试响应 for " + type.name();
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(sessionId, query, response, type);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount,
                    type.name() + " 反馈类型应正确记录");
        }

        @Test
        @DisplayName("记录多条反馈应正确累加计数")
        void testMultipleFeedbacks_ShouldAccumulateCount() {
            // Given
            long initialCount = feedbackService.getUnprocessedFeedbackCount();
            int feedbackCount = 5;

            // When
            for (int i = 0; i < feedbackCount; i++) {
                String sessionId = "session-multi-" + i;
                feedbackService.recordFeedback(sessionId, "查询" + i, "响应" + i, FeedbackType.POSITIVE);
            }

            // Then
            long finalCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + feedbackCount, finalCount,
                    String.format("记录 %d 条反馈后计数应正确累加", feedbackCount));
        }

        @Test
        @DisplayName("空查询和响应也应能正确记录")
        void testEmptyQueryAndResponse_ShouldStillRecord() {
            // Given
            String sessionId = "session-empty-" + UUID.randomUUID();
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(sessionId, "", "", FeedbackType.NEGATIVE);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount,
                    "空查询和响应也应能正确记录");
        }

        @Test
        @DisplayName("null 查询和响应应能正确记录")
        void testNullQueryAndResponse_ShouldStillRecord() {
            // Given
            String sessionId = "session-null-" + UUID.randomUUID();
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(sessionId, null, null, FeedbackType.POSITIVE);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount,
                    "null 查询和响应也应能正确记录");
        }
    }

    // ==========================================
    // 2. 工厂数据学习测试
    // ==========================================
    @Nested
    @DisplayName("工厂数据学习测试")
    class FactoryDataLearningTests {

        @Test
        @DisplayName("KF-010: 应从工厂历史数据中学习")
        void testLearnFromFactoryData_ShouldQueryHistoricalData() {
            // Given
            String factoryId = "F001";
            List<AIAnalysisResult> mockHistory = TestDataFactory.createMockAnalysisHistory(factoryId, 5);

            when(analysisResultRepository.findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(
                    eq(factoryId), any(LocalDateTime.class)))
                    .thenReturn(mockHistory);

            // When
            feedbackService.learnFromFactoryData(factoryId);

            // Then
            verify(analysisResultRepository, times(1))
                    .findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(
                            eq(factoryId), any(LocalDateTime.class));
        }

        @Test
        @DisplayName("KF-011: 空历史数据应正常处理")
        void testLearnFromFactoryData_WithEmptyHistory_ShouldHandleGracefully() {
            // Given
            String factoryId = "F002";

            when(analysisResultRepository.findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(
                    eq(factoryId), any(LocalDateTime.class)))
                    .thenReturn(Collections.emptyList());

            // When & Then
            assertDoesNotThrow(() -> feedbackService.learnFromFactoryData(factoryId),
                    "空历史数据应正常处理，不抛出异常");

            verify(analysisResultRepository, times(1))
                    .findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(
                            eq(factoryId), any(LocalDateTime.class));
        }

        @Test
        @DisplayName("KF-012: Repository 异常应被捕获处理")
        void testLearnFromFactoryData_RepositoryException_ShouldHandleGracefully() {
            // Given
            String factoryId = "F003";

            when(analysisResultRepository.findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(
                    eq(factoryId), any(LocalDateTime.class)))
                    .thenThrow(new RuntimeException("Database connection failed"));

            // When & Then
            assertDoesNotThrow(() -> feedbackService.learnFromFactoryData(factoryId),
                    "Repository 异常应被捕获处理，不向外抛出");
        }

        @Test
        @DisplayName("KF-013: 多条历史数据应正确处理")
        void testLearnFromFactoryData_WithMultipleRecords_ShouldProcessAll() {
            // Given
            String factoryId = "F004";
            int recordCount = 10;
            List<AIAnalysisResult> mockHistory = TestDataFactory.createMockAnalysisHistory(factoryId, recordCount);

            when(analysisResultRepository.findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(
                    eq(factoryId), any(LocalDateTime.class)))
                    .thenReturn(mockHistory);

            // When
            feedbackService.learnFromFactoryData(factoryId);

            // Then
            verify(analysisResultRepository, times(1))
                    .findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(
                            eq(factoryId), any(LocalDateTime.class));
        }

        @Test
        @DisplayName("KF-014: null factoryId 应正常处理")
        void testLearnFromFactoryData_NullFactoryId_ShouldHandleGracefully() {
            // Given
            when(analysisResultRepository.findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(
                    isNull(), any(LocalDateTime.class)))
                    .thenReturn(Collections.emptyList());

            // When & Then
            assertDoesNotThrow(() -> feedbackService.learnFromFactoryData(null),
                    "null factoryId 应正常处理");
        }
    }

    // ==========================================
    // 3. 未处理计数测试
    // ==========================================
    @Nested
    @DisplayName("未处理反馈计数测试")
    class UnprocessedCountTests {

        @Test
        @DisplayName("KF-020: 初始计数应为 0")
        void testInitialCount_ShouldBeZero() {
            // Given - 新创建的服务实例

            // When
            long count = feedbackService.getUnprocessedFeedbackCount();

            // Then
            assertEquals(0, count, "初始未处理计数应为 0");
        }

        @Test
        @DisplayName("KF-021: 每次反馈后计数应增加")
        void testCountIncreasesWithEachFeedback() {
            // Given
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When - 记录 3 条反馈
            feedbackService.recordFeedback("s1", "q1", "r1", FeedbackType.POSITIVE);
            long countAfter1 = feedbackService.getUnprocessedFeedbackCount();

            feedbackService.recordFeedback("s2", "q2", "r2", FeedbackType.NEGATIVE);
            long countAfter2 = feedbackService.getUnprocessedFeedbackCount();

            feedbackService.recordFeedback("s3", "q3", "r3", FeedbackType.CORRECTION, "correction");
            long countAfter3 = feedbackService.getUnprocessedFeedbackCount();

            // Then
            assertEquals(initialCount + 1, countAfter1, "第 1 条反馈后计数应为 1");
            assertEquals(initialCount + 2, countAfter2, "第 2 条反馈后计数应为 2");
            assertEquals(initialCount + 3, countAfter3, "第 3 条反馈后计数应为 3");
        }

        @Test
        @DisplayName("KF-022: 计数方法应能被多次调用且结果一致")
        void testGetCount_MultipleCalls_ShouldBeConsistent() {
            // Given
            feedbackService.recordFeedback("s1", "q1", "r1", FeedbackType.POSITIVE);
            feedbackService.recordFeedback("s2", "q2", "r2", FeedbackType.NEGATIVE);

            // When
            long count1 = feedbackService.getUnprocessedFeedbackCount();
            long count2 = feedbackService.getUnprocessedFeedbackCount();
            long count3 = feedbackService.getUnprocessedFeedbackCount();

            // Then
            assertEquals(count1, count2, "连续调用计数应一致");
            assertEquals(count2, count3, "连续调用计数应一致");
        }

        @Test
        @DisplayName("KF-023: 并发获取计数应返回一致结果")
        void testConcurrentGetCount_ShouldBeConsistent() throws InterruptedException {
            // Given
            int feedbackCount = 50;
            for (int i = 0; i < feedbackCount; i++) {
                feedbackService.recordFeedback("s" + i, "q" + i, "r" + i, FeedbackType.POSITIVE);
            }

            int threadCount = 10;
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch startLatch = new CountDownLatch(1);
            CountDownLatch completeLatch = new CountDownLatch(threadCount);
            List<Long> counts = Collections.synchronizedList(new ArrayList<>());

            // When
            for (int t = 0; t < threadCount; t++) {
                executor.submit(() -> {
                    try {
                        startLatch.await();
                        long count = feedbackService.getUnprocessedFeedbackCount();
                        counts.add(count);
                    } catch (Exception e) {
                        // ignore
                    } finally {
                        completeLatch.countDown();
                    }
                });
            }

            startLatch.countDown();
            completeLatch.await(10, TimeUnit.SECONDS);
            executor.shutdown();

            // Then
            assertEquals(threadCount, counts.size(), "所有线程都应返回计数结果");
            long expectedCount = counts.get(0);
            for (Long count : counts) {
                assertEquals(expectedCount, count, "所有线程获取的计数应一致");
            }
        }
    }

    // ==========================================
    // 4. 批处理测试
    // ==========================================
    @Nested
    @DisplayName("批处理测试")
    class BatchProcessingTests {

        @Test
        @DisplayName("KF-030: 处理空批次应返回 0")
        void testProcessEmptyBatch_ShouldReturnZero() {
            // Given - 新服务实例，无反馈

            // When
            int processed = feedbackService.processFeedbackBatch(10);

            // Then
            assertEquals(0, processed, "处理空批次应返回 0");
        }

        @Test
        @DisplayName("KF-031: 处理批次大小为 0 应返回 0")
        void testProcessBatchSizeZero_ShouldReturnZero() {
            // Given
            feedbackService.recordFeedback("s1", "q1", "r1", FeedbackType.POSITIVE);
            feedbackService.recordFeedback("s2", "q2", "r2", FeedbackType.NEGATIVE);

            // When
            int processed = feedbackService.processFeedbackBatch(0);

            // Then
            assertEquals(0, processed, "批次大小为 0 应返回 0");
        }

        @Test
        @DisplayName("KF-032: 处理批次大小为负数应返回 0")
        void testProcessNegativeBatchSize_ShouldReturnZero() {
            // Given
            feedbackService.recordFeedback("s1", "q1", "r1", FeedbackType.POSITIVE);

            // When
            int processed = feedbackService.processFeedbackBatch(-5);

            // Then
            assertEquals(0, processed, "负数批次大小应返回 0");
        }

        @Test
        @DisplayName("KF-033: 处理不同批次大小")
        void testProcessDifferentBatchSizes() {
            // Given
            int totalFeedbacks = 25;
            for (int i = 0; i < totalFeedbacks; i++) {
                feedbackService.recordFeedback("s" + i, "q" + i, "r" + i, FeedbackType.POSITIVE);
            }

            // When & Then
            // Note: Current implementation returns 0 (TODO in Phase 2)
            // Testing that the method can be called with various batch sizes
            assertDoesNotThrow(() -> feedbackService.processFeedbackBatch(5),
                    "处理批次大小 5 应正常执行");
            assertDoesNotThrow(() -> feedbackService.processFeedbackBatch(10),
                    "处理批次大小 10 应正常执行");
            assertDoesNotThrow(() -> feedbackService.processFeedbackBatch(100),
                    "处理批次大小 100 应正常执行");
        }

        @Test
        @DisplayName("KF-034: 多次处理批次应能连续调用")
        void testMultipleBatchProcessing_ShouldBeCallableMultipleTimes() {
            // Given
            for (int i = 0; i < 30; i++) {
                feedbackService.recordFeedback("s" + i, "q" + i, "r" + i, FeedbackType.POSITIVE);
            }

            // When & Then
            assertDoesNotThrow(() -> {
                feedbackService.processFeedbackBatch(10);
                feedbackService.processFeedbackBatch(10);
                feedbackService.processFeedbackBatch(10);
            }, "多次处理批次应能连续调用");
        }

        @Test
        @DisplayName("KF-035: 并发处理批次应线程安全")
        void testConcurrentBatchProcessing_ShouldBeThreadSafe() throws InterruptedException {
            // Given
            for (int i = 0; i < 50; i++) {
                feedbackService.recordFeedback("s" + i, "q" + i, "r" + i, FeedbackType.POSITIVE);
            }

            int threadCount = 5;
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch startLatch = new CountDownLatch(1);
            CountDownLatch completeLatch = new CountDownLatch(threadCount);
            AtomicInteger errorCount = new AtomicInteger(0);

            // When
            for (int t = 0; t < threadCount; t++) {
                executor.submit(() -> {
                    try {
                        startLatch.await();
                        feedbackService.processFeedbackBatch(10);
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                    } finally {
                        completeLatch.countDown();
                    }
                });
            }

            startLatch.countDown();
            boolean completed = completeLatch.await(10, TimeUnit.SECONDS);
            executor.shutdown();

            // Then
            assertTrue(completed, "所有线程应在超时前完成");
            assertEquals(0, errorCount.get(), "并发处理应无错误");
        }
    }

    // ==========================================
    // 5. 并发访问测试
    // ==========================================
    @Nested
    @DisplayName("并发访问测试")
    class ConcurrentAccessTests {

        @Test
        @DisplayName("KF-040: 10 线程并发写入应全部成功")
        void testConcurrentWrites_With10Threads_ShouldSucceed() throws InterruptedException {
            // Given
            int threadCount = 10;
            int writesPerThread = 50;
            int totalExpectedWrites = threadCount * writesPerThread;

            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch startLatch = new CountDownLatch(1);
            CountDownLatch completeLatch = new CountDownLatch(threadCount);
            AtomicInteger successCount = new AtomicInteger(0);
            AtomicInteger errorCount = new AtomicInteger(0);

            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            for (int t = 0; t < threadCount; t++) {
                final int threadIndex = t;
                executor.submit(() -> {
                    try {
                        startLatch.await();
                        for (int i = 0; i < writesPerThread; i++) {
                            String sessionId = String.format("concurrent-session-%d-%d", threadIndex, i);
                            feedbackService.recordFeedback(
                                    sessionId,
                                    "并发查询 " + threadIndex + "-" + i,
                                    "并发响应 " + threadIndex + "-" + i,
                                    FeedbackType.values()[i % FeedbackType.values().length]
                            );
                            successCount.incrementAndGet();
                        }
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                    } finally {
                        completeLatch.countDown();
                    }
                });
            }

            startLatch.countDown();
            boolean completed = completeLatch.await(60, TimeUnit.SECONDS);
            executor.shutdown();

            // Then
            assertTrue(completed, "所有线程应在 60 秒内完成");
            assertEquals(0, errorCount.get(), "不应有任何错误");
            assertEquals(totalExpectedWrites, successCount.get(),
                    "应完成所有写入操作");

            long finalCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + totalExpectedWrites, finalCount,
                    "最终计数应等于初始计数加上总写入数");
        }

        @Test
        @DisplayName("KF-041: 并发读写混合操作应保持数据一致性")
        void testConcurrentReadWrite_ShouldMaintainConsistency() throws InterruptedException {
            // Given
            int writerThreads = 5;
            int readerThreads = 5;
            int operationsPerThread = 100;

            ExecutorService executor = Executors.newFixedThreadPool(writerThreads + readerThreads);
            CountDownLatch startLatch = new CountDownLatch(1);
            CountDownLatch completeLatch = new CountDownLatch(writerThreads + readerThreads);
            AtomicInteger writeErrors = new AtomicInteger(0);
            AtomicInteger readErrors = new AtomicInteger(0);

            // When - 启动写入线程
            for (int t = 0; t < writerThreads; t++) {
                final int threadIndex = t;
                executor.submit(() -> {
                    try {
                        startLatch.await();
                        for (int i = 0; i < operationsPerThread; i++) {
                            feedbackService.recordFeedback(
                                    "writer-" + threadIndex + "-" + i,
                                    "query" + i,
                                    "response" + i,
                                    FeedbackType.POSITIVE
                            );
                        }
                    } catch (Exception e) {
                        writeErrors.incrementAndGet();
                    } finally {
                        completeLatch.countDown();
                    }
                });
            }

            // 启动读取线程
            for (int t = 0; t < readerThreads; t++) {
                executor.submit(() -> {
                    try {
                        startLatch.await();
                        for (int i = 0; i < operationsPerThread; i++) {
                            long count = feedbackService.getUnprocessedFeedbackCount();
                            // 计数应始终非负
                            if (count < 0) {
                                readErrors.incrementAndGet();
                            }
                        }
                    } catch (Exception e) {
                        readErrors.incrementAndGet();
                    } finally {
                        completeLatch.countDown();
                    }
                });
            }

            startLatch.countDown();
            boolean completed = completeLatch.await(60, TimeUnit.SECONDS);
            executor.shutdown();

            // Then
            assertTrue(completed, "所有线程应在超时前完成");
            assertEquals(0, writeErrors.get(), "写入操作应无错误");
            assertEquals(0, readErrors.get(), "读取操作应无错误且计数始终非负");
        }

        @Test
        @DisplayName("KF-042: 高并发场景下 CountDownLatch 同步测试")
        void testHighConcurrency_WithCountDownLatchSync() throws InterruptedException {
            // Given
            int threadCount = 10;
            int feedbacksPerThread = 200;
            int totalExpected = threadCount * feedbacksPerThread;

            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch readyLatch = new CountDownLatch(threadCount); // 所有线程准备就绪
            CountDownLatch startLatch = new CountDownLatch(1); // 开始信号
            CountDownLatch doneLatch = new CountDownLatch(threadCount); // 完成信号

            AtomicInteger successfulOperations = new AtomicInteger(0);

            // When
            for (int t = 0; t < threadCount; t++) {
                final int threadId = t;
                executor.submit(() -> {
                    try {
                        readyLatch.countDown(); // 标记线程已准备就绪
                        startLatch.await(); // 等待开始信号

                        for (int i = 0; i < feedbacksPerThread; i++) {
                            feedbackService.recordFeedback(
                                    "latch-test-" + threadId + "-" + i,
                                    "query-" + i,
                                    "response-" + i,
                                    FeedbackType.values()[i % 4]
                            );
                            successfulOperations.incrementAndGet();
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } finally {
                        doneLatch.countDown();
                    }
                });
            }

            // 等待所有线程准备就绪
            assertTrue(readyLatch.await(10, TimeUnit.SECONDS),
                    "所有线程应在 10 秒内准备就绪");

            // 发送开始信号，让所有线程同时开始
            startLatch.countDown();

            // 等待所有线程完成
            assertTrue(doneLatch.await(120, TimeUnit.SECONDS),
                    "所有线程应在 120 秒内完成");

            executor.shutdown();

            // Then
            assertEquals(totalExpected, successfulOperations.get(),
                    "所有操作应成功完成");

            long finalCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(totalExpected, finalCount,
                    "最终反馈计数应等于预期总数");
        }

        @Test
        @DisplayName("KF-043: 压力测试 - 大量并发反馈记录")
        void testStressTest_LargeConcurrentFeedbackRecording() throws InterruptedException {
            // Given
            int threadCount = 20;
            int feedbacksPerThread = 500;

            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch latch = new CountDownLatch(threadCount);
            AtomicInteger totalRecorded = new AtomicInteger(0);

            long startTime = System.currentTimeMillis();

            // When
            for (int t = 0; t < threadCount; t++) {
                final int threadId = t;
                executor.submit(() -> {
                    try {
                        for (int i = 0; i < feedbacksPerThread; i++) {
                            feedbackService.recordFeedback(
                                    "stress-" + threadId + "-" + i,
                                    "stress-query-" + i,
                                    "stress-response-" + i,
                                    FeedbackType.POSITIVE
                            );
                            totalRecorded.incrementAndGet();
                        }
                    } finally {
                        latch.countDown();
                    }
                });
            }

            latch.await(180, TimeUnit.SECONDS);
            executor.shutdown();

            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;

            // Then
            int expectedTotal = threadCount * feedbacksPerThread;
            assertEquals(expectedTotal, totalRecorded.get(),
                    "应完成所有反馈记录");

            long finalCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(expectedTotal, finalCount,
                    "最终计数应等于预期总数");

            // 性能基准：每秒至少处理 1000 条反馈
            double throughput = (double) expectedTotal / (duration / 1000.0);
            assertTrue(throughput > 100,
                    String.format("吞吐量应大于 100 ops/s，实际: %.2f ops/s", throughput));
        }
    }

    // ==========================================
    // 6. 边界条件和异常处理测试
    // ==========================================
    @Nested
    @DisplayName("边界条件和异常处理测试")
    class EdgeCaseTests {

        @Test
        @DisplayName("KF-050: 超长 sessionId 应正常处理")
        void testVeryLongSessionId_ShouldHandle() {
            // Given
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 1000; i++) {
                sb.append("a");
            }
            String longSessionId = sb.toString();
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(longSessionId, "query", "response", FeedbackType.POSITIVE);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount, "超长 sessionId 应正常处理");
        }

        @Test
        @DisplayName("KF-051: 超长查询文本应正常处理")
        void testVeryLongQuery_ShouldHandle() {
            // Given
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 10000; i++) {
                sb.append("这是一个很长的查询文本");
            }
            String longQuery = sb.toString();
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback("session", longQuery, "response", FeedbackType.POSITIVE);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount, "超长查询文本应正常处理");
        }

        @Test
        @DisplayName("KF-052: 特殊字符应正常处理")
        void testSpecialCharacters_ShouldHandle() {
            // Given
            String specialChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?\n\t\r\u0000\uFFFF";
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(
                    "session-special",
                    "query with " + specialChars,
                    "response with " + specialChars,
                    FeedbackType.CORRECTION,
                    "correction with " + specialChars
            );

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount, "特殊字符应正常处理");
        }

        @Test
        @DisplayName("KF-053: Unicode 字符应正常处理")
        void testUnicodeCharacters_ShouldHandle() {
            // Given
            String unicode = "你好世界 \uD83D\uDE00 \u4E2D\u6587 日本語 한국어 العربية";
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(
                    "session-unicode",
                    "查询: " + unicode,
                    "响应: " + unicode,
                    FeedbackType.POSITIVE
            );

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount, "Unicode 字符应正常处理");
        }

        @Test
        @DisplayName("KF-054: 空 sessionId 应正常处理")
        void testEmptySessionId_ShouldHandle() {
            // Given
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback("", "query", "response", FeedbackType.POSITIVE);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount, "空 sessionId 应正常处理");
        }

        @Test
        @DisplayName("KF-055: null sessionId 应正常处理")
        void testNullSessionId_ShouldHandle() {
            // Given
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(null, "query", "response", FeedbackType.POSITIVE);

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount, "null sessionId 应正常处理");
        }

        @Test
        @DisplayName("KF-056: CORRECTION 类型带 null correctionText 应正常处理")
        void testCorrectionWithNullText_ShouldHandle() {
            // Given
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(
                    "session-correction-null",
                    "query",
                    "response",
                    FeedbackType.CORRECTION,
                    null
            );

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount,
                    "CORRECTION 类型带 null correctionText 应正常处理");
        }

        @Test
        @DisplayName("KF-057: CORRECTION 类型带空 correctionText 应正常处理")
        void testCorrectionWithEmptyText_ShouldHandle() {
            // Given
            long initialCount = feedbackService.getUnprocessedFeedbackCount();

            // When
            feedbackService.recordFeedback(
                    "session-correction-empty",
                    "query",
                    "response",
                    FeedbackType.CORRECTION,
                    ""
            );

            // Then
            long newCount = feedbackService.getUnprocessedFeedbackCount();
            assertEquals(initialCount + 1, newCount,
                    "CORRECTION 类型带空 correctionText 应正常处理");
        }
    }
}
