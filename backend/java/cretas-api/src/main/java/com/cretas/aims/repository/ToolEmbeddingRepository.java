package com.cretas.aims.repository;

import com.cretas.aims.entity.tool.ToolEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 工具向量嵌入 Repository
 *
 * 提供工具向量的持久化操作，支持:
 * - 按工具名称查询
 * - 按分类查询
 * - 查询所有已向量化的工具
 * - 更新使用统计
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
@Repository
public interface ToolEmbeddingRepository extends JpaRepository<ToolEmbedding, String> {

    /**
     * 根据工具名称查询
     *
     * @param toolName 工具名称
     * @return 工具向量信息
     */
    Optional<ToolEmbedding> findByToolName(String toolName);

    /**
     * 根据工具分类查询
     *
     * @param category 工具分类
     * @return 该分类下的所有工具
     */
    List<ToolEmbedding> findByToolCategory(String category);

    /**
     * 查询所有已生成向量的工具
     *
     * @return 已向量化的工具列表
     */
    List<ToolEmbedding> findAllByEmbeddingVectorIsNotNull();

    /**
     * 查询所有未生成向量的工具 (用于初始化)
     *
     * @return 未向量化的工具列表
     */
    List<ToolEmbedding> findAllByEmbeddingVectorIsNull();

    /**
     * 增加工具使用次数并更新最后使用时间
     *
     * @param toolName 工具名称
     * @param now      当前时间
     */
    @Modifying
    @Query("UPDATE ToolEmbedding t SET t.usageCount = t.usageCount + 1, t.lastUsedAt = :now WHERE t.toolName = :toolName")
    void incrementUsage(@Param("toolName") String toolName, @Param("now") LocalDateTime now);

    /**
     * 更新工具的平均执行时间
     * 使用滑动平均公式: new_avg = (old_avg * count + new_time) / (count + 1)
     *
     * @param toolName      工具名称
     * @param executionTime 本次执行时间 (毫秒)
     */
    @Modifying
    @Query(value = "UPDATE tool_embeddings SET " +
           "avg_execution_time_ms = CASE " +
           "  WHEN avg_execution_time_ms IS NULL THEN :executionTime " +
           "  ELSE (avg_execution_time_ms * usage_count + :executionTime) / (usage_count + 1) " +
           "END " +
           "WHERE tool_name = :toolName", nativeQuery = true)
    void updateAvgExecutionTime(@Param("toolName") String toolName, @Param("executionTime") Integer executionTime);

    /**
     * 按使用次数降序获取热门工具
     *
     * @return 热门工具列表
     */
    List<ToolEmbedding> findTop10ByOrderByUsageCountDesc();

    /**
     * 检查工具是否已存在
     *
     * @param toolName 工具名称
     * @return 是否存在
     */
    boolean existsByToolName(String toolName);
}
