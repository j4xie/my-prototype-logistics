package com.cretas.aims.dto.processing;

import com.fasterxml.jackson.annotation.JsonAlias;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * 创建原材料接收记录请求 DTO.
 *
 * <p>Rule 17.1 cleanup (PR #370 audit, Issue #384 batch 4): isolates the
 * wire contract from {@link com.cretas.aims.entity.MaterialBatch}
 * persistence model for the {@code POST /api/mobile/{factoryId}/processing/material-receipt}
 * endpoint. Continues the sweep from PR #383 (batch 1: BomController), PR
 * #388 (batch 2: BOM /overhead), and PR #390 (batch 3: ProcessingController.createBatch).
 *
 * <p><b>Note on coexistence with {@link com.cretas.aims.dto.material.CreateMaterialBatchRequest}:</b>
 * {@code MaterialBatchController.createMaterialBatch} (POST /material-batches)
 * binds {@code CreateMaterialBatchRequest} and calls
 * {@code MaterialBatchService.createMaterialBatch(factoryId, request, userId)}
 * which returns a {@link com.cretas.aims.dto.material.MaterialBatchDTO}.
 * That is a fully separate code path. This DTO targets
 * {@link com.cretas.aims.service.ProcessingService#createMaterialReceipt(String, com.cretas.aims.entity.MaterialBatch)}
 * which has its own service-owned defaulting (status=AVAILABLE,
 * quantityUnit from materialType-or-"公斤", weightPerUnit=ONE, unitPrice=ZERO,
 * usedQuantity=ZERO, reservedQuantity=ZERO, purchaseDate=receiptDate).
 *
 * <p>Service-owned defaults filled by
 * {@link com.cretas.aims.service.impl.ProcessingServiceImpl#createMaterialReceipt} —
 * <em>not</em> replicated by the controller mapper (single source of truth):
 * <ul>
 *   <li>{@code factoryId} — auto-filled from {@code @PathVariable}</li>
 *   <li>{@code status} — service forces
 *       {@link com.cretas.aims.entity.enums.MaterialBatchStatus#AVAILABLE}</li>
 *   <li>{@code receiptQuantity} — copied from initialQuantity (alias of
 *       receiptQuantity itself), guarded by service NPE check</li>
 *   <li>{@code usedQuantity} / {@code reservedQuantity} — forced to {@code ZERO}</li>
 *   <li>{@code quantityUnit} — derived from {@code materialType.unit} if
 *       materialType resolves, else default {@code "公斤"} when wire field absent</li>
 *   <li>{@code purchaseDate} — synced from {@code receiptDate} if wire field absent</li>
 *   <li>{@code weightPerUnit} — defaults to {@code BigDecimal.ONE} if absent</li>
 *   <li>{@code unitPrice} — defaults to {@code BigDecimal.ZERO} if absent</li>
 *   <li>{@code id} / {@code version} — DB IDENTITY / JPA managed</li>
 *   <li>{@code createdAt} / {@code updatedAt} / {@code deletedAt} —
 *       {@link com.cretas.aims.entity.BaseEntity} audit</li>
 *   <li>{@code createdBy} — set by Controller from JWT token (when provided)</li>
 * </ul>
 *
 * <p><b>FE wire format aliases</b> (per {@code processingApiClient.recordMaterialReceipt}
 * and {@code MaterialReceiptScreen.tsx}):
 * <ul>
 *   <li>{@code quantity} → {@code receiptQuantity} (FE legacy field name)</li>
 *   <li>{@code receivedDate} → {@code receiptDate} (FE legacy field name)</li>
 *   <li>{@code unit} → {@code quantityUnit} (FE legacy field name)</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-05-11
 */
@Data
@Schema(description = "创建原材料接收记录请求")
public class CreateMaterialReceiptRequest {

    @Schema(description = "批次号", example = "MB-F001-ABC123", required = true)
    @Size(max = 50, message = "批次号长度不能超过50个字符")
    private String batchNumber;

    @Schema(description = "原材料类型ID", required = true)
    @Size(max = 100, message = "原材料类型ID长度不能超过100个字符")
    private String materialTypeId;

    @Schema(description = "供应商ID")
    @Size(max = 100, message = "供应商ID长度不能超过100个字符")
    private String supplierId;

    @Schema(description = "入库日期 (FE 字段 receivedDate 兼容)")
    @JsonAlias("receivedDate")
    private LocalDate receiptDate;

    @Schema(description = "生产日期 (可选)")
    private LocalDate productionDate;

    @Schema(description = "到期日期 (可选)")
    private LocalDate expireDate;

    @Schema(description = "入库数量 (FE 字段 quantity 兼容)", required = true, example = "500")
    @NotNull(message = "入库数量不能为空")
    @DecimalMin(value = "0.01", message = "入库数量必须大于0")
    @JsonAlias({"quantity", "inboundQuantity", "initialQuantity"})
    private BigDecimal receiptQuantity;

    @Schema(description = "数量单位 (FE 字段 unit 兼容, 可选 — 服务端按 materialType 推断, 兜底 '公斤')",
            example = "kg")
    @JsonAlias("unit")
    @Size(max = 20, message = "数量单位长度不能超过20个字符")
    private String quantityUnit;

    @Schema(description = "每单位重量 kg (可选, 服务端缺省 1.0)")
    @PositiveOrZero(message = "每单位重量不能为负数")
    private BigDecimal weightPerUnit;

    @Schema(description = "单价 元 (可选, 服务端缺省 0)")
    @PositiveOrZero(message = "单价不能为负数")
    private BigDecimal unitPrice;

    @Schema(description = "存储位置")
    @Size(max = 100, message = "存储位置长度不能超过100个字符")
    private String storageLocation;

    @Schema(description = "质量证书/质量等级")
    @JsonAlias("qualityGrade")
    @Size(max = 100, message = "质量证书长度不能超过100个字符")
    private String qualityCertificate;

    @Schema(description = "备注")
    private String notes;

    @Schema(description = "仓库ID (D1 双仓流转, 可选)")
    @Size(max = 64, message = "仓库ID长度不能超过64个字符")
    private String warehouseId;

    @Schema(description = "Canvas 动态字段值")
    private Map<String, Object> customFields;
}
