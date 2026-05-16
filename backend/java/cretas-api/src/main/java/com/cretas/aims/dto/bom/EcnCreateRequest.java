package com.cretas.aims.dto.bom;

import com.cretas.aims.entity.bom.EngineeringChangeNotice.EcnReason;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDate;
import java.util.List;

/**
 * Create-ECN request DTO (Sprint 3 Track-H / M-BOM-VER-1).
 *
 * <p>Used by {@code ECNService.create()}. Either {@code fromVersion=null} (first-version
 * creation) or {@code fromVersion>=1}. {@code toVersion} required (target version after ECN).
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EcnCreateRequest {

    @NotBlank
    private String factoryId;

    @NotBlank
    private String bomRecipeId;

    /** null = first version creation (no prior version). */
    private Integer fromVersion;

    @NotNull
    private Integer toVersion;

    @NotNull
    private EcnReason reason;

    private String reasonDetail;

    /** Effective date (historical orders before this still use prior BOM). */
    private LocalDate effectiveDate;

    /** Roles to notify on ECN events. Default: production / procurement / quality / sales. */
    private List<String> notifyRoles;

    /**
     * Optional pre-resolved {@code approval_chain_configs.id}. null = ECNService uses
     * hardcoded default chain until Track-I C-APPROVAL-EDITOR ships.
     */
    private String approvalChainId;

    /** Creator user id (typically Long via auth context). */
    private Long createdBy;
}
