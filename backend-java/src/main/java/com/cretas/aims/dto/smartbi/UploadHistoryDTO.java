package com.cretas.aims.dto.smartbi;

import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import lombok.Data;

/**
 * Upload history DTO for upload list display.
 * AUDIT-086: Extracted from SmartBIController inner class.
 */
@Data
public class UploadHistoryDTO {
    private Long id;
    private String fileName;
    private String sheetName;
    private String tableType;
    private Integer rowCount;
    private Integer columnCount;
    private String status;
    private String createdAt;

    public static UploadHistoryDTO fromEntity(SmartBiPgExcelUpload upload) {
        UploadHistoryDTO dto = new UploadHistoryDTO();
        dto.setId(upload.getId());
        dto.setFileName(upload.getFileName());
        dto.setSheetName(upload.getSheetName());
        dto.setTableType(upload.getDetectedTableType());
        dto.setRowCount(upload.getRowCount());
        dto.setColumnCount(upload.getColumnCount());
        dto.setStatus(upload.getUploadStatus() != null ? upload.getUploadStatus().name() : "UNKNOWN");
        dto.setCreatedAt(upload.getCreatedAt() != null ? upload.getCreatedAt().toString() : null);
        return dto;
    }
}
