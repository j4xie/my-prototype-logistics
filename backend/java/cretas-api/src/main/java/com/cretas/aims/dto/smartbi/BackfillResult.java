package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Backfill result DTO for field definition backfill operations.
 * AUDIT-086: Extracted from SmartBIController inner class.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BackfillResult {
    private Long uploadId;
    private String status;  // "success", "skipped", "failed"
    private int fieldsCreated;
    private String message;

    public static BackfillResult success(Long uploadId, int fieldsCreated) {
        return BackfillResult.builder()
                .uploadId(uploadId)
                .status("success")
                .fieldsCreated(fieldsCreated)
                .message("成功创建 " + fieldsCreated + " 个字段定义")
                .build();
    }

    public static BackfillResult skipped(Long uploadId, String reason) {
        return BackfillResult.builder()
                .uploadId(uploadId)
                .status("skipped")
                .fieldsCreated(0)
                .message(reason)
                .build();
    }

    public static BackfillResult failed(Long uploadId, String error) {
        return BackfillResult.builder()
                .uploadId(uploadId)
                .status("failed")
                .fieldsCreated(0)
                .message(error)
                .build();
    }
}
