package com.cretas.aims.repository;

import com.cretas.aims.entity.BatchWorkSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;

/**
 * 批次工作会话数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface BatchWorkSessionRepository extends JpaRepository<BatchWorkSession, Integer> {

    /**
     * 根据批次ID查找工作会话
     */
    @Query("SELECT bws FROM BatchWorkSession bws " +
           "LEFT JOIN FETCH bws.workSession ws " +
           "LEFT JOIN FETCH ws.user u " +
           "LEFT JOIN FETCH ws.workType wt " +
           "WHERE bws.batchId = :batchId")
    List<BatchWorkSession> findByBatchIdWithDetails(@Param("batchId") Long batchId);

    /**
     * 根据批次ID查找工作会话
     */
    List<BatchWorkSession> findByBatchId(Integer batchId);

    /**
     * 根据工作会话ID查找
     */
    List<BatchWorkSession> findByWorkSessionId(Integer workSessionId);

    /**
     * 计算批次的总人工成本
     */
    @Query("SELECT SUM(bws.laborCost) FROM BatchWorkSession bws WHERE bws.batchId = :batchId")
    BigDecimal calculateTotalLaborCostByBatch(@Param("batchId") Integer batchId);

    /**
     * 计算批次的总工作时长
     */
    @Query("SELECT SUM(bws.workMinutes) FROM BatchWorkSession bws WHERE bws.batchId = :batchId")
    Integer calculateTotalWorkMinutesByBatch(@Param("batchId") Integer batchId);
}
