package com.cretas.aims.dto.producttype;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
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
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    // 关联信息
    private String factoryName;
    private String createdByName;
    // 统计信息
    private Integer totalProductionPlans;
    private Integer activePlans;
    private BigDecimal totalProducedQuantity;

    // ==================== 前端字段别名 ====================

    /**
     * productCode 别名（兼容前端）
     * 前端使用 productCode，后端使用 code
     */
    @JsonProperty("productCode")
    @Schema(description = "产品编码(前端别名)")
    public String getProductCode() {
        return code;
    }
}
