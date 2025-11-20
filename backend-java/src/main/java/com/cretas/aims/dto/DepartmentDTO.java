package com.cretas.aims.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import javax.validation.constraints.*;
import java.time.LocalDateTime;

/**
 * 部门数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-19
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentDTO {

    private Integer id;

    private String factoryId;

    @NotBlank(message = "部门名称不能为空")
    @Size(max = 100, message = "部门名称不能超过100个字符")
    private String name;

    @Size(max = 50, message = "部门编码不能超过50个字符")
    private String code;

    @Size(max = 500, message = "描述不能超过500个字符")
    private String description;

    private Integer managerUserId;

    private String managerName; // 负责人姓名（关联查询）

    private Integer parentDepartmentId;

    private String parentDepartmentName; // 父部门名称（关联查询）

    private Boolean isActive;

    @Min(value = 0, message = "显示顺序不能为负数")
    private Integer displayOrder;

    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$|^$", message = "颜色格式不正确，应为#RRGGBB格式")
    private String color;

    @Size(max = 50, message = "图标名称不能超过50个字符")
    private String icon;

    private Integer createdBy;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    // 扩展字段（统计信息）
    private Long employeeCount; // 部门员工数量
}
