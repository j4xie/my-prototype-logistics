package com.cretas.aims.dto.aps;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * 进度更新请求 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProgressUpdateRequest {

    /**
     * 已完成数量
     */
    @NotNull(message = "已完成数量不能为空")
    @Min(value = 0, message = "已完成数量不能为负数")
    private Integer completedQty;

    /**
     * 实际效率 (件/小时)
     * 可选，如果不提供则根据时间计算
     */
    private BigDecimal actualEfficiency;

    /**
     * 备注
     */
    private String remark;
}
