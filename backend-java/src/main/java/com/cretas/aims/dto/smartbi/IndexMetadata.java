package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 索引页元数据 DTO
 * 用于存储 Excel 文件中索引/目录页的信息
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IndexMetadata {

    /**
     * 是否存在索引页
     */
    private boolean hasIndex;

    /**
     * 索引页的 Sheet 索引
     */
    private Integer indexSheetIndex;

    /**
     * Sheet 映射列表
     */
    private List<IndexSheetMapping> sheetMappings;

    /**
     * 索引页 Sheet 映射
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IndexSheetMapping {
        /**
         * Sheet 索引
         */
        private int index;

        /**
         * 报表名称（从索引页提取）
         */
        private String reportName;

        /**
         * 原始 Sheet 名称
         */
        private String sheetName;

        /**
         * 编制说明（如有）
         */
        private String description;
    }

    /**
     * 创建空的索引元数据（无索引页）
     */
    public static IndexMetadata empty() {
        return IndexMetadata.builder()
                .hasIndex(false)
                .sheetMappings(List.of())
                .build();
    }
}
