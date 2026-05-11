package com.cretas.aims.dto.bom;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 更新均摊费用配置请求 DTO.
 *
 * <p>Rule 17.1 cleanup (PR #370 audit, Issue #384 batch 2). See {@link
 * CreateOverheadCostRequest} for background. {@code id} comes from path;
 * {@code factoryId} auto-filled; other fields full-replace on PUT.
 *
 * @author Cretas Team
 * @since 2026-05-11
 */
@Data
@Schema(description = "更新均摊费用配置请求")
public class UpdateOverheadCostRequest {

    @Schema(description = "费用名称", required = true)
    @NotBlank(message = "费用名称不能为空")
    @Size(max = 100, message = "费用名称长度不能超过100个字符")
    private String name;

    @Schema(description = "费用类别")
    @Size(max = 50, message = "费用类别长度不能超过50个字符")
    private String category;

    @Schema(description = "单价/费率", required = true)
    @NotNull(message = "单价不能为空")
    @PositiveOrZero(message = "单价必须 >= 0")
    private BigDecimal unitPrice;

    @Schema(description = "计价单位")
    @Size(max = 20, message = "计价单位长度不能超过20个字符")
    private String priceUnit;

    @Schema(description = "分摊方式 (PER_UNIT | PER_BATCH | FIXED)")
    @Size(max = 20, message = "分摊方式长度不能超过20个字符")
    private String allocationMethod;

    @Schema(description = "默认分摊比例/数量")
    @PositiveOrZero(message = "分摊比例必须 >= 0")
    private BigDecimal allocationRate;

    @Schema(description = "是否启用")
    private Boolean isActive;

    @Schema(description = "排序顺序")
    private Integer sortOrder;

    @Schema(description = "备注")
    @Size(max = 500, message = "备注长度不能超过500个字符")
    private String remark;
}
