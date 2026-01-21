package com.cretas.aims.dto.sop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SOP 上传请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SopUploadRequest {

    /**
     * 关联的 SKU 编码
     */
    private String skuCode;

    /**
     * 产品类型ID
     */
    private String productTypeId;

    /**
     * 是否自动分析复杂度
     */
    @Builder.Default
    private Boolean autoAnalyze = true;
}
