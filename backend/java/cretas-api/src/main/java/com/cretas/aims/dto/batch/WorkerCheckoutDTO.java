package com.cretas.aims.dto.batch;

import lombok.Data;

/**
 * 员工完成批次工作请求DTO
 */
@Data
public class WorkerCheckoutDTO {

    /**
     * 工作分钟数（可选）
     * 不传则自动根据checkIn和checkOut时间计算
     */
    private Integer workMinutes;

    /**
     * 备注（可选）
     */
    private String notes;
}
