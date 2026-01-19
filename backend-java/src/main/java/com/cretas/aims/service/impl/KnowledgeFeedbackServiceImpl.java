package com.cretas.aims.service.impl;

import com.cretas.aims.service.KnowledgeFeedbackService;
import com.cretas.aims.entity.AIAnalysisResult;
import com.cretas.aims.repository.AIAnalysisResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 知识库反馈服务实现
 *
 * 当前实现使用内存存储，后续版本将迁移到数据库。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeFeedbackServiceImpl implements KnowledgeFeedbackService {

    private final AIAnalysisResultRepository analysisResultRepository;

    // 内存反馈存储 (后续迁移到数据库)
    private final ConcurrentMap<String, FeedbackRecord> feedbackStore = new ConcurrentHashMap<>();
    private final AtomicLong feedbackCounter = new AtomicLong(0);

    @Override
    public void recordFeedback(String sessionId, String query, String response, FeedbackType type) {
        recordFeedback(sessionId, query, response, type, null);
    }

    @Override
    public void recordFeedback(String sessionId, String query, String response,
                               FeedbackType type, String correctionText) {
        String feedbackId = "fb_" + feedbackCounter.incrementAndGet();

        FeedbackRecord record = new FeedbackRecord(
                feedbackId,
                sessionId,
                query,
                response,
                type,
                correctionText,
                LocalDateTime.now(),
                false
        );

        feedbackStore.put(feedbackId, record);

        log.info("📝 记录反馈: feedbackId={}, type={}, sessionId={}, query='{}'",
                feedbackId, type, sessionId,
                query != null && query.length() > 30 ? query.substring(0, 30) + "..." : query);
    }

    @Override
    public void learnFromFactoryData(String factoryId) {
        log.info("🎓 开始从工厂数据学习: factoryId={}", factoryId);

        try {
            // 获取所有有效（未过期）的分析结果
            LocalDateTime now = LocalDateTime.now();
            List<AIAnalysisResult> historicalAnalysis = analysisResultRepository
                    .findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(factoryId, now);

            if (historicalAnalysis.isEmpty()) {
                log.info("未找到工厂历史分析数据: factoryId={}", factoryId);
                return;
            }

            // TODO: Phase 2 实现 - 提取模式并存入向量数据库
            // 1. 提取有价值的模式
            // 2. 生成知识条目
            // 3. 存入向量数据库

            log.info("✅ 工厂数据学习完成: factoryId={}, recordCount={}",
                    factoryId, historicalAnalysis.size());

        } catch (Exception e) {
            log.error("❌ 工厂数据学习失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
        }
    }

    @Override
    public long getUnprocessedFeedbackCount() {
        return feedbackStore.values().stream()
                .filter(f -> !f.processed)
                .count();
    }

    @Override
    public int processFeedbackBatch(int batchSize) {
        // TODO: Phase 2 实现 - 处理反馈并更新知识库
        log.info("处理反馈批次: batchSize={}, unprocessed={}",
                batchSize, getUnprocessedFeedbackCount());
        return 0;
    }

    /**
     * 反馈记录内部类
     */
    private static class FeedbackRecord {
        final String feedbackId;
        final String sessionId;
        final String query;
        final String response;
        final FeedbackType type;
        final String correctionText;
        final LocalDateTime createdAt;
        boolean processed;

        FeedbackRecord(String feedbackId, String sessionId, String query, String response,
                      FeedbackType type, String correctionText, LocalDateTime createdAt, boolean processed) {
            this.feedbackId = feedbackId;
            this.sessionId = sessionId;
            this.query = query;
            this.response = response;
            this.type = type;
            this.correctionText = correctionText;
            this.createdAt = createdAt;
            this.processed = processed;
        }
    }
}
