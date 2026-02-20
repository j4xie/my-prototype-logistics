package com.cretas.aims.repository;

import com.cretas.aims.entity.ml.LinUCBModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * LinUCB模型参数仓库
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Repository
public interface LinUCBModelRepository extends JpaRepository<LinUCBModel, String> {

    /**
     * 根据工厂ID和工人ID查找模型
     */
    Optional<LinUCBModel> findByFactoryIdAndWorkerId(String factoryId, Long workerId);

    /**
     * 根据工厂ID查找所有工人模型
     */
    List<LinUCBModel> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID和工人ID列表批量查找模型
     */
    @Query("SELECT m FROM LinUCBModel m WHERE m.factoryId = :factoryId AND m.workerId IN :workerIds")
    List<LinUCBModel> findByFactoryIdAndWorkerIdIn(
            @Param("factoryId") String factoryId,
            @Param("workerIds") List<Long> workerIds);

    /**
     * 查找更新次数最多的模型（按工厂）
     */
    @Query("SELECT m FROM LinUCBModel m WHERE m.factoryId = :factoryId ORDER BY m.updateCount DESC")
    List<LinUCBModel> findTopModelsByUpdateCount(@Param("factoryId") String factoryId);

    /**
     * 查找平均奖励值最高的工人模型
     */
    @Query("SELECT m FROM LinUCBModel m WHERE m.factoryId = :factoryId AND m.avgReward IS NOT NULL ORDER BY m.avgReward DESC")
    List<LinUCBModel> findTopModelsByAvgReward(@Param("factoryId") String factoryId);

    /**
     * 统计工厂的模型数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 检查模型是否存在
     */
    boolean existsByFactoryIdAndWorkerId(String factoryId, Long workerId);

    /**
     * 删除工厂的所有模型
     */
    void deleteByFactoryId(String factoryId);

    /**
     * 删除指定工人的模型
     */
    void deleteByFactoryIdAndWorkerId(String factoryId, Long workerId);
}
