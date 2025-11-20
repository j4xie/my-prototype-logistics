package com.cretas.aims.dto.platform;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.*;

/**
 * 创建工厂请求DTO
 * 用于平台管理员创建新工厂
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "创建工厂请求")
public class CreateFactoryRequest {

    @NotBlank(message = "工厂名称不能为空")
    @Size(min = 2, max = 100, message = "工厂名称长度必须在2-100之间")
    @Schema(description = "工厂名称", example = "白垩纪水产品工厂", required = true)
    private String name;

    @NotBlank(message = "行业代码不能为空")
    @Pattern(regexp = "^[A-Z]{2,10}$", message = "行业代码必须为2-10位大写字母")
    @Schema(description = "行业代码", example = "FISH", required = true)
    private String industryCode;

    @NotBlank(message = "地区代码不能为空")
    @Pattern(regexp = "^[0-9]{4}$", message = "地区代码必须为4位数字")
    @Schema(description = "地区代码", example = "2025", required = true)
    private String regionCode;

    @Size(max = 255, message = "地址长度不能超过255字符")
    @Schema(description = "工厂地址", example = "北京市朝阳区")
    private String address;

    @Size(max = 50, message = "联系人姓名长度不能超过50字符")
    @Schema(description = "联系人姓名", example = "张三")
    private String contactName;

    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "联系电话格式不正确")
    @Schema(description = "联系电话", example = "13800138000")
    private String contactPhone;

    @Email(message = "邮箱格式不正确")
    @Size(max = 100, message = "邮箱长度不能超过100字符")
    @Schema(description = "联系邮箱", example = "contact@factory.com")
    private String contactEmail;

    @Pattern(regexp = "^(BASIC|STANDARD|PREMIUM|ENTERPRISE)$", message = "订阅计划必须为BASIC、STANDARD、PREMIUM或ENTERPRISE")
    @Schema(description = "订阅计划", example = "PREMIUM", allowableValues = {"BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"})
    private String subscriptionPlan;

    @Min(value = 0, message = "AI每周配额不能小于0")
    @Max(value = 1000, message = "AI每周配额不能大于1000")
    @Schema(description = "AI每周配额", example = "50")
    private Integer aiWeeklyQuota;

    @Schema(description = "是否激活", example = "true")
    private Boolean isActive;
}
