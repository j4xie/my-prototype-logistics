package com.cretas.aims.dto.bom;

import com.cretas.aims.entity.bom.EngineeringChangeNotice.EcnReason;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Batch-replace request: 物料 A → B 跨多 BOM (Sprint 3 Track-H).
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchReplaceRequest {

    @NotBlank private String factoryId;
    @NotBlank private String oldMaterialId;
    @NotBlank private String newMaterialId;

    /** If true, preserve existing standard_quantity / unit; only swap material reference. */
    @Builder.Default private boolean preserveQuantity = true;

    @Builder.Default private boolean allInFactory = false;
    private List<String> recipeIds;

    @NotNull private EcnReason ecnReason;
    private String ecnReasonDetail;
    private LocalDate effectiveDate;
    private Long createdBy;
}
