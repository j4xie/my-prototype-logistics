package com.cretas.aims.repository;

import com.cretas.aims.entity.AlertThreshold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 告警阈值配置数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
@Repository
public interface AlertThresholdRepository extends JpaRepository<AlertThreshold, Long> {

    /**
     * 按工厂ID和启用状态查询
     */
    List<AlertThreshold> findByFactoryIdAndEnabled(String factoryId, Boolean enabled);

    /**
     * 按工厂ID查询所有阈值
     */
    List<AlertThreshold> findByFactoryId(String factoryId);

    /**
     * 按工厂ID和指标名称查询
     */
    List<AlertThreshold> findByFactoryIdAndMetricName(String factoryId, String metricName);
}
