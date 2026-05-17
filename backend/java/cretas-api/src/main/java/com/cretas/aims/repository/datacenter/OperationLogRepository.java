package com.cretas.aims.repository.datacenter;

import com.cretas.aims.entity.datacenter.OperationLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

/**
 * OperationLog 查询. 注意 PG IS NULL 参数类型 hint (database-entity-sync.md §JPQL).
 */
@Repository
public interface OperationLogRepository extends JpaRepository<OperationLog, Long> {

    /**
     * 通用筛选查询. 所有 :param 可传 null 即不过滤. PG 严格类型推断要求 {@code CAST(:p AS string) IS NULL}.
     */
    @Query("SELECT o FROM OperationLog o WHERE o.factoryId = :factoryId "
            + "AND (CAST(:module AS string) IS NULL OR o.module = :module) "
            + "AND (CAST(:action AS string) IS NULL OR o.action = :action) "
            + "AND (:userId IS NULL OR o.userId = :userId) "
            + "AND (CAST(:entityType AS string) IS NULL OR o.entityType = :entityType) "
            + "AND (CAST(:entityId AS string) IS NULL OR o.entityId = :entityId) "
            + "AND (CAST(:start AS timestamp) IS NULL OR o.createdAt >= :start) "
            + "AND (CAST(:end AS timestamp) IS NULL OR o.createdAt <= :end) "
            + "ORDER BY o.createdAt DESC")
    Page<OperationLog> findByFilters(
            @Param("factoryId") String factoryId,
            @Param("module") String module,
            @Param("action") String action,
            @Param("userId") Long userId,
            @Param("entityType") String entityType,
            @Param("entityId") String entityId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            Pageable pageable);
}
