package com.cretas.aims.repository;

import com.cretas.aims.entity.FactorySchedulingConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 工厂调度配置Repository
 */
@Repository
public interface FactorySchedulingConfigRepository extends JpaRepository<FactorySchedulingConfig, Long> {

    /**
     * 根据工厂ID查询配置
     */
    Optional<FactorySchedulingConfig> findByFactoryId(String factoryId);

    /**
     * 查询所有启用的工厂配置
     */
    List<FactorySchedulingConfig> findByEnabledTrue();

    /**
     * 查询启用自适应学习的工厂
     */
    List<FactorySchedulingConfig> findByAdaptiveLearningEnabledTrue();

    /**
     * 检查工厂是否有配置
     */
    boolean existsByFactoryId(String factoryId);

    /**
     * 查询需要自适应调整的工厂
     * 条件: 启用自适应学习 + 距上次调整超过1小时
     */
    @Query("SELECT c FROM FactorySchedulingConfig c WHERE c.adaptiveLearningEnabled = true " +
           "AND (c.lastAdaptationAt IS NULL OR c.lastAdaptationAt < :cutoffTime)")
    List<FactorySchedulingConfig> findConfigsNeedingAdaptation(@Param("cutoffTime") java.time.LocalDateTime cutoffTime);
}
