package com.cretas.aims.dto.scale;

import com.cretas.aims.entity.scale.ScaleBrandModel;
import lombok.*;

/**
 * 秤品牌型号 DTO
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScaleBrandModelDTO {

    private String id;
    private String brandCode;
    private String brandName;
    private String brandNameEn;
    private String modelCode;
    private String modelName;
    private String supportedProtocolIds;
    private String defaultProtocolId;
    private Boolean hasSerialPort;
    private Boolean hasWifi;
    private Boolean hasEthernet;
    private Boolean hasBluetooth;
    private Boolean hasUsb;
    private String weightRange;
    private String accuracy;
    private String scaleType;
    private String ipRating;
    private String material;
    private String manufacturer;
    private String manufacturerWebsite;
    private String priceRange;
    private Integer recommendationScore;
    private String recommendationReason;
    private String documentationUrl;
    private String imageUrl;
    private Boolean isRecommended;
    private Boolean isVerified;
    private String description;
    private Integer sortOrder;

    // ==================== 转换方法 ====================

    public static ScaleBrandModelDTO fromEntity(ScaleBrandModel entity) {
        if (entity == null) return null;

        return ScaleBrandModelDTO.builder()
                .id(entity.getId())
                .brandCode(entity.getBrandCode())
                .brandName(entity.getBrandName())
                .brandNameEn(entity.getBrandNameEn())
                .modelCode(entity.getModelCode())
                .modelName(entity.getModelName())
                .supportedProtocolIds(entity.getSupportedProtocolIds())
                .defaultProtocolId(entity.getDefaultProtocolId())
                .hasSerialPort(entity.getHasSerialPort())
                .hasWifi(entity.getHasWifi())
                .hasEthernet(entity.getHasEthernet())
                .hasBluetooth(entity.getHasBluetooth())
                .hasUsb(entity.getHasUsb())
                .weightRange(entity.getWeightRange())
                .accuracy(entity.getAccuracy())
                .scaleType(entity.getScaleType() != null ? entity.getScaleType().name() : null)
                .ipRating(entity.getIpRating())
                .material(entity.getMaterial())
                .manufacturer(entity.getManufacturer())
                .manufacturerWebsite(entity.getManufacturerWebsite())
                .priceRange(entity.getPriceRange())
                .recommendationScore(entity.getRecommendationScore())
                .recommendationReason(entity.getRecommendationReason())
                .documentationUrl(entity.getDocumentationUrl())
                .imageUrl(entity.getImageUrl())
                .isRecommended(entity.getIsRecommended())
                .isVerified(entity.getIsVerified())
                .description(entity.getDescription())
                .sortOrder(entity.getSortOrder())
                .build();
    }
}
