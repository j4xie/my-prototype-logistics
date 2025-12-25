package com.cretas.aims.dto.traceability;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 溯源数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public class TraceabilityDTO {

    /**
     * 完整溯源链路响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FullTraceResponse {
        private ProductionInfo production;
        private List<MaterialInfo> materials;
        private List<QualityInfo> qualityInspections;
        private List<ShipmentInfo> shipments;
        private String traceCode;
        private LocalDateTime queryTime;
    }

    /**
     * 生产批次信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductionInfo {
        private String batchNumber;
        private String productName;
        private String productType;
        private LocalDate productionDate;
        private LocalDateTime completionTime;
        private String supervisorName;
        private String equipmentName;
        private Double quantity;
        private String unit;
        private String qualityStatus;
        private String factoryName;
        private String factoryId;
    }

    /**
     * 原材料溯源信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MaterialInfo {
        private String batchNumber;
        private String materialName;
        private String materialType;
        private String supplierName;
        private String supplierCode;
        private LocalDate receiptDate;
        private LocalDate expireDate;
        private Double quantity;
        private String unit;
        private String storageLocation;
        private String status;
    }

    /**
     * 质检溯源信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QualityInfo {
        private String inspectionId;
        private LocalDateTime inspectionDate;
        private String inspectorName;
        private String result;
        private Double passRate;
        private String conclusion;
        private String remarks;
    }

    /**
     * 出货溯源信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShipmentInfo {
        private String shipmentNumber;
        private LocalDate shipmentDate;
        private String customerName;
        private String logisticsCompany;
        private String trackingNumber;
        private String status;
        private Double quantity;
        private String unit;
    }

    /**
     * 公开溯源信息（消费者扫码查询，脱敏）
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PublicTraceResponse {
        private String productName;
        private String batchNumber;
        private LocalDate productionDate;
        private String factoryName;
        private String qualityStatus;
        private String certificationInfo;
        private List<PublicMaterialInfo> materials;
        private PublicQualityInfo qualityInspection;
        private String traceCode;
        private LocalDateTime queryTime;
        private Boolean isValid;
        private String message;
    }

    /**
     * 公开原材料信息（脱敏）
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PublicMaterialInfo {
        private String materialType;
        private String origin;
        private LocalDate receiptDate;
    }

    /**
     * 公开质检信息（脱敏）
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PublicQualityInfo {
        private LocalDateTime inspectionDate;
        private String result;
        private Double passRate;
    }

    /**
     * 基础溯源响应（批次级别）
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchTraceResponse {
        private ProductionInfo production;
        private Integer materialCount;
        private Integer inspectionCount;
        private Integer shipmentCount;
        private String qualityStatus;
        private LocalDateTime lastUpdateTime;
    }
}
