package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.RecommendationLog;
import com.joolun.mall.entity.UserBehaviorEvent;
import com.joolun.mall.mapper.RecommendationLogMapper;
import com.joolun.mall.mapper.UserBehaviorEventMapper;
import com.joolun.mall.service.CTRPredictionService;
import com.joolun.mall.service.FeedbackProcessorService;
import com.joolun.mall.service.SimulatedFeedbackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * 反馈处理服务实现
 *
 * 核心功能:
 * 1. 处理真实用户反馈: UserBehaviorEvent → RecommendationLog.isClicked
 * 2. 处理模拟反馈: 调用SimulatedFeedbackService生成反馈
 * 3. 训练CTR模型: 从反馈数据提取训练样本
 *
 * 定时任务:
 * - 每10分钟处理真实反馈 (当有真实数据时)
 * - 每小时处理模拟反馈 (当前阶段)
 *
 * @author Recommendation Enhancement
 * @since 2026-01-20
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeedbackProcessorServiceImpl implements FeedbackProcessorService {

    private final RecommendationLogMapper recommendationLogMapper;
    private final UserBehaviorEventMapper behaviorEventMapper;
    private final SimulatedFeedbackService simulatedFeedbackService;
    private final CTRPredictionService ctrPredictionService;

    // 统计信息
    private final AtomicLong totalProcessedReal = new AtomicLong(0);
    private final AtomicLong totalProcessedSimulated = new AtomicLong(0);
    private volatile LocalDateTime lastProcessTime;

    // 处理窗口 (匹配推荐日志和行为事件的时间窗口，分钟)
    private static final int MATCHING_WINDOW_MINUTES = 60;

    @Override
    @Transactional
    public Map<String, Object> processRealFeedback() {
        log.info("开始处理真实用户反馈");
        long startTime = System.currentTimeMillis();

        Map<String, Object> stats = new LinkedHashMap<>();
        int processedClicks = 0;
        int processedPurchases = 0;
        int matchedLogs = 0;

        try {
            // 1. 查询最近的点击事件
            LocalDateTime cutoffTime = LocalDateTime.now().minusMinutes(MATCHING_WINDOW_MINUTES);

            LambdaQueryWrapper<UserBehaviorEvent> clickWrapper = new LambdaQueryWrapper<>();
            clickWrapper.eq(UserBehaviorEvent::getEventType, "click")
                    .ge(UserBehaviorEvent::getEventTime, cutoffTime);

            List<UserBehaviorEvent> clickEvents = behaviorEventMapper.selectList(clickWrapper);
            log.info("获取到点击事件: {} 条", clickEvents.size());

            // 2. 处理点击事件
            for (UserBehaviorEvent event : clickEvents) {
                boolean matched = processClickEvent(event.getWxUserId(), event.getTargetId());
                if (matched) {
                    matchedLogs++;
                }
                processedClicks++;
            }

            // 3. 查询最近的购买事件
            LambdaQueryWrapper<UserBehaviorEvent> purchaseWrapper = new LambdaQueryWrapper<>();
            purchaseWrapper.eq(UserBehaviorEvent::getEventType, "purchase")
                    .ge(UserBehaviorEvent::getEventTime, cutoffTime);

            List<UserBehaviorEvent> purchaseEvents = behaviorEventMapper.selectList(purchaseWrapper);
            log.info("获取到购买事件: {} 条", purchaseEvents.size());

            // 4. 处理购买事件
            for (UserBehaviorEvent event : purchaseEvents) {
                processPurchaseEvent(event.getWxUserId(), event.getTargetId());
                processedPurchases++;
            }

            // 5. 如果有新反馈，训练CTR模型
            if (matchedLogs > 0) {
                trainCTRFromRecentFeedback(1);  // 训练最近1天的反馈
            }

            // 更新统计
            totalProcessedReal.addAndGet(processedClicks + processedPurchases);
            lastProcessTime = LocalDateTime.now();

            long elapsed = System.currentTimeMillis() - startTime;

            stats.put("processedClicks", processedClicks);
            stats.put("processedPurchases", processedPurchases);
            stats.put("matchedLogs", matchedLogs);
            stats.put("elapsedMs", elapsed);

            log.info("真实反馈处理完成: clicks={}, purchases={}, matched={}, elapsed={}ms",
                    processedClicks, processedPurchases, matchedLogs, elapsed);

            return stats;

        } catch (Exception e) {
            log.error("处理真实反馈失败", e);
            stats.put("error", e.getMessage());
            stats.put("processedClicks", processedClicks);
            stats.put("processedPurchases", processedPurchases);
            stats.put("matchedLogs", matchedLogs);
            return stats;
        }
    }

    @Override
    public Map<String, Object> processSimulatedFeedback() {
        log.info("开始处理模拟反馈");

        try {
            // 调用模拟反馈服务
            Map<String, Object> generateStats = simulatedFeedbackService.generateSimulatedFeedback(7);

            // 训练CTR模型
            Map<String, Object> trainStats = simulatedFeedbackService.trainCTRModelFromFeedback();

            // 更新统计
            Object processed = generateStats.get("processed");
            if (processed instanceof Number) {
                totalProcessedSimulated.addAndGet(((Number) processed).longValue());
            }
            lastProcessTime = LocalDateTime.now();

            // 合并统计
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("generateStats", generateStats);
            result.put("trainStats", trainStats);
            result.put("success", true);

            log.info("模拟反馈处理完成");
            return result;

        } catch (Exception e) {
            log.error("处理模拟反馈失败", e);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    @Override
    public Map<String, Object> trainCTRFromRecentFeedback(int days) {
        log.info("从最近{}天反馈训练CTR模型", days);

        Map<String, Object> stats = new LinkedHashMap<>();

        try {
            // 获取有反馈的推荐日志
            List<RecommendationLog> feedbackLogs = recommendationLogMapper.selectWithFeedback(days);
            log.info("获取到反馈日志: {} 条", feedbackLogs.size());

            if (feedbackLogs.isEmpty()) {
                stats.put("samples", 0);
                stats.put("success", true);
                stats.put("message", "没有反馈数据");
                return stats;
            }

            // 构建训练数据
            List<CTRPredictionService.CTRFeedback> trainingData = feedbackLogs.stream()
                    .filter(log -> log.getWxUserId() != null && log.getProductId() != null)
                    .map(log -> new CTRPredictionService.CTRFeedback(
                            log.getWxUserId(),
                            log.getProductId(),
                            Boolean.TRUE.equals(log.getIsClicked())))
                    .collect(Collectors.toList());

            // 批量训练
            ctrPredictionService.batchUpdateModel(trainingData);

            // 计算统计
            long positiveCount = feedbackLogs.stream()
                    .filter(log -> Boolean.TRUE.equals(log.getIsClicked()))
                    .count();
            double positiveRate = (double) positiveCount / feedbackLogs.size();

            stats.put("samples", trainingData.size());
            stats.put("positiveSamples", positiveCount);
            stats.put("positiveRate", String.format("%.4f", positiveRate));
            stats.put("success", true);

            log.info("CTR模型训练完成: samples={}, positiveRate={:.2%}",
                    trainingData.size(), positiveRate);

            return stats;

        } catch (Exception e) {
            log.error("训练CTR模型失败", e);
            stats.put("success", false);
            stats.put("error", e.getMessage());
            return stats;
        }
    }

    @Override
    @Transactional
    public boolean processClickEvent(String wxUserId, String productId) {
        if (wxUserId == null || productId == null) {
            return false;
        }

        try {
            // 更新推荐日志的点击状态
            int updated = recommendationLogMapper.updateClicked(wxUserId, productId);

            if (updated > 0) {
                log.debug("更新点击状态成功: wxUserId={}, productId={}", wxUserId, productId);
                return true;
            } else {
                log.debug("未找到匹配的推荐日志: wxUserId={}, productId={}", wxUserId, productId);
                return false;
            }

        } catch (Exception e) {
            log.warn("处理点击事件失败: wxUserId={}, productId={}, error={}",
                    wxUserId, productId, e.getMessage());
            return false;
        }
    }

    @Override
    @Transactional
    public boolean processPurchaseEvent(String wxUserId, String productId) {
        if (wxUserId == null || productId == null) {
            return false;
        }

        try {
            // 更新推荐日志的购买状态
            int updated = recommendationLogMapper.updatePurchased(wxUserId, productId);

            if (updated > 0) {
                log.debug("更新购买状态成功: wxUserId={}, productId={}", wxUserId, productId);
                return true;
            } else {
                log.debug("未找到匹配的推荐日志: wxUserId={}, productId={}", wxUserId, productId);
                return false;
            }

        } catch (Exception e) {
            log.warn("处理购买事件失败: wxUserId={}, productId={}, error={}",
                    wxUserId, productId, e.getMessage());
            return false;
        }
    }

    @Override
    public Map<String, Object> getProcessingStats() {
        Map<String, Object> stats = new LinkedHashMap<>();

        stats.put("totalProcessedReal", totalProcessedReal.get());
        stats.put("totalProcessedSimulated", totalProcessedSimulated.get());
        stats.put("lastProcessTime", lastProcessTime);

        // 获取CTR模型统计
        Map<String, Object> ctrStats = ctrPredictionService.getModelStats();
        stats.put("ctrModelSamples", ctrStats.get("totalSamples"));
        stats.put("ctrPositiveRate", ctrStats.get("positiveRate"));

        // 获取最近反馈统计
        try {
            Map<String, Object> feedbackStats = recommendationLogMapper.selectFeedbackStats(7);
            stats.put("recentFeedbackStats", feedbackStats);
        } catch (Exception e) {
            log.warn("获取反馈统计失败: {}", e.getMessage());
        }

        return stats;
    }

    // ==================== 定时任务 ====================

    /**
     * 每10分钟处理真实反馈
     */
    @Scheduled(fixedRate = 600000)
    public void scheduledProcessRealFeedback() {
        log.debug("定时任务: 处理真实反馈");
        try {
            processRealFeedback();
        } catch (Exception e) {
            log.error("定时处理真实反馈失败", e);
        }
    }

    /**
     * 每小时处理模拟反馈 (当前阶段使用)
     * 生产环境可禁用此任务
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void scheduledProcessSimulatedFeedback() {
        log.info("定时任务: 处理模拟反馈");
        try {
            processSimulatedFeedback();
        } catch (Exception e) {
            log.error("定时处理模拟反馈失败", e);
        }
    }

    /**
     * 每天凌晨3点训练CTR模型
     */
    @Scheduled(cron = "0 0 3 * * ?")
    public void scheduledTrainCTR() {
        log.info("定时任务: 训练CTR模型");
        try {
            trainCTRFromRecentFeedback(7);  // 训练最近7天的反馈
        } catch (Exception e) {
            log.error("定时训练CTR模型失败", e);
        }
    }
}
