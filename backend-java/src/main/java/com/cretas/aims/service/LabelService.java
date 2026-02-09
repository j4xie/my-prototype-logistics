package com.cretas.aims.service;

import com.cretas.aims.entity.Label;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

/**
 * 标签服务接口
 * 用于管理产品追溯标签、条码、二维码
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
public interface LabelService {

    /**
     * 分页查询标签列表
     */
    Page<Label> getLabels(String factoryId, Pageable pageable);

    /**
     * 根据类型分页查询
     */
    Page<Label> getLabelsByType(String factoryId, String labelType, Pageable pageable);

    /**
     * 根据状态分页查询
     */
    Page<Label> getLabelsByStatus(String factoryId, String status, Pageable pageable);

    /**
     * 获取单个标签详情
     */
    Optional<Label> getLabelById(String factoryId, String id);

    /**
     * 根据标签编码查询
     */
    Optional<Label> getByLabelCode(String labelCode);

    /**
     * 根据追溯码查询
     */
    Optional<Label> getByTraceCode(String traceCode);

    /**
     * 创建标签
     */
    Label createLabel(Label label);

    /**
     * 批量创建标签
     */
    List<Label> createLabels(List<Label> labels);

    /**
     * 更新标签
     */
    Label updateLabel(String id, Label updateData);

    /**
     * 打印标签（更新打印记录）
     */
    Label printLabel(String id, Long printedBy);

    /**
     * 贴标操作
     */
    Label applyLabel(String id, Long appliedBy);

    /**
     * 作废标签
     */
    Label voidLabel(String id, Long updatedBy);

    /**
     * 删除标签（软删除）
     */
    void deleteLabel(String id);

    /**
     * 查询批次关联的标签
     */
    List<Label> getLabelsByBatchId(String batchId);

    /**
     * 查询生产批次关联的标签
     */
    List<Label> getLabelsByProductionBatchId(Long productionBatchId);

    /**
     * 查询即将过期的标签
     */
    List<Label> getExpiringLabels(String factoryId, int daysAhead);

    /**
     * 查询已过期的标签
     */
    List<Label> getExpiredLabels(String factoryId);

    /**
     * 统计标签数量
     */
    long countByFactory(String factoryId);

    /**
     * 统计特定状态的标签数量
     */
    long countByStatus(String factoryId, String status);

    /**
     * 生成标签编码
     */
    String generateLabelCode(String factoryId, String labelType);

    /**
     * 生成追溯码
     */
    String generateTraceCode(String factoryId, String batchNumber);
}
