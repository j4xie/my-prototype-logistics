package com.cretas.aims.dto;

import com.cretas.aims.entity.enums.ChangeType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 转换率变更历史记录数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-25
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversionChangeHistoryDTO {

    private String id;

    /**
     * 关联的转换率配置ID
     */
    private String conversionId;

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 原料类型ID
     */
    private String materialTypeId;

    /**
     * 原料类型名称（便于前端显示）
     */
    private String materialTypeName;

    /**
     * 产品类型ID
     */
    private String productTypeId;

    /**
     * 产品类型名称（便于前端显示）
     */
    private String productTypeName;

    /**
     * 变更类型
     */
    private ChangeType changeType;

    /**
     * 变更类型描述（中文）
     */
    private String changeTypeDesc;

    // ========== 变更前后的值 ==========

    /**
     * 变更前的转换率
     */
    private BigDecimal oldConversionRate;

    /**
     * 变更后的转换率
     */
    private BigDecimal newConversionRate;

    /**
     * 转换率变化量（newConversionRate - oldConversionRate）
     */
    private BigDecimal conversionRateChange;

    /**
     * 变更前的损耗率
     */
    private BigDecimal oldWastageRate;

    /**
     * 变更后的损耗率
     */
    private BigDecimal newWastageRate;

    /**
     * 损耗率变化量
     */
    private BigDecimal wastageRateChange;

    // ========== 变更说明 ==========

    /**
     * 变更原因
     */
    private String reason;

    /**
     * 备注
     */
    private String notes;

    // ========== 操作信息 ==========

    /**
     * 操作人用户ID
     */
    private Long changedBy;

    /**
     * 操作人用户名（便于前端显示）
     */
    private String changedByUsername;

    /**
     * 变更时间
     */
    private LocalDateTime changedAt;

    /**
     * 记录创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 获取变更类型的中文描述
     */
    public String getChangeTypeDesc() {
        if (changeType == null) {
            return null;
        }
        switch (changeType) {
            case CREATE:
                return "新建";
            case UPDATE:
                return "更新";
            case DELETE:
                return "删除";
            case ACTIVATE:
                return "启用";
            case DEACTIVATE:
                return "停用";
            default:
                return changeType.name();
        }
    }
}
