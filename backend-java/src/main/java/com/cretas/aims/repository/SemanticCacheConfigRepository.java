package com.cretas.aims.repository;

import com.cretas.aims.entity.cache.SemanticCacheConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 语义缓存配置 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Repository
public interface SemanticCacheConfigRepository extends JpaRepository<SemanticCacheConfig, Long> {

    /**
     * 获取工厂特定配置
     *
     * @param factoryId 工厂ID
     * @return 配置 (如果存在)
     */
    Optional<SemanticCacheConfig> findByFactoryId(String factoryId);

    /**
     * 获取全局默认配置
     *
     * @return 全局配置
     */
    default Optional<SemanticCacheConfig> findGlobalConfig() {
        return findByFactoryId(SemanticCacheConfig.GLOBAL_CONFIG);
    }

    /**
     * 获取工厂配置，如果不存在则返回全局配置
     * (在服务层实现 fallback 逻辑)
     *
     * @param factoryId 工厂ID
     * @return 有效配置
     */
    default Optional<SemanticCacheConfig> findEffectiveConfig(String factoryId) {
        Optional<SemanticCacheConfig> factoryConfig = findByFactoryId(factoryId);
        if (factoryConfig.isPresent()) {
            return factoryConfig;
        }
        return findByFactoryId(SemanticCacheConfig.GLOBAL_CONFIG);
    }

    /**
     * 检查工厂是否有专属配置
     *
     * @param factoryId 工厂ID
     * @return 是否存在
     */
    boolean existsByFactoryId(String factoryId);

    /**
     * 检查语义缓存是否启用
     * (在服务层实现 fallback 逻辑)
     *
     * @param factoryId 工厂ID
     * @return 是否启用
     */
    default Boolean isEnabledForFactory(String factoryId) {
        return findEffectiveConfig(factoryId)
                .map(SemanticCacheConfig::isEnabled)
                .orElse(true); // 默认启用
    }
}
