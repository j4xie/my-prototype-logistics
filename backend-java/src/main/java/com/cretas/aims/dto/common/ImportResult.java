package com.cretas.aims.dto.common;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 批量导入结果对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-20
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "批量导入结果对象")
public class ImportResult<T> implements Serializable {

    @Schema(description = "导入总数", example = "100")
    private Integer totalCount;

    @Schema(description = "成功导入数量", example = "95")
    private Integer successCount;

    @Schema(description = "失败数量", example = "5")
    private Integer failureCount;

    @Schema(description = "成功导入的数据列表")
    private List<T> successData;

    @Schema(description = "失败详情列表")
    private List<FailureDetail> failureDetails;

    @Schema(description = "导入是否完全成功", example = "false")
    private Boolean isFullSuccess;

    /**
     * 失败详情
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "导入失败详情")
    public static class FailureDetail implements Serializable {
        @Schema(description = "行号", example = "3")
        private Integer rowNumber;

        @Schema(description = "失败原因", example = "客户名称已存在")
        private String reason;

        @Schema(description = "原始数据（JSON格式）")
        private String rawData;

        // Manual getters and setters (Lombok @Data not working)
        public Integer getRowNumber() {
            return rowNumber;
        }

        public void setRowNumber(Integer rowNumber) {
            this.rowNumber = rowNumber;
        }

        public String getReason() {
            return reason;
        }

        public void setReason(String reason) {
            this.reason = reason;
        }

        public String getRawData() {
            return rawData;
        }

        public void setRawData(String rawData) {
            this.rawData = rawData;
        }
    }

    /**
     * 创建初始导入结果
     */
    public static <T> ImportResult<T> create(Integer totalCount) {
        ImportResult<T> result = new ImportResult<>();
        result.setTotalCount(totalCount);
        result.setSuccessCount(0);
        result.setFailureCount(0);
        result.setSuccessData(new ArrayList<>());
        result.setFailureDetails(new ArrayList<>());
        result.setIsFullSuccess(false);
        return result;
    }

    /**
     * 添加成功记录
     */
    public void addSuccess(T data) {
        this.successData.add(data);
        this.successCount = this.successData.size();
        updateFullSuccessStatus();
    }

    /**
     * 添加失败记录
     */
    public void addFailure(Integer rowNumber, String reason, String rawData) {
        FailureDetail detail = new FailureDetail(rowNumber, reason, rawData);
        this.failureDetails.add(detail);
        this.failureCount = this.failureDetails.size();
        updateFullSuccessStatus();
    }

    /**
     * 更新完全成功状态
     */
    private void updateFullSuccessStatus() {
        this.isFullSuccess = (this.failureCount == 0 && this.successCount > 0);
    }

    // Manual getters and setters (Lombok @Data not working)
    public Integer getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(Integer totalCount) {
        this.totalCount = totalCount;
    }

    public Integer getSuccessCount() {
        return successCount;
    }

    public void setSuccessCount(Integer successCount) {
        this.successCount = successCount;
    }

    public Integer getFailureCount() {
        return failureCount;
    }

    public void setFailureCount(Integer failureCount) {
        this.failureCount = failureCount;
    }

    public List<T> getSuccessData() {
        return successData;
    }

    public void setSuccessData(List<T> successData) {
        this.successData = successData;
    }

    public List<FailureDetail> getFailureDetails() {
        return failureDetails;
    }

    public void setFailureDetails(List<FailureDetail> failureDetails) {
        this.failureDetails = failureDetails;
    }

    public Boolean getIsFullSuccess() {
        return isFullSuccess;
    }

    public void setIsFullSuccess(Boolean isFullSuccess) {
        this.isFullSuccess = isFullSuccess;
    }
}
