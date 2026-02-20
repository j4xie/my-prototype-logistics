package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Python Excel 解析请求 DTO
 *
 * 用于发送 Excel 文件到 Python 服务进行解析
 * 注意：实际文件通过 MultipartFile 发送，此 DTO 用于额外参数
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonExcelParseRequest {

    /**
     * 工厂 ID
     */
    private String factoryId;

    /**
     * 数据类型 (finance, sales, production, etc.)
     */
    private String dataType;

    /**
     * 要解析的 Sheet 名称 (可选，为空则解析所有)
     */
    private String sheetName;

    /**
     * 表头行号 (从 0 开始，默认 0)
     */
    @Builder.Default
    private Integer headerRow = 0;

    /**
     * 是否自动检测数据类型
     */
    @Builder.Default
    private Boolean autoDetectType = true;

    /**
     * 最大读取行数 (0 表示无限制)
     */
    @Builder.Default
    private Integer maxRows = 0;

    /**
     * 是否跳过空行
     */
    @Builder.Default
    private Boolean skipEmptyRows = true;

    /**
     * 日期格式 (用于解析日期列)
     */
    @Builder.Default
    private String dateFormat = "yyyy-MM-dd";
}
