package com.cretas.aims.dto.user;

import com.cretas.aims.entity.enums.Department;
import com.cretas.aims.entity.enums.FactoryUserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "用户信息")
public class UserDTO {

    @Schema(description = "用户ID")
    private Integer id;

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "用户名")
    private String username;

    @Schema(description = "邮箱")
    private String email;

    @Schema(description = "手机号")
    private String phone;

    @Schema(description = "全名")
    private String fullName;

    @Schema(description = "是否激活")
    private Boolean isActive;

    @Schema(description = "角色代码")
    private FactoryUserRole roleCode;

    @Schema(description = "角色显示名称")
    private String roleDisplayName;

    @Schema(description = "部门")
    private Department department;

    @Schema(description = "部门显示名称")
    private String departmentDisplayName;

    @Schema(description = "职位")
    private String position;

    @Schema(description = "月薪")
    private BigDecimal monthlySalary;

    @Schema(description = "预期工作分钟数")
    private Integer expectedWorkMinutes;

    @Schema(description = "CCR费率")
    private BigDecimal ccrRate;

    @Schema(description = "最后登录时间")
    private LocalDateTime lastLogin;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}