package com.cretas.aims.service.intent.impl;

import com.cretas.aims.dto.intent.IntentFeedbackRequest;
import com.cretas.aims.service.IntentFeedbackService;
import com.cretas.aims.service.intent.IntentFeedbackLearningService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Intent Feedback & Learning Service Implementation
 *
 * Delegates feedback recording to IntentFeedbackService.
 *
 * @author Cretas Team
 * @version 2.0.0 (refactored from AIIntentServiceImpl)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IntentFeedbackLearningServiceImpl implements IntentFeedbackLearningService {

    private final IntentFeedbackService intentFeedbackService;

    @Override
    @Transactional
    public void recordPositiveFeedback(String factoryId, String intentCode, List<String> matchedKeywords) {
        log.debug("recordPositiveFeedback(factoryId={}, intentCode={}, keywordCount={})",
                factoryId, intentCode, matchedKeywords != null ? matchedKeywords.size() : 0);
        intentFeedbackService.recordPositiveFeedback(factoryId, intentCode, matchedKeywords);
    }

    @Override
    @Transactional
    public void recordNegativeFeedback(String factoryId, String rejectedIntentCode,
                                        String selectedIntentCode, List<String> matchedKeywords) {
        log.debug("recordNegativeFeedback(factoryId={}, rejectedIntent={}, selectedIntent={})",
                factoryId, rejectedIntentCode, selectedIntentCode);
        intentFeedbackService.recordNegativeFeedback(factoryId, rejectedIntentCode,
                selectedIntentCode, matchedKeywords);
    }

    @Override
    @Transactional
    public void processIntentFeedback(String factoryId, Long userId, IntentFeedbackRequest request) {
        log.debug("processIntentFeedback(factoryId={}, userId={}, matchedIntent={})",
                factoryId, userId, request.getMatchedIntentCode());
        intentFeedbackService.processIntentFeedback(factoryId, userId, request);
    }
}
