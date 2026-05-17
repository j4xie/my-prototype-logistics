package com.cretas.aims.dto.template;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.Map;

/**
 * Request DTO for {@code POST /print/preview-template} (Sprint 3 Track-J Day 4).
 *
 * <p>Issue #712 fix (2026-05-17): replaces raw Map in PrintController. At least
 * one of {@code templateId} or {@code inlineSchemaJson} must be set —
 * cross-field check stays in the controller body since Bean Validation alone
 * cannot express "either/or" without a custom validator.
 *
 * @since 2026-05-17
 */
@Data
@Schema(description = "打印模板预览请求体")
public class PrintPreviewTemplateRequest {

    @Schema(description = "已保存模板 ID (与 inlineSchemaJson 二选一)",
            example = "11111111-2222-3333-4444-555555555555")
    private String templateId;

    @Schema(description = "内联 schema JSON (与 templateId 二选一)",
            example = "{\"type\":\"object\",\"properties\":{\"_printSchema\":{}}}")
    private String inlineSchemaJson;

    @Schema(description = "PRINT_* entity type", required = true, example = "PRINT_SALES_ORDER")
    @NotBlank(message = "entityType 不能为空")
    @Pattern(regexp = "PRINT_.+", message = "entityType 必须以 PRINT_ 前缀")
    private String entityType;

    @Schema(description = "实体 ID (Day 5+: 拉真实数据)")
    private String entityId;

    @Schema(description = "Mock 数据 (编辑器预览用)")
    private Map<String, Object> mockData;
}
