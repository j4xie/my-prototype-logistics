package com.joolun.mall.dto;

import lombok.Data;
import java.util.List;

/**
 * 批量行为事件DTO
 */
@Data
public class BehaviorBatchDTO {
    /**
     * 事件列表
     */
    private List<BehaviorEventDTO> events;

    /**
     * 会话ID (可选，批量事件共用)
     */
    private String sessionId;
}
