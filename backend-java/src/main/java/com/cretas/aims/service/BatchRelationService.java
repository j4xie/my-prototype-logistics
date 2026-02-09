package com.cretas.aims.service;

import com.cretas.aims.entity.BatchRelation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

/**
 * 批次关联服务接口
 * 用于管理生产批次与原材料批次的追溯关系
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
public interface BatchRelationService {

    /**
     * 分页查询批次关联列表
     */
    Page<BatchRelation> getBatchRelations(String factoryId, Pageable pageable);

    /**
     * 获取单个批次关联详情
     */
    Optional<BatchRelation> getBatchRelationById(String factoryId, String id);

    /**
     * 创建批次关联
     */
    BatchRelation createBatchRelation(BatchRelation batchRelation);

    /**
     * 更新批次关联
     */
    BatchRelation updateBatchRelation(String id, BatchRelation updateData);

    /**
     * 删除批次关联（软删除）
     */
    void deleteBatchRelation(String id);

    /**
     * 根据生产批次ID查询关联的原材料
     */
    List<BatchRelation> getByProductionBatchId(Long productionBatchId);

    /**
     * 根据原材料批次ID查询关联的生产批次
     */
    List<BatchRelation> getByMaterialBatchId(String materialBatchId);

    /**
     * 正向追溯：原材料 → 生产批次
     */
    List<BatchRelation> traceForward(String materialBatchId);

    /**
     * 反向追溯：生产批次 → 原材料
     */
    List<BatchRelation> traceBackward(Long productionBatchId);

    /**
     * 验证批次关联
     */
    BatchRelation verifyRelation(String id, Long verifiedBy);

    /**
     * 检查关联是否存在
     */
    boolean existsRelation(Long productionBatchId, String materialBatchId);

    /**
     * 查询未验证的关联
     */
    List<BatchRelation> getUnverifiedRelations(String factoryId);
}
