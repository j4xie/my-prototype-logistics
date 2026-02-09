package com.cretas.aims.dto.scale;

import lombok.*;
import java.math.BigDecimal;

/**
 * 协议匹配结果 DTO
 * 用于自动识别协议类型
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProtocolMatchResult {

    /**
     * 协议ID
     */
    private String protocolId;

    /**
     * 协议编码
     */
    private String protocolCode;

    /**
     * 协议名称
     */
    private String protocolName;

    /**
     * 匹配置信度 (0-100)
     */
    private Integer confidence;

    /**
     * 匹配原因说明
     */
    private String matchReason;

    /**
     * 是否完全匹配
     */
    private Boolean exactMatch;

    /**
     * 测试解析结果 (如果可解析)
     */
    private ScaleDataParseResult testParseResult;

    /**
     * 推荐理由
     */
    private String recommendation;

    // ==================== 工厂方法 ====================

    public static ProtocolMatchResult exactMatch(String protocolId, String protocolCode, String protocolName) {
        return ProtocolMatchResult.builder()
                .protocolId(protocolId)
                .protocolCode(protocolCode)
                .protocolName(protocolName)
                .confidence(100)
                .exactMatch(true)
                .matchReason("数据帧格式完全匹配")
                .build();
    }

    public static ProtocolMatchResult partialMatch(String protocolId, String protocolCode, String protocolName, int confidence, String reason) {
        return ProtocolMatchResult.builder()
                .protocolId(protocolId)
                .protocolCode(protocolCode)
                .protocolName(protocolName)
                .confidence(confidence)
                .exactMatch(false)
                .matchReason(reason)
                .build();
    }
}
