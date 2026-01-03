package com.cretas.aims.service.impl;

import com.cretas.aims.entity.intent.KeywordEffectiveness;
import com.cretas.aims.repository.KeywordEffectivenessRepository;
import com.cretas.aims.service.KeywordEffectivenessService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 关键词效果追踪服务实现
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KeywordEffectivenessServiceImpl implements KeywordEffectivenessService {

    private final KeywordEffectivenessRepository keywordEffectivenessRepository;

    @Override
    @Transactional
    public void recordFeedback(String factoryId, String intentCode, String keyword, boolean isPositive) {
        Optional<KeywordEffectiveness> existing = keywordEffectivenessRepository
            .findByFactoryIdAndIntentCodeAndKeyword(factoryId, intentCode, keyword);

        if (existing.isPresent()) {
            KeywordEffectiveness record = existing.get();
            if (isPositive) {
                record.recordPositiveFeedback();
                log.info("记录正向反馈: factory={}, intent={}, keyword={}, " +
                         "positive={}, negative={}, score={}",
                    factoryId, intentCode, keyword,
                    record.getPositiveCount(), record.getNegativeCount(),
                    record.getEffectivenessScore());
            } else {
                record.recordNegativeFeedback();
                log.info("记录负向反馈: factory={}, intent={}, keyword={}, " +
                         "positive={}, negative={}, score={}",
                    factoryId, intentCode, keyword,
                    record.getPositiveCount(), record.getNegativeCount(),
                    record.getEffectivenessScore());
            }
            keywordEffectivenessRepository.save(record);
        } else {
            // 如果记录不存在，创建新记录
            KeywordEffectiveness newRecord = KeywordEffectiveness.builder()
                .factoryId(factoryId)
                .intentCode(intentCode)
                .keyword(keyword)
                .positiveCount(isPositive ? 1 : 0)
                .negativeCount(isPositive ? 0 : 1)
                .effectivenessScore(BigDecimal.ONE)
                .weight(BigDecimal.ONE)
                .specificity(BigDecimal.ONE)
                .source(KeywordEffectiveness.Source.MANUAL)
                .isAutoLearned(false)
                .lastMatchedAt(LocalDateTime.now())
                .build();

            // 计算初始效果评分
            newRecord.setEffectivenessScore(newRecord.calculateWilsonScore());
            keywordEffectivenessRepository.save(newRecord);
            log.info("创建新关键词效果记录: factory={}, intent={}, keyword={}",
                factoryId, intentCode, keyword);
        }
    }

    @Override
    public Optional<KeywordEffectiveness> getKeywordEffectiveness(
        String factoryId, String intentCode, String keyword) {
        return keywordEffectivenessRepository
            .findByFactoryIdAndIntentCodeAndKeyword(factoryId, intentCode, keyword);
    }

    @Override
    public List<KeywordEffectiveness> getEffectiveKeywords(
        String factoryId, String intentCode, BigDecimal threshold) {
        return keywordEffectivenessRepository
            .findEffectiveKeywords(factoryId, intentCode, threshold);
    }

    @Override
    @Transactional
    public KeywordEffectiveness createOrUpdateKeyword(
        String factoryId, String intentCode, String keyword,
        String source, BigDecimal initialWeight) {

        Optional<KeywordEffectiveness> existing = keywordEffectivenessRepository
            .findByFactoryIdAndIntentCodeAndKeyword(factoryId, intentCode, keyword);

        if (existing.isPresent()) {
            // 已存在，更新来源和权重（如果是晋升的）
            KeywordEffectiveness record = existing.get();
            if (KeywordEffectiveness.Source.PROMOTED.equals(source)) {
                record.setSource(source);
                record.setWeight(initialWeight);
                log.info("更新关键词为晋升状态: factory={}, intent={}, keyword={}",
                    factoryId, intentCode, keyword);
            }
            return keywordEffectivenessRepository.save(record);
        }

        // 创建新记录
        KeywordEffectiveness newRecord = KeywordEffectiveness.builder()
            .factoryId(factoryId)
            .intentCode(intentCode)
            .keyword(keyword)
            .positiveCount(0)
            .negativeCount(0)
            .effectivenessScore(initialWeight)
            .weight(initialWeight)
            .specificity(BigDecimal.ONE) // 默认值，稍后批量计算
            .source(source)
            .isAutoLearned(KeywordEffectiveness.Source.AUTO_LEARNED.equals(source))
            .build();

        KeywordEffectiveness saved = keywordEffectivenessRepository.save(newRecord);
        log.info("创建关键词效果记录: factory={}, intent={}, keyword={}, source={}, weight={}",
            factoryId, intentCode, keyword, source, initialWeight);

        return saved;
    }

    @Override
    public boolean existsInOtherIntent(String factoryId, String keyword, String excludeIntentCode) {
        return keywordEffectivenessRepository
            .existsByKeywordInOtherIntent(factoryId, keyword, excludeIntentCode);
    }

    @Override
    @Transactional
    public int cleanupLowEffectivenessKeywords(String factoryId, BigDecimal threshold, int minNegative) {
        List<KeywordEffectiveness> toCleanup = keywordEffectivenessRepository
            .findKeywordsForCleanup(factoryId, threshold, minNegative);

        int cleanedCount = 0;
        for (KeywordEffectiveness keyword : toCleanup) {
            keywordEffectivenessRepository.delete(keyword);
            log.info("清理低效关键词: factory={}, intent={}, keyword={}, score={}, negative={}",
                factoryId, keyword.getIntentCode(), keyword.getKeyword(),
                keyword.getEffectivenessScore(), keyword.getNegativeCount());
            cleanedCount++;
        }

        if (cleanedCount > 0) {
            log.info("工厂 {} 清理低效关键词完成，共清理 {} 个", factoryId, cleanedCount);
        }

        return cleanedCount;
    }

    @Override
    @Transactional
    public void recalculateAllSpecificity() {
        log.info("开始重算所有关键词的 specificity");

        List<String> allKeywords = keywordEffectivenessRepository.findDistinctKeywords();
        int updatedCount = 0;

        for (String keyword : allKeywords) {
            // 计算该关键词出现在多少个意图中
            long intentCount = keywordEffectivenessRepository.countDistinctIntentsByKeyword(keyword);

            // specificity = 1 / intentCount (TF-IDF 原理)
            BigDecimal specificity = BigDecimal.ONE.divide(
                BigDecimal.valueOf(Math.max(1, intentCount)),
                4, RoundingMode.HALF_UP);

            // 批量更新
            int affected = keywordEffectivenessRepository.updateSpecificityByKeyword(keyword, specificity);
            updatedCount += affected;

            if (intentCount > 1) {
                log.debug("关键词 '{}' 出现在 {} 个意图中，specificity={}",
                    keyword, intentCount, specificity);
            }
        }

        log.info("specificity 重算完成，共处理 {} 个唯一关键词，更新 {} 条记录",
            allKeywords.size(), updatedCount);
    }

    @Override
    public long countKeywords(String factoryId, String intentCode) {
        return keywordEffectivenessRepository.countByFactoryIdAndIntentCode(factoryId, intentCode);
    }
}
