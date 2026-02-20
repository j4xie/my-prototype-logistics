package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * AI 业务数据初始化响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIBusinessDataResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 消息
     */
    private String message;

    /**
     * 创建结果统计
     */
    private CreationStats stats;

    /**
     * 创建的产品类型 IDs
     */
    private List<String> createdProductTypeIds;

    /**
     * 创建的原材料类型 IDs
     */
    private List<String> createdMaterialTypeIds;

    /**
     * 创建的转换率 IDs
     */
    private List<String> createdConversionIds;

    /**
     * 创建结果统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreationStats {
        private int productTypesCreated;
        private int productTypesSkipped;
        private int materialTypesCreated;
        private int materialTypesSkipped;
        private int conversionsCreated;
        private int conversionsSkipped;
    }
}
