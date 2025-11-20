package com.cretas.aims.dto.producttype;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;
/**
 * 产品类型数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductTypeDTO {
    private String id;
    private String factoryId;
    private String code;
    private String name;
    private String category;
    private String unit;
    private BigDecimal unitPrice;
    private Integer productionTimeMinutes;
    private Integer shelfLifeDays;
    private String packageSpec;
    private Boolean isActive;
    private String notes;
    private Integer createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    // 关联信息
    private String factoryName;
    private String createdByName;
    // 统计信息
    private Integer totalProductionPlans;
    private Integer activePlans;
    private BigDecimal totalProducedQuantity;
}
