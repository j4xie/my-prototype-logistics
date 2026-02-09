package com.cretas.aims.repository.isapi;

import com.cretas.aims.entity.isapi.LabelRecognitionConfig;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 标签识别配置 Repository
 *
 * @author Cretas Team
 * @since 2026-01-13
 */
@Repository
public interface LabelRecognitionConfigRepository extends JpaRepository<LabelRecognitionConfig, Long> {

    // ==================== 基础查询 ====================

    /**
     * 根据工厂ID查询所有配置
     */
    List<LabelRecognitionConfig> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID分页查询配置
     */
    Page<LabelRecognitionConfig> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和启用状态查询
     */
    List<LabelRecognitionConfig> findByFactoryIdAndEnabledTrue(String factoryId);

    /**
     * 根据设备ID和启用状态查询
     */
    List<LabelRecognitionConfig> findByDeviceIdAndEnabledTrue(String deviceId);

    /**
     * 根据设备ID查询
     */
    List<LabelRecognitionConfig> findByDeviceId(String deviceId);

    /**
     * 根据工厂ID和设备ID查询
     */
    Optional<LabelRecognitionConfig> findByFactoryIdAndDeviceId(String factoryId, String deviceId);

    // ==================== 触发相关查询 ====================

    /**
     * 查询需要VMD触发的配置
     */
    @Query("SELECT c FROM LabelRecognitionConfig c WHERE c.factoryId = :factoryId " +
            "AND c.enabled = true AND c.triggerOnVmd = true")
    List<LabelRecognitionConfig> findVmdTriggerConfigs(@Param("factoryId") String factoryId);

    /**
     * 查询需要区域入侵触发的配置
     */
    @Query("SELECT c FROM LabelRecognitionConfig c WHERE c.factoryId = :factoryId " +
            "AND c.enabled = true AND c.triggerOnFieldDetection = true")
    List<LabelRecognitionConfig> findFieldDetectionTriggerConfigs(@Param("factoryId") String factoryId);

    /**
     * 根据设备ID查询启用的配置（用于事件触发）
     */
    @Query("SELECT c FROM LabelRecognitionConfig c WHERE c.deviceId = :deviceId AND c.enabled = true")
    List<LabelRecognitionConfig> findEnabledConfigsByDeviceId(@Param("deviceId") String deviceId);

    // ==================== 更新操作 ====================

    /**
     * 更新启用状态
     */
    @Modifying
    @Query("UPDATE LabelRecognitionConfig c SET c.enabled = :enabled, c.updatedAt = CURRENT_TIMESTAMP WHERE c.id = :id")
    int updateEnabled(@Param("id") Long id, @Param("enabled") boolean enabled);

    /**
     * 更新最后触发时间
     */
    @Modifying
    @Query("UPDATE LabelRecognitionConfig c SET c.lastTriggerTime = :time, c.updatedAt = CURRENT_TIMESTAMP WHERE c.id = :id")
    int updateLastTriggerTime(@Param("id") Long id, @Param("time") LocalDateTime time);

    // ==================== 统计查询 ====================

    /**
     * 统计工厂配置数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计工厂启用的配置数量
     */
    long countByFactoryIdAndEnabledTrue(String factoryId);

    /**
     * 检查设备是否已有配置
     */
    boolean existsByFactoryIdAndDeviceId(String factoryId, String deviceId);
}
