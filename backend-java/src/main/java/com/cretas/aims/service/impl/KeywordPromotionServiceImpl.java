package com.cretas.aims.service.impl;

import com.cretas.aims.entity.intent.KeywordFactoryAdoption;
import com.cretas.aims.repository.KeywordFactoryAdoptionRepository;
import com.cretas.aims.service.KeywordEffectivenessService;
import com.cretas.aims.service.KeywordPromotionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 关键词晋升服务实现
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KeywordPromotionServiceImpl implements KeywordPromotionService {

    private final KeywordFactoryAdoptionRepository adoptionRepository;
    private final KeywordEffectivenessService effectivenessService;

    private static final String GLOBAL_FACTORY_ID = "GLOBAL";

    @Override
    @Transactional
    public KeywordFactoryAdoption recordAdoption(
        String factoryId, String intentCode, String keyword, BigDecimal effectivenessScore) {

        Optional<KeywordFactoryAdoption> existing = adoptionRepository
            .findByIntentCodeAndKeywordAndFactoryId(intentCode, keyword, factoryId);

        if (existing.isPresent()) {
            // 更新现有记录
            KeywordFactoryAdoption record = existing.get();
            record.updateEffectiveness(effectivenessScore);
            record.incrementUsage();
            return adoptionRepository.save(record);
        }

        // 创建新采用记录
        KeywordFactoryAdoption adoption = KeywordFactoryAdoption.builder()
            .intentCode(intentCode)
            .keyword(keyword)
            .factoryId(factoryId)
            .effectivenessScore(effectivenessScore)
            .usageCount(1)
            .isDisabled(false)
            .isPromoted(false)
            .build();

        KeywordFactoryAdoption saved = adoptionRepository.save(adoption);
        log.info("记录工厂采用关键词: factory={}, intent={}, keyword={}, score={}",
            factoryId, intentCode, keyword, effectivenessScore);

        return saved;
    }

    @Override
    @Transactional
    public void disableKeyword(String factoryId, String intentCode, String keyword, String reason) {
        Optional<KeywordFactoryAdoption> existing = adoptionRepository
            .findByIntentCodeAndKeywordAndFactoryId(intentCode, keyword, factoryId);

        if (existing.isPresent()) {
            KeywordFactoryAdoption record = existing.get();
            record.disable(reason);
            adoptionRepository.save(record);
            log.info("禁用关键词: factory={}, intent={}, keyword={}, reason={}",
                factoryId, intentCode, keyword, reason);
        }
    }

    @Override
    @Transactional
    public void enableKeyword(String factoryId, String intentCode, String keyword) {
        Optional<KeywordFactoryAdoption> existing = adoptionRepository
            .findByIntentCodeAndKeywordAndFactoryId(intentCode, keyword, factoryId);

        if (existing.isPresent()) {
            KeywordFactoryAdoption record = existing.get();
            record.enable();
            adoptionRepository.save(record);
            log.info("启用关键词: factory={}, intent={}, keyword={}",
                factoryId, intentCode, keyword);
        }
    }

    @Override
    public boolean checkPromotionEligibility(
        String intentCode, String keyword, int minFactories, BigDecimal minEffectiveness) {

        // 检查采用工厂数
        long factoryCount = adoptionRepository.countActiveFactoriesByKeyword(intentCode, keyword);
        if (factoryCount < minFactories) {
            return false;
        }

        // 检查是否有工厂禁用
        if (adoptionRepository.hasDisabledByAnyFactory(intentCode, keyword)) {
            return false;
        }

        // 检查平均效果评分
        BigDecimal avgEffectiveness = adoptionRepository.getAverageEffectiveness(intentCode, keyword);
        if (avgEffectiveness == null || avgEffectiveness.compareTo(minEffectiveness) < 0) {
            return false;
        }

        return true;
    }

    @Override
    @Transactional
    public boolean promoteToGlobal(String intentCode, String keyword) {
        // 获取采用该关键词的工厂列表
        List<String> factoryIds = adoptionRepository.findFactoryIdsByKeyword(intentCode, keyword);
        BigDecimal avgEffectiveness = adoptionRepository.getAverageEffectiveness(intentCode, keyword);

        if (factoryIds.isEmpty() || avgEffectiveness == null) {
            log.warn("晋升失败：关键词 {} (意图: {}) 无有效采用记录", keyword, intentCode);
            return false;
        }

        // 创建全局关键词记录
        effectivenessService.createOrUpdateKeyword(
            GLOBAL_FACTORY_ID,
            intentCode,
            keyword,
            "PROMOTED",
            avgEffectiveness  // 使用平均效果评分作为初始权重
        );

        // 标记所有工厂的采用记录为已晋升
        int updated = adoptionRepository.markAsPromoted(intentCode, keyword);

        log.info("关键词晋升成功: intent={}, keyword={}, factories={}, avgScore={}, updatedRecords={}",
            intentCode, keyword, factoryIds.size(), avgEffectiveness, updated);

        return true;
    }

    @Override
    @Transactional
    public int runPromotionCheck(int minFactories, BigDecimal minEffectiveness) {
        log.info("开始运行关键词晋升检查: minFactories={}, minEffectiveness={}",
            minFactories, minEffectiveness);

        // 获取候选关键词（3+工厂采用）
        List<Object[]> candidates = adoptionRepository.findPromotionCandidates(minFactories);
        int promotedCount = 0;

        for (Object[] candidate : candidates) {
            String intentCode = (String) candidate[0];
            String keyword = (String) candidate[1];
            long factoryCount = ((Number) candidate[2]).longValue();

            // 检查平均效果评分
            BigDecimal avgEffectiveness = adoptionRepository.getAverageEffectiveness(intentCode, keyword);
            if (avgEffectiveness == null || avgEffectiveness.compareTo(minEffectiveness) < 0) {
                log.debug("跳过晋升: intent={}, keyword={}, avgScore={} < {}",
                    intentCode, keyword, avgEffectiveness, minEffectiveness);
                continue;
            }

            // 检查是否被禁用
            if (adoptionRepository.hasDisabledByAnyFactory(intentCode, keyword)) {
                log.debug("跳过晋升: intent={}, keyword={} 被某工厂禁用", intentCode, keyword);
                continue;
            }

            // 执行晋升
            if (promoteToGlobal(intentCode, keyword)) {
                promotedCount++;
            }
        }

        log.info("关键词晋升检查完成: 候选数={}, 晋升数={}", candidates.size(), promotedCount);
        return promotedCount;
    }

    @Override
    public List<String> getPromotedKeywords(String intentCode) {
        return adoptionRepository.findPromotedKeywords(intentCode);
    }

    @Override
    @Transactional
    public void syncEffectivenessScore(
        String factoryId, String intentCode, String keyword, BigDecimal effectivenessScore) {
        adoptionRepository.updateEffectivenessAndUsage(intentCode, keyword, factoryId, effectivenessScore);
    }
}
