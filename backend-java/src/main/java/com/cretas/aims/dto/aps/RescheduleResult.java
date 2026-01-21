package com.cretas.aims.dto.aps;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 重排执行结果 DTO
 *
 * @author Cretas APS V1.0
 * @since 2026-01-21
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RescheduleResult {
    /**
     * 排程批次号
     */
    private String scheduleBatchNo;

    /**
     * 重排的任务数量
     */
    private int rescheduledTaskCount;

    /**
     * 重排前准时率
     */
    private double beforeOnTimeRate;

    /**
     * 重排后预期准时率
     */
    private double afterOnTimeRate;

    /**
     * 改善百分比
     */
    private double improvementPercent;

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 消息
     */
    private String message;

    /**
     * 便捷构造函数
     */
    public RescheduleResult(String scheduleBatchNo, int rescheduledTaskCount,
                            double beforeOnTimeRate, double afterOnTimeRate, double improvementPercent) {
        this.scheduleBatchNo = scheduleBatchNo;
        this.rescheduledTaskCount = rescheduledTaskCount;
        this.beforeOnTimeRate = beforeOnTimeRate;
        this.afterOnTimeRate = afterOnTimeRate;
        this.improvementPercent = improvementPercent;
        this.success = true;
        this.message = "重排成功";
    }
}
