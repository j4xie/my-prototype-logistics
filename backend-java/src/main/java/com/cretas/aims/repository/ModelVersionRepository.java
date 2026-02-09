package com.cretas.aims.repository;

import com.cretas.aims.entity.ModelVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * ML模型版本仓库
 */
@Repository
public interface ModelVersionRepository extends JpaRepository<ModelVersion, String> {

    /**
     * 查找工厂当前激活的模型（按类型）
     */
    Optional<ModelVersion> findByFactoryIdAndModelTypeAndIsActiveTrue(
            String factoryId, String modelType);

    /**
     * 查找工厂所有激活的模型
     */
    List<ModelVersion> findByFactoryIdAndIsActiveTrue(String factoryId);

    /**
     * 查找工厂指定类型的所有模型版本（按训练时间降序）
     */
    List<ModelVersion> findByFactoryIdAndModelTypeOrderByTrainedAtDesc(
            String factoryId, String modelType);

    /**
     * 查找工厂的所有模型版本
     */
    List<ModelVersion> findByFactoryIdOrderByTrainedAtDesc(String factoryId);

    /**
     * 检查工厂是否有指定类型的可用模型
     */
    boolean existsByFactoryIdAndModelTypeAndIsActiveTrue(String factoryId, String modelType);

    /**
     * 停用工厂指定类型的所有模型
     */
    @Modifying
    @Query("UPDATE ModelVersion m SET m.isActive = false, m.status = 'deprecated' " +
           "WHERE m.factoryId = :factoryId AND m.modelType = :modelType AND m.isActive = true")
    void deactivateModelsByType(@Param("factoryId") String factoryId,
                                 @Param("modelType") String modelType);

    /**
     * 停用工厂的所有模型
     */
    @Modifying
    @Query("UPDATE ModelVersion m SET m.isActive = false, m.status = 'deprecated' " +
           "WHERE m.factoryId = :factoryId AND m.isActive = true")
    void deactivateAllModels(@Param("factoryId") String factoryId);

    /**
     * 查找训练失败的模型
     */
    List<ModelVersion> findByFactoryIdAndStatus(String factoryId, String status);

    /**
     * 获取工厂最新训练的模型（不论是否激活）
     */
    @Query("SELECT m FROM ModelVersion m WHERE m.factoryId = :factoryId " +
           "ORDER BY m.trainedAt DESC")
    List<ModelVersion> findLatestModels(@Param("factoryId") String factoryId,
                                         org.springframework.data.domain.Pageable pageable);

    /**
     * 获取所有有模型的工厂ID
     */
    @Query("SELECT DISTINCT m.factoryId FROM ModelVersion m WHERE m.isActive = true")
    List<String> findDistinctFactoryIdsWithActiveModels();

    /**
     * 统计工厂的模型数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计工厂激活的模型数量
     */
    long countByFactoryIdAndIsActiveTrue(String factoryId);

    /**
     * 按版本号查找模型
     */
    Optional<ModelVersion> findByFactoryIdAndModelTypeAndVersion(
            String factoryId, String modelType, String version);

    /**
     * 删除工厂的所有模型版本记录
     */
    void deleteByFactoryId(String factoryId);

    /**
     * 更新模型状态
     */
    @Modifying
    @Query("UPDATE ModelVersion m SET m.status = :status WHERE m.id = :modelId")
    void updateStatus(@Param("modelId") String modelId, @Param("status") String status);
}
