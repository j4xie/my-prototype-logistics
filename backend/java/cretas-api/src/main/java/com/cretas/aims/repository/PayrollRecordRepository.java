package com.cretas.aims.repository;

import com.cretas.aims.entity.PayrollRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 工资记录数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Repository
public interface PayrollRecordRepository extends JpaRepository<PayrollRecord, Long> {

    /**
     * 根据工厂ID查找工资记录
     */
    List<PayrollRecord> findByFactoryId(String factoryId);

    /**
     * 分页查找工厂的工资记录
     */
    Page<PayrollRecord> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工人ID查找工资记录
     */
    List<PayrollRecord> findByWorkerId(Long workerId);

    /**
     * 分页查找工人的工资记录
     */
    Page<PayrollRecord> findByWorkerId(Long workerId, Pageable pageable);

    /**
     * 根据工厂ID和工人ID查找工资记录
     */
    List<PayrollRecord> findByFactoryIdAndWorkerId(String factoryId, Long workerId);

    /**
     * 根据状态查找工资记录
     */
    List<PayrollRecord> findByFactoryIdAndStatus(String factoryId, String status);

    /**
     * 分页查找指定状态的工资记录
     */
    Page<PayrollRecord> findByFactoryIdAndStatus(String factoryId, String status, Pageable pageable);

    /**
     * 按工人ID和状态查询
     */
    List<PayrollRecord> findByWorkerIdAndStatus(Long workerId, String status);

    /**
     * 按工厂ID和周期开始日期范围查询
     */
    List<PayrollRecord> findByFactoryIdAndPeriodStartBetween(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 查找指定周期的工资记录
     */
    @Query("SELECT p FROM PayrollRecord p WHERE p.factoryId = :factoryId " +
           "AND p.periodStart = :periodStart AND p.periodEnd = :periodEnd")
    List<PayrollRecord> findByPeriod(
            @Param("factoryId") String factoryId,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd);

    /**
     * 查找工人指定周期的工资记录
     */
    @Query("SELECT p FROM PayrollRecord p WHERE p.factoryId = :factoryId " +
           "AND p.workerId = :workerId " +
           "AND p.periodStart = :periodStart AND p.periodEnd = :periodEnd")
    Optional<PayrollRecord> findByWorkerAndPeriod(
            @Param("factoryId") String factoryId,
            @Param("workerId") Long workerId,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd);

    /**
     * 查找时间范围内的工资记录
     */
    @Query("SELECT p FROM PayrollRecord p WHERE p.factoryId = :factoryId " +
           "AND p.periodStart >= :startDate AND p.periodEnd <= :endDate")
    List<PayrollRecord> findByDateRange(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 统计工厂指定周期的总工资
     */
    @Query("SELECT SUM(p.totalWage) FROM PayrollRecord p WHERE p.factoryId = :factoryId " +
           "AND p.periodStart >= :startDate AND p.periodEnd <= :endDate")
    BigDecimal sumTotalWageByPeriod(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 统计工厂指定周期的计件工资总额
     */
    @Query("SELECT SUM(p.pieceRateWage) FROM PayrollRecord p WHERE p.factoryId = :factoryId " +
           "AND p.periodStart >= :startDate AND p.periodEnd <= :endDate")
    BigDecimal sumPieceRateWageByPeriod(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 统计工厂指定周期的总计件数
     */
    @Query("SELECT SUM(p.totalPieceCount) FROM PayrollRecord p WHERE p.factoryId = :factoryId " +
           "AND p.periodStart >= :startDate AND p.periodEnd <= :endDate")
    Integer sumPieceCountByPeriod(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 获取工厂指定周期的平均效率
     */
    @Query("SELECT AVG(p.averageEfficiency) FROM PayrollRecord p WHERE p.factoryId = :factoryId " +
           "AND p.periodStart >= :startDate AND p.periodEnd <= :endDate " +
           "AND p.averageEfficiency IS NOT NULL")
    BigDecimal avgEfficiencyByPeriod(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 按效率评级统计
     */
    @Query("SELECT p.efficiencyRating, COUNT(p), SUM(p.totalWage) FROM PayrollRecord p " +
           "WHERE p.factoryId = :factoryId " +
           "AND p.periodStart >= :startDate AND p.periodEnd <= :endDate " +
           "GROUP BY p.efficiencyRating")
    List<Object[]> countByEfficiencyRating(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 获取工人工资排名
     */
    @Query("SELECT p FROM PayrollRecord p WHERE p.factoryId = :factoryId " +
           "AND p.periodStart = :periodStart AND p.periodEnd = :periodEnd " +
           "ORDER BY p.totalWage DESC")
    List<PayrollRecord> findTopEarners(
            @Param("factoryId") String factoryId,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd,
            Pageable pageable);

    /**
     * 统计待审核工资记录数
     */
    long countByFactoryIdAndStatus(String factoryId, String status);

    /**
     * 检查是否存在重复的工资记录
     */
    boolean existsByFactoryIdAndWorkerIdAndPeriodStartAndPeriodEnd(
            String factoryId, Long workerId, LocalDate periodStart, LocalDate periodEnd);
}
