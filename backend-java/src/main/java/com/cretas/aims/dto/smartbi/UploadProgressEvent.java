package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 上传进度事件 DTO
 * 用于 SSE 流式推送处理进度
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UploadProgressEvent {

    /**
     * 事件类型
     */
    private EventType type;

    /**
     * 总体进度 (0-100)
     */
    private int progress;

    /**
     * 当前处理的 Sheet 索引
     */
    private Integer sheetIndex;

    /**
     * 当前处理的 Sheet 名称
     */
    private String sheetName;

    /**
     * 当前阶段
     */
    private String stage;

    /**
     * 详细消息
     */
    private String message;

    /**
     * 已完成的 Sheet 数量
     */
    private int completedSheets;

    /**
     * 总 Sheet 数量
     */
    private int totalSheets;

    /**
     * 字典命中数量（跳过 LLM）
     */
    private Integer dictionaryHits;

    /**
     * LLM 分析字段数量
     */
    private Integer llmAnalyzedFields;

    /**
     * 错误信息（如果有）
     */
    private String error;

    /**
     * 最终结果（完成时）
     */
    private BatchUploadResult result;

    public enum EventType {
        START,          // 开始处理
        SHEET_START,    // 开始处理某个 Sheet
        PARSING,        // 解析中
        FIELD_MAPPING,  // 字段映射中
        DICTIONARY_HIT, // 字典命中
        LLM_ANALYZING,  // LLM 分析中
        LLM_COMPLETE,   // LLM 分析完成
        PERSISTING,     // 持久化中
        CHART_GENERATING, // 图表生成中
        SHEET_COMPLETE, // Sheet 处理完成
        SHEET_FAILED,   // Sheet 处理失败
        COMPLETE,       // 全部完成
        ERROR           // 错误
    }

    // 便捷工厂方法
    public static UploadProgressEvent start(int totalSheets) {
        return UploadProgressEvent.builder()
                .type(EventType.START)
                .progress(5)
                .totalSheets(totalSheets)
                .stage("初始化")
                .message("开始处理 " + totalSheets + " 个 Sheet")
                .build();
    }

    public static UploadProgressEvent sheetStart(int sheetIndex, String sheetName, int total) {
        return UploadProgressEvent.builder()
                .type(EventType.SHEET_START)
                .sheetIndex(sheetIndex)
                .sheetName(sheetName)
                .totalSheets(total)
                .stage("开始处理")
                .message("开始处理 Sheet: " + sheetName)
                .build();
    }

    public static UploadProgressEvent parsing(int sheetIndex, String sheetName) {
        return UploadProgressEvent.builder()
                .type(EventType.PARSING)
                .sheetIndex(sheetIndex)
                .sheetName(sheetName)
                .stage("解析数据")
                .message("正在解析 " + sheetName + " 的数据...")
                .build();
    }

    public static UploadProgressEvent fieldMapping(int sheetIndex, String sheetName, int dictionaryHits, int llmFields) {
        return UploadProgressEvent.builder()
                .type(EventType.FIELD_MAPPING)
                .sheetIndex(sheetIndex)
                .sheetName(sheetName)
                .dictionaryHits(dictionaryHits)
                .llmAnalyzedFields(llmFields)
                .stage("字段映射")
                .message(String.format("字典命中 %d 个字段, %d 个需要 LLM 分析", dictionaryHits, llmFields))
                .build();
    }

    public static UploadProgressEvent llmAnalyzing(int sheetIndex, String sheetName, int fieldCount) {
        return UploadProgressEvent.builder()
                .type(EventType.LLM_ANALYZING)
                .sheetIndex(sheetIndex)
                .sheetName(sheetName)
                .llmAnalyzedFields(fieldCount)
                .stage("AI 分析")
                .message("正在调用 AI 分析 " + fieldCount + " 个字段...")
                .build();
    }

    public static UploadProgressEvent llmComplete(int sheetIndex, String sheetName, int savedToDict) {
        return UploadProgressEvent.builder()
                .type(EventType.LLM_COMPLETE)
                .sheetIndex(sheetIndex)
                .sheetName(sheetName)
                .stage("AI 分析完成")
                .message("AI 分析完成, " + savedToDict + " 个高置信度结果已保存到字典")
                .build();
    }

    public static UploadProgressEvent persisting(int sheetIndex, String sheetName, int rowCount) {
        return UploadProgressEvent.builder()
                .type(EventType.PERSISTING)
                .sheetIndex(sheetIndex)
                .sheetName(sheetName)
                .stage("保存数据")
                .message("正在保存 " + rowCount + " 行数据...")
                .build();
    }

    public static UploadProgressEvent sheetComplete(int sheetIndex, String sheetName, int completed, int total, int savedRows) {
        int progress = 10 + (int) ((completed * 80.0) / total);
        return UploadProgressEvent.builder()
                .type(EventType.SHEET_COMPLETE)
                .progress(progress)
                .sheetIndex(sheetIndex)
                .sheetName(sheetName)
                .completedSheets(completed)
                .totalSheets(total)
                .stage("Sheet 完成")
                .message(String.format("✓ %s 处理完成 (%d/%d), 保存 %d 行", sheetName, completed, total, savedRows))
                .build();
    }

    public static UploadProgressEvent sheetFailed(int sheetIndex, String sheetName, String error, int completed, int total) {
        int progress = 10 + (int) ((completed * 80.0) / total);
        return UploadProgressEvent.builder()
                .type(EventType.SHEET_FAILED)
                .progress(progress)
                .sheetIndex(sheetIndex)
                .sheetName(sheetName)
                .completedSheets(completed)
                .totalSheets(total)
                .stage("Sheet 失败")
                .error(error)
                .message("✗ " + sheetName + " 处理失败: " + error)
                .build();
    }

    public static UploadProgressEvent complete(BatchUploadResult result) {
        return UploadProgressEvent.builder()
                .type(EventType.COMPLETE)
                .progress(100)
                .completedSheets((int) result.getSuccessCount())
                .totalSheets(result.getTotalSheets())
                .stage("完成")
                .message(result.getMessage())
                .result(result)
                .build();
    }

    public static UploadProgressEvent error(String error) {
        return UploadProgressEvent.builder()
                .type(EventType.ERROR)
                .stage("错误")
                .error(error)
                .message("处理失败: " + error)
                .build();
    }
}
