package com.cretas.aims.dto.user;

import com.cretas.aims.entity.enums.Department;
import com.cretas.aims.entity.enums.FactoryUserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * 创建用户请求对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Schema(description = "创建用户请求")
public class CreateUserRequest {

    /**
     * Apr 20 Bug BR-13 fix: 去 @NotBlank. DTO 同时用于 create + update
     * (UserController.updateUser 第 78 行: @Valid @RequestBody CreateUserRequest).
     * 更新场景 frontend 只送 email/fullName/phone/roleCode, username=null 导致 @NotBlank
     * 误报. Create 场景改由 UserServiceImpl.createUser 显式校验 (line 67+ 已有 existsByUsername
     * 调用, 补 null/empty 判断即可).
     * Pattern 保留 — 如果 update 场景 frontend 真送了 username, 也该过校验.
     */
    @Schema(description = "用户名", required = true)
    @Pattern(regexp = "^[a-zA-Z0-9_]{3,20}$", message = "用户名只能包含字母、数字和下划线，长度3-20")
    private String username;

    @Schema(description = "密码（创建时必填，更新时可选）")
    private String password;

    @Schema(description = "邮箱（创建时必填，更新时可选）")
    @Email(message = "邮箱格式不正确")
    private String email;

    @Schema(description = "手机号")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @Schema(description = "全名")
    private String fullName;

    @Schema(description = "角色代码", required = true)
    private FactoryUserRole roleCode = FactoryUserRole.unactivated;

    @Schema(description = "部门")
    private Department department;

    @Schema(description = "职位")
    private String position;

    @Schema(description = "月薪")
    private BigDecimal monthlySalary;

    @Schema(description = "预期工作分钟数")
    private Integer expectedWorkMinutes;

    @Schema(description = "CCR费率")
    private BigDecimal ccrRate;

    @Schema(description = "工号", maxLength = 10)
    @Size(max = 10, message = "工号长度不能超过 10 个字符")
    private String employeeCode;

    /**
     * Apr 18 2026 Bug #57: 员工编辑时切换在职/离职 UI 操作不生效 — 前端已送 isActive,
     * 但 DTO 之前没这个字段导致 Jackson 直接丢弃。create 场景该字段可选 (默认
     * entity 用 true), update 场景 service 需按非 null 才更新 (不能 false 覆盖为 null)。
     */
    @Schema(description = "是否在职")
    private Boolean isActive;
}