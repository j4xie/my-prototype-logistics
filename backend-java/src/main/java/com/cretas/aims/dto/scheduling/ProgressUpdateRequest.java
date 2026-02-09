package com.cretas.aims.dto.scheduling;

import lombok.Data;

import javax.validation.constraints.NotNull;

/**
 * 进度上报请求 DTO
 */
@Data
public class ProgressUpdateRequest {
    @NotNull(message = "已完成数量不能为空")
    private Double completedQty;

    private Double actualEfficiency; // 可选，件/小时
}
