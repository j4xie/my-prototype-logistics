package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.WorkflowVariableDef;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 工作流变量库 Repository — Sprint 4 W2 Chat J C-WF-VAR-1.
 *
 * @since 2026-05-17
 */
@Repository
public interface WorkflowVariableDefRepository extends JpaRepository<WorkflowVariableDef, String> {

    /**
     * 弹框 / 编辑器使用: 工厂可见变量 = 工厂自定义 + 系统预设 (factory_id IS NULL).
     * CAST(:factoryId AS string) 处理 PostgreSQL parameter-side IS NULL 类型推断
     * (per .claude/rules/database-entity-sync.md PG IS NULL 节).
     */
    @Query("""
        SELECT v FROM WorkflowVariableDef v
        WHERE v.isActive = TRUE
          AND (
                v.factoryId IS NULL
             OR (CAST(:factoryId AS string) IS NOT NULL AND v.factoryId = :factoryId)
          )
        ORDER BY v.category ASC, v.varName ASC
        """)
    List<WorkflowVariableDef> findAvailableForFactory(@Param("factoryId") String factoryId);

    /** Admin: 工厂自定义变量. */
    List<WorkflowVariableDef> findByFactoryIdAndIsActiveTrueOrderByCategoryAscVarNameAsc(String factoryId);

    /** Admin: 系统预设 (factory_id IS NULL). */
    List<WorkflowVariableDef> findByFactoryIdIsNullAndIsActiveTrueOrderByCategoryAscVarNameAsc();

    /** Lookup by var name (跨工厂查 — 优先工厂自定义, 否则 fallback 系统预设). */
    @Query("""
        SELECT v FROM WorkflowVariableDef v
        WHERE v.varName = :varName
          AND v.isActive = TRUE
          AND (
                v.factoryId = :factoryId
             OR v.factoryId IS NULL
          )
        ORDER BY v.factoryId NULLS LAST
        """)
    List<WorkflowVariableDef> findByVarNameForFactory(@Param("varName") String varName,
                                                       @Param("factoryId") String factoryId);

    default Optional<WorkflowVariableDef> findFirstByVarNameForFactory(String varName, String factoryId) {
        List<WorkflowVariableDef> list = findByVarNameForFactory(varName, factoryId);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }
}
