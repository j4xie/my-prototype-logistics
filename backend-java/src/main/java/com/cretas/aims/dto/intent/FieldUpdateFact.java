package com.cretas.aims.dto.intent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 字段更新验证事实对象 - 用于 Drools 规则引擎
 *
 * 适用规则文件: field-validation.drl
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FieldUpdateFact {

    /**
     * 实体类型
     * 可选值: MATERIAL_BATCH, PRODUCTION_BATCH, PRODUCTION_PLAN, PRODUCT_TYPE, etc.
     */
    private String entityType;

    /**
     * 实体ID
     */
    private String entityId;

    /**
     * 字段名称（camelCase）
     * 例如: storageTemperature, quantity, batchNumber, status
     */
    private String fieldName;

    /**
     * 旧值（更新前的值）
     */
    private Object oldValue;

    /**
     * 新值（更新后的值）
     */
    private Object newValue;

    /**
     * 工厂ID（用于多租户隔离）
     */
    private String factoryId;

    /**
     * 是否有关联批次（用于产品类型修改检查）
     */
    private boolean hasRelatedBatches;

    /**
     * 关联批次数量
     */
    private int relatedBatchCount;

    /**
     * 操作类型（CREATE, UPDATE, DELETE）
     */
    private String operation;

    /**
     * 用户ID（用于审计）
     */
    private Long userId;

    /**
     * 用户名（用于审计）
     */
    private String username;

    /**
     * 用户角色
     */
    private String userRole;
}
