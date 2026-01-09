package com.joolun.mall.event;

import com.joolun.mall.service.ABTestService;
import com.joolun.mall.service.RealtimeFeatureService;
import com.joolun.mall.service.RecommendMetricsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 用户行为事件监听器
 * 异步处理用户行为，更新实时特征和指标
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserBehaviorEventListener {

    private final RealtimeFeatureService realtimeFeatureService;
    private final RecommendMetricsService recommendMetricsService;
    private final ABTestService abTestService;

    /**
     * 异步处理用户行为事件
     */
    @Async
    @EventListener
    public void handleUserBehaviorEvent(UserBehaviorEvent event) {
        try {
            Long userId = event.getUserId();
            String productId = event.getProductId();
            String source = event.getSource();
            double value = event.getValue();

            switch (event.getBehaviorType()) {
                case VIEW:
                    handleViewEvent(userId, productId, (int) value);
                    break;

                case CLICK:
                    handleClickEvent(userId, productId, source);
                    break;

                case SEARCH:
                    handleSearchEvent(userId, productId, (int) value);
                    break;

                case PURCHASE:
                    handlePurchaseEvent(userId, productId, value, source);
                    break;

                case FAVORITE:
                    handleFavoriteEvent(userId, productId, true);
                    break;

                case UNFAVORITE:
                    handleFavoriteEvent(userId, productId, false);
                    break;

                case AI_CHAT:
                    handleAiChatEvent(userId, productId);
                    break;

                default:
                    log.debug("未处理的行为类型: {}", event.getBehaviorType());
            }

        } catch (Exception e) {
            log.error("处理用户行为事件失败: {}", event, e);
        }
    }

    /**
     * 处理浏览事件
     */
    private void handleViewEvent(Long userId, String productId, int duration) {
        // 1. 更新实时特征
        realtimeFeatureService.recordView(userId, productId, duration);

        // 2. 记录曝光指标
        recommendMetricsService.recordImpressions(userId, List.of(productId), "view");

        log.debug("处理浏览事件: userId={}, productId={}, duration={}s", userId, productId, duration);
    }

    /**
     * 处理点击事件
     */
    private void handleClickEvent(Long userId, String productId, String source) {
        // 1. 更新实时特征
        realtimeFeatureService.recordClick(userId, productId, source);

        // 2. 记录点击指标
        recommendMetricsService.recordClick(userId, productId, source);

        // 3. 记录A/B测试指标
        abTestService.recordMetric(userId, ABTestService.EXP_VECTOR_SEARCH, "click", 1);
        abTestService.recordMetric(userId, ABTestService.EXP_RAG_KNOWLEDGE, "click", 1);

        log.debug("处理点击事件: userId={}, productId={}, source={}", userId, productId, source);
    }

    /**
     * 处理搜索事件
     */
    private void handleSearchEvent(Long userId, String query, int resultCount) {
        // 1. 更新实时特征
        realtimeFeatureService.recordSearch(userId, query, resultCount);

        // 2. 记录A/B测试指标
        if (resultCount == 0) {
            abTestService.recordMetric(userId, ABTestService.EXP_VECTOR_SEARCH, "no_result", 1);
        } else {
            abTestService.recordMetric(userId, ABTestService.EXP_VECTOR_SEARCH, "has_result", 1);
        }

        log.debug("处理搜索事件: userId={}, query={}, resultCount={}", userId, query, resultCount);
    }

    /**
     * 处理购买事件
     */
    private void handlePurchaseEvent(Long userId, String productId, double amount, String source) {
        // 1. 更新实时特征
        realtimeFeatureService.recordPurchase(userId, productId, amount);

        // 2. 记录购买指标
        recommendMetricsService.recordPurchase(userId, productId, amount, source);

        // 3. 记录A/B测试指标
        abTestService.recordMetric(userId, ABTestService.EXP_VECTOR_SEARCH, "purchase", 1);
        abTestService.recordMetric(userId, ABTestService.EXP_VECTOR_SEARCH, "gmv", amount);
        abTestService.recordMetric(userId, ABTestService.EXP_RAG_KNOWLEDGE, "purchase", 1);
        abTestService.recordMetric(userId, ABTestService.EXP_FEATURE_128D, "purchase", 1);

        log.debug("处理购买事件: userId={}, productId={}, amount={}", userId, productId, amount);
    }

    /**
     * 处理收藏事件
     */
    private void handleFavoriteEvent(Long userId, String productId, boolean isFavorite) {
        // 更新实时特征
        realtimeFeatureService.recordFavorite(userId, productId, isFavorite);

        log.debug("处理收藏事件: userId={}, productId={}, isFavorite={}", userId, productId, isFavorite);
    }

    /**
     * 处理AI对话事件
     */
    private void handleAiChatEvent(Long userId, String sessionId) {
        // 记录A/B测试指标
        abTestService.recordMetric(userId, ABTestService.EXP_RAG_KNOWLEDGE, "ai_chat", 1);
        abTestService.recordMetric(userId, ABTestService.EXP_EXPRESS_MATCH, "ai_chat", 1);

        log.debug("处理AI对话事件: userId={}, sessionId={}", userId, sessionId);
    }
}
