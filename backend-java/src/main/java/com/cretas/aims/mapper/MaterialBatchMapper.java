package com.cretas.aims.mapper;

import com.cretas.aims.dto.material.CreateMaterialBatchRequest;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
/**
 * 原材料批次实体映射器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@Component
public class MaterialBatchMapper {
    /**
     * Entity 转 DTO
     */
    public MaterialBatchDTO toDTO(MaterialBatch batch) {
        if (batch == null) {
            return null;
        }
        MaterialBatchDTO dto = MaterialBatchDTO.builder()
                .id(batch.getId())
                .factoryId(batch.getFactoryId())
                .batchNumber(batch.getBatchNumber())
                .materialTypeId(batch.getMaterialTypeId())
                .supplierId(batch.getSupplierId())
                .receiptDate(batch.getReceiptDate())
                .expireDate(batch.getExpireDate())
                .receiptQuantity(batch.getReceiptQuantity())
                .quantityUnit(batch.getQuantityUnit())
                .weightPerUnit(batch.getWeightPerUnit())
                .totalWeight(batch.getTotalWeight())
                .currentQuantity(batch.getCurrentQuantity())
                .totalValue(batch.getTotalValue())
                .unitPrice(batch.getUnitPrice())
                .totalPrice(batch.getTotalPrice())
                .status(batch.getStatus())
                .statusDisplayName(batch.getStatus() != null ? batch.getStatus().getDisplayName() : null)
                .storageLocation(batch.getStorageLocation())
                .qualityCertificate(batch.getQualityCertificate())
                .notes(batch.getNotes())
                .createdBy(batch.getCreatedBy())
                .lastUsedAt(batch.getLastUsedAt())
                .createdAt(batch.getCreatedAt())
                .updatedAt(batch.getUpdatedAt())
                .build();
        // 设置原材料信息
        if (batch.getMaterialType() != null) {
            dto.setMaterialName(batch.getMaterialType().getName());
            dto.setMaterialCode(batch.getMaterialType().getCode());
            dto.setMaterialCategory(batch.getMaterialType().getCategory());
            dto.setUnit(batch.getMaterialType().getUnit());
        }
        // 设置供应商信息
        if (batch.getSupplier() != null) {
            dto.setSupplierName(batch.getSupplier().getName());
        }
        // 设置创建人信息
        if (batch.getCreatedByUser() != null) {
            dto.setCreatedByName(batch.getCreatedByUser().getFullName());
        }
        // 计算剩余天数
        if (batch.getExpireDate() != null) {
            long remainingDays = ChronoUnit.DAYS.between(LocalDate.now(), batch.getExpireDate());
            dto.setRemainingDays((int) remainingDays);
        }
        // 计算库存占用率
        if (batch.getReceiptQuantity() != null && batch.getReceiptQuantity().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal usedQuantity = batch.getReceiptQuantity().subtract(batch.getCurrentQuantity());
            BigDecimal usageRate = usedQuantity.divide(batch.getReceiptQuantity(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
            dto.setUsageRate(usageRate);
        }
        return dto;
    }

    /**
     * CreateRequest 转 Entity
     */
    public MaterialBatch toEntity(CreateMaterialBatchRequest request, String factoryId, Integer createdBy) {
        if (request == null) {
            return null;
        }
        MaterialBatch batch = new MaterialBatch();
        batch.setFactoryId(factoryId);
        batch.setBatchNumber(generateBatchNumber());
        batch.setMaterialTypeId(request.getMaterialTypeId());
        batch.setSupplierId(request.getSupplierId());
        batch.setReceiptDate(request.getReceiptDate());
        batch.setReceiptQuantity(request.getReceiptQuantity());
        batch.setQuantityUnit(request.getQuantityUnit());
        batch.setWeightPerUnit(request.getWeightPerUnit());
        // 注意: totalWeight, currentQuantity, totalQuantity, remainingQuantity, totalValue
        // 现在都是计算属性，不再需要手动设置

        // 计算单价并验证（以总价值为准）
        BigDecimal calculatedUnitPrice = request.getTotalValue()
            .divide(request.getTotalWeight(), 2, RoundingMode.HALF_UP);

        if (request.getUnitPrice() != null) {
            // 用户填写了单价，验证是否一致
            BigDecimal userUnitPrice = request.getUnitPrice();
            BigDecimal difference = calculatedUnitPrice.subtract(userUnitPrice).abs();
            BigDecimal tolerance = calculatedUnitPrice.multiply(new BigDecimal("0.05")); // 5%误差

            if (difference.compareTo(tolerance) > 0) {
                // 误差超过5%，记录警告
                BigDecimal diffPercent = difference.divide(calculatedUnitPrice, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
                log.warn("⚠️ 单价不一致: 用户填写={}元/kg, 系统计算={}元/kg, 差异={}%, 以总价值为准",
                    userUnitPrice, calculatedUnitPrice, diffPercent);

                // 添加备注说明
                String warningNote = String.format("[系统提示] 单价已按总价值自动计算为%.2f元/kg (用户填写%.2f元/kg存在%.2f%%差异)",
                    calculatedUnitPrice, userUnitPrice, diffPercent);
                String originalNotes = request.getNotes() != null ? request.getNotes() : "";
                batch.setNotes(originalNotes + (originalNotes.isEmpty() ? "" : "\n") + warningNote);
            }
        }

        // 始终使用计算值（以总价值为准）
        batch.setUnitPrice(calculatedUnitPrice);
        // 注意: totalPrice 现在是计算属性 (unitPrice × receiptQuantity)，不再需要手动设置
        batch.setStatus(MaterialBatchStatus.AVAILABLE);
        batch.setStorageLocation(request.getStorageLocation());
        batch.setQualityCertificate(request.getQualityCertificate());
        // notes已在上面的验证逻辑中设置（如果有警告的话）
        // 如果没有警告，使用原始notes
        if (batch.getNotes() == null) {
            batch.setNotes(request.getNotes());
        }
        batch.setCreatedBy(createdBy);

        // 设置到期日期（如果提供了）
        if (request.getExpireDate() != null) {
            batch.setExpireDate(request.getExpireDate());
        }

        return batch;
    }

    /**
     * 更新实体
     */
    public void updateEntity(MaterialBatch batch, CreateMaterialBatchRequest request) {
        if (request.getMaterialTypeId() != null) {
            batch.setMaterialTypeId(request.getMaterialTypeId());
        }
        if (request.getSupplierId() != null) {
            batch.setSupplierId(request.getSupplierId());
        }
        if (request.getReceiptDate() != null) {
            batch.setReceiptDate(request.getReceiptDate());
        }
        if (request.getTotalValue() != null) {
            // 注意: totalValue 现在是计算属性，不再存储
            // 根据 totalValue 反算 unitPrice
            if (batch.getTotalWeight() != null && batch.getTotalWeight().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal newUnitPrice = request.getTotalValue()
                    .divide(batch.getTotalWeight(), 2, RoundingMode.HALF_UP);
                batch.setUnitPrice(newUnitPrice);
            }
        }
        if (request.getUnitPrice() != null) {
            batch.setUnitPrice(request.getUnitPrice());
        }
        if (request.getStorageLocation() != null) {
            batch.setStorageLocation(request.getStorageLocation());
        }
        if (request.getQualityCertificate() != null) {
            batch.setQualityCertificate(request.getQualityCertificate());
        }
        if (request.getNotes() != null) {
            batch.setNotes(request.getNotes());
        }
    }

    /**
     * 生成批次号
     * 格式: MAT-YYYYMMDD-HHMMSS
     */
    private String generateBatchNumber() {
        LocalDateTime now = LocalDateTime.now();
        String dateStr = now.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String timeStr = now.format(DateTimeFormatter.ofPattern("HHmmss"));
        return String.format("MAT-%s-%s", dateStr, timeStr);
    }
}
