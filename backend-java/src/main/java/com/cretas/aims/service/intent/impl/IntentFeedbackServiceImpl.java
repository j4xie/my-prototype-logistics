package com.cretas.aims.service.intent.impl;

import com.cretas.aims.dto.intent.IntentFeedbackRequest;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.ExpressionLearningService;
import com.cretas.aims.service.KeywordEffectivenessService;
import com.cretas.aims.service.KeywordLearningService;
import com.cretas.aims.service.intent.IntentFeedbackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 意图反馈服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IntentFeedbackServiceImpl implements IntentFeedbackService {

    private final AIIntentConfigRepository intentRepository;
    private final KeywordEffectivenessService keywordEffectivenessService;
    private final KeywordLearningService keywordLearningService;
    private final ExpressionLearningService expressionLearningService;

    @Override
    public void recordPositiveFeedback(String factoryId, String intentCode, List<String> matchedKeywords) {
        if (factoryId == null || intentCode == null) {
            log.warn("recordPositiveFeedback: factoryId or intentCode is null");
            return;
        }

        try {
            // 增加匹配关键词的有效性分数
            for (String keyword : matchedKeywords) {
                keywordEffectivenessService.updateEffectiveness(
                        factoryId, intentCode, keyword, true);
            }
            log.debug("Recorded positive feedback for intent {} with {} keywords",
                    intentCode, matchedKeywords.size());
        } catch (Exception e) {
            log.warn("记录正向反馈失败: {}", e.getMessage());
        }
    }

    @Override
    public void recordNegativeFeedback(String factoryId, String rejectedIntentCode,
                                        String selectedIntentCode, List<String> matchedKeywords) {
        if (factoryId == null || rejectedIntentCode == null) {
            log.warn("recordNegativeFeedback: factoryId or rejectedIntentCode is null");
            return;
        }

        try {
            // 降低被拒绝意图的关键词有效性
            for (String keyword : matchedKeywords) {
                keywordEffectivenessService.updateEffectiveness(
                        factoryId, rejectedIntentCode, keyword, false);
            }

            // 如果用户选择了正确意图，尝试学习关键词
            if (selectedIntentCode != null && !selectedIntentCode.isEmpty()) {
                tryLearnKeywordsForSelectedIntent(factoryId, selectedIntentCode, matchedKeywords);
            }

            log.debug("Recorded negative feedback: rejected={}, selected={}, keywords={}",
                    rejectedIntentCode, selectedIntentCode, matchedKeywords.size());
        } catch (Exception e) {
            log.warn("记录负向反馈失败: {}", e.getMessage());
        }
    }

    @Override
    public void processIntentFeedback(String factoryId, Long userId, IntentFeedbackRequest request) {
        if (request == null) {
            log.warn("processIntentFeedback: request is null");
            return;
        }

        String feedbackType = request.getFeedbackType();
        if ("POSITIVE".equalsIgnoreCase(feedbackType)) {
            recordPositiveFeedback(factoryId, request.getIntentCode(), request.getMatchedKeywords());
        } else if ("NEGATIVE".equalsIgnoreCase(feedbackType)) {
            recordNegativeFeedback(factoryId, request.getIntentCode(),
                    request.getSelectedIntentCode(), request.getMatchedKeywords());
        } else {
            log.warn("Unknown feedback type: {}", feedbackType);
        }
    }

    @Override
    public int tryAutoLearnKeywords(String factoryId, String intentCode, List<String> keywords) {
        if (factoryId == null || intentCode == null || keywords == null || keywords.isEmpty()) {
            return 0;
        }

        return keywordLearningService.learnFromUserFeedback(factoryId, intentCode, keywords);
    }

    @Override
    public boolean tryAutoLearnExpression(String factoryId, String intentCode, String expression) {
        if (factoryId == null || intentCode == null || expression == null || expression.isBlank()) {
            return false;
        }

        try {
            expressionLearningService.learnExpression(factoryId, intentCode, expression);
            return true;
        } catch (Exception e) {
            log.warn("自动学习表达式失败: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 尝试将关键词学习到用户选择的正确意图
     */
    @CacheEvict(value = {"allIntents", "intentsByCategory", "intentCategories", "intentsBySensitivity",
            "allIntents_legacy", "intentsByCategory_legacy", "intentCategories_legacy"}, allEntries = true)
    private void tryLearnKeywordsForSelectedIntent(String factoryId, String selectedIntentCode, List<String> keywords) {
        int added = keywordLearningService.learnFromUserFeedback(factoryId, selectedIntentCode, keywords);
        if (added > 0) {
            log.info("Learned {} keywords for intent {} in factory {}", added, selectedIntentCode, factoryId);
        }
    }
}
