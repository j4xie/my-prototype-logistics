package com.cretas.aims.service.intent;

import com.cretas.aims.dto.intent.IntentFeedbackRequest;

import java.util.List;

/**
 * Intent Feedback & Learning Service
 *
 * Handles user feedback recording, keyword learning triggers,
 * expression learning, and active learning sample collection.
 *
 * @author Cretas Team
 * @version 2.0.0 (refactored from AIIntentServiceImpl)
 */
public interface IntentFeedbackLearningService {

    /**
     * Record positive feedback (user confirmed match is correct).
     */
    void recordPositiveFeedback(String factoryId, String intentCode, List<String> matchedKeywords);

    /**
     * Record negative feedback (user rejected match and selected another).
     */
    void recordNegativeFeedback(String factoryId, String rejectedIntentCode,
                                 String selectedIntentCode, List<String> matchedKeywords);

    /**
     * Process intent feedback (user correction triggers auto-learning).
     */
    void processIntentFeedback(String factoryId, Long userId, IntentFeedbackRequest request);
}
