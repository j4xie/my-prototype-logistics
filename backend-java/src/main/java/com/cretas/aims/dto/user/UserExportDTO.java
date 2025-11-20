package com.cretas.aims.dto.user;

import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.write.style.ColumnWidth;
import com.alibaba.excel.annotation.write.style.ContentRowHeight;
import com.alibaba.excel.annotation.write.style.HeadRowHeight;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户导出DTO
 * 用于Excel导出，包含EasyExcel注解
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-20
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@HeadRowHeight(20)
@ContentRowHeight(18)
public class UserExportDTO {

    @ExcelProperty(value = "用户ID", index = 0)
    @ColumnWidth(10)
    private Integer id;

    @ExcelProperty(value = "用户名", index = 1)
    @ColumnWidth(15)
    private String username;

    @ExcelProperty(value = "全名", index = 2)
    @ColumnWidth(15)
    private String fullName;

    @ExcelProperty(value = "邮箱", index = 3)
    @ColumnWidth(25)
    private String email;

    @ExcelProperty(value = "手机号", index = 4)
    @ColumnWidth(15)
    private String phone;

    @ExcelProperty(value = "角色", index = 5)
    @ColumnWidth(15)
    private String roleDisplayName;

    @ExcelProperty(value = "部门", index = 6)
    @ColumnWidth(15)
    private String departmentDisplayName;

    @ExcelProperty(value = "职位", index = 7)
    @ColumnWidth(15)
    private String position;

    @ExcelProperty(value = "月薪", index = 8)
    @ColumnWidth(12)
    private BigDecimal monthlySalary;

    @ExcelProperty(value = "预期工作时长(分钟)", index = 9)
    @ColumnWidth(18)
    private Integer expectedWorkMinutes;

    @ExcelProperty(value = "状态", index = 10)
    @ColumnWidth(10)
    private String status;

    @ExcelProperty(value = "最后登录", index = 11)
    @ColumnWidth(20)
    private String lastLogin;

    @ExcelProperty(value = "创建时间", index = 12)
    @ColumnWidth(20)
    private String createdAt;

    /**
     * 从UserDTO转换为UserExportDTO
     */
    public static UserExportDTO fromUserDTO(UserDTO dto) {
        if (dto == null) {
            return null;
        }

        return UserExportDTO.builder()
                .id(dto.getId())
                .username(dto.getUsername())
                .fullName(dto.getFullName())
                .email(dto.getEmail())
                .phone(dto.getPhone())
                .roleDisplayName(dto.getRoleDisplayName())
                .departmentDisplayName(dto.getDepartmentDisplayName())
                .position(dto.getPosition())
                .monthlySalary(dto.getMonthlySalary())
                .expectedWorkMinutes(dto.getExpectedWorkMinutes())
                .status(Boolean.TRUE.equals(dto.getIsActive()) ? "激活" : "停用")
                .lastLogin(formatDateTime(dto.getLastLogin()))
                .createdAt(formatDateTime(dto.getCreatedAt()))
                .build();
    }

    private static String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        return dateTime.toString().replace('T', ' ');
    }
}
