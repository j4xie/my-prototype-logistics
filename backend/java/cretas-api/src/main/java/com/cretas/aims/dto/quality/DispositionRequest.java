package com.cretas.aims.dto.quality;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.Map;

/**
 * 质检处置请求 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Data
public class DispositionRequest {

    /**
     * 请求的处置动作
     */
    @NotNull(message = "处置动作不能为空")
    private String requestedAction;

    /**
     * 处置原因说明
     */
    private String reason;

    /**
     * 执行人ID (从Token中获取，可选传入)
     */
    private Long executorId;

    /**
     * 附加上下文
     */
    private Map<String, Object> context;
}
