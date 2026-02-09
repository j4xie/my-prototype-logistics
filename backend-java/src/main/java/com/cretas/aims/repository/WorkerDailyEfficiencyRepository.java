package com.cretas.aims.repository;

import com.cretas.aims.entity.WorkerDailyEfficiency;
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
 * 工人日效率数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Repository
public interface WorkerDailyEfficiencyRepository extends JpaRepository<WorkerDailyEfficiency, Long> {

    /**
     * 根据工厂ID查找效率记录
     */
    List<WorkerDailyEfficiency> findByFactoryId(String factoryId);

    /**
     * 分页查找工厂的效率记录
     */
    Page<WorkerDailyEfficiency> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工人ID查找效率记录
     */
    List<WorkerDailyEfficiency> findByWorkerId(Long workerId);

    /**
     * 按工人ID和日期范围查询
     */
    List<WorkerDailyEfficiency> findByWorkerIdAndWorkDateBetween(Long workerId, LocalDate startDate, LocalDate endDate);

    /**
     * 根据工厂和工人查找效率记录
     */
    List<WorkerDailyEfficiency> findByFactoryIdAndWorkerId(String factoryId, Long workerId);

    /**
     * 根据工作日期查找效率记录
     */
    List<WorkerDailyEfficiency> findByFactoryIdAndWorkDate(String factoryId, LocalDate workDate);

    /**
     * 按工厂ID和工作日期查询（按效率评分降序排名）
     */
    List<WorkerDailyEfficiency> findByFactoryIdAndWorkDateOrderByEfficiencyScoreDesc(String factoryId, LocalDate workDate);

    /**
     * 查找工人某天的效率记录
     */
    Optional<WorkerDailyEfficiency> findByFactoryIdAndWorkerIdAndWorkDate(
            String factoryId, Long workerId, LocalDate workDate);

    /**
     * 查找工人某天某工序的效率记录
     */
    Optional<WorkerDailyEfficiency> findByFactoryIdAndWorkerIdAndWorkDateAndProcessStageType(
            String factoryId, Long workerId, LocalDate workDate, String processStageType);

    /**
     * 查找日期范围内的效率记录
     */
    @Query("SELECT e FROM WorkerDailyEfficiency e WHERE e.factoryId = :factoryId " +
           "AND e.workDate >= :startDate AND e.workDate <= :endDate " +
           "ORDER BY e.workDate DESC")
    List<WorkerDailyEfficiency> findByDateRange(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 查找工人在日期范围内的效率记录
     */
    @Query("SELECT e FROM WorkerDailyEfficiency e WHERE e.factoryId = :factoryId " +
           "AND e.workerId = :workerId " +
           "AND e.workDate >= :startDate AND e.workDate <= :endDate " +
           "ORDER BY e.workDate ASC")
    List<WorkerDailyEfficiency> findByWorkerAndDateRange(
            @Param("factoryId") String factoryId,
            @Param("workerId") Long workerId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 获取某天的效率排名 (按件/小时)
     */
    @Query("SELECT e FROM WorkerDailyEfficiency e WHERE e.factoryId = :factoryId " +
           "AND e.workDate = :workDate " +
           "AND e.piecesPerHour IS NOT NULL " +
           "ORDER BY e.piecesPerHour DESC")
    List<WorkerDailyEfficiency> findDailyRanking(
            @Param("factoryId") String factoryId,
            @Param("workDate") LocalDate workDate);

    /**
     * 获取某天某工序的效率排名
     */
    @Query("SELECT e FROM WorkerDailyEfficiency e WHERE e.factoryId = :factoryId " +
           "AND e.workDate = :workDate " +
           "AND e.processStageType = :processStageType " +
           "AND e.piecesPerHour IS NOT NULL " +
           "ORDER BY e.piecesPerHour DESC")
    List<WorkerDailyEfficiency> findDailyRankingByProcess(
            @Param("factoryId") String factoryId,
            @Param("workDate") LocalDate workDate,
            @Param("processStageType") String processStageType);

    /**
     * 统计工人在周期内的总计件数
     */
    @Query("SELECT SUM(e.totalPieceCount) FROM WorkerDailyEfficiency e " +
           "WHERE e.factoryId = :factoryId AND e.workerId = :workerId " +
           "AND e.workDate >= :startDate AND e.workDate <= :endDate")
    Integer sumPieceCountByWorkerAndPeriod(
            @Param("factoryId") String factoryId,
            @Param("workerId") Long workerId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 统计工人在周期内的总工作时长 (分钟)
     */
    @Query("SELECT SUM(e.effectiveWorkMinutes) FROM WorkerDailyEfficiency e " +
           "WHERE e.factoryId = :factoryId AND e.workerId = :workerId " +
           "AND e.workDate >= :startDate AND e.workDate <= :endDate")
    Integer sumWorkMinutesByWorkerAndPeriod(
            @Param("factoryId") String factoryId,
            @Param("workerId") Long workerId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 统计工人在周期内的平均效率 (件/小时)
     */
    @Query("SELECT AVG(e.piecesPerHour) FROM WorkerDailyEfficiency e " +
           "WHERE e.factoryId = :factoryId AND e.workerId = :workerId " +
           "AND e.workDate >= :startDate AND e.workDate <= :endDate " +
           "AND e.piecesPerHour IS NOT NULL")
    BigDecimal avgPiecesPerHourByWorkerAndPeriod(
            @Param("factoryId") String factoryId,
            @Param("workerId") Long workerId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 按工人计算平均效率评分（指定日期范围）
     */
    @Query("SELECT AVG(e.efficiencyScore) FROM WorkerDailyEfficiency e " +
           "WHERE e.workerId = :workerId " +
           "AND e.workDate >= :startDate AND e.workDate <= :endDate " +
           "AND e.efficiencyScore IS NOT NULL")
    BigDecimal calculateAverageEfficiencyByWorkerIdAndDateRange(
            @Param("workerId") Long workerId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 统计工厂某天的总计件数
     */
    @Query("SELECT SUM(e.totalPieceCount) FROM WorkerDailyEfficiency e " +
           "WHERE e.factoryId = :factoryId AND e.workDate = :workDate")
    Integer sumPieceCountByFactoryAndDate(
            @Param("factoryId") String factoryId,
            @Param("workDate") LocalDate workDate);

    /**
     * 获取工厂某天的平均效率
     */
    @Query("SELECT AVG(e.piecesPerHour) FROM WorkerDailyEfficiency e " +
           "WHERE e.factoryId = :factoryId AND e.workDate = :workDate " +
           "AND e.piecesPerHour IS NOT NULL")
    BigDecimal avgPiecesPerHourByFactoryAndDate(
            @Param("factoryId") String factoryId,
            @Param("workDate") LocalDate workDate);

    /**
     * 按工序统计效率
     */
    @Query("SELECT e.processStageType, AVG(e.piecesPerHour), SUM(e.totalPieceCount) " +
           "FROM WorkerDailyEfficiency e WHERE e.factoryId = :factoryId " +
           "AND e.workDate >= :startDate AND e.workDate <= :endDate " +
           "GROUP BY e.processStageType")
    List<Object[]> statsByProcessStage(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 获取效率趋势数据 (按日期分组)
     */
    @Query("SELECT e.workDate, AVG(e.piecesPerHour), SUM(e.totalPieceCount), COUNT(e) " +
           "FROM WorkerDailyEfficiency e WHERE e.factoryId = :factoryId " +
           "AND e.workDate >= :startDate AND e.workDate <= :endDate " +
           "GROUP BY e.workDate ORDER BY e.workDate ASC")
    List<Object[]> getDailyTrend(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 获取工人的效率趋势
     */
    @Query("SELECT e.workDate, e.piecesPerHour, e.totalPieceCount, e.efficiencyScore " +
           "FROM WorkerDailyEfficiency e WHERE e.workerId = :workerId " +
           "AND e.workDate >= :startDate AND e.workDate <= :endDate " +
           "ORDER BY e.workDate ASC")
    List<Object[]> getWorkerTrend(
            @Param("workerId") Long workerId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 统计某天工作的人数
     */
    @Query("SELECT COUNT(DISTINCT e.workerId) FROM WorkerDailyEfficiency e " +
           "WHERE e.factoryId = :factoryId AND e.workDate = :workDate")
    long countWorkersByDate(@Param("factoryId") String factoryId, @Param("workDate") LocalDate workDate);

    /**
     * 检查工人某天是否有效率记录
     */
    boolean existsByFactoryIdAndWorkerIdAndWorkDate(String factoryId, Long workerId, LocalDate workDate);
}
