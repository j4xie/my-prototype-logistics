package com.cretas.aims.dto.intent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 数据操作验证事实对象 - 用于 Drools 规则引擎
 *
 * 适用规则文件: data-operation-validation.drl
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataOperationFact {

    /**
     * 实体类型
     */
    private String entityType;

    /**
     * 实体ID
     */
    private String entityId;

    /**
     * 操作类型
     * 可选值: CREATE, UPDATE, DELETE, BATCH_UPDATE, BATCH_DELETE, QUERY, VIEW, EXPORT
     */
    private String operation;

    /**
     * 目标工厂ID
     */
    private String targetFactoryId;

    /**
     * 原材料批次所属工厂ID（用于跨工厂检查）
     */
    private String materialBatchFactoryId;

    /**
     * 关联批次数量（用于级联删除检查）
     */
    private int relatedBatchCount;

    /**
     * 关联原材料批次数量
     */
    private int relatedMaterialBatchCount;

    /**
     * 关联生产计划数量
     */
    private int relatedProductionPlanCount;

    /**
     * 产品类型是否存在
     */
    private boolean productTypeExists;

    /**
     * 当前状态
     */
    private String currentStatus;

    /**
     * 目标状态（用于状态转换检查）
     */
    private String targetStatus;

    /**
     * 待更新字段映射
     */
    private Map<String, Object> fieldsToUpdate;

    /**
     * 批量操作的记录数量
     */
    private int batchSize;

    /**
     * 批量操作中是否有字段类型不一致
     */
    private boolean hasInconsistentFieldTypes;

    /**
     * 批量删除中是否有实体存在关联
     */
    private boolean hasEntitiesWithRelations;

    /**
     * 存在关联的实体数量
     */
    private int entitiesWithRelationsCount;

    /**
     * 是否需要原材料消耗（用于生产批次创建）
     */
    private boolean requiresMaterialConsumption;

    /**
     * 是否在原子事务中执行
     */
    private boolean isAtomicTransaction;

    /**
     * 质检不合格后是否已创建处理记录
     */
    private boolean disposalRecordCreated;

    /**
     * 是否已归档
     */
    private boolean isArchived;

    /**
     * 数据保留期限（天）
     */
    private int retentionPeriodDays;

    /**
     * 距离创建时间的天数
     */
    private long daysSinceCreation;

    /**
     * 是否无外部依赖（新建实体时）
     */
    private boolean hasNoExternalDependencies;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 用户ID（用于审计）
     */
    private Long userId;

    /**
     * 用户名（用于审计）
     */
    private String username;
}
