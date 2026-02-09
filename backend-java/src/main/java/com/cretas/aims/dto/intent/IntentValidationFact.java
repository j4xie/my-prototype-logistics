package com.cretas.aims.dto.intent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 意图级验证事实对象 - 用于 Drools 规则引擎
 *
 * 适用规则文件: intent-validation.drl
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntentValidationFact {

    /**
     * 意图类别
     * 可选值: DATA_OPERATION, PRODUCTION, QUALITY, FORM_ASSISTANT, QUERY, TRACEABILITY
     */
    private String intentCategory;

    /**
     * 操作类型
     * 可选值: QUERY, VIEW, UPDATE, DELETE, BATCH_UPDATE, BATCH_DELETE, CREATE
     */
    private String operation;

    /**
     * 时间戳（用于工作时间检查）
     */
    private LocalDateTime timestamp;

    /**
     * 用户最近操作次数（5分钟内）
     */
    private int recentOperationCount;

    /**
     * 目标工厂ID（用于跨工厂操作检查）
     */
    private String targetFactoryId;

    /**
     * 当前用户所属工厂ID
     */
    private String currentFactoryId;

    /**
     * 用户角色
     * 可选值: super_admin, factory_super_admin, factory_admin,
     *        department_admin, workshop_supervisor, quality_inspector, warehouse_keeper
     */
    private String userRole;

    /**
     * 是否强制执行（用于删除操作的二次确认）
     */
    private boolean forceExecute;

    /**
     * 批量操作的记录数量
     */
    private int batchSize;

    /**
     * 用户ID（用于审计）
     */
    private Long userId;

    /**
     * 用户名（用于审计）
     */
    private String username;

    /**
     * 意图代码（用于追溯）
     */
    private String intentCode;

    /**
     * 实体类型（如果涉及具体实体）
     */
    private String entityType;

    /**
     * 实体ID（如果涉及具体实体）
     */
    private String entityId;
}
