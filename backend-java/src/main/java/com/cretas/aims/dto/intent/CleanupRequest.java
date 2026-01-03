package com.cretas.aims.dto.intent;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * 清理低效关键词的请求DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CleanupRequest {

    /**
     * Wilson Score 阈值，低于此值的关键词将被清理
     */
    private Double threshold;

    /**
     * 最小负面反馈次数，达到此次数的关键词将被清理
     */
    private Integer minNegative;
}
