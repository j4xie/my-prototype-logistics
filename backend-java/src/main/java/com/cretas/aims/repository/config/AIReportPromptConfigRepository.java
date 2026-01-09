package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.AIReportPromptConfig;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AI报告提示词配置 Repository
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-08
 */
@Repository("configAIReportPromptConfigRepository")
public interface AIReportPromptConfigRepository extends JpaRepository<AIReportPromptConfig, String> {

    // ==================== 分页查询 ====================

    /**
     * 分页查询所有配置
     */
    Page<AIReportPromptConfig> findAllByOrderByPriorityDesc(Pageable pageable);

    /**
     * 按报告类型分页查询
     */
    Page<AIReportPromptConfig> findByReportTypeOrderByPriorityDesc(String reportType, Pageable pageable);

    /**
     * 按工厂ID分页查询
     */
    Page<AIReportPromptConfig> findByFactoryIdOrderByPriorityDesc(String factoryId, Pageable pageable);

    /**
     * 按启用状态分页查询
     */
    Page<AIReportPromptConfig> findByIsActiveOrderByPriorityDesc(Boolean isActive, Pageable pageable);

    // ==================== 常规查询 ====================

    /**
     * 根据工厂ID和报告类型查询配置
     * 优先查询工厂级别配置，如果不存在则查询全局配置
     * 全局配置: factoryId IS NULL
     */
    @Query("SELECT c FROM AIReportPromptConfig c " +
           "WHERE c.reportType = :reportType " +
           "AND (c.factoryId = :factoryId OR c.factoryId IS NULL) " +
           "AND c.isActive = true " +
           "ORDER BY c.priority DESC, " +
           "CASE WHEN c.factoryId = :factoryId THEN 1 ELSE 2 END")
    List<AIReportPromptConfig> findByFactoryIdAndReportType(
            @Param("factoryId") String factoryId,
            @Param("reportType") String reportType);

    /**
     * 查询全局默认配置（factoryId IS NULL）
     */
    Optional<AIReportPromptConfig> findFirstByFactoryIdIsNullAndReportTypeAndIsActiveTrueOrderByPriorityDesc(
            String reportType);

    /**
     * 查询工厂级别配置
     */
    Optional<AIReportPromptConfig> findFirstByFactoryIdAndReportTypeAndIsActiveTrueOrderByPriorityDesc(
            String factoryId, String reportType);

    /**
     * 根据工厂ID查询所有启用的配置
     */
    List<AIReportPromptConfig> findByFactoryIdAndIsActiveTrueOrderByPriorityDesc(String factoryId);

    /**
     * 查询所有全局配置
     */
    List<AIReportPromptConfig> findByFactoryIdIsNullAndIsActiveTrueOrderByReportType();

    /**
     * 查询特定报告类型的所有配置（包括禁用的）
     */
    List<AIReportPromptConfig> findByReportTypeOrderByPriorityDesc(String reportType);

    /**
     * 按报告类型查询所有启用的配置
     */
    List<AIReportPromptConfig> findByReportTypeAndIsActiveTrueOrderByPriorityDesc(String reportType);

    /**
     * 检查配置是否存在
     */
    boolean existsByFactoryIdAndReportType(String factoryId, String reportType);

    /**
     * 统计工厂配置数量
     */
    @Query("SELECT COUNT(c) FROM AIReportPromptConfig c " +
           "WHERE c.factoryId = :factoryId AND c.isActive = true")
    Long countByFactoryIdAndActive(@Param("factoryId") String factoryId);

    // ==================== 状态更新 ====================

    /**
     * 更新配置启用状态
     */
    @Modifying
    @Query("UPDATE AIReportPromptConfig c SET c.isActive = :isActive, c.updatedBy = :updatedBy WHERE c.id = :id")
    int updateActiveStatus(@Param("id") String id, @Param("isActive") Boolean isActive, @Param("updatedBy") String updatedBy);
}
