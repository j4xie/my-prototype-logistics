package com.cretas.aims.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import javax.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
/**
 * 工作类型数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkTypeDTO {
    private String id;
    private String factoryId;
    @NotBlank(message = "工作类型名称不能为空")
    @Size(max = 50, message = "工作类型名称不能超过50个字符")
    private String name;
    @Size(max = 20, message = "工作类型代码不能超过20个字符")
    private String code;
    @Size(max = 500, message = "描述不能超过500个字符")
    private String description;
    @Size(max = 50, message = "部门名称不能超过50个字符")
    private String department;
    private String billingType; // HOURLY, PIECE, DAILY, MONTHLY
    @DecimalMin(value = "0.0", inclusive = false, message = "基础费率必须大于0")
    @DecimalMax(value = "999999.99", message = "基础费率不能超过999999.99")
    private BigDecimal baseRate;
    @DecimalMin(value = "1.0", message = "加班倍率不能小于1")
    @DecimalMax(value = "9.99", message = "加班倍率不能超过9.99")
    private BigDecimal overtimeRateMultiplier;
    @DecimalMin(value = "1.0", message = "假期倍率不能小于1")
    @DecimalMax(value = "9.99", message = "假期倍率不能超过9.99")
    private BigDecimal holidayRateMultiplier;
    @DecimalMin(value = "1.0", message = "夜班倍率不能小于1")
    @DecimalMax(value = "9.99", message = "夜班倍率不能超过9.99")
    private BigDecimal nightShiftRateMultiplier;
    @Min(value = 0, message = "危险等级不能小于0")
    @Max(value = 5, message = "危险等级不能大于5")
    private Integer hazardLevel;
    private Boolean certificationRequired;
    private String requiredSkills;
    private Boolean isActive;
    private Boolean isDefault;
    @Min(value = 0, message = "显示顺序不能为负数")
    private Integer displayOrder;
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$|^$", message = "颜色格式不正确")
    private String color;
    @Size(max = 50, message = "图标名称不能超过50个字符")
    private String icon;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    // 计算字段
    private Integer activeEmployeeCount;
    private BigDecimal totalWorkHours;
    private BigDecimal averageWorkHours;
    /**
     * 工作类型统计信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkTypeStats {
        private Integer totalTypes;
        private Integer activeTypes;
        private Integer inactiveTypes;
        private Map<String, Integer> typesByDepartment;
        private Map<String, Integer> typesByBillingType;
        private Map<Integer, Integer> typesByHazardLevel;
        private Integer typesRequiringCertification;
        private List<WorkTypeUsage> mostUsedTypes;
        private List<WorkTypeUsage> leastUsedTypes;
        @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
        private LocalDateTime lastUpdated;
    }

    /**
     * 工作类型使用情况
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkTypeUsage {
        private Integer workTypeId;
        private String workTypeName;
        private Integer usageCount;
        private BigDecimal totalHours;
        private Integer employeeCount;
        private BigDecimal totalPaid;
    }

    /**
     * 显示顺序更新
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DisplayOrderUpdate {
        @NotNull(message = "工作类型ID不能为空")
        private String id;
        @NotNull(message = "显示顺序不能为空")
        @Min(value = 0, message = "显示顺序不能为负数")
        private Integer displayOrder;
    }

    /**
     * 批量更新请求
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchUpdateRequest {
        @NotEmpty(message = "工作类型ID列表不能为空")
        private List<String> ids;
        private String operation; // ACTIVATE, DEACTIVATE, DELETE
        private Map<String, Object> updates;
    }

    /**
     * 工资计算请求
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PayCalculationRequest {
        @NotNull(message = "工作时长不能为空")
        @DecimalMin(value = "0", message = "工作时长不能为负数")
        private BigDecimal regularHours;
        @DecimalMin(value = "0", message = "加班时长不能为负数")
        private BigDecimal overtimeHours;
        @DecimalMin(value = "0", message = "假期时长不能为负数")
        private BigDecimal holidayHours;
        @DecimalMin(value = "0", message = "夜班时长不能为负数")
        private BigDecimal nightShiftHours;
        private BigDecimal pieceCount; // 计件数量（如果是计件工资）
    }

    /**
     * 工资计算结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PayCalculationResult {
        private BigDecimal regularPay;
        private BigDecimal overtimePay;
        private BigDecimal holidayPay;
        private BigDecimal nightShiftPay;
        private BigDecimal totalPay;
        private BigDecimal hazardAllowance;
        private Map<String, BigDecimal> breakdown;
    }
}
