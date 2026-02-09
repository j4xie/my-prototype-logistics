package com.cretas.aims.dto.aps;

import com.cretas.aims.entity.enums.TriggerPriority;
import com.cretas.aims.entity.enums.TriggerType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 重排触发器 DTO
 * 描述单个触发重排的原因
 *
 * @author Cretas APS V1.0
 * @since 2026-01-21
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RescheduleTrigger {
    /**
     * 触发类型
     */
    private TriggerType type;

    /**
     * 触发优先级
     */
    private TriggerPriority priority;

    /**
     * 相关实体ID (任务ID、产线ID、订单ID等)
     */
    private String entityId;

    /**
     * 触发描述
     */
    private String description;
}
