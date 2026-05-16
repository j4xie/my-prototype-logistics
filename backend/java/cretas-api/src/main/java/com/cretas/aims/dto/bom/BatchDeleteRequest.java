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
 * Batch-delete request: 多 BOM 同一物料全删 (Sprint 3 Track-H).
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchDeleteRequest {

    @NotBlank private String factoryId;
    @NotBlank private String materialId;

    @Builder.Default private boolean allInFactory = false;
    private List<String> recipeIds;

    @NotNull private EcnReason ecnReason;
    private String ecnReasonDetail;
    private LocalDate effectiveDate;
    private Long createdBy;
}
