package com.cretas.aims.repository;

import com.cretas.aims.entity.TrainingDataRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * ML训练数据仓库
 */
@Repository
public interface TrainingDataRepository extends JpaRepository<TrainingDataRecord, String> {

    /**
     * 统计工厂的训练数据量
     */
    long countByFactoryId(String factoryId);

    /**
     * 查找工厂的所有训练数据（按记录时间降序）
     */
    List<TrainingDataRecord> findByFactoryIdOrderByRecordedAtDesc(String factoryId);

    /**
     * 查找工厂指定时间范围内的训练数据
     */
    List<TrainingDataRecord> findByFactoryIdAndRecordedAtBetweenOrderByRecordedAtDesc(
            String factoryId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 查找工厂最近N条训练数据
     */
    @Query("SELECT t FROM TrainingDataRecord t WHERE t.factoryId = :factoryId " +
           "ORDER BY t.recordedAt DESC")
    List<TrainingDataRecord> findTopNByFactoryId(
            @Param("factoryId") String factoryId,
            org.springframework.data.domain.Pageable pageable);

    /**
     * 检查批次是否已有训练数据记录
     */
    boolean existsByFactoryIdAndBatchId(String factoryId, Long batchId);

    /**
     * 通过批次ID查找训练数据
     */
    Optional<TrainingDataRecord> findByFactoryIdAndBatchId(String factoryId, Long batchId);

    /**
     * 获取所有有训练数据的工厂ID列表
     */
    @Query("SELECT DISTINCT t.factoryId FROM TrainingDataRecord t")
    List<String> findDistinctFactoryIds();

    /**
     * 统计指定时间之后的数据量
     */
    long countByFactoryIdAndRecordedAtAfter(String factoryId, LocalDateTime after);

    /**
     * 查找指定产品类型的训练数据
     */
    List<TrainingDataRecord> findByFactoryIdAndProductType(String factoryId, String productType);

    /**
     * 统计工厂各产品类型的数据量
     */
    @Query("SELECT t.productType, COUNT(t) FROM TrainingDataRecord t " +
           "WHERE t.factoryId = :factoryId GROUP BY t.productType")
    List<Object[]> countByProductType(@Param("factoryId") String factoryId);

    /**
     * 获取工厂的平均效率（用于基准比较）
     */
    @Query("SELECT AVG(t.actualEfficiency) FROM TrainingDataRecord t " +
           "WHERE t.factoryId = :factoryId AND t.actualEfficiency IS NOT NULL")
    Double getAverageEfficiency(@Param("factoryId") String factoryId);

    /**
     * 获取工厂的效率标准差
     */
    @Query("SELECT STDDEV(t.actualEfficiency) FROM TrainingDataRecord t " +
           "WHERE t.factoryId = :factoryId AND t.actualEfficiency IS NOT NULL")
    Double getEfficiencyStdDev(@Param("factoryId") String factoryId);

    /**
     * 删除工厂的所有训练数据
     */
    void deleteByFactoryId(String factoryId);

    /**
     * 删除指定时间之前的旧数据
     */
    void deleteByFactoryIdAndRecordedAtBefore(String factoryId, LocalDateTime before);
}
