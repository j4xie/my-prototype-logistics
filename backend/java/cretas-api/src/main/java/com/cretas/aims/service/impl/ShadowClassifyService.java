package com.cretas.aims.service.impl;

import com.cretas.aims.config.IntentMatchingConfig;
import com.cretas.aims.dto.ClassifierResult;
import com.cretas.aims.repository.IntentMatchRecordRepository;
import com.cretas.aims.service.ClassifierIntentMatcher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 影子分类服务
 *
 * 在 PHRASE_MATCH 路径异步调用 BERT 分类器，
 * 对比短语匹配与 ML 分类的一致性，不影响主流程延迟。
 *
 * 数据用于：
 * 1. 评估 PHRASE_MATCH 规则质量
 * 2. 发现 BERT 分类器可替代短语匹配的意图
 * 3. 收集不一致样本用于模型改进
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-27
 */
@Slf4j
@Service
public class ShadowClassifyService {

    @Autowired(required = false)
    private ClassifierIntentMatcher classifierIntentMatcher;

    @Autowired
    private IntentMatchRecordRepository recordRepository;

    @Autowired
    private IntentMatchingConfig matchingConfig;

    /**
     * 异步影子分类：对 PHRASE_MATCH 记录运行 BERT 分类器并记录对比结果
     *
     * @param recordId           已保存的 IntentMatchRecord ID
     * @param userInput          用户原始输入
     * @param phraseMatchedIntent PHRASE_MATCH 命中的意图代码
     */
    @Async("aiAnalysisExecutor")
    @Transactional
    public void shadowClassify(String recordId, String userInput, String phraseMatchedIntent) {
        if (recordId == null || classifierIntentMatcher == null || !classifierIntentMatcher.isAvailable()) {
            return;
        }

        // 采样控制
        double sampleRate = matchingConfig.getShadowModeSampleRate();
        if (sampleRate < 1.0 && ThreadLocalRandom.current().nextDouble() > sampleRate) {
            return;
        }

        try {
            long startMs = System.currentTimeMillis();
            Optional<ClassifierResult> classifierResult = classifierIntentMatcher.classify(userInput);
            long latencyMs = System.currentTimeMillis() - startMs;

            if (classifierResult.isEmpty()) {
                log.debug("[Shadow] Classifier returned empty for input='{}', recordId={}", userInput, recordId);
                return;
            }

            ClassifierResult result = classifierResult.get();
            String shadowIntent = result.getIntentCode();
            double shadowConf = result.getConfidence();
            boolean agreed = shadowIntent != null && shadowIntent.equals(phraseMatchedIntent);

            int updated = recordRepository.updateShadowResult(
                    recordId,
                    shadowIntent,
                    BigDecimal.valueOf(shadowConf),
                    agreed,
                    result.getEntropy() != null ? BigDecimal.valueOf(result.getEntropy()) : null,
                    result.getMargin() != null ? BigDecimal.valueOf(result.getMargin()) : null,
                    result.getMaxLogit() != null ? BigDecimal.valueOf(result.getMaxLogit()) : null
            );

            if (!agreed) {
                // R4.2: Shadow disagreement → mark as ZPD boundary for active learning
                recordRepository.markZpdBoundary(recordId);
                log.info("[Shadow] DISAGREEMENT+ZPD: input='{}', phrase={}, bert={} (conf={}, latency={}ms)",
                        userInput, phraseMatchedIntent, shadowIntent,
                        String.format("%.4f", shadowConf), latencyMs);
            } else {
                log.debug("[Shadow] Agreed: input='{}', intent={}, conf={}, latency={}ms",
                        userInput, phraseMatchedIntent, String.format("%.4f", shadowConf), latencyMs);
            }

        } catch (Exception e) {
            log.warn("[Shadow] Failed for recordId={}: {}", recordId, e.getMessage());
        }
    }
}
