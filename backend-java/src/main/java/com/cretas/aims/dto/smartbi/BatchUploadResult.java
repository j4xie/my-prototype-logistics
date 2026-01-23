package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 批量 Sheet 上传结果 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchUploadResult {

    /**
     * 总 Sheet 数量
     */
    private int totalSheets;

    /**
     * 成功数量
     */
    private long successCount;

    /**
     * 失败数量
     */
    private long failedCount;

    /**
     * 需要确认数量（字段映射置信度不足）
     */
    private long requiresConfirmationCount;

    /**
     * 总保存行数
     */
    private int totalSavedRows;

    /**
     * 各 Sheet 的处理结果
     */
    private List<SheetUploadResult> results;

    /**
     * 整体处理消息
     */
    private String message;

    /**
     * 是否全部成功
     */
    public boolean isAllSuccess() {
        return failedCount == 0 && requiresConfirmationCount == 0;
    }

    /**
     * 是否部分成功
     */
    public boolean isPartialSuccess() {
        return successCount > 0 && (failedCount > 0 || requiresConfirmationCount > 0);
    }

    /**
     * 从结果列表构建
     */
    public static BatchUploadResult fromResults(List<SheetUploadResult> results) {
        long successCount = results.stream().filter(r -> r.isSuccess() && !r.isRequiresConfirmation()).count();
        long failedCount = results.stream().filter(r -> !r.isSuccess()).count();
        long requiresConfirmationCount = results.stream().filter(r -> r.isSuccess() && r.isRequiresConfirmation()).count();
        int totalSavedRows = results.stream()
                .filter(r -> r.isSuccess() && r.getSavedRows() != null)
                .mapToInt(SheetUploadResult::getSavedRows)
                .sum();

        String message;
        if (failedCount == 0 && requiresConfirmationCount == 0) {
            message = String.format("全部 %d 个 Sheet 处理成功，共保存 %d 行数据",
                    results.size(), totalSavedRows);
        } else if (successCount == 0 && requiresConfirmationCount == 0) {
            message = String.format("全部 %d 个 Sheet 处理失败", results.size());
        } else {
            message = String.format("%d 个成功，%d 个失败，%d 个待确认，共保存 %d 行数据",
                    successCount, failedCount, requiresConfirmationCount, totalSavedRows);
        }

        return BatchUploadResult.builder()
                .totalSheets(results.size())
                .successCount(successCount)
                .failedCount(failedCount)
                .requiresConfirmationCount(requiresConfirmationCount)
                .totalSavedRows(totalSavedRows)
                .results(results)
                .message(message)
                .build();
    }
}
