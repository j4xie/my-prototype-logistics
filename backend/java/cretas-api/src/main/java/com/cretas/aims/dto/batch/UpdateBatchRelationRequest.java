package com.cretas.aims.dto.batch;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 更新批次关联请求 DTO.
 *
 * <p>Rule 17.1 cleanup (Issue #384 batch 5): isolates the wire contract from
 * {@link com.cretas.aims.entity.BatchRelation} persistence model for
 * {@code PUT /api/mobile/{factoryId}/batch-relations/{id}}.
 *
 * <p>Per {@link com.cretas.aims.service.impl.BatchRelationServiceImpl#updateBatchRelation},
 * only the following fields are mutable (the service iterates each one with
 * an {@code if (... != null)} guard). All other entity fields
 * (productionBatchId, materialBatchId, relationType, usedAt, verification
 * state, factoryId, operatorId, audit timestamps) are NOT mutable through
 * this endpoint — preserving the underlying traceability link integrity.
 *
 * @author Cretas Team
 * @since 2026-05-11
 */
@Data
@Schema(description = "更新批次关联请求")
public class UpdateBatchRelationRequest {

    @Schema(description = "使用数量")
    @PositiveOrZero(message = "使用数量不能为负数")
    private BigDecimal quantityUsed;

    @Schema(description = "单位")
    @Size(max = 20, message = "单位长度不能超过20个字符")
    private String unit;

    @Schema(description = "批次位置/阶段")
    @Size(max = 50, message = "批次位置/阶段长度不能超过50个字符")
    private String stage;

    @Schema(description = "备注")
    @Size(max = 500, message = "备注长度不能超过500个字符")
    private String remarks;
}
