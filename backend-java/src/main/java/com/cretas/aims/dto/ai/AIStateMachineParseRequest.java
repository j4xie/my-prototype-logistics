package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import java.util.Map;

/**
 * AI 状态机解析请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIStateMachineParseRequest {

    /**
     * 用户自然语言描述
     * 例如: "质检单有待检、合格、不合格三个状态，不合格可以申请复检"
     */
    @NotBlank(message = "用户输入不能为空")
    private String userInput;

    /**
     * 实体类型
     * QualityInspection, ProcessingBatch, Shipment, etc.
     */
    @NotBlank(message = "实体类型不能为空")
    private String entityType;

    /**
     * 工厂ID (可选)
     */
    private String factoryId;

    /**
     * 上下文信息 (可选)
     */
    private Map<String, Object> context;
}
