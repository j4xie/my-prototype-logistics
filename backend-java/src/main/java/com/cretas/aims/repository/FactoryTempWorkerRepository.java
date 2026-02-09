package com.cretas.aims.repository;

import com.cretas.aims.entity.FactoryTempWorker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 临时工记录Repository
 */
@Repository
public interface FactoryTempWorkerRepository extends JpaRepository<FactoryTempWorker, Long> {

    /**
     * 根据工厂ID和工人ID查询
     */
    Optional<FactoryTempWorker> findByFactoryIdAndWorkerId(String factoryId, Long workerId);

    /**
     * 查询工厂的所有临时工
     */
    List<FactoryTempWorker> findByFactoryIdAndIsTempWorkerTrue(String factoryId);

    /**
     * 查询工厂的所有正式工
     */
    List<FactoryTempWorker> findByFactoryIdAndIsTempWorkerFalse(String factoryId);

    /**
     * 查询即将结束的临时工 (7天内)
     */
    @Query("SELECT w FROM FactoryTempWorker w WHERE w.factoryId = :factoryId " +
           "AND w.isTempWorker = true AND w.convertedToPermanent = false " +
           "AND w.expectedEndDate BETWEEN :today AND :nextWeek")
    List<FactoryTempWorker> findExpiringTempWorkers(
            @Param("factoryId") String factoryId,
            @Param("today") LocalDate today,
            @Param("nextWeek") LocalDate nextWeek);

    /**
     * 查询高绩效临时工 (可能转正)
     */
    @Query("SELECT w FROM FactoryTempWorker w WHERE w.factoryId = :factoryId " +
           "AND w.isTempWorker = true AND w.convertedToPermanent = false " +
           "AND w.avgEfficiency >= :minEfficiency " +
           "AND w.reliabilityScore >= :minReliability")
    List<FactoryTempWorker> findHighPerformingTempWorkers(
            @Param("factoryId") String factoryId,
            @Param("minEfficiency") Double minEfficiency,
            @Param("minReliability") Double minReliability);

    /**
     * 统计工厂临时工数量
     */
    @Query("SELECT COUNT(w) FROM FactoryTempWorker w WHERE w.factoryId = :factoryId " +
           "AND w.isTempWorker = true AND w.convertedToPermanent = false")
    long countActiveTempWorkers(@Param("factoryId") String factoryId);

    /**
     * 查询新入职工人 (N天内)
     */
    @Query("SELECT w FROM FactoryTempWorker w WHERE w.factoryId = :factoryId " +
           "AND w.hireDate >= :sinceDate")
    List<FactoryTempWorker> findNewWorkers(
            @Param("factoryId") String factoryId,
            @Param("sinceDate") LocalDate sinceDate);
}
