package com.cretas.aims.dto.user;

import com.cretas.aims.entity.enums.Department;
import com.cretas.aims.entity.enums.FactoryUserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
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

    @Schema(description = "用户名", required = true)
    @NotBlank(message = "用户名不能为空")
    @Pattern(regexp = "^[a-zA-Z0-9_]{3,20}$", message = "用户名只能包含字母、数字和下划线，长度3-20")
    private String username;

    @Schema(description = "密码", required = true)
    @NotBlank(message = "密码不能为空")
    @Pattern(regexp = "^.{6,20}$", message = "密码长度必须在6-20之间")
    private String password;

    @Schema(description = "邮箱", required = true)
    @NotBlank(message = "邮箱不能为空")
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
}