package com.cretas.aims.service.impl;

import com.cretas.aims.dto.intent.IntentFeedbackRequest;
import com.cretas.aims.entity.learning.TrainingSample;
import com.cretas.aims.repository.learning.TrainingSampleRepository;
import com.cretas.aims.service.IntentFeedbackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 意图反馈服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IntentFeedbackServiceImpl implements IntentFeedbackService {

    private final TrainingSampleRepository trainingSampleRepository;

    @Override
    @Transactional
    public void recordPositiveFeedback(String factoryId, String intentCode, List<String> matchedKeywords) {
        log.debug("Recording positive feedback for intent: {} in factory: {}", intentCode, factoryId);

        // 更新最近的训练样本为已确认正确
        trainingSampleRepository.findTopByFactoryIdAndMatchedIntentCodeOrderByCreatedAtDesc(factoryId, intentCode)
                .ifPresent(sample -> {
                    sample.setIsCorrect(true);
                    sample.setFeedbackAt(LocalDateTime.now());
                    trainingSampleRepository.save(sample);
                    log.info("Positive feedback recorded for sample: {}", sample.getId());
                });
    }

    @Override
    @Transactional
    public void recordNegativeFeedback(String factoryId, String rejectedIntentCode,
                                        String selectedIntentCode, List<String> matchedKeywords) {
        log.debug("Recording negative feedback: rejected={}, selected={} in factory: {}",
                rejectedIntentCode, selectedIntentCode, factoryId);

        // 更新最近的训练样本为错误，并记录正确意图
        trainingSampleRepository.findTopByFactoryIdAndMatchedIntentCodeOrderByCreatedAtDesc(factoryId, rejectedIntentCode)
                .ifPresent(sample -> {
                    sample.setIsCorrect(false);
                    sample.setCorrectIntentCode(selectedIntentCode);
                    sample.setFeedbackAt(LocalDateTime.now());
                    trainingSampleRepository.save(sample);
                    log.info("Negative feedback recorded for sample: {}, correct intent: {}",
                            sample.getId(), selectedIntentCode);
                });
    }

    @Override
    @Transactional
    public void processIntentFeedback(String factoryId, Long userId, IntentFeedbackRequest request) {
        log.debug("Processing intent feedback from user {} in factory {}: {}",
                userId, factoryId, request);

        if (request.isConfirmed()) {
            recordPositiveFeedback(factoryId, request.getMatchedIntentCode(), request.getMatchedKeywords());
        } else {
            recordNegativeFeedback(factoryId, request.getMatchedIntentCode(),
                    request.getSelectedIntentCode(), request.getMatchedKeywords());
        }
    }
}
