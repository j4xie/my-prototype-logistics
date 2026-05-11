package com.cretas.aims.dto.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiDatasource;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DataSource DTO for SmartBI config UI (Apr 16 2026).
 *
 * Aligns field names with the frontend TypeScript interface:
 *   type: 'DATABASE' | 'API' | 'EXCEL' | 'CUSTOM'
 *   code, connectionConfig, refreshInterval, isActive, linkedUploadId
 *
 * <p><b>Issue #318 (Rule 17.1 anti-pattern fix, 2026-05-11):</b> {@code connectionConfig}
 * 是 PostgreSQL JSON 列, 空串 {@code ""} 不是合法 JSON, 反序列化后到 Hibernate 写
 * 库时抛 PSQLException → 之前被 controller {@code catch (Exception)} 吞成
 * 通用 500 "创建失败: 数据处理失败", 客户端无从定位。加 {@code @NotBlank}
 * 让 Bean Validation 在 controller 入口直接拦截, 由 GlobalExceptionHandler 返 400 +
 * 明确字段提示。POST 路径生效 (controller 已声明 {@code @Valid});
 * PUT 路径无 {@code @Valid} 标注, partial update 行为不变 (null 跳过, 非 null 才写)。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataSourceDTO {
    private Long id;
    private String factoryId;
    private String name;
    private String code;
    /** Frontend-friendly type: DATABASE / API / EXCEL / CUSTOM */
    private String type;
    private String description;
    @NotBlank(message = "数据源连接配置不能为空")
    private String connectionConfig;
    private Integer refreshInterval;
    private Boolean isActive;
    private Long linkedUploadId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static DataSourceDTO fromEntity(SmartBiDatasource e) {
        if (e == null) return null;
        return DataSourceDTO.builder()
                .id(e.getId())
                .factoryId(e.getFactoryId())
                .name(e.getName())
                .code(e.getCode())
                .type(e.getSourceType() != null ? e.getSourceType().toClientType() : null)
                .description(e.getDescription())
                .connectionConfig(e.getConnectionConfig())
                .refreshInterval(e.getRefreshInterval())
                .isActive(e.getIsActive())
                .linkedUploadId(e.getLinkedUploadId())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
