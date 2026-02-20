package com.cretas.aims.repository.calibration;

import com.cretas.aims.entity.calibration.ReflectionMemory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 反思记忆仓库接口
 *
 * 提供 episodic memory 的存储和检索功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Repository
public interface ReflectionMemoryRepository extends JpaRepository<ReflectionMemory, Long> {

    /**
     * 按工具名查询最近的反思记录
     */
    List<ReflectionMemory> findByToolNameOrderByCreatedAtDesc(String toolName);

    /**
     * 按会话ID查询反思记录
     */
    List<ReflectionMemory> findBySessionIdOrderByCreatedAtDesc(String sessionId);

    /**
     * 按工具名和工厂ID查询
     */
    List<ReflectionMemory> findByToolNameAndFactoryIdOrderByCreatedAtDesc(String toolName, String factoryId);

    /**
     * 查询成功的纠错记录
     */
    List<ReflectionMemory> findByToolNameAndWasSuccessfulTrueOrderByCreatedAtDesc(String toolName);

    /**
     * 按策略统计成功率
     */
    @Query("SELECT r.correctionStrategy, COUNT(r), SUM(CASE WHEN r.wasSuccessful = true THEN 1 ELSE 0 END) " +
            "FROM ReflectionMemory r WHERE r.toolName = :toolName GROUP BY r.correctionStrategy")
    List<Object[]> countByStrategyAndSuccess(@Param("toolName") String toolName);

    /**
     * 查询指定时间范围内的反思记录
     */
    List<ReflectionMemory> findByCreatedAtBetweenOrderByCreatedAtDesc(
            LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 计算工具的纠错成功率
     */
    @Query("SELECT COUNT(r) as total, SUM(CASE WHEN r.wasSuccessful = true THEN 1 ELSE 0 END) as success " +
            "FROM ReflectionMemory r WHERE r.toolName = :toolName")
    List<Object[]> calculateSuccessRate(@Param("toolName") String toolName);

    /**
     * 获取最近 N 条成功的反思（用于学习）
     */
    @Query("SELECT r FROM ReflectionMemory r WHERE r.toolName = :toolName AND r.wasSuccessful = true " +
            "ORDER BY r.createdAt DESC")
    List<ReflectionMemory> findRecentSuccessfulReflections(
            @Param("toolName") String toolName,
            org.springframework.data.domain.Pageable pageable);

    /**
     * 删除过期的反思记录（保留最近 30 天）
     */
    void deleteByCreatedAtBefore(LocalDateTime cutoffTime);
}
