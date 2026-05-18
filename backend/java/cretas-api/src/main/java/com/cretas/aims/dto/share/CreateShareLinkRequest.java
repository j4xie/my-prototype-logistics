package com.cretas.aims.dto.share;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for {@code POST /api/mobile/{factoryId}/share-links} (PR #872).
 *
 * <p>Steve's 2026-05-18 decision: NO email service. Backend just creates the
 * row + returns the share URL.
 */
@Data
@NoArgsConstructor
public class CreateShareLinkRequest {

    /** 'PurchaseOrder' | 'SalesOrder' — matches Java simple class name. */
    @NotBlank(message = "entityType 不能为空")
    @Pattern(regexp = "^(PurchaseOrder|SalesOrder)$",
            message = "entityType 必须是 PurchaseOrder 或 SalesOrder")
    private String entityType;

    @NotBlank(message = "entityId 不能为空")
    private String entityId;

    /**
     * 0 = permanent. UI presets: 7 / 30 (default) / 90 / 0 (permanent).
     * Defensive cap of ~10 years applied server-side.
     */
    @Min(value = 0, message = "expiresDays 不能为负")
    @Max(value = 3650, message = "expiresDays 不能超过 3650 天 (10 年)")
    private int expiresDays = 30;

    /** Default TRUE per Steve's decision (include prices unless explicitly toggled off). */
    private boolean includePrice = true;
}
