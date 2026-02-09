package com.cretas.aims.dto.scale;

import com.cretas.aims.entity.scale.ScaleProtocolConfig;
import lombok.*;

/**
 * 秤协议配置 DTO
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScaleProtocolDTO {

    private String id;
    private String factoryId;
    private String protocolCode;
    private String protocolName;
    private String connectionType;
    private String serialConfig;
    private String apiConfig;
    private String frameFormat;
    private String parsingRuleGroup;
    private String checksumType;
    private String readMode;
    private Integer stableThresholdMs;
    private String modbusConfig;
    private String documentationUrl;
    private String sampleDataHex;
    private Boolean isActive;
    private Boolean isVerified;
    private Boolean isBuiltin;
    private String description;

    // ==================== 转换方法 ====================

    public static ScaleProtocolDTO fromEntity(ScaleProtocolConfig entity) {
        if (entity == null) return null;

        return ScaleProtocolDTO.builder()
                .id(entity.getId())
                .factoryId(entity.getFactoryId())
                .protocolCode(entity.getProtocolCode())
                .protocolName(entity.getProtocolName())
                .connectionType(entity.getConnectionType() != null ? entity.getConnectionType().name() : null)
                .serialConfig(entity.getSerialConfig())
                .apiConfig(entity.getApiConfig())
                .frameFormat(entity.getFrameFormat())
                .parsingRuleGroup(entity.getParsingRuleGroup())
                .checksumType(entity.getChecksumType() != null ? entity.getChecksumType().name() : null)
                .readMode(entity.getReadMode() != null ? entity.getReadMode().name() : null)
                .stableThresholdMs(entity.getStableThresholdMs())
                .modbusConfig(entity.getModbusConfig())
                .documentationUrl(entity.getDocumentationUrl())
                .sampleDataHex(entity.getSampleDataHex())
                .isActive(entity.getIsActive())
                .isVerified(entity.getIsVerified())
                .isBuiltin(entity.getIsBuiltin())
                .description(entity.getDescription())
                .build();
    }
}
