package com.cretas.aims.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import javax.validation.constraints.DecimalMax;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
/**
 * 转换率数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversionDTO {
    private Integer id;
    @NotNull(message = "原材料类型ID不能为空")
    private String materialTypeId;
    private String materialTypeName;
    private String materialUnit;
    @NotNull(message = "产品类型ID不能为空")
    private String productTypeId;
    private String productTypeName;
    private String productCode;
    private String productUnit;
    @NotNull(message = "转换率不能为空")
    @DecimalMin(value = "0.0001", message = "转换率必须大于0")
    @DecimalMax(value = "9999.9999", message = "转换率不能超过9999.9999")
    private BigDecimal conversionRate;
    @DecimalMin(value = "0", message = "损耗率不能为负数")
    @DecimalMax(value = "100", message = "损耗率不能超过100%")
    private BigDecimal wastageRate;
    private BigDecimal standardUsage;
    @DecimalMin(value = "0", message = "最小批量不能为负数")
    private BigDecimal minBatchSize;
    @DecimalMin(value = "0", message = "最大批量不能为负数")
    private BigDecimal maxBatchSize;
    private Boolean isActive;
    private String notes;
}
