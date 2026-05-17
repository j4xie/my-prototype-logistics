package com.cretas.aims.dto.bom;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

/**
 * Request DTO for ECN impact calculation (read-only, no ECN created).
 *
 * <p>Issue #712 fix (2026-05-17).
 *
 * @since 2026-05-17
 */
@Data
@Schema(description = "计算 ECN 影响范围请求体")
public class EcnImpactCalculateRequest {

    @Schema(description = "BomRecipe ID", required = true)
    @NotBlank(message = "bomRecipeId 不能为空")
    private String bomRecipeId;

    @Schema(description = "变更上下文 (任意 key/value, 供 service 自由解析)")
    private Map<String, Object> changeContext;
}
