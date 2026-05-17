package com.cretas.aims.dto.bom;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request DTO for creating a BomVersion DRAFT.
 *
 * <p>Issue #712 fix (2026-05-17): replaces raw {@code Map<String, Object>}
 * in {@code BomVersionController.createDraft} with a typed payload so
 * malformed input returns 400 instead of 500 NPE.
 *
 * @since 2026-05-17
 */
@Data
@Schema(description = "创建 BomVersion DRAFT 请求体")
public class CreateBomDraftRequest {

    @Schema(description = "BomRecipe ID", required = true,
            example = "11111111-2222-3333-4444-555555555555")
    @NotBlank(message = "bomRecipeId 不能为空")
    private String bomRecipeId;

    @Schema(description = "创建者 user ID (可选, 缺省由 controller 从 JWT 拿)", example = "1")
    private Long createdBy;
}
