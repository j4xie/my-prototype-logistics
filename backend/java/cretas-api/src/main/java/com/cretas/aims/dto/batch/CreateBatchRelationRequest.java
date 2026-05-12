package com.cretas.aims.dto.batch;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 创建批次关联请求 DTO.
 *
 * <p>Rule 17.1 cleanup (Issue #384 batch 5): isolates the wire contract from
 * {@link com.cretas.aims.entity.BatchRelation} persistence model for
 * {@code POST /api/mobile/{factoryId}/batch-relations}.
 * Continues the sweep from PR #383 (batch 1: BomController),
 * PR #388 (batch 2: BOM /overhead), PR #390 (batch 3: ProcessingController.createBatch),
 * PR #391 (batch 4: ProcessingController.createMaterialReceipt).
 *
 * <p>Service-owned defaults filled by
 * {@link com.cretas.aims.service.impl.BatchRelationServiceImpl#createBatchRelation} —
 * <em>not</em> replicated by the controller mapper (single source of truth):
 * <ul>
 *   <li>{@code factoryId} — set in Controller from {@code @PathVariable}</li>
 *   <li>{@code operatorId} — set in Controller from {@code @RequestAttribute("userId")}</li>
 *   <li>{@code id} — service generates {@code UUID.randomUUID().toString()} if absent</li>
 *   <li>{@code relationType} — service defaults to {@code "INPUT"} if absent</li>
 *   <li>{@code verified} — service forces {@code false} on creation</li>
 *   <li>{@code usedAt} — service defaults to {@code LocalDateTime.now()} if absent</li>
 *   <li>{@code verifiedAt} / {@code verifiedBy} — set later via {@code verifyRelation} flow</li>
 *   <li>{@code createdAt} / {@code updatedAt} / {@code deletedAt} —
 *       {@link com.cretas.aims.entity.BaseEntity} audit</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-05-11
 */
@Data
@Schema(description = "创建批次关联请求")
public class CreateBatchRelationRequest {

    @Schema(description = "生产批次ID（输出批次）", example = "12345", required = true)
    @NotNull(message = "生产批次ID不能为空")
    private Long productionBatchId;

    @Schema(description = "原材料批次ID（输入批次）", example = "MB-F001-ABC123", required = true)
    @NotBlank(message = "原材料批次ID不能为空")
    @Size(max = 50, message = "原材料批次ID长度不能超过50个字符")
    private String materialBatchId;

    @Schema(description = "关联类型 INPUT/OUTPUT/REWORK/BLEND (可选, 服务端缺省 INPUT)")
    @Size(max = 20, message = "关联类型长度不能超过20个字符")
    private String relationType;

    @Schema(description = "使用数量", example = "50.500")
    @PositiveOrZero(message = "使用数量不能为负数")
    private BigDecimal quantityUsed;

    @Schema(description = "单位", example = "kg")
    @Size(max = 20, message = "单位长度不能超过20个字符")
    private String unit;

    @Schema(description = "使用时间 (可选, 服务端缺省 now)")
    private LocalDateTime usedAt;

    @Schema(description = "批次位置/阶段")
    @Size(max = 50, message = "批次位置/阶段长度不能超过50个字符")
    private String stage;

    @Schema(description = "备注")
    @Size(max = 500, message = "备注长度不能超过500个字符")
    private String remarks;

    /**
     * Optional explicit ID override. When absent (typical case), the service
     * generates {@code UUID.randomUUID().toString()}.
     */
    @Schema(description = "关联ID (可选, 服务端缺省 UUID)")
    @Size(max = 50, message = "关联ID长度不能超过50个字符")
    private String id;
}
