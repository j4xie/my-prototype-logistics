package com.cretas.aims.dto.smartbi;

import com.cretas.aims.entity.smartbi.enums.UploadStatus;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Upload history DTO for upload list display.
 * AUDIT-086: Extracted from SmartBIController inner class.
 */
@Data
@NoArgsConstructor
public class UploadHistoryDTO {
    private Long id;
    private String fileName;
    private String sheetName;
    private String tableType;
    private Integer rowCount;
    private Integer columnCount;
    private String status;
    private String createdAt;

    /** JPA projection constructor — used by JPQL `SELECT new UploadHistoryDTO(...)` */
    public UploadHistoryDTO(Long id, String fileName, String sheetName, String tableType,
                            Integer rowCount, Integer columnCount, UploadStatus uploadStatus,
                            LocalDateTime createdAt) {
        this.id = id;
        this.fileName = fileName;
        this.sheetName = sheetName;
        this.tableType = tableType;
        this.rowCount = rowCount;
        this.columnCount = columnCount;
        this.status = uploadStatus != null ? uploadStatus.name() : "UNKNOWN";
        this.createdAt = createdAt != null ? createdAt.toString() : null;
    }

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
