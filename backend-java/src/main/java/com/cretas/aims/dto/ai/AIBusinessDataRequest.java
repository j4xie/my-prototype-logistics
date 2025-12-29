package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * AI 业务数据初始化请求 DTO
 * 用于接收 AI 生成的业务数据建议
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIBusinessDataRequest {

    /**
     * 产品类型列表
     */
    private List<ProductTypeData> productTypes;

    /**
     * 原材料类型列表
     */
    private List<MaterialTypeData> materialTypes;

    /**
     * 转换率配置列表
     */
    private List<ConversionRateData> conversionRates;

    /**
     * 产品类型数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductTypeData {
        private String code;
        private String name;
        private String category;
        private String unit;
        private String description;
        private Integer productionTimeMinutes;
        private Integer shelfLifeDays;
    }

    /**
     * 原材料类型数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MaterialTypeData {
        private String code;
        private String name;
        private String category;
        private String unit;
        private String storageType;
        private Integer shelfLifeDays;
        private String description;
    }

    /**
     * 转换率数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConversionRateData {
        private String materialTypeCode;
        private String productTypeCode;
        private Double rate;
        private Double wastageRate;
        private String description;
    }
}
