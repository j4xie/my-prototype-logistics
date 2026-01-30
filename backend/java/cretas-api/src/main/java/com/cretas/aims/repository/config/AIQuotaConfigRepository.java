package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.AIQuotaConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AI配额规则配置 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface AIQuotaConfigRepository extends JpaRepository<AIQuotaConfig, String> {

    /**
     * 根据工厂ID和问题类型查询配额配置
     * 优先查询工厂级别配置，如果不存在则查询全局配置
     */
    @Query("SELECT c FROM AIQuotaConfig c " +
           "WHERE c.questionType = :questionType " +
           "AND c.factoryId IN (:factoryId, '*') " +
           "AND c.enabled = true " +
           "ORDER BY c.priority DESC, " +
           "CASE WHEN c.factoryId = :factoryId THEN 1 ELSE 2 END")
    List<AIQuotaConfig> findByFactoryIdAndQuestionType(
            @Param("factoryId") String factoryId,
            @Param("questionType") String questionType);

    /**
     * 根据工厂ID查询所有启用的配额配置
     */
    List<AIQuotaConfig> findByFactoryIdAndEnabledTrueOrderByPriorityDesc(String factoryId);

    /**
     * 查询所有全局配置
     */
    List<AIQuotaConfig> findByFactoryIdAndEnabledTrueOrderByQuestionType(String factoryId);

    /**
     * 根据工厂ID和问题类型查询精确配置
     */
    Optional<AIQuotaConfig> findByFactoryIdAndQuestionTypeAndEnabledTrue(
            String factoryId, String questionType);

    /**
     * 检查配置是否存在
     */
    boolean existsByFactoryIdAndQuestionType(String factoryId, String questionType);

    /**
     * 根据工厂ID查询所有配置 (包括禁用的)
     */
    List<AIQuotaConfig> findByFactoryIdOrderByPriorityDesc(String factoryId);

    /**
     * 统计工厂配置数量
     */
    @Query("SELECT COUNT(c) FROM AIQuotaConfig c " +
           "WHERE c.factoryId = :factoryId AND c.enabled = true")
    Long countByFactoryIdAndEnabled(@Param("factoryId") String factoryId);

    /**
     * 获取最高配额消耗值
     */
    @Query("SELECT MAX(c.quotaCost) FROM AIQuotaConfig c " +
           "WHERE c.factoryId = :factoryId AND c.enabled = true")
    Integer findMaxQuotaCostByFactoryId(@Param("factoryId") String factoryId);
}
