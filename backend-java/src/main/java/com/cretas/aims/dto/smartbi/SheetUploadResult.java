package com.cretas.aims.dto.smartbi;

import com.cretas.aims.service.smartbi.SmartBIUploadFlowService.UploadFlowResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 单个 Sheet 上传结果 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SheetUploadResult {

    /**
     * Sheet 索引
     */
    private Integer sheetIndex;

    /**
     * Sheet 名称
     */
    private String sheetName;

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 处理消息
     */
    private String message;

    /**
     * 检测到的数据类型
     */
    private String detectedDataType;

    /**
     * 表格类型：index(索引/目录), data(数据), summary(汇总), metadata(元数据)
     */
    private String tableType;

    /**
     * 保存的行数
     */
    private Integer savedRows;

    /**
     * 上传记录 ID
     */
    private Long uploadId;

    /**
     * 完整的上传流程结果（可选，用于需要详细信息的场景）
     */
    private UploadFlowResult flowResult;

    /**
     * 是否需要用户确认字段映射
     */
    @Builder.Default
    private boolean requiresConfirmation = false;

    /**
     * 创建成功结果
     */
    public static SheetUploadResult success(Integer sheetIndex, String sheetName, UploadFlowResult flowResult) {
        // 从解析结果中获取 tableType (由 Python TableClassifier 识别)
        String tableType = null;
        if (flowResult.getParseResult() != null) {
            tableType = flowResult.getParseResult().getTableType();
        }

        return SheetUploadResult.builder()
                .sheetIndex(sheetIndex)
                .sheetName(sheetName)
                .success(true)
                .message(flowResult.getMessage())
                .detectedDataType(flowResult.getDetectedDataType())
                .tableType(tableType)
                .savedRows(flowResult.getPersistResult() != null ? flowResult.getPersistResult().getSavedRows() : 0)
                .uploadId(flowResult.getUploadId())
                .flowResult(flowResult)
                .requiresConfirmation(flowResult.isRequiresConfirmation())
                .build();
    }

    /**
     * 创建失败结果
     */
    public static SheetUploadResult failed(Integer sheetIndex, String sheetName, String errorMessage) {
        return SheetUploadResult.builder()
                .sheetIndex(sheetIndex)
                .sheetName(sheetName)
                .success(false)
                .message(errorMessage)
                .build();
    }
}
