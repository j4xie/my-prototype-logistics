package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.AIIntentConfigHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AI意图配置历史 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Repository
public interface AIIntentConfigHistoryRepository extends JpaRepository<AIIntentConfigHistory, Long> {

    /**
     * 获取配置的所有历史版本
     */
    List<AIIntentConfigHistory> findByIntentConfigIdOrderByVersionNumberDesc(String intentConfigId);

    /**
     * 获取特定版本
     */
    Optional<AIIntentConfigHistory> findByIntentConfigIdAndVersionNumber(
            String intentConfigId, Integer versionNumber);

    /**
     * 获取最新版本
     */
    @Query("SELECT h FROM AIIntentConfigHistory h " +
           "WHERE h.intentConfigId = :configId " +
           "ORDER BY h.versionNumber DESC")
    List<AIIntentConfigHistory> findLatestVersion(@Param("configId") String configId);

    /**
     * 获取工厂的所有配置历史
     */
    List<AIIntentConfigHistory> findByFactoryIdOrderByChangedAtDesc(String factoryId);

    /**
     * 根据意图代码查询历史
     */
    List<AIIntentConfigHistory> findByIntentCodeOrderByVersionNumberDesc(String intentCode);

    /**
     * 统计配置的版本数
     */
    @Query("SELECT COUNT(h) FROM AIIntentConfigHistory h WHERE h.intentConfigId = :configId")
    int countVersionsByConfigId(@Param("configId") String configId);
}
