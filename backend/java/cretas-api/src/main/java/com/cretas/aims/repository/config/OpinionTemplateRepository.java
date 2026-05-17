package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.OpinionTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 审批意见模板 Repository (Sprint 4 Wave 2 Chat J — C-OPINION-1 foundation).
 *
 * <p>Foundation 阶段仅暴露 minimal query 给后续 service 使用。
 *
 * @since 2026-05-24
 */
@Repository
public interface OpinionTemplateRepository extends JpaRepository<OpinionTemplate, String> {

    /**
     * 列出工厂可用模板 = 工厂自定义 + 系统预设 (factory_id IS NULL),按 sortOrder。
     * 用 CAST(:factoryId AS string) 应对 PostgreSQL parameter-side IS NULL 类型推断
     * (见 .claude/rules/database-entity-sync.md PG IS NULL 节)。
     */
    @Query("""
        SELECT o FROM OpinionTemplate o
        WHERE o.isActive = TRUE
          AND o.decisionType = :decisionType
          AND (
                o.factoryId IS NULL
             OR (CAST(:factoryId AS string) IS NOT NULL AND o.factoryId = :factoryId)
          )
        ORDER BY o.sortOrder ASC, o.createdAt ASC
        """)
    List<OpinionTemplate> findAvailableForFactory(
            @Param("decisionType") String decisionType,
            @Param("factoryId") String factoryId);

    /** 列出某工厂的自定义模板. */
    List<OpinionTemplate> findByFactoryIdAndIsActiveTrueOrderBySortOrderAsc(String factoryId);

    /** 系统预设 (factory_id IS NULL). */
    List<OpinionTemplate> findByFactoryIdIsNullAndIsActiveTrueOrderBySortOrderAsc();
}
