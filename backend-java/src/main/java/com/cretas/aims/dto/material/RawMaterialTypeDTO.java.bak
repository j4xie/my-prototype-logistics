package com.cretas.aims.dto.material;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import javax.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDateTime;
/**
 * 原材料类型数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RawMaterialTypeDTO {
    private Integer id;
    private String factoryId;
    @NotBlank(message = "原材料编码不能为空")
    private String code;
    @NotBlank(message = "原材料名称不能为空")
    private String name;
    private String category;
    @NotBlank(message = "单位不能为空")
    private String unit;
    private BigDecimal unitPrice;
    private String storageType; // fresh, frozen, dry
    private Integer shelfLifeDays;
    private BigDecimal minStock;
    private BigDecimal maxStock;
    private Boolean isActive;
    private String notes;
    private Integer createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    // 关联信息
    private String factoryName;
    private String createdByName;
    // 统计信息
    private Integer totalBatches;
    private BigDecimal currentStock;
    private BigDecimal totalValue;
}
