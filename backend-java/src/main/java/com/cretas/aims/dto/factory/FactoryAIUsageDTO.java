package com.cretas.aims.dto.factory;

import lombok.Builder;
import lombok.Data;

/**
 * 工厂AI使用情况DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Data
@Builder
public class FactoryAIUsageDTO {

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 工厂名称
     */
    private String factoryName;

    /**
     * 每周配额
     */
    private Integer weeklyQuota;

    /**
     * 当前周次（ISO 8601格式，例如: '2025-W44'）
     */
    private String currentWeek;

    /**
     * 本周已使用次数
     */
    private Long weeklyUsed;

    /**
     * 本周剩余次数
     */
    private Long weeklyRemaining;

    /**
     * 利用率（百分比，保留2位小数）
     */
    private String utilization;

    /**
     * 历史总使用次数
     */
    private Long totalUsed;

    /**
     * 配额状态
     */
    private QuotaStatus status;

    /**
     * 配额状态枚举
     */
    public enum QuotaStatus {
        NORMAL,      // 正常（使用率 < 80%）
        WARNING,     // 警告（使用率 >= 80% 且 < 100%）
        EXHAUSTED    // 已耗尽（使用率 >= 100%）
    }
}
