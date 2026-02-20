package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.BlueprintVersionHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 蓝图版本历史数据访问层
 *
 * Sprint 3 任务: S3-7 蓝图版本管理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface BlueprintVersionHistoryRepository extends JpaRepository<BlueprintVersionHistory, String> {

    /**
     * 查询蓝图的所有版本历史（按版本号降序）
     */
    List<BlueprintVersionHistory> findByBlueprintIdOrderByVersionDesc(String blueprintId);

    /**
     * 查询蓝图的指定版本
     */
    Optional<BlueprintVersionHistory> findByBlueprintIdAndVersion(String blueprintId, Integer version);

    /**
     * 查询蓝图的最新版本
     */
    Optional<BlueprintVersionHistory> findFirstByBlueprintIdOrderByVersionDesc(String blueprintId);

    /**
     * 查询蓝图的最新发布版本
     */
    Optional<BlueprintVersionHistory> findFirstByBlueprintIdAndIsPublishedTrueOrderByVersionDesc(String blueprintId);

    /**
     * 查询蓝图的所有发布版本
     */
    List<BlueprintVersionHistory> findByBlueprintIdAndIsPublishedTrueOrderByVersionDesc(String blueprintId);

    /**
     * 获取蓝图的最大版本号
     */
    @Query("SELECT COALESCE(MAX(h.version), 0) FROM BlueprintVersionHistory h WHERE h.blueprintId = :blueprintId")
    Integer getMaxVersionByBlueprintId(String blueprintId);

    /**
     * 查询特定变更类型的版本历史
     */
    List<BlueprintVersionHistory> findByBlueprintIdAndChangeTypeOrderByVersionDesc(String blueprintId, String changeType);
}
