package com.cretas.aims.dto.platform;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 工厂详情DTO
 * 用于平台管理员查看和管理工厂信息
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "工厂详情响应")
public class FactoryDTO {

    @Schema(description = "工厂ID", example = "FISH_2025_001")
    private String id;

    @Schema(description = "工厂名称", example = "白垩纪水产品工厂")
    private String name;

    @Schema(description = "行业代码", example = "FISH")
    private String industryCode;

    @Schema(description = "地区代码", example = "2025")
    private String regionCode;

    @Schema(description = "工厂地址", example = "北京市朝阳区")
    private String address;

    @Schema(description = "联系人姓名", example = "张三")
    private String contactName;

    @Schema(description = "联系电话", example = "13800138000")
    private String contactPhone;

    @Schema(description = "联系邮箱", example = "contact@factory.com")
    private String contactEmail;

    @Schema(description = "订阅计划", example = "PREMIUM")
    private String subscriptionPlan;

    @Schema(description = "AI每周配额", example = "50")
    private Integer aiWeeklyQuota;

    @Schema(description = "是否激活", example = "true")
    private Boolean isActive;

    @Schema(description = "创建时间", example = "2025-01-01T00:00:00")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间", example = "2025-01-01T00:00:00")
    private LocalDateTime updatedAt;
}
