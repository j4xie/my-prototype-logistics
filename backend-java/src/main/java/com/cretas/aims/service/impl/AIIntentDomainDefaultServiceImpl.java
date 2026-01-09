package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.AIIntentDomainDefault;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.config.AIIntentDomainDefaultRepository;
import com.cretas.aims.service.AIIntentDomainDefaultService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * AI意图域默认配置服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-10
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AIIntentDomainDefaultServiceImpl implements AIIntentDomainDefaultService {

    private final AIIntentDomainDefaultRepository domainDefaultRepository;

    @Override
    public Optional<String> getPrimaryIntent(String factoryId, String domainName) {
        log.debug("获取域主默认意图: factoryId={}, domainName={}", factoryId, domainName);

        return getDomainDefault(factoryId, domainName)
                .map(AIIntentDomainDefault::getPrimaryIntentCode);
    }

    @Override
    public Optional<String> getSecondaryIntent(String factoryId, String domainName) {
        log.debug("获取域次默认意图: factoryId={}, domainName={}", factoryId, domainName);

        return getDomainDefault(factoryId, domainName)
                .map(AIIntentDomainDefault::getSecondaryIntentCode)
                .filter(code -> code != null && !code.isEmpty());
    }

    @Override
    public Optional<AIIntentDomainDefault> getDomainDefault(String factoryId, String domainName) {
        if (domainName == null || domainName.isEmpty()) {
            log.warn("域名为空，无法查找默认意图");
            return Optional.empty();
        }

        String normalizedDomain = domainName.toUpperCase().trim();

        // 1. 优先查找工厂级配置
        if (factoryId != null && !factoryId.isEmpty()) {
            Optional<AIIntentDomainDefault> factoryConfig = domainDefaultRepository
                    .findByFactoryIdAndDomainNameAndIsActiveTrueAndDeletedAtIsNull(factoryId, normalizedDomain);

            if (factoryConfig.isPresent()) {
                log.debug("使用工厂级域默认配置: factoryId={}, domainName={}, primaryIntent={}",
                        factoryId, normalizedDomain, factoryConfig.get().getPrimaryIntentCode());
                return factoryConfig;
            }
        }

        // 2. 查找平台级配置
        Optional<AIIntentDomainDefault> platformConfig = domainDefaultRepository
                .findPlatformLevelByDomainName(normalizedDomain);

        if (platformConfig.isPresent()) {
            log.debug("使用平台级域默认配置: domainName={}, primaryIntent={}",
                    normalizedDomain, platformConfig.get().getPrimaryIntentCode());
        } else {
            log.debug("未找到域默认配置: factoryId={}, domainName={}", factoryId, normalizedDomain);
        }

        return platformConfig;
    }

    @Override
    public List<AIIntentDomainDefault> getVisibleDomainDefaults(String factoryId) {
        log.debug("获取工厂可见的域默认配置: factoryId={}", factoryId);

        if (factoryId == null || factoryId.isEmpty()) {
            return getAllPlatformDefaults();
        }

        return domainDefaultRepository.findByFactoryIdOrPlatformLevel(factoryId);
    }

    @Override
    public List<AIIntentDomainDefault> getAllPlatformDefaults() {
        log.debug("获取所有平台级域默认配置");
        return domainDefaultRepository.findAllPlatformLevel();
    }

    @Override
    public List<String> getAllDomainNames() {
        log.debug("获取所有已配置的域名");
        return domainDefaultRepository.findAllDomainNames();
    }

    @Override
    @Transactional
    public AIIntentDomainDefault saveOrUpdate(String factoryId, String domainName,
                                               String primaryIntentCode, String secondaryIntentCode) {
        log.info("保存域默认配置: factoryId={}, domainName={}, primaryIntent={}, secondaryIntent={}",
                factoryId, domainName, primaryIntentCode, secondaryIntentCode);

        if (domainName == null || domainName.isEmpty()) {
            throw new IllegalArgumentException("域名不能为空");
        }
        if (primaryIntentCode == null || primaryIntentCode.isEmpty()) {
            throw new IllegalArgumentException("主默认意图代码不能为空");
        }

        String normalizedDomain = domainName.toUpperCase().trim();

        // 查找现有配置
        Optional<AIIntentDomainDefault> existing;
        if (factoryId == null || factoryId.isEmpty()) {
            existing = domainDefaultRepository.findPlatformLevelByDomainName(normalizedDomain);
        } else {
            existing = domainDefaultRepository
                    .findByFactoryIdAndDomainNameAndIsActiveTrueAndDeletedAtIsNull(factoryId, normalizedDomain);
        }

        AIIntentDomainDefault config;
        if (existing.isPresent()) {
            // 更新现有配置
            config = existing.get();
            config.setPrimaryIntentCode(primaryIntentCode);
            config.setSecondaryIntentCode(secondaryIntentCode);
            log.info("更新域默认配置: id={}", config.getId());
        } else {
            // 创建新配置
            config = AIIntentDomainDefault.builder()
                    .factoryId(factoryId)
                    .domainName(normalizedDomain)
                    .primaryIntentCode(primaryIntentCode)
                    .secondaryIntentCode(secondaryIntentCode)
                    .isActive(true)
                    .build();
            log.info("创建域默认配置: factoryId={}, domainName={}", factoryId, normalizedDomain);
        }

        return domainDefaultRepository.save(config);
    }

    @Override
    @Transactional
    public void delete(String id) {
        log.info("删除域默认配置: id={}", id);

        AIIntentDomainDefault config = domainDefaultRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("域默认配置不存在: " + id));

        // 软删除
        config.softDelete();
        domainDefaultRepository.save(config);

        log.info("域默认配置已删除: id={}, domainName={}", id, config.getDomainName());
    }

    @Override
    public boolean exists(String factoryId, String domainName) {
        if (domainName == null || domainName.isEmpty()) {
            return false;
        }

        String normalizedDomain = domainName.toUpperCase().trim();
        return domainDefaultRepository.existsByFactoryIdAndDomainName(factoryId, normalizedDomain);
    }
}
