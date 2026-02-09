package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;

import java.util.List;
import java.util.Map;

/**
 * Excel 数据持久化服务接口
 *
 * 负责将解析后的 Excel 数据保存到相应的数据表（sales_data/finance_data 等）。
 * 支持：
 * - 自动检测数据类型（销售/财务/部门）
 * - 根据字段映射转换数据
 * - 批量保存到数据库
 * - 返回保存结果统计
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
public interface ExcelDataPersistenceService {

    /**
     * 数据类型枚举
     */
    enum DataType {
        SALES("销售数据"),
        FINANCE("财务数据"),
        DEPARTMENT("部门数据"),
        UNKNOWN("未知数据");

        private final String displayName;

        DataType(String displayName) {
            this.displayName = displayName;
        }

        public String getDisplayName() {
            return displayName;
        }
    }

    /**
     * 持久化结果
     */
    class PersistenceResult {
        private boolean success;
        private DataType dataType;
        private int totalRows;
        private int savedRows;
        private int failedRows;
        private Long uploadId;
        private String message;
        private List<String> errors;

        // Getters and setters
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public DataType getDataType() { return dataType; }
        public void setDataType(DataType dataType) { this.dataType = dataType; }
        public int getTotalRows() { return totalRows; }
        public void setTotalRows(int totalRows) { this.totalRows = totalRows; }
        public int getSavedRows() { return savedRows; }
        public void setSavedRows(int savedRows) { this.savedRows = savedRows; }
        public int getFailedRows() { return failedRows; }
        public void setFailedRows(int failedRows) { this.failedRows = failedRows; }
        public Long getUploadId() { return uploadId; }
        public void setUploadId(Long uploadId) { this.uploadId = uploadId; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public List<String> getErrors() { return errors; }
        public void setErrors(List<String> errors) { this.errors = errors; }

        public static PersistenceResult success(DataType dataType, int savedRows, Long uploadId) {
            PersistenceResult result = new PersistenceResult();
            result.setSuccess(true);
            result.setDataType(dataType);
            result.setSavedRows(savedRows);
            result.setTotalRows(savedRows);
            result.setUploadId(uploadId);
            result.setMessage(String.format("成功保存 %d 条%s记录", savedRows, dataType.getDisplayName()));
            return result;
        }

        public static PersistenceResult failure(String message, List<String> errors) {
            PersistenceResult result = new PersistenceResult();
            result.setSuccess(false);
            result.setMessage(message);
            result.setErrors(errors);
            return result;
        }
    }

    /**
     * 根据解析结果自动检测数据类型
     *
     * @param parseResponse Excel 解析结果
     * @return 检测到的数据类型
     */
    DataType detectDataType(ExcelParseResponse parseResponse);

    /**
     * 保存解析后的 Excel 数据到数据库
     *
     * @param factoryId     工厂ID
     * @param parseResponse Excel 解析结果
     * @param dataType      数据类型（可选，如果为 null 则自动检测）
     * @return 持久化结果
     */
    PersistenceResult persistData(String factoryId, ExcelParseResponse parseResponse, DataType dataType);

    /**
     * 保存解析后的 Excel 数据到数据库（使用确认的字段映射）
     *
     * @param factoryId     工厂ID
     * @param parseResponse Excel 解析结果
     * @param confirmedMappings 用户确认的字段映射
     * @param dataType      数据类型
     * @return 持久化结果
     */
    PersistenceResult persistData(String factoryId,
                                   ExcelParseResponse parseResponse,
                                   List<FieldMappingResult> confirmedMappings,
                                   DataType dataType);

    /**
     * 删除指定上传ID关联的所有数据
     *
     * @param uploadId 上传记录ID
     * @return 删除的记录数
     */
    int deleteByUploadId(Long uploadId);

    /**
     * 获取支持的标准字段列表（用于字段映射）
     *
     * @param dataType 数据类型
     * @return 标准字段列表
     */
    List<String> getStandardFields(DataType dataType);
}
