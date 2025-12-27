package com.cretas.aims.dto.batch;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 批次员工信息响应DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchWorkerDTO {

    /**
     * 批次工作会话ID
     */
    private Long id;

    /**
     * 员工ID
     */
    private Long workerId;

    /**
     * 员工姓名
     */
    private String workerName;

    /**
     * 员工工号
     */
    private String employeeNumber;

    /**
     * 部门名称
     */
    private String departmentName;

    /**
     * 签入时间
     */
    private LocalDateTime checkInTime;

    /**
     * 签出时间
     */
    private LocalDateTime checkOutTime;

    /**
     * 工作分钟数
     */
    private Integer workMinutes;

    /**
     * 人工成本
     */
    private BigDecimal laborCost;

    /**
     * 状态：assigned, working, completed, cancelled
     */
    private String status;

    /**
     * 状态显示文字
     */
    private String statusText;

    /**
     * 分配人ID
     */
    private Long assignedBy;

    /**
     * 分配人姓名
     */
    private String assignerName;

    /**
     * 分配时间
     */
    private LocalDateTime assignedAt;

    /**
     * 备注
     */
    private String notes;

    /**
     * 获取状态显示文字
     */
    public String getStatusText() {
        if (statusText != null) {
            return statusText;
        }
        if (status == null) {
            return "未知";
        }
        switch (status) {
            case "assigned": return "已分配";
            case "working": return "工作中";
            case "completed": return "已完成";
            case "cancelled": return "已取消";
            default: return status;
        }
    }
}
